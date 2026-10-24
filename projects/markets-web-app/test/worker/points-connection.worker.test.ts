import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createMarketsBackendApp } from "../../src/backend/app";
import { createMarketsAuth } from "../../src/backend/auth/create-auth";
import {
  createPointsConnectionService,
  PointsConnectionRepository,
} from "../../src/backend/points/points-link-saga";
import { sha256 } from "../../src/backend/points/oauth-state";
import type { PointsApiClient } from "../../src/backend/points/points-api-client";
import type { PointsOAuthClient } from "../../src/backend/points/points-oauth-client";
import type { PointsTokenStore } from "../../src/backend/points/points-token-store";
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
      "DELETE FROM points_unlink_authorization; DELETE FROM points_oauth_state; DELETE FROM points_connection; DELETE FROM account; DELETE FROM markets_user; DELETE FROM session; DELETE FROM user; DELETE FROM points_provider;",
    );
    await env
      .DB!.prepare(`INSERT INTO points_provider
      (id, display_name, origin, issuer, resource, client_public_jwk, status)
      VALUES ('provider-a', 'Points A', 'https://points-a.example.test', 'https://points-a.example.test', 'https://points-a.example.test/api/v1', '{}', 'ACTIVE'),
             ('provider-b', 'Points B', 'https://points-b.example.test', 'https://points-b.example.test', 'https://points-b.example.test/api/v1', '{}', 'ACTIVE')`)
      .run();
  });

  it("permits only one live Markets user per pairwise Points subject", async () => {
    await seedUser("auth-a", "musr_a");
    await seedUser("auth-b", "musr_b");
    const repository = new PointsConnectionRepository(env.DB!);
    await repository.createPending({
      providerId: "provider-a",
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
        providerId: "provider-a",
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
        providerId: "provider-a",
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
    await expect(
      repository.createPending({
        providerId: "provider-b",
        attemptPayloadHash: "sha256:attempt-d",
        authUserId: "auth-a",
        expiresAt: new Date("2026-07-13T00:10:00.000Z"),
        id: "mpc_d",
        linkAttemptId: "pla_d",
        marketsUserId: "musr_a",
        m2mClientId: "m2m-client",
        pointsIssuer: "https://points-b.example.test",
        pointsSubject: "pairwise-subject",
        scopes: ["openid"],
        sessionId: "session-a",
        userClientId: "user-client",
      }),
    ).resolves.toMatchObject({ providerId: "provider-b" });
  });

  it("rejects a callback state saved for another provider before exchanging the code", async () => {
    await seedUser("auth-a", "musr_a");
    const repository = new PointsConnectionRepository(env.DB!);
    await repository.saveOAuthState({
      providerId: "provider-a",
      reauthConnectionId: null,
      attemptPayloadHash: "sha256:attempt-a",
      authUserId: "auth-a",
      callbackUri: "https://markets.example.test/api/points-connection/callback",
      expiresAt: new Date(Date.now() + 60_000),
      linkAttemptId: "pla_a",
      marketsUserId: "musr_a",
      nonce: "nonce-a",
      pkceVerifier: "verifier-a",
      requestedScopes: ["openid"],
      returnUrlHash: "sha256:return",
      sessionId: "session-a",
      stateHash: await sha256("state-a"),
    });
    let exchanged = false;
    const service = createPointsConnectionService({
      providerId: "provider-b",
      api: {} as PointsApiClient,
      callbackUri: "https://markets.example.test/api/points-connection/callback",
      db: env.DB!,
      m2mClientId: "client-b",
      oauth: {
        exchangeAuthorizationCode: async () => {
          exchanged = true;
          throw new Error("MUST_NOT_EXCHANGE");
        },
      } as unknown as PointsOAuthClient,
      pointsIssuer: "https://points-b.example.test",
      tokenStore: {} as PointsTokenStore,
      userClientId: "client-b",
    });
    await expect(
      service.completeCallback({ marketsUserId: "musr_a" } as never, "auth-a", "session-a", {
        code: "code-a",
        issuer: "https://points-b.example.test",
        state: "state-a",
      }),
    ).rejects.toThrow("POINTS_OAUTH_STATE_INVALID");
    expect(exchanged).toBe(false);
  });

  it("reauthorizes the same connection ID and subject after refresh expires", async () => {
    await seedUser("auth-a", "musr_a");
    const repository = new PointsConnectionRepository(env.DB!);
    await repository.createPending({
      providerId: "provider-a",
      attemptPayloadHash: "sha256:old",
      authUserId: "auth-a",
      expiresAt: new Date(Date.now() + 60_000),
      id: "mpc_existing",
      linkAttemptId: "pla_old",
      marketsUserId: "musr_a",
      m2mClientId: "client-a",
      pointsIssuer: "https://points-a.example.test",
      pointsSubject: "same-subject",
      scopes: ["openid"],
      sessionId: "session-a",
      userClientId: "client-a",
    });
    await repository.activate("mpc_existing", "receipt-old", 1);
    await repository.markReauthRequired("mpc_existing");
    let confirmedId: string | undefined;
    const service = createPointsConnectionService({
      providerId: "provider-a",
      db: env.DB!,
      m2mClientId: "client-a",
      userClientId: "client-a",
      pointsIssuer: "https://points-a.example.test",
      callbackUri: "https://markets.example.test/callback",
      api: {
        createPointsLinkAttempt: async () => ({ data: { linkAttemptId: "pla_new" } }),
        finalizePointsLinkAttempt: async (
          _attempt: string,
          body: { marketsPointsConnectionId: string },
        ) => {
          confirmedId = body.marketsPointsConnectionId;
          return {
            data: {
              outcome: "CONFIRM",
              grantStatus: "ACTIVE",
              grantVersion: 2,
              linkAttemptFinalizationReceiptId: "receipt-new",
            },
          };
        },
      } as unknown as PointsApiClient,
      oauth: {
        authorizationUrl: ({ state }: { state: string }) =>
          `https://points-a.example.test/authorize?state=${state}`,
        exchangeAuthorizationCode: async () => ({
          accessToken: "access-new",
          accessTokenExpiresAt: new Date(Date.now() + 60_000),
          clientId: "client-a",
          issuer: "https://points-a.example.test",
          refreshToken: "refresh-new",
          scopes: ["openid"],
          subject: "same-subject",
        }),
      } as unknown as PointsOAuthClient,
      tokenStore: { save: async () => {} } as unknown as PointsTokenStore,
    });
    const actor = { marketsUserId: "musr_a" } as never;
    const started = await service.start(actor, "auth-a", "session-a");
    const state = new URL(started.authorizationUrl).searchParams.get("state")!;
    const callback = await service.completeCallback(actor, "auth-a", "session-a", {
      code: "code-new",
      issuer: "https://points-a.example.test",
      state,
    });
    expect(callback.pendingId).toBe("mpc_existing");
    await expect(service.confirm(actor, "session-a", callback.pendingId)).resolves.toEqual({
      pointsConnectionId: "mpc_existing",
      status: "ACTIVE",
    });
    expect(confirmedId).toBe("mpc_existing");
    expect(await repository.findById("mpc_existing")).toMatchObject({
      id: "mpc_existing",
      linkAttemptId: "pla_new",
      pointsSubject: "same-subject",
      status: "ACTIVE",
    });
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
      accountId: "provider-a|pairwise-subject",
      authUserId: "auth-1",
      refreshToken: "plain-refresh-token",
      scopes: ["openid", "offline_access"],
    });
    await oldStore.save({
      accessToken: "other-provider-access",
      accessTokenExpiresAt: new Date("2026-07-13T01:00:00.000Z"),
      accountId: "provider-b|pairwise-subject",
      authUserId: "auth-1",
      refreshToken: "other-provider-refresh",
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
      "provider-a|pairwise-subject",
    );
    expect(read.accessToken).toBe("plain-access-token");
    expect(read.refreshToken).toBe("plain-refresh-token");
    expect(
      (await createBetterAuthPointsTokenStore(currentAuth).read("provider-b|pairwise-subject"))
        .refreshToken,
    ).toBe("other-provider-refresh");
  });

  it("keeps the normal connection token when unlink confirmation is left pending", async () => {
    await seedUser("auth-1", "musr_1");
    const auth = createMarketsAuth({
      ...env,
      APP_ORIGIN: "https://markets.example.test",
      BETTER_AUTH_SECRETS: "2:test-current-secret-at-least-32-characters",
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
    });
    const store = createBetterAuthPointsTokenStore(auth);
    await store.save({
      accessToken: "active-access",
      accessTokenExpiresAt: new Date(Date.now() + 60_000),
      accountId: "provider-a|pairwise-subject",
      authUserId: "auth-1",
      refreshToken: "active-refresh",
      scopes: ["points.reservations.create"],
    });
    await store.saveOneTimeAccessToken({
      accessToken: "unlink-access",
      accessTokenExpiresAt: new Date(Date.now() + 60_000),
      accountId: "unlink:provider-a:authorization-1",
      authUserId: "auth-1",
      scopes: ["points.connection.unlink"],
    });
    expect(await store.readOneTimeAccessToken("unlink:provider-a:authorization-1", "auth-1")).toBe(
      "unlink-access",
    );
    expect(await store.read("provider-a|pairwise-subject")).toMatchObject({
      accessToken: "active-access",
      refreshToken: "active-refresh",
    });
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
      accountId: "provider-a|pairwise-subject",
      authUserId: "auth-1",
      refreshToken: "old-refresh",
      scopes: ["offline_access"],
    });
    const repository = new PointsConnectionRepository(env.DB!);
    await repository.createPending({
      providerId: "provider-a",
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
        {
          method: "POST",
          body: JSON.stringify({ providerId: "provider-a" }),
          headers: { "Content-Type": "application/json" },
        },
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

  it("lists the user's connections separately for each provider", async () => {
    await seedUser("auth-1", "musr_1");
    await env
      .DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ('google-1', 'google-subject', 'google', 'auth-1', 1)",
      )
      .run();
    await new PointsConnectionRepository(env.DB!).createPending({
      providerId: "provider-a",
      attemptPayloadHash: "sha256:attempt-a",
      authUserId: "auth-1",
      expiresAt: new Date(Date.now() + 60_000),
      id: "mpc_a",
      linkAttemptId: "pla_a",
      marketsUserId: "musr_1",
      m2mClientId: "client-a",
      pointsIssuer: "https://points-a.example.test",
      pointsSubject: "same-subject",
      scopes: ["openid"],
      sessionId: "session-1",
      userClientId: "client-a",
    });
    const app = createMarketsBackendApp(async () => ({
      session: { id: "session-1", userId: "auth-1" },
      user: { id: "auth-1" },
    }));
    const response = await app.fetch(
      new Request("https://markets.example.test/api/points-connection"),
      env,
    );
    expect(response.status).toBe(200);
    expect(
      (
        (await response.json()) as {
          data: Array<{ providerId: string; connection: { id: string } | null }>;
        }
      ).data,
    ).toMatchObject([
      { providerId: "provider-a", connection: { id: "mpc_a" } },
      { providerId: "provider-b", connection: null },
    ]);
  });

  it("allows reauthorization on a stopped provider while rejecting a new link", async () => {
    await seedUser("auth-1", "musr_1");
    await env
      .DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ('google-1', 'google-subject', 'google', 'auth-1', 1)",
      )
      .run();
    await env
      .DB!.prepare(
        "UPDATE points_provider SET status = 'STOPPED' WHERE id IN ('provider-a', 'provider-b')",
      )
      .run();
    const repository = new PointsConnectionRepository(env.DB!);
    await repository.createPending({
      providerId: "provider-a",
      attemptPayloadHash: "sha256:old",
      authUserId: "auth-1",
      expiresAt: new Date(Date.now() + 60_000),
      id: "mpc_existing",
      linkAttemptId: "pla_old",
      marketsUserId: "musr_1",
      m2mClientId: "client-a",
      pointsIssuer: "https://points-a.example.test",
      pointsSubject: "same-subject",
      scopes: ["openid"],
      sessionId: "session-1",
      userClientId: "client-a",
    });
    await repository.activate("mpc_existing", "receipt-old", 1);
    await repository.markReauthRequired("mpc_existing");
    const app = createMarketsBackendApp(
      async () => ({ session: { id: "session-1", userId: "auth-1" }, user: { id: "auth-1" } }),
      {
        start: async () => ({ authorizationUrl: "https://points-a.example.test/authorize" }),
        completeCallback: async () => ({ pendingId: "mpc_existing" }),
        confirm: async () => ({ pointsConnectionId: "mpc_existing", status: "ACTIVE" }),
      },
    );
    const start = (providerId: string) =>
      app.fetch(
        new Request("https://markets.example.test/api/points-connection/start", {
          body: JSON.stringify({ providerId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
        env,
      );
    expect((await start("provider-a")).status).toBe(200);
    expect((await start("provider-b")).status).toBe(400);
  });
});
