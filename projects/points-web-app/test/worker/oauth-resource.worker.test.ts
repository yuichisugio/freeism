import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { Hono } from "hono";

import {
  introspectResourceRequest,
  type PointsOAuthResourceConfig,
} from "../../src/backend/auth/resource-token-introspection";
import { createPointsLinkAttempt } from "../../src/backend/usecases/create-points-link-attempt";
import { bindPointsLinkAttemptFromOAuthState } from "../../src/backend/usecases/bind-points-link-attempt-from-oauth-state";
import { finalizePointsLinkAttempt } from "../../src/backend/usecases/finalize-points-link-attempt";
import { readPointsConnection } from "../../src/backend/usecases/read-points-connection";
import type { BackendContext, Bindings } from "../../src/backend/http/context";
import { registerOAuthResourceRoutes } from "../../src/backend/http/routes/oauth-resource-routes";

const db = env.DB!;

const resourceConfig: PointsOAuthResourceConfig = {
  allowedScopes: ["points.connection.read", "points.balance.read"],
  audience: "https://points.example.test/api/v1",
  clientId: "markets-user-client",
  clientSecret: "user-client-secret-at-least-32-chars",
  introspectionUrl: "https://points.example.test/api/auth/oauth2/introspect",
  issuer: "https://points.example.test/api/auth",
  kind: "USER",
};

