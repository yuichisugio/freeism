import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Hono } from "hono";

import {
  verifyPointsResourceRequest,
  type PointsOAuthResourceConfig,
} from "../../src/backend/auth/resource-token-introspection";
import { createPointsLinkAttempt } from "../../src/backend/usecases/create-points-link-attempt";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { importPointPackages } from "../../src/backend/usecases/import-point-packages";
import { deactivatePointsConnection } from "../../src/backend/usecases/deactivate-points-connection";
import { bindPointsLinkAttemptFromOAuthState } from "../../src/backend/usecases/bind-points-link-attempt-from-oauth-state";
import { finalizePointsLinkAttempt } from "../../src/backend/usecases/finalize-points-link-attempt";
import { readPointsConnection } from "../../src/backend/usecases/read-points-connection";
import type { BackendContext, Bindings } from "../../src/backend/http/context";
import { registerOAuthResourceRoutes } from "../../src/backend/http/routes/oauth-resource-routes";

const db = env.DB!;
const marketsClientId = "markets-points-client";

const resourceConfig: PointsOAuthResourceConfig = {
  allowedScopes: ["points.connection.read", "points.balance.read"],
  audience: "https://points.example.test/api/v1",
  db,
  issuer: "https://points.example.test/api/auth",
  jwksUrl: "https://points.example.test/api/auth/jwks",
  kind: "USER",
};

