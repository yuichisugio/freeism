import { env } from "cloudflare:test";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createPointsAuth } from "../../src/backend/auth/create-auth";
import { pointsOAuthScopes } from "../../src/backend/auth/points-oauth-provider";
import { verifyPointsResourceRequest } from "../../src/backend/auth/resource-token-introspection";
import type { BackendContext, Bindings } from "../../src/backend/http/context";
import { registerOAuthResourceRoutes } from "../../src/backend/http/routes/oauth-resource-routes";
import { seedPointsUser } from "../support/accounts-worker-setup";

const db = env.DB!;
const pointsOrigin = "http://localhost:3000";
const registeredLocalCallback = "http://localhost:3000/points/callback";
const localCallback = "http://localhost:4321/points/callback";
const marketsCallback = "https://markets.example.test/api/points-connection/callback";
const pointsResource = `${pointsOrigin}/api/v1`;
const tokenEndpoint = `${pointsOrigin}/api/auth/oauth2/token`;
const verifier = "test-code-verifier-with-at-least-forty-three-characters";

async function challenge(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("base64url");
}

async function generateClientKey() {
  const keyPair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const { kty, crv, x } = (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as JsonWebKey;
  const kid = crypto.randomUUID();
  return {
    jwks: { keys: [{ kty, crv, x, kid, alg: "EdDSA" as const, use: "sig" as const }] },
    kid,
    privateKey: keyPair.privateKey,
  };
}

async function clientAssertion(
  clientId: string,
  key: Awaited<ReturnType<typeof generateClientKey>>,
) {
  const now = Math.floor(Date.now() / 1_000);
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: key.kid })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({
      iss: clientId,
      sub: clientId,
      aud: tokenEndpoint,
      iat: now,
      exp: now + 60,
      jti: crypto.randomUUID(),
    }),
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    key.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${Buffer.from(signature).toString("base64url")}`;
}

describe("Points private_key_jwt authorization code", () => {
  beforeEach(async () => {
    await db.exec(
      "DELETE FROM verification; DELETE FROM oauth_access_token; DELETE FROM oauth_refresh_token; DELETE FROM oauth_consent; DELETE FROM oauth_client_resource; DELETE FROM oauth_client; DELETE FROM oauth_resource; DELETE FROM session; DELETE FROM account; DELETE FROM points_user; DELETE FROM user;",
    );
  });

  it("binds two callbacks and PKCE, permits a loopback port change, and issues a refresh token", async () => {
    const auth = createPointsAuth(env as Bindings);
    const user = await seedPointsUser(db);
    const token = `token-${user.sessionId.slice("session-".length)}`;
    const secret = (await auth.$context).secret;
    const cookieKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = Buffer.from(
      await crypto.subtle.sign("HMAC", cookieKey, new TextEncoder().encode(token)),
    ).toString("base64");
    const cookie = `points.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
    const key = await generateClientKey();
    const client = await auth.api.adminCreateOAuthClient({
      headers: new Headers({ Cookie: cookie, Origin: pointsOrigin }),
      body: {
        client_name: "Markets",
        redirect_uris: [registeredLocalCallback, marketsCallback],
        token_endpoint_auth_method: "private_key_jwt",
        jwks: key.jwks,
        application_type: "native",
        grant_types: ["authorization_code", "refresh_token", "client_credentials"],
        response_types: ["code"],
        scope: "openid offline_access points.connection.unlink",
        client_credentials_scopes: ["points.connection.link-attempt.create"],
        subject_type: "public",
      },
    });
    const clientId = client.client_id;

    const issueCode = async (redirectUri: string, scope: string) => {
      const query = new URLSearchParams({
        client_id: clientId,
        code_challenge: await challenge(verifier),
        code_challenge_method: "S256",
        redirect_uri: redirectUri,
        resource: pointsResource,
        response_type: "code",
        scope,
        state: crypto.randomUUID(),
        prompt: "consent",
      });
      const authorization = await auth.handler(
        new Request(`${pointsOrigin}/api/auth/oauth2/authorize?${query}`, {
          headers: { Cookie: cookie },
        }),
      );
      expect(authorization.status).toBe(302);
      const consentUrl = new URL(authorization.headers.get("location")!, pointsOrigin);
      expect(consentUrl.pathname).toBe("/oauth/consent");
      const consent = await auth.handler(
        new Request(`${pointsOrigin}/api/auth/oauth2/consent`, {
          body: JSON.stringify({ accept: true, oauth_query: consentUrl.search.slice(1) }),
          headers: { Cookie: cookie, "Content-Type": "application/json", Origin: pointsOrigin },
          method: "POST",
        }),
      );
      expect(consent.status).toBe(200);
      const result = (await consent.json()) as { url?: string; redirect_uri?: string };
      const callback = new URL(result.url ?? result.redirect_uri!);
      expect(`${callback.origin}${callback.pathname}`).toBe(redirectUri);
      expect(callback.searchParams.get("state")).toBe(query.get("state"));
      return callback.searchParams.get("code")!;
    };

    const exchange = async (code: string, redirectUri: string, codeVerifier = verifier) =>
      auth.handler(
        new Request(tokenEndpoint, {
          body: new URLSearchParams({
            client_id: clientId,
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            client_assertion: await clientAssertion(clientId, key),
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          method: "POST",
        }),
      );

    const userScope = "openid points.connection.unlink";
    expect(
      (await exchange(await issueCode(localCallback, userScope), marketsCallback)).status,
    ).toBe(400);
    expect(
      (
        await exchange(
          await issueCode(localCallback, userScope),
          localCallback,
          `${verifier}-wrong`,
        )
      ).status,
    ).toBe(401);
    const userToken = await exchange(await issueCode(localCallback, userScope), localCallback);
    expect(userToken.status).toBe(200);
    const issuedUserToken = (await userToken.json()) as { access_token: string };
    expect(issuedUserToken).toHaveProperty("access_token");
    const originalFetch = globalThis.fetch;
    const jwksFetch = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (
        new URL(input instanceof Request ? input.url : String(input)).pathname === "/api/auth/jwks"
      ) {
        return auth.handler(new Request(`${pointsOrigin}/api/auth/jwks`, init));
      }
      return originalFetch(input, init);
    });
    try {
      const principal = await verifyPointsResourceRequest(
        new Request(`${pointsResource}/me/connection`, {
          headers: { Authorization: `Bearer ${issuedUserToken.access_token}` },
        }),
        {
          allowedScopes: pointsOAuthScopes.USER,
          audience: pointsResource,
          db,
          issuer: `${pointsOrigin}/api/auth`,
          jwksUrl: `${pointsOrigin}/api/auth/jwks`,
          kind: "USER",
        },
        ["points.connection.unlink"],
      );
      expect(principal).toMatchObject({ clientId, kind: "USER", subject: user.authUserId });

      const app = new Hono<BackendContext>();
      registerOAuthResourceRoutes(app);
      const resourceResponse = await app.request(
        `${pointsResource}/me/connection-deactivations`,
        {
          body: "{}",
          headers: {
            Authorization: `Bearer ${issuedUserToken.access_token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        env as Bindings,
      );
      expect(resourceResponse.status).toBe(422);
      await expect(resourceResponse.json()).resolves.toMatchObject({ code: "VALIDATION_FAILED" });
    } finally {
      jwksFetch.mockRestore();
    }

    const settlementScope = "openid offline_access points.connection.unlink";
    expect(
      (await exchange(await issueCode(marketsCallback, settlementScope), localCallback)).status,
    ).toBe(400);
    const settlementToken = await exchange(
      await issueCode(marketsCallback, settlementScope),
      marketsCallback,
    );
    expect(settlementToken.status).toBe(200);
    expect((await settlementToken.json()) as { refresh_token: string }).toHaveProperty(
      "refresh_token",
    );
  });
});