describe("Points OAuth resource core", () => {
  beforeEach(async () => {
    await db.exec("DELETE FROM points_oauth_connection; DELETE FROM points_oauth_link_attempt;");
    const now = Date.now();
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

  it("uses confidential remote introspection and derives only an allowed USER principal", async () => {
    let remoteVerify: Record<string, unknown> | undefined;
    const request = new Request("https://points.example.test/api/v1/me/connection", {
      headers: { Authorization: "Bearer opaque-access-token" },
    });
    const principal = await introspectResourceRequest(
      request,
      resourceConfig,
      ["points.connection.read"],
      async (_input, options) => {
        remoteVerify = options.remoteVerify;
        return {
          aud: resourceConfig.audience,
          client_id: resourceConfig.clientId,
          exp: Math.floor(Date.now() / 1000) + 60,
          iss: resourceConfig.issuer,
          scope: "points.connection.read",
          sub: "pairwise-subject",
        };
      },
    );

    expect(principal).toEqual({
      clientId: resourceConfig.clientId,
      issuer: resourceConfig.issuer,
      kind: "USER",
      scopes: ["points.connection.read"],
      subject: "pairwise-subject",
    });
    expect(remoteVerify).toEqual({
      clientId: resourceConfig.clientId,
      clientSecret: resourceConfig.clientSecret,
      force: true,
      introspectUrl: resourceConfig.introspectionUrl,
    });
  });

  it("rejects inactive, mismatched-client and ID-token-shaped bearer responses", async () => {
    const base = {
      active: true,
      aud: resourceConfig.audience,
      client_id: resourceConfig.clientId,
      exp: Math.floor(Date.now() / 1000) + 60,
      iss: resourceConfig.issuer,
      scope: "points.connection.read",
      sub: "pairwise-subject",
    };
    for (const response of [
      { ...base, active: false },
      { ...base, client_id: "other-client" },
    ]) {
      await expect(
        introspectResourceRequest(
          new Request("https://points.example.test/api/v1/me/connection", {
            headers: { Authorization: "Bearer opaque-access-token" },
          }),
          resourceConfig,
          ["points.connection.read"],
          async () => {
            if (!response.active) throw new Error("token inactive");
            return response;
          },
        ),
      ).rejects.toThrow("INVALID_ACCESS_TOKEN");
    }
    await expect(
      introspectResourceRequest(
        new Request("https://points.example.test/api/v1/me/connection", {
          headers: { Authorization: "Bearer a.b.c" },
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
      m2mClientId: "markets-m2m-client",
      payloadHash: `sha256:${"a".repeat(64)}`,
      pointsUserId: "pusr_1",
      requestedScopes: ["points.connection.read", "points.balance.read"],
      stateHash: `sha256:${"1".repeat(64)}`,
      userClientId: "markets-user-client",
      now,
    });
    expect(attempt.status).toBe("PENDING_MARKETS_CONFIRMATION");

    const connection = await finalizePointsLinkAttempt(db, {
      attemptPayloadHash: `sha256:${"a".repeat(64)}`,
      idempotencyKey: "idem-finalize-1",
      issuer: "https://points.example.test/api/auth",
      linkAttemptId: attempt.linkAttemptId,
      marketsPointsConnectionId: "mpc_1",
      m2mClientId: "markets-m2m-client",
      outcome: "CONFIRM",
      pointsSubject: "pairwise-subject",
      userClientId: "markets-user-client",
      now: new Date(now.getTime() + 1_000),
    });
    expect(connection).toMatchObject({
      marketsUserId: "musr_1",
      m2mClientId: "markets-m2m-client",
      status: "ACTIVE",
      userClientId: "markets-user-client",
    });

    expect(
      await readPointsConnection(db, {
        issuer: "https://points.example.test/api/auth",
        pointsSubject: "pairwise-subject",
        userClientId: "markets-user-client",
      }),
    ).toMatchObject({
      grantVersion: 1,
      grantedScopes: ["points.balance.read", "points.connection.read"],
      issuer: "https://points.example.test/api/auth",
      pointsConnectionId: expect.stringMatching(/^pcn_/),
      status: "ACTIVE",
      subject: "pairwise-subject",
    });
  });

  it("cancels expired attempts and does not create a connection", async () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const attempt = await createPointsLinkAttempt(db, {
      expiresAt: new Date(now.getTime() + 1),
      idempotencyKey: "idem-link-expired",
      marketsUserId: "musr_expired",
      m2mClientId: "markets-m2m-client",
      payloadHash: `sha256:${"b".repeat(64)}`,
      pointsUserId: "pusr_expired",
      requestedScopes: ["points.connection.read"],
      stateHash: `sha256:${"2".repeat(64)}`,
      userClientId: "markets-user-client",
      now,
    });
    await expect(
      finalizePointsLinkAttempt(db, {
        attemptPayloadHash: `sha256:${"b".repeat(64)}`,
        idempotencyKey: "idem-finalize-expired",
        issuer: "https://points.example.test/api/auth",
        linkAttemptId: attempt.linkAttemptId,
        marketsPointsConnectionId: "mpc_expired",
        m2mClientId: "markets-m2m-client",
        outcome: "CONFIRM",
        pointsSubject: "pairwise-expired",
        userClientId: "markets-user-client",
        now: new Date(now.getTime() + 2),
      }),
    ).rejects.toThrow("LINK_ATTEMPT_EXPIRED");
  });

  it("replays only the same finalization outcome and payload", async () => {
    const now = new Date("2026-07-13T00:00:00.000Z");
    const attempt = await createPointsLinkAttempt(db, {
      expiresAt: new Date(now.getTime() + 600_000),
      idempotencyKey: "idem-link-replay",
      marketsUserId: "musr_replay",
      m2mClientId: "markets-m2m-client",
      payloadHash: `sha256:${"c".repeat(64)}`,
      pointsUserId: "pusr_1",
      requestedScopes: ["points.connection.read"],
      stateHash: `sha256:${"3".repeat(64)}`,
      userClientId: "markets-user-client",
      now,
    });
    const confirm = {
      attemptPayloadHash: `sha256:${"c".repeat(64)}`,
      idempotencyKey: "idem-finalize-replay",
      issuer: "https://points.example.test/api/auth",
      linkAttemptId: attempt.linkAttemptId,
      marketsPointsConnectionId: "mpc_replay",
      m2mClientId: "markets-m2m-client",
      outcome: "CONFIRM" as const,
      pointsSubject: "pairwise-replay",
      userClientId: "markets-user-client",
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
      m2mClientId: "markets-m2m-client",
      payloadHash: `sha256:${"d".repeat(64)}`,
      pointsUserId: "pusr_1",
      requestedScopes: ["points.connection.read"],
      stateHash: `sha256:${"4".repeat(64)}`,
      userClientId: "markets-user-client",
      now,
    });
    const cancel = {
      attemptPayloadHash: `sha256:${"d".repeat(64)}`,
      idempotencyKey: "idem-finalize-cancel-replay",
      linkAttemptId: attempt.linkAttemptId,
      marketsPointsConnectionId: "mpc_cancel_replay",
      m2mClientId: "markets-m2m-client",
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

  it("mounts create, cancel-finalize and connection read routes with principal separation", async () => {
    const app = new Hono<BackendContext>();
    registerOAuthResourceRoutes(app, async (_request, _bindings, kind, scopes) =>
      kind === "M2M"
        ? {
            clientId: "markets-m2m-client",
            issuer: "http://localhost:3000/api/auth",
            kind: "M2M",
            scopes: [...scopes],
          }
        : {
            clientId: "markets-user-client",
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
      userClientId: "markets-user-client",
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
          userClientId: "markets-user-client",
        }),
        headers: { Authorization: "Bearer opaque", "Idempotency-Key": "route-confirm" },
        method: "POST",
      },
      env as Bindings,
    );
    expect(confirmResponse.status).toBe(200);
    await expect(confirmResponse.json()).resolves.toMatchObject({
      data: { grantStatus: "ACTIVE", outcome: "CONFIRM" },
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
  });
});
