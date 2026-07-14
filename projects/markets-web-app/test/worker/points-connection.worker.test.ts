import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createMarketsBackendApp } from "../../src/backend/app";
import { createMarketsAuth } from "../../src/backend/auth/create-auth";
import { PointsConnectionRepository } from "../../src/backend/points/points-link-saga";
import { createBetterAuthPointsTokenStore } from "../../src/backend/points/points-token-store";
import {
  createRefreshLeaseRepository,
  withUserAccessToken,
} from "../../src/backend/points/refresh-lease-repository";

async function seedUser(authUserId: string, marketsUserId: string) {
  await env.DB!.batch([
    env
      .DB!.prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)")
      .bind(authUserId, authUserId, `${authUserId}@example.test`),
    env
      .DB!.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)")
      .bind(marketsUserId, authUserId),
  ]);
}

describe("Markets Points connection", () => {
  beforeEach(async () => {
    await env.DB!.exec(
      "DELETE FROM points_unlink_authorization; DELETE FROM points_oauth_state; DELETE FROM points_connection; DELETE FROM account; DELETE FROM markets_user; DELETE FROM session; DELETE FROM user;",
    );
  });

  it("permits only one live Markets user per pairwise Points subject", async () => {
    await seedUser("auth-a", "musr_a");
    await seedUser("auth-b", "musr_b");
    const repository = new PointsConnectionRepository(env.DB!);
    await repository.createPending({
      attemptPayloadHash: "sha256:attempt-a",
      authUserId: "auth-a",
      expiresAt: new Date("2026-07-13T00:10:00.000Z"),
      id: "mpc_a",
      linkAttemptId: "pla_a",
      marketsUserId: "musr_a",
      m2mClientId: "m2m-client",
      pointsIssuer: "https://points.example.test/api/auth",
      pointsSubject: "pairwise-subject",
      scopes: ["openid"],
      sessionId: "session-a",
      userClientId: "user-client",
    });
    await expect(
      repository.createPending({
        attemptPayloadHash: "sha256:attempt-b",
        authUserId: "auth-b",
        expiresAt: new Date("2026-07-13T00:10:00.000Z"),
        id: "mpc_b",
        linkAttemptId: "pla_b",
        marketsUserId: "musr_b",
        m2mClientId: "m2m-client",
        pointsIssuer: "https://points.example.test/api/auth",
        pointsSubject: "pairwise-subject",
        scopes: ["openid"],
        sessionId: "session-b",
        userClientId: "user-client",
      }),
    ).rejects.toMatchObject({ code: "POINTS_CONNECTION_CONFLICT" });
    await expect(
      repository.createPending({
        attemptPayloadHash: "sha256:attempt-c",
        authUserId: "auth-a",
        expiresAt: new Date("2026-07-13T00:10:00.000Z"),
        id: "mpc_c",
        linkAttemptId: "pla_c",
        marketsUserId: "musr_a",
        m2mClientId: "m2m-client",
        pointsIssuer: "https://points.example.test/api/auth",
        pointsSubject: "another-pairwise-subject",
        scopes: ["openid"],
        sessionId: "session-a",
        userClientId: "user-client",
      }),
    ).rejects.toMatchObject({ code: "POINTS_CONNECTION_CONFLICT" });
    const first = await repository.findById("mpc_a");
    expect(first?.status).toBe("PENDING_CONFIRMATION");
  });

  it("stores user tokens only through Better Auth encrypted accounts and reads an old secret version", async () => {
    await seedUser("auth-1", "musr_1");
    const oldAuth = createMarketsAuth({
      ...env,
      APP_ORIGIN: "https://markets.example.test",
      BETTER_AUTH_SECRETS: "1:test-old-secret-at-least-32-characters",
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
    });
    const oldStore = createBetterAuthPointsTokenStore(oldAuth);
    await oldStore.save({
      accessToken: "plain-access-token",
      accessTokenExpiresAt: new Date("2026-07-13T01:00:00.000Z"),
      accountId: "https://points.example.test/api/auth|pairwise-subject",
      authUserId: "auth-1",
      refreshToken: "plain-refresh-token",
      scopes: ["openid", "offline_access"],
    });

    const stored = await env
      .DB!.prepare(
        "SELECT access_token AS accessToken, refresh_token AS refreshToken FROM account WHERE provider_id = 'points'",
      )
      .first<{ accessToken: string; refreshToken: string }>();
    expect(stored?.accessToken).not.toContain("plain-access-token");
    expect(stored?.refreshToken).not.toContain("plain-refresh-token");

    const currentAuth = createMarketsAuth({
      ...env,
      APP_ORIGIN: "https://markets.example.test",
      BETTER_AUTH_SECRETS:
        "2:test-current-secret-at-least-32-characters,1:test-old-secret-at-least-32-characters",
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
    });
    const read = await createBetterAuthPointsTokenStore(currentAuth).read(
      "https://points.example.test/api/auth|pairwise-subject",
    );
    expect(read.accessToken).toBe("plain-access-token");
    expect(read.refreshToken).toBe("plain-refresh-token");
  });

  it("lets exactly one concurrent refresh use the old refresh token", async () => {
    await seedUser("auth-1", "musr_1");
    const auth = createMarketsAuth({
      ...env,
      APP_ORIGIN: "https://markets.example.test",
      BETTER_AUTH_SECRETS:
        "2:test-current-secret-at-least-32-characters,1:test-old-secret-at-least-32-characters",
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
    });
    const tokenStore = createBetterAuthPointsTokenStore(auth);
    await tokenStore.save({
      accessToken: "old-access",
      accessTokenExpiresAt: new Date("2026-07-13T00:00:00.000Z"),
      accountId: "https://points.example.test/api/auth|pairwise-subject",
      authUserId: "auth-1",
      refreshToken: "old-refresh",
      scopes: ["offline_access"],
    });
    const repository = new PointsConnectionRepository(env.DB!);
    await repository.createPending({
      attemptPayloadHash: "sha256:attempt",
      authUserId: "auth-1",
      expiresAt: new Date("2026-07-13T00:10:00.000Z"),
      id: "mpc_1",
      linkAttemptId: "pla_1",
      marketsUserId: "musr_1",
      m2mClientId: "m2m-client",
      pointsIssuer: "https://points.example.test/api/auth",
      pointsSubject: "pairwise-subject",
      scopes: ["offline_access"],
      sessionId: "session-1",
      userClientId: "user-client",
    });
    await repository.activate("mpc_1", "receipt-1", 1);

    let refreshCalls = 0;
    const lease = createRefreshLeaseRepository(env.DB!, tokenStore);
    const call = () =>
      withUserAccessToken(
        lease,
        "mpc_1",
        async (accessToken) =>
          new Response(null, { status: accessToken === "old-access" ? 401 : 200 }),
        async (refreshToken) => {
          refreshCalls += 1;
          expect(refreshToken).toBe("old-refresh");
          await new Promise((resolve) => setTimeout(resolve, 5));
          return {
            accessToken: "new-access",
            accessTokenExpiresAt: new Date("2026-07-13T01:00:00.000Z"),
            refreshToken: "new-refresh",
            scopes: ["offline_access"],
          };
        },
      );
    const responses = await Promise.all([call(), call()]);
    expect(refreshCalls).toBe(1);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
  });

  it("keeps callback navigation fixed and activates only on same-session POST", async () => {
    await seedUser("auth-1", "musr_1");
    await env
      .DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ('google-1', 'google-subject', 'google', 'auth-1', 1)",
      )
      .run();
    const calls: string[] = [];
    const app = createMarketsBackendApp(
      async () => ({ session: { id: "session-1", userId: "auth-1" }, user: { id: "auth-1" } }),
      {
        confirm: async (_actor, sessionId, pendingId) => {
          calls.push(`confirm:${sessionId}:${pendingId}`);
          return { pointsConnectionId: pendingId, status: "ACTIVE" as const };
        },
        completeCallback: async (_actor, authUserId, sessionId, callback) => {
          calls.push(`callback:${authUserId}:${sessionId}:${callback.state}`);
          return { pendingId: "mpc_1" };
        },
        start: async (_actor, authUserId, sessionId) => {
          calls.push(`start:${authUserId}:${sessionId}`);
          return { authorizationUrl: "https://points.example.test/api/auth/oauth2/authorize" };
        },
      },
    );

    const forbidden = await app.fetch(
      new Request(
        "https://markets.example.test/api/points-connection/start?returnTo=https://evil.example",
        { method: "POST" },
      ),
      env,
    );
    expect(forbidden.status).toBe(400);

    const callback = await app.fetch(
      new Request(
        "https://markets.example.test/api/points-connection/callback?code=code-1&state=state-1&returnTo=https://evil.example",
      ),
      env,
    );
    expect(callback.status).toBe(303);
    expect(callback.headers.get("Location")).toBe(
      "https://markets.example.test/settings/points-connection",
    );

    const confirmed = await app.fetch(
      new Request("https://markets.example.test/api/points-connection/confirm", {
        body: JSON.stringify({ pendingId: "mpc_1" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(confirmed.status).toBe(200);
    expect(calls).toEqual(["callback:auth-1:session-1:state-1", "confirm:session-1:mpc_1"]);
  });
});
