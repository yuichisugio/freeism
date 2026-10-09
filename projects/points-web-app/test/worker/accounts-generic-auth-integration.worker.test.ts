import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import { createPointsBackendApp } from "../../src/backend/app";
import { createPointsAuth } from "../../src/backend/auth/create-auth";
import type { Bindings } from "../../src/backend/http/context";
import {
  createFakeAccountsNetwork,
  importTestKek,
  seedActiveAccountsConnection,
  seedPointsUser,
} from "../support/accounts-worker-setup";
import { createFakeAccounts, sampleExternalAccounts } from "../support/fake-accounts";

const db = env.DB!;
const previewOrigin = "https://preview.points.test";
const stagingOrigin = "https://staging.points.test";

async function sessionCookie(bindings: Bindings, sessionId: string): Promise<string> {
  const token = `token-${sessionId.slice("session-".length)}`;
  const authContext = await createPointsAuth(bindings).$context;
  const secret = authContext.secret;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token)),
  ).toString("base64");
  return `${authContext.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${signature}`)}`;
}

describe("Accounts 本体 Generic OAuth 連携", () => {
  it("Accounts provider の通常 sign-in を拒否する", async () => {
    const app = createPointsBackendApp();
    const previewEnv = {
      ...env,
      APP_ORIGIN: previewOrigin,
      OAUTH_PROXY_PRODUCTION_URL: stagingOrigin,
    } as unknown as Bindings;
    const response = await app.fetch(
      new Request(`${previewOrigin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { origin: previewOrigin, "content-type": "application/json" },
        body: JSON.stringify({
          provider: "accounts-acon_example",
          callbackURL: `${previewOrigin}/settings/connections`,
        }),
      }),
      previewEnv,
    );
    expect(response.status).toBe(403);
  });

  it("通常session取得でAccountsのdiscoveryを実行しない", async () => {
    const previewEnv = {
      ...env,
      APP_ORIGIN: previewOrigin,
      OAUTH_PROXY_PRODUCTION_URL: stagingOrigin,
    } as unknown as Bindings;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("Unexpected Accounts discovery");
    });
    try {
      await createPointsAuth(previewEnv).api.getSession({ headers: new Headers() });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  for (const browserOrigin of [previewOrigin, stagingOrigin])
    it(`${browserOrigin} の callback 後、元sessionのみdomain連携を保存しcore行を残さない`, async () => {
      const network = createFakeAccountsNetwork();
      const accounts = network.add(
        await createFakeAccounts({ origin: `https://accounts-${crypto.randomUUID()}.test` }),
      );
      accounts.setList(() => sampleExternalAccounts());
      const admin = await seedPointsUser(db, { admin: true });
      const { connectionId, clientId } = await seedActiveAccountsConnection(db, {
        kek: await importTestKek(env),
        accounts,
        actorPointsUserId: admin.pointsUserId,
      });
      const user = await seedPointsUser(db);
      const other = await seedPointsUser(db);
      const previewEnv = {
        ...env,
        APP_ORIGIN: previewOrigin,
        OAUTH_PROXY_PRODUCTION_URL: stagingOrigin,
      } as unknown as Bindings;
      const stagingEnv = {
        ...env,
        APP_ORIGIN: stagingOrigin,
        OAUTH_PROXY_PRODUCTION_URL: stagingOrigin,
      } as unknown as Bindings;
      const browserEnv = browserOrigin === previewOrigin ? previewEnv : stagingEnv;
      const userCookie = await sessionCookie(browserEnv, user.sessionId);
      const otherCookie = await sessionCookie(browserEnv, other.sessionId);
      expect(
        await createPointsAuth(browserEnv).api.getSession({
          headers: new Headers({ cookie: userCookie }),
        }),
      ).not.toBeNull();
      const app = createPointsBackendApp({
        getSession: (bindings, headers) => createPointsAuth(bindings).api.getSession({ headers }),
        accountsFetch: network.fetch,
      });
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(network.fetch);
      try {
        const start = await app.fetch(
          new Request(`${browserOrigin}/api/accounts-links/attempts`, {
            method: "POST",
            headers: {
              origin: browserOrigin,
              cookie: userCookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ accountsConnectionId: connectionId }),
          }),
          browserEnv,
        );
        expect(start.status).toBe(201);
        const stateCookie = start.headers
          .getSetCookie()
          .find((cookie) => cookie.includes("points.state="));
        expect(stateCookie).toBeDefined();
        const { data } = (await start.json()) as { data: { authorizationUrl: string } };
        const authorize = new URL(data.authorizationUrl);
        expect(authorize.searchParams.get("client_id")).toBe(clientId);
        const accountsUserId = `ausr_${crypto.randomUUID()}`;
        const code = accounts.issueCode({
          clientId,
          sub: accountsUserId,
          nonce: authorize.searchParams.get("nonce")!,
          codeChallenge: authorize.searchParams.get("code_challenge")!,
          redirectUri: authorize.searchParams.get("redirect_uri")!,
        });
        const fixedCallback = new URL(authorize.searchParams.get("redirect_uri")!);
        fixedCallback.searchParams.set("code", code);
        fixedCallback.searchParams.set("state", authorize.searchParams.get("state")!);
        fixedCallback.searchParams.set("iss", accounts.origin);
        const fixed = await app.fetch(
          new Request(fixedCallback, {
            headers:
              browserOrigin === stagingOrigin
                ? { cookie: `${userCookie}; ${stateCookie!.split(";", 1)[0]}` }
                : {},
          }),
          stagingEnv,
        );
        expect(fixed.status).toBe(302);
        const callbackUrl = fixed.headers.get("location")!;
        expect(callbackUrl).toContain("/oauth-proxy");
        const completed = await app.fetch(
          new Request(callbackUrl, {
            headers: { cookie: `${userCookie}; ${stateCookie!.split(";", 1)[0]}` },
          }),
          browserEnv,
        );
        expect(completed.status).toBe(302);
        const finishUrl = completed.headers.get("location")!;
        expect(finishUrl).toContain("/api/accounts-links/finish?ticket=");
        const core = await db
          .prepare("SELECT id FROM account WHERE provider_id = ? AND account_id = ?")
          .bind(`accounts-${connectionId}`, accountsUserId)
          .first();
        expect(core).toBeNull();
        const wrongSession = await app.fetch(
          new Request(finishUrl, { headers: { cookie: otherCookie } }),
          browserEnv,
        );
        expect(wrongSession.headers.get("location")).toContain(
          "accountsLinkError=ACCOUNTS_LINK_ATTEMPT_INVALID",
        );
        const finish = await app.fetch(
          new Request(finishUrl, { headers: { cookie: userCookie } }),
          browserEnv,
        );
        expect(finish.headers.get("location")).toContain("accountsLinkResult=LINKED");
        const linked = await db
          .prepare(
            "SELECT points_user_id AS pointsUserId FROM accounts_links WHERE accounts_origin = ? AND accounts_user_id = ?",
          )
          .bind(accounts.origin, accountsUserId)
          .first<{ pointsUserId: string }>();
        expect(linked?.pointsUserId).toBe(user.pointsUserId);

        const relinkStart = await app.fetch(
          new Request(`${browserOrigin}/api/accounts-links/attempts`, {
            method: "POST",
            headers: {
              origin: browserOrigin,
              cookie: userCookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ accountsConnectionId: connectionId }),
          }),
          browserEnv,
        );
        expect(relinkStart.status).toBe(201);
        const relinkStateCookie = relinkStart.headers
          .getSetCookie()
          .find((cookie) => cookie.includes("points.state="))!;
        const relinkData = (await relinkStart.json()) as { data: { authorizationUrl: string } };
        const relinkAuthorize = new URL(relinkData.data.authorizationUrl);
        const relinkCallback = new URL(relinkAuthorize.searchParams.get("redirect_uri")!);
        relinkCallback.searchParams.set(
          "code",
          accounts.issueCode({
            clientId,
            sub: accountsUserId,
            nonce: relinkAuthorize.searchParams.get("nonce")!,
            codeChallenge: relinkAuthorize.searchParams.get("code_challenge")!,
            redirectUri: relinkAuthorize.searchParams.get("redirect_uri")!,
          }),
        );
        relinkCallback.searchParams.set("state", relinkAuthorize.searchParams.get("state")!);
        relinkCallback.searchParams.set("iss", accounts.origin);
        const relinkFixed = await app.fetch(
          new Request(relinkCallback, {
            headers:
              browserOrigin === stagingOrigin
                ? { cookie: `${userCookie}; ${relinkStateCookie.split(";", 1)[0]}` }
                : {},
          }),
          stagingEnv,
        );
        expect(relinkFixed.status).toBe(302);
        const relinkCompleted = await app.fetch(
          new Request(relinkFixed.headers.get("location")!, {
            headers: { cookie: `${userCookie}; ${relinkStateCookie.split(";", 1)[0]}` },
          }),
          browserEnv,
        );
        expect(relinkCompleted.status).toBe(302);
        const relinkFinish = await app.fetch(
          new Request(relinkCompleted.headers.get("location")!, {
            headers: { cookie: userCookie },
          }),
          browserEnv,
        );
        expect(relinkFinish.headers.get("location")).toContain("accountsLinkResult=LINKED");
        const transientCore = await db
          .prepare("SELECT id FROM account WHERE provider_id = ? AND account_id = ?")
          .bind(`accounts-${connectionId}`, accountsUserId)
          .first();
        expect(transientCore).toBeNull();

        if (browserOrigin === previewOrigin) {
          const otherAccounts = network.add(
            await createFakeAccounts({ origin: `https://accounts-${crypto.randomUUID()}.test` }),
          );
          otherAccounts.setList(() => sampleExternalAccounts());
          const otherConnection = await seedActiveAccountsConnection(db, {
            kek: await importTestKek(env),
            accounts: otherAccounts,
            actorPointsUserId: admin.pointsUserId,
          });
          const otherStart = await app.fetch(
            new Request(`${browserOrigin}/api/accounts-links/attempts`, {
              method: "POST",
              headers: {
                origin: browserOrigin,
                cookie: userCookie,
                "content-type": "application/json",
              },
              body: JSON.stringify({ accountsConnectionId: otherConnection.connectionId }),
            }),
            browserEnv,
          );
          expect(otherStart.status).toBe(201);
          const otherData = (await otherStart.json()) as { data: { authorizationUrl: string } };
          const otherAuthorize = new URL(otherData.data.authorizationUrl);
          const otherCallback = new URL(otherAuthorize.searchParams.get("redirect_uri")!);
          otherCallback.searchParams.set(
            "code",
            otherAccounts.issueCode({
              clientId: otherConnection.clientId,
              sub: accountsUserId,
              nonce: otherAuthorize.searchParams.get("nonce")!,
              codeChallenge: otherAuthorize.searchParams.get("code_challenge")!,
              redirectUri: otherAuthorize.searchParams.get("redirect_uri")!,
            }),
          );
          otherCallback.searchParams.set("state", otherAuthorize.searchParams.get("state")!);
          otherCallback.searchParams.set("iss", otherAccounts.origin);
          const otherFixed = await app.fetch(new Request(otherCallback), stagingEnv);
          expect(otherFixed.status).toBe(302);
          const otherCompleted = await app.fetch(
            new Request(otherFixed.headers.get("location")!, {
              headers: { cookie: userCookie },
            }),
            browserEnv,
          );
          expect(otherCompleted.status).toBe(302);
          const otherFinish = await app.fetch(
            new Request(otherCompleted.headers.get("location")!, {
              headers: { cookie: userCookie },
            }),
            browserEnv,
          );
          expect(otherFinish.headers.get("location")).toContain("accountsLinkResult=LINKED");
          const sameSubjectLinks = await db
            .prepare(
              "SELECT accounts_origin AS accountsOrigin FROM accounts_links WHERE accounts_user_id = ? AND points_user_id = ? ORDER BY accounts_origin",
            )
            .bind(accountsUserId, user.pointsUserId)
            .all<{ accountsOrigin: string }>();
          expect(sameSubjectLinks.results.map((row) => row.accountsOrigin)).toEqual(
            [accounts.origin, otherAccounts.origin].sort(),
          );
        }
      } finally {
        fetchMock.mockRestore();
      }
    });

  for (const failure of ["bad-nonce", "access-denied", "bad-issuer"] as const)
    it(`${failure} はdomain連携を保存しない`, async () => {
      const network = createFakeAccountsNetwork();
      const accounts = network.add(
        await createFakeAccounts({ origin: `https://accounts-${crypto.randomUUID()}.test` }),
      );
      const admin = await seedPointsUser(db, { admin: true });
      const { connectionId, clientId } = await seedActiveAccountsConnection(db, {
        kek: await importTestKek(env),
        accounts,
        actorPointsUserId: admin.pointsUserId,
      });
      const user = await seedPointsUser(db);
      const previewEnv = {
        ...env,
        APP_ORIGIN: previewOrigin,
        OAUTH_PROXY_PRODUCTION_URL: stagingOrigin,
      } as unknown as Bindings;
      const stagingEnv = {
        ...env,
        APP_ORIGIN: stagingOrigin,
        OAUTH_PROXY_PRODUCTION_URL: stagingOrigin,
      } as unknown as Bindings;
      const userCookie = await sessionCookie(previewEnv, user.sessionId);
      const app = createPointsBackendApp({
        getSession: (bindings, headers) => createPointsAuth(bindings).api.getSession({ headers }),
        accountsFetch: network.fetch,
      });
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(network.fetch);
      try {
        const start = await app.fetch(
          new Request(`${previewOrigin}/api/accounts-links/attempts`, {
            method: "POST",
            headers: {
              origin: previewOrigin,
              cookie: userCookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ accountsConnectionId: connectionId }),
          }),
          previewEnv,
        );
        expect(start.status).toBe(201);
        const { data } = (await start.json()) as { data: { authorizationUrl: string } };
        const authorize = new URL(data.authorizationUrl);
        const callback = new URL(authorize.searchParams.get("redirect_uri")!);
        callback.searchParams.set("state", authorize.searchParams.get("state")!);
        callback.searchParams.set(
          "iss",
          failure === "bad-issuer" ? "https://other-issuer.test" : accounts.origin,
        );
        if (failure !== "access-denied") {
          callback.searchParams.set(
            "code",
            accounts.issueCode({
              clientId,
              sub: `ausr_${crypto.randomUUID()}`,
              nonce: "wrong-nonce",
              codeChallenge: authorize.searchParams.get("code_challenge")!,
              redirectUri: authorize.searchParams.get("redirect_uri")!,
            }),
          );
        } else {
          callback.searchParams.set("error", "access_denied");
        }
        const response = await app.fetch(new Request(callback), stagingEnv);
        if (failure === "bad-issuer") {
          expect(response.status).toBe(400);
        } else {
          expect(response.status).toBe(302);
          const location = new URL(response.headers.get("location")!);
          expect(location.origin).toBe(previewOrigin);
          expect(location.pathname).toBe("/settings/connections");
          expect(location.searchParams.get("accountsLinkError")).toBe("ACCOUNTS_UNAVAILABLE");
          if (failure === "access-denied")
            expect(location.searchParams.get("error")).toBe("access_denied");
        }
        const links = await db
          .prepare("SELECT id FROM accounts_links WHERE points_user_id = ?")
          .bind(user.pointsUserId)
          .all();
        expect(links.results).toHaveLength(0);
      } finally {
        fetchMock.mockRestore();
      }
    });
});