describe("Points OAuth resource core", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(async () => {
    await db.exec(
      "DELETE FROM points_oauth_revocation_outbox; DELETE FROM points_oauth_connection_deactivation; DELETE FROM points_oauth_connection; DELETE FROM points_oauth_link_attempt; DELETE FROM admin_membership; DELETE FROM oauth_client;",
    );
    const now = Date.now();
    await db
      .prepare(
        "INSERT INTO oauth_client (id, client_id, redirect_uris, disabled) VALUES (?, ?, ?, 0)",
      )
      .bind("oauth_client_markets", marketsClientId, "[]")
      .run();
    for (const suffix of ["1", "expired"]) {
      await db
        .prepare(
          "INSERT OR IGNORE INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
        )
        .bind(
          `oauth_user_${suffix}`,
          `OAuth ${suffix}`,
          `oauth-${suffix}@example.invalid`,
          now,
          now,
        )
        .run();
      await db
        .prepare(
          "INSERT OR IGNORE INTO points_user (id, auth_user_id, account_status, created_at) VALUES (?, ?, 'ACTIVE', ?)",
        )
        .bind(`pusr_${suffix}`, `oauth_user_${suffix}`, now)
        .run();
    }
  });

  it("uses standard JWT verification and derives only an allowed USER principal", async () => {
    let verifyOptions: Record<string, unknown> | undefined;
    const request = new Request("https://points.example.test/api/v1/me/connection", {
      headers: { Authorization: "DPoP header.payload.signature" },
    });
    const principal = await verifyPointsResourceRequest(
      request,
      resourceConfig,
      ["points.connection.read"],
      async (_input, options) => {
        verifyOptions = options;
        return {
          aud: resourceConfig.audience,
          client_id: marketsClientId,
          exp: Math.floor(Date.now() / 1000) + 60,
          iss: resourceConfig.issuer,
          scope: "points.connection.read",
          sub: "oauth_user_1",
        };
      },
    );

    expect(principal).toEqual({
      clientId: marketsClientId,
      issuer: resourceConfig.issuer,
      kind: "USER",
      scopes: ["points.connection.read"],
      subject: "oauth_user_1",
    });
    expect(verifyOptions).toEqual({
      jwksUrl: resourceConfig.jwksUrl,
      requiredScopes: ["points.connection.read"],
      verifyOptions: { audience: resourceConfig.audience, issuer: resourceConfig.issuer },
    });
  });

  it("separates USER and M2M principals with the same client ID", async () => {
    const request = new Request("https://points.example.test/api/v1/me/connection", {
      headers: { Authorization: "DPoP header.payload.signature" },
    });
    const m2mConfig: PointsOAuthResourceConfig = {
      ...resourceConfig,
      allowedScopes: ["points.reservations.status"],
      kind: "M2M",
    };
    const base = {
      aud: resourceConfig.audience,
      client_id: marketsClientId,
      exp: Math.floor(Date.now() / 1000) + 60,
      iss: resourceConfig.issuer,
    };
    const userToken = { ...base, scope: "points.connection.read", sub: "oauth_user_1" };
    const m2mToken = { ...base, scope: "points.reservations.status", sub: marketsClientId };
    const verify = (payload: Record<string, unknown>) => async () => payload;

    await expect(
      verifyPointsResourceRequest(
        request,
        resourceConfig,
        ["points.connection.read"],
        verify(userToken),
      ),
    ).resolves.toMatchObject({
      clientId: marketsClientId,
      kind: "USER",
      subject: "oauth_user_1",
    });
    await expect(
      verifyPointsResourceRequest(
        request,
        m2mConfig,
        ["points.reservations.status"],
        verify(m2mToken),
      ),
    ).resolves.toMatchObject({ clientId: marketsClientId, kind: "M2M" });

    const rejected = [
      [resourceConfig, ["points.connection.read"], { ...userToken, sub: undefined }],
      [m2mConfig, ["points.reservations.status"], { ...m2mToken, sub: "oauth_user_1" }],
      [resourceConfig, [], { ...userToken, scope: "points.reservations.status" }],
      [m2mConfig, [], { ...m2mToken, scope: "points.connection.read" }],
    ] as const;
    for (const [config, requiredScopes, payload] of rejected) {
      await expect(
        verifyPointsResourceRequest(request, config, requiredScopes, verify(payload)),
      ).rejects.toThrow("INVALID_ACCESS_TOKEN");
    }
  });

  it("rejects deleted clients, closed users, mismatched clients and opaque bearer responses", async () => {
    const base = {
      aud: resourceConfig.audience,
      client_id: marketsClientId,
      exp: Math.floor(Date.now() / 1000) + 60,
      iss: resourceConfig.issuer,
      scope: "points.connection.read",
      sub: "oauth_user_1",
    };
    for (const response of [{ ...base, client_id: "other-client" }]) {
      await expect(
        verifyPointsResourceRequest(
          new Request("https://points.example.test/api/v1/me/connection", {
            headers: { Authorization: "DPoP header.payload.signature" },
          }),
          resourceConfig,
          ["points.connection.read"],
          async () => response,
        ),
      ).rejects.toThrow("INVALID_ACCESS_TOKEN");
    }
    await db
      .prepare("UPDATE points_user SET account_status = 'CLOSED' WHERE auth_user_id = ?")
      .bind("oauth_user_1")
      .run();
    await expect(
      verifyPointsResourceRequest(
        new Request("https://points.example.test/api/v1/me/connection", {
          headers: { Authorization: "DPoP header.payload.signature" },
        }),
        resourceConfig,
        ["points.connection.read"],
        async () => base,
      ),
    ).rejects.toThrow("INVALID_ACCESS_TOKEN");
    await db
      .prepare("UPDATE points_user SET account_status = 'ACTIVE' WHERE auth_user_id = ?")
      .bind("oauth_user_1")
      .run();
    await db.prepare("DELETE FROM oauth_client WHERE client_id = ?").bind(marketsClientId).run();
    await expect(
      verifyPointsResourceRequest(
        new Request("https://points.example.test/api/v1/me/connection", {
          headers: { Authorization: "DPoP header.payload.signature" },
        }),
        resourceConfig,
        ["points.connection.read"],
        async () => base,
      ),
    ).rejects.toThrow("INVALID_ACCESS_TOKEN");
    await expect(
      verifyPointsResourceRequest(
        new Request("https://points.example.test/api/v1/me/connection", {
          headers: { Authorization: "Bearer opaque-access-token" },
        }),
        resourceConfig,
        ["points.connection.read"],
        async () => base,
      ),
    ).rejects.toThrow("INVALID_ACCESS_TOKEN");
  });

  it("converges a bound PENDING link attempt to one ACTIVE connection", async () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const attempt = await createPointsLinkAttempt(db, {
      expiresAt: new Date(now.getTime() + 600_000),
      idempotencyKey: "idem-link-1",
      marketsUserId: "musr_1",
      m2mClientId: marketsClientId,
      payloadHash: `sha256:${"a".repeat(64)}`,
      pointsUserId: "pusr_1",
      requestedScopes: ["points.connection.read", "points.balance.read"],
      stateHash: `sha256:${"1".repeat(64)}`,
      userClientId: marketsClientId,
      now,
    });
    expect(attempt.status).toBe("PENDING_MARKETS_CONFIRMATION");

    const connection = await finalizePointsLinkAttempt(db, {
      attemptPayloadHash: `sha256:${"a".repeat(64)}`,
      idempotencyKey: "idem-finalize-1",
      issuer: "https://points.example.test/api/auth",
      linkAttemptId: attempt.linkAttemptId,
      marketsPointsConnectionId: "mpc_1",
      m2mClientId: marketsClientId,
      outcome: "CONFIRM",
      pointsSubject: "oauth_user_1",
      userClientId: marketsClientId,
      now: new Date(now.getTime() + 1_000),
    });
    expect(connection).toMatchObject({
      marketsUserId: "musr_1",
      m2mClientId: marketsClientId,
      status: "ACTIVE",
      userClientId: marketsClientId,
    });

    const linkedConnection = await readPointsConnection(db, {
      issuer: "https://points.example.test/api/auth",
      pointsSubject: "oauth_user_1",
      userClientId: marketsClientId,
    });
    expect(linkedConnection).toMatchObject({
      grantVersion: 1,
      grantedScopes: ["points.balance.read", "points.connection.read"],
      issuer: "https://points.example.test/api/auth",
      pointsConnectionId: expect.stringMatching(/^pcn_/),
      status: "ACTIVE",
      subject: "oauth_user_1",
    });

    await db
      .prepare(
        "INSERT INTO admin_membership (id, points_user_id, role, created_at) VALUES (?, ?, 'ADMIN', ?)",
      )
      .bind("admin_1", "pusr_1", Date.now())
      .run();
    const app = new Hono<BackendContext>();
    registerOAuthResourceRoutes(app, async () => ({
      clientId: marketsClientId,
      issuer: "https://points.example.test/api/auth",
      kind: "USER",
      scopes: ["points.connection.read"],
      subject: "oauth_user_1",
    }));
    const url = "http://localhost:3000/api/v1/me/admin-membership";
    const active = await app.request(
      url,
      { headers: { Authorization: "Bearer valid" } },
      env as Bindings,
    );
    expect(active.status).toBe(200);
    await expect(active.json()).resolves.toMatchObject({ data: { isAdmin: true } });

    await db
      .prepare("UPDATE points_oauth_connection SET status = 'UNLINKED' WHERE id = ?")
      .bind(linkedConnection.pointsConnectionId)
      .run();
    const unlinked = await app.request(
      url,
      { headers: { Authorization: "Bearer valid" } },
      env as Bindings,
    );
    expect(unlinked.status).toBe(401);
    await expect(unlinked.json()).resolves.toMatchObject({ code: "INVALID_ACCESS_TOKEN" });
  });

  it("cancels expired attempts and does not create a connection", async () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const attempt = await createPointsLinkAttempt(db, {
      expiresAt: new Date(now.getTime() + 1),
      idempotencyKey: "idem-link-expired",
      marketsUserId: "musr_expired",
      m2mClientId: marketsClientId,
      payloadHash: `sha256:${"b".repeat(64)}`,
      pointsUserId: "pusr_expired",
      requestedScopes: ["points.connection.read"],
      stateHash: `sha256:${"2".repeat(64)}`,
      userClientId: marketsClientId,
      now,
    });
    await expect(
      finalizePointsLinkAttempt(db, {
        attemptPayloadHash: `sha256:${"b".repeat(64)}`,
        idempotencyKey: "idem-finalize-expired",
        issuer: "https://points.example.test/api/auth",
        linkAttemptId: attempt.linkAttemptId,
        marketsPointsConnectionId: "mpc_expired",
        m2mClientId: marketsClientId,
        outcome: "CONFIRM",
        pointsSubject: "pairwise-expired",
        userClientId: marketsClientId,
        now: new Date(now.getTime() + 2),
      }),
    ).rejects.toThrow("LINK_ATTEMPT_EXPIRED");
  });

  it("reconfirms the same connection after refresh expiry while keeping its identity", async () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const createAttempt = async (suffix: string, pointsUserId = "pusr_1") =>
      createPointsLinkAttempt(db, {
        expiresAt: new Date(now.getTime() + 600_000),
        idempotencyKey: `reauth-${suffix}`,
        marketsUserId: "musr_1",
        m2mClientId: marketsClientId,
        payloadHash: `sha256:${suffix.repeat(64)}`,
        pointsUserId,
        requestedScopes:
          suffix === "a"
            ? ["points.connection.read"]
            : ["points.connection.read", "points.balance.read"],
        stateHash: `sha256:${suffix.repeat(64)}`,
        userClientId: marketsClientId,
        now,
      });
    const confirm = (linkAttemptId: string, suffix: string, pointsSubject = "oauth_user_1") =>
      finalizePointsLinkAttempt(db, {
        attemptPayloadHash: `sha256:${suffix.repeat(64)}`,
        idempotencyKey: `reauth-confirm-${suffix}`,
        issuer: "https://points.example.test",
        linkAttemptId,
        marketsPointsConnectionId: "mpc_reauth",
        m2mClientId: marketsClientId,
        outcome: "CONFIRM",
        pointsSubject,
        userClientId: marketsClientId,
        now: new Date(now.getTime() + 1_000),
      });

    const firstAttempt = await createAttempt("a");
    const first = await confirm(firstAttempt.linkAttemptId, "a");
    if (first.status !== "ACTIVE") throw new Error("expected active connection");
    const secondAttempt = await createAttempt("b");
    const reauthorized = await confirm(secondAttempt.linkAttemptId, "b");
    expect(reauthorized).toMatchObject({
      pointsConnectionId: first.pointsConnectionId,
      marketsPointsConnectionId: "mpc_reauth",
      grantedScopes: ["points.balance.read", "points.connection.read"],
      grantVersion: 2,
      status: "ACTIVE",
    });
    await expect(confirm(secondAttempt.linkAttemptId, "b")).resolves.toMatchObject({
      pointsConnectionId: first.pointsConnectionId,
      grantVersion: 2,
    });
    expect(
      await db.prepare("SELECT count(*) AS count FROM points_oauth_connection").first(),
    ).toEqual({ count: 1 });

    const wrongIdentityAttempt = await createAttempt("c", "pusr_expired");
    await expect(
      confirm(wrongIdentityAttempt.linkAttemptId, "c", "oauth_user_expired"),
    ).rejects.toThrow("LINK_ATTEMPT_MISMATCH");
  });

  it("replays only the same finalization outcome and payload", async () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const attempt = await createPointsLinkAttempt(db, {
      expiresAt: new Date(now.getTime() + 600_000),
      idempotencyKey: "idem-link-replay",
      marketsUserId: "musr_replay",
      m2mClientId: marketsClientId,
      payloadHash: `sha256:${"c".repeat(64)}`,
      pointsUserId: "pusr_1",
      requestedScopes: ["points.connection.read"],
      stateHash: `sha256:${"3".repeat(64)}`,
      userClientId: marketsClientId,
      now,
    });
    const confirm = {
      attemptPayloadHash: `sha256:${"c".repeat(64)}`,
      idempotencyKey: "idem-finalize-replay",
      issuer: "https://points.example.test/api/auth",
      linkAttemptId: attempt.linkAttemptId,
      marketsPointsConnectionId: "mpc_replay",
      m2mClientId: marketsClientId,
      outcome: "CONFIRM" as const,
      pointsSubject: "pairwise-replay",
      userClientId: marketsClientId,
      now: new Date(now.getTime() + 1_000),
    };
    await expect(finalizePointsLinkAttempt(db, confirm)).resolves.toMatchObject({
      marketsPointsConnectionId: "mpc_replay",
      status: "ACTIVE",
    });
    await expect(finalizePointsLinkAttempt(db, confirm)).resolves.toMatchObject({
      marketsPointsConnectionId: "mpc_replay",
      status: "ACTIVE",
    });
    await expect(finalizePointsLinkAttempt(db, { ...confirm, outcome: "CANCEL" })).rejects.toThrow(
      "LINK_ATTEMPT_ALREADY_FINALIZED",
    );
  });

  it("replays the same CANCEL receipt without changing its timestamp", async () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const attempt = await createPointsLinkAttempt(db, {
      expiresAt: new Date(now.getTime() + 600_000),
      idempotencyKey: "idem-link-cancel-replay",
      marketsUserId: "musr_cancel_replay",
      m2mClientId: marketsClientId,
      payloadHash: `sha256:${"d".repeat(64)}`,
      pointsUserId: "pusr_1",
      requestedScopes: ["points.connection.read"],
      stateHash: `sha256:${"4".repeat(64)}`,
      userClientId: marketsClientId,
      now,
    });
    const cancel = {
      attemptPayloadHash: `sha256:${"d".repeat(64)}`,
      idempotencyKey: "idem-finalize-cancel-replay",
      linkAttemptId: attempt.linkAttemptId,
      marketsPointsConnectionId: "mpc_cancel_replay",
      m2mClientId: marketsClientId,
      outcome: "CANCEL" as const,
      now: new Date(now.getTime() + 1_000),
    };
    const first = await finalizePointsLinkAttempt(db, cancel);
    const replay = await finalizePointsLinkAttempt(db, {
      ...cancel,
      now: new Date(now.getTime() + 2_000),
    });
    expect(replay).toEqual(first);
  });

  it("deactivates an ACTIVE connection once and enqueues consent revocation", async () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const attempt = await createPointsLinkAttempt(db, {
      expiresAt: new Date(now.getTime() + 600_000),
      idempotencyKey: "idem-link-deactivate",
      marketsUserId: "musr_deactivate",
      m2mClientId: marketsClientId,
      payloadHash: `sha256:${"e".repeat(64)}`,
      pointsUserId: "pusr_1",
      requestedScopes: ["points.connection.read", "points.connection.unlink"],
      stateHash: `sha256:${"5".repeat(64)}`,
      userClientId: marketsClientId,
      now,
    });
    const connection = await finalizePointsLinkAttempt(db, {
      attemptPayloadHash: `sha256:${"e".repeat(64)}`,
      idempotencyKey: "idem-finalize-deactivate",
      issuer: "https://points.example.test/api/auth",
      linkAttemptId: attempt.linkAttemptId,
      marketsPointsConnectionId: "mpc_deactivate",
      m2mClientId: marketsClientId,
      outcome: "CONFIRM",
      pointsSubject: "pairwise-deactivate",
      userClientId: marketsClientId,
      now: new Date(now.getTime() + 1_000),
    });
    if (connection.status === "CANCELLED") throw new Error("expected active connection");
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    const input = {
      idempotencyKey: "idem-deactivate",
      issuer: "https://points.example.test/api/auth",
      now: new Date(now.getTime() + 2_000),
      pointsConnectionId: connection.pointsConnectionId,
      pointsSubject: "pairwise-deactivate",
      reason: "user requested unlink",
      requestId: "req_deactivate",
      userClientId: marketsClientId,
    };
    const [first, replay] = await Promise.all([
      deactivatePointsConnection(db, input),
      deactivatePointsConnection(db, input),
    ]);
    expect(replay).toEqual(first);
    expect(first).toMatchObject({ grantVersion: 2, status: "UNLINKED" });
    expect(
      await db
        .prepare(
          "SELECT action, status FROM points_oauth_revocation_outbox WHERE points_connection_id = ?",
        )
        .bind(connection.pointsConnectionId)
        .first(),
    ).toEqual({ action: "DELETE_CONSENT", status: "PENDING" });
    const auditLogs = logs.mock.calls
      .map(([log]) => log)
      .filter((log) => log.operation === "POINTS_CONNECTION_DEACTIVATE");
    expect(auditLogs).toEqual([
      expect.objectContaining({
        operation: "POINTS_CONNECTION_DEACTIVATE",
        outcome: "SUCCESS",
        requestId: input.requestId,
      }),
    ]);
    expect(JSON.stringify(auditLogs)).not.toContain(input.reason);
    expect(JSON.stringify(auditLogs)).not.toContain(input.pointsConnectionId);
    await expect(
      deactivatePointsConnection(db, { ...input, pointsSubject: "other-subject" }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  it("mounts every protected interservice route and enforces the 1 MiB M2M body limit", async () => {
    const app = new Hono<BackendContext>();
    registerOAuthResourceRoutes(app, async (_request, _bindings, kind, scopes) =>
      kind === "M2M"
        ? {
            clientId: marketsClientId,
            issuer: "http://localhost:3000/api/auth",
            kind: "M2M",
            scopes: [...scopes],
          }
        : {
            clientId: marketsClientId,
            issuer: "http://localhost:3000/api/auth",
            kind: "USER",
            scopes: [...scopes],
            subject: "route-confirmed-subject",
          },
    );
    expect(app.routes.map(({ method, path }) => `${method} ${path}`).sort()).toEqual(
      [
        "GET /api/v1/me/admin-membership",
        "GET /api/v1/me/connection",
        "POST /api/v1/me/balance-checks",
        "POST /api/v1/me/connection-deactivations",
        "POST /api/v1/me/point-reservations",
        "POST /api/v1/oauth/link-attempts",
        "POST /api/v1/oauth/link-attempts/:linkAttemptId/finalizations",
        "POST /api/v1/point-package-auction-eligibility-checks",
        "POST /api/v1/point-reservations/release",
        "POST /api/v1/point-reservations/status",
        "POST /api/v1/settlements/:settlementId/capture",
      ].sort(),
    );
    const response = await app.request(
      "http://localhost:3000/api/v1/point-reservations/status",
      {
        body: JSON.stringify({ padding: "x".repeat(1024 * 1024) }),
        headers: { Authorization: "Bearer opaque" },
        method: "POST",
      },
      env as Bindings,
    );
    expect(response.status).toBe(413);
  });

  it("normalizes an invalid reservation status request to the documented problem code", async () => {
    const app = new Hono<BackendContext>();
    registerOAuthResourceRoutes(app, async (_request, _bindings, _kind, scopes) => ({
      clientId: marketsClientId,
      issuer: "http://localhost:3000/api/auth",
      kind: "M2M",
      scopes: [...scopes],
    }));

    const response = await app.request(
      "http://localhost:3000/api/v1/point-reservations/status",
      {
        body: JSON.stringify({ lookupBy: "POINT_RESERVATION_ID", pointReservationIds: [] }),
        headers: { Authorization: "Bearer opaque" },
        method: "POST",
      },
      env as Bindings,
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("normalizes an inactive Points connection to the invalid access token contract", async () => {
    const app = new Hono<BackendContext>();
    registerOAuthResourceRoutes(app, async () => {
      throw new Error("POINTS_CONNECTION_NOT_ACTIVE");
    });

    const response = await app.request(
      "http://localhost:3000/api/v1/me/connection",
      { headers: { Authorization: "Bearer opaque" } },
      env as Bindings,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_ACCESS_TOKEN" });
  });

  it("links and reserves under one client ID, then enforces M2M reservation ownership", async () => {
    const app = new Hono<BackendContext>();
    registerOAuthResourceRoutes(app, async (request, _bindings, kind, scopes) =>
      kind === "M2M"
        ? {
            clientId:
              request.headers.get("Authorization") === "Bearer other-client"
                ? "other-client"
                : marketsClientId,
            issuer: "http://localhost:3000/api/auth",
            kind: "M2M",
            scopes: [...scopes],
          }
        : {
            clientId: marketsClientId,
            issuer: "http://localhost:3000/api/auth",
            kind: "USER",
            scopes: [...scopes],
            subject: "route-confirmed-subject",
          },
    );
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    const rawState = "route-oauth-state";
    const stateHash = `sha256:${await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(rawState))
      .then((bytes) =>
        Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(""),
      )}`;
    const createResponse = await app.request(
      "http://localhost:3000/api/v1/oauth/link-attempts",
      {
        body: JSON.stringify({
          expiresAt,
          marketsUserId: "musr_route",
          pkceChallenge: "a".repeat(43),
          redirectUri: "https://markets.example.test/oauth/callback",
          requestedScopes: ["points.connection.read"],
          returnUrlHash: `sha256:${"b".repeat(64)}`,
          stateHash,
        }),
        headers: { Authorization: "Bearer opaque", "Idempotency-Key": "route-create" },
        method: "POST",
      },
      env as Bindings,
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      data: { linkAttemptId: string };
    };
    const stored = await db
      .prepare("SELECT payload_hash AS payloadHash FROM points_oauth_link_attempt WHERE id = ?")
      .bind(created.data.linkAttemptId)
      .first<{ payloadHash: string }>();

    await bindPointsLinkAttemptFromOAuthState(db, {
      authUserId: "oauth_user_1",
      rawState,
      userClientId: marketsClientId,
    });
    const confirmResponse = await app.request(
      `http://localhost:3000/api/v1/oauth/link-attempts/${created.data.linkAttemptId}/finalizations`,
      {
        body: JSON.stringify({
          attemptPayloadHash: stored!.payloadHash,
          marketsPointsConnectionId: "mpc_route",
          outcome: "CONFIRM",
          pointsIssuer: "http://localhost:3000/api/auth",
          pointsSubject: "route-confirmed-subject",
          userClientId: marketsClientId,
        }),
        headers: { Authorization: "Bearer opaque", "Idempotency-Key": "route-confirm" },
        method: "POST",
      },
      env as Bindings,
    );
    expect(confirmResponse.status).toBe(200);
    await expect(confirmResponse.json()).resolves.toMatchObject({
      data: { grantStatus: "ACTIVE", grantVersion: 1, outcome: "CONFIRM" },
    });

    const readResponse = await app.request(
      "http://localhost:3000/api/v1/me/connection",
      { headers: { Authorization: "Bearer opaque" } },
      env as Bindings,
    );
    expect(readResponse.status).toBe(200);
    await expect(readResponse.json()).resolves.toMatchObject({
      data: {
        issuer: "http://localhost:3000/api/auth",
        status: "ACTIVE",
        subject: "route-confirmed-subject",
      },
    });

    const suffix = crypto.randomUUID().replaceAll("-", "");
    const criterionId = `criterion_route_${suffix}`;
    const [criterion] = await importEvaluationCriteria(db, {
      actorPointsUserId: "pusr_1",
      reason: "route reservation ownership test",
      items: [
        {
          balanceVisibleByDefault: false,
          buyNowEnabled: true,
          description: "Route criterion",
          evaluationCriterionId: criterionId,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "0.0002",
          name: `Route criterion ${suffix.slice(0, 8)}`,
          relatedUrls: [],
          status: "ACTIVE",
          transferEnabled: true,
        },
      ],
    });
    const now = Date.now();
    const fixResultId = `fix_route_${suffix}`;
    const fixRevisionId = `fix_revision_route_${suffix}`;
    await db.batch([
      db
        .prepare(
          "INSERT INTO fix_result (id, current_revision_id, current_revision, created_at) VALUES (?, ?, 1, ?)",
        )
        .bind(fixResultId, fixRevisionId, now),
      db
        .prepare(
          `INSERT INTO fix_revision
           (id, fix_result_id, revision, file_hash, validation_hash, content_hash,
            actor_points_user_id, reason, created_at)
         VALUES (?, ?, 1, ?, ?, ?, ?, 'route reservation balance', ?)`,
        )
        .bind(
          fixRevisionId,
          fixResultId,
          "1".repeat(64),
          "2".repeat(64),
          "3".repeat(64),
          "pusr_1",
          now,
        ),
      db
        .prepare(
          `INSERT INTO point_ledger_entry
           (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
            delta_amount_scaled, affects_evaluation_total, source_type,
            source_fix_revision_id, created_at)
         VALUES (?, ?, ?, ?, 100, 1, 'FIX', ?, ?)`,
        )
        .bind(
          `ledger_route_${suffix}`,
          "pusr_1",
          criterionId,
          criterion!.evaluationCriterionRevisionId,
          fixRevisionId,
          now,
        ),
      db
        .prepare("INSERT INTO fix_revision_seal (fix_revision_id, sealed_at) VALUES (?, ?)")
        .bind(fixRevisionId, now),
    ]);
    const [pointPackage] = await importPointPackages(db, {
      actorPointsUserId: "pusr_1",
      reason: "route reservation ownership test",
      items: [
        {
          components: [{ displayOrder: 0, evaluationCriterionId: criterionId, weight: 1 }],
          description: null,
          expectedRevision: null,
          name: `Route package ${suffix.slice(0, 8)}`,
          pointPackageId: `pkg_route_${suffix}`,
          relatedUrl: null,
          status: "ACTIVE",
        },
      ],
    });
    const reserveResponse = await app.request(
      "http://localhost:3000/api/v1/me/point-reservations",
      {
        body: JSON.stringify({
          auctionId: `auc_route_${suffix}`,
          leaseSeconds: 900,
          marketsUserId: "musr_route",
          planHash: `sha256:${"a".repeat(64)}`,
          pointPackageRevisionId: pointPackage!.pointPackageRevisionId,
          priceTicks: 18,
          quantity: 2,
          reservationKey: `reservation_route_${suffix}`,
          settlementId: `settlement_route_${suffix}`,
        }),
        headers: { Authorization: "Bearer opaque", "Idempotency-Key": `route-reserve-${suffix}` },
        method: "POST",
      },
      env as Bindings,
    );
    expect(reserveResponse.status, await reserveResponse.clone().text()).toBe(201);
    const reserved = (await reserveResponse.json()) as { data: { pointReservationId: string } };
    expect(
      await db
        .prepare("SELECT markets_client_id AS clientId FROM point_reservation WHERE id = ?")
        .bind(reserved.data.pointReservationId)
        .first(),
    ).toEqual({ clientId: marketsClientId });

    const statusBody = JSON.stringify({
      lookupBy: "POINT_RESERVATION_ID",
      pointReservationIds: [reserved.data.pointReservationId],
    });
    const statusResponse = await app.request(
      "http://localhost:3000/api/v1/point-reservations/status",
      { body: statusBody, headers: { Authorization: "Bearer opaque" }, method: "POST" },
      env as Bindings,
    );
    expect(statusResponse.status).toBe(200);
    await expect(statusResponse.json()).resolves.toMatchObject({
      data: { items: [{ pointReservationId: reserved.data.pointReservationId, status: "ACTIVE" }] },
    });

    const otherClientStatus = await app.request(
      "http://localhost:3000/api/v1/point-reservations/status",
      { body: statusBody, headers: { Authorization: "Bearer other-client" }, method: "POST" },
      env as Bindings,
    );
    expect(otherClientStatus.status).toBe(404);
    await expect(otherClientStatus.json()).resolves.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});
