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
const origin = "http://localhost:3000";
const resource = `${origin}/api/v1`;
const tokenEndpoint = `${origin}/api/auth/oauth2/token`;

describe("Points private_key_jwt M2M JWT", () => {
  beforeEach(async () => {
    await db.exec(
      "DELETE FROM verification; DELETE FROM oauth_access_token; DELETE FROM oauth_refresh_token; DELETE FROM oauth_consent; DELETE FROM oauth_client_resource; DELETE FROM oauth_client; DELETE FROM oauth_resource; DELETE FROM session; DELETE FROM account; DELETE FROM points_user; DELETE FROM user;",
    );
  });

  it("issues a client_credentials JWT and verifies it with the published JWKS", async () => {
    const auth = createPointsAuth(env as Bindings);
    const user = await seedPointsUser(db);
    const sessionToken = `token-${user.sessionId.slice("session-".length)}`;
    const secret = (await auth.$context).secret;
    const cookieKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = Buffer.from(
      await crypto.subtle.sign("HMAC", cookieKey, new TextEncoder().encode(sessionToken)),
    ).toString("base64");
    const cookie = `points.session_token=${encodeURIComponent(`${sessionToken}.${signature}`)}`;

    const keyPair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const { kty, crv, x } = (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as JsonWebKey;
    const kid = crypto.randomUUID();
    const client = await auth.api.adminCreateOAuthClient({
      headers: new Headers({ Cookie: cookie, Origin: origin }),
      body: {
        client_name: "Markets",
        redirect_uris: ["https://markets.example.test/callback"],
        token_endpoint_auth_method: "private_key_jwt",
        jwks: { keys: [{ kty, crv, x, kid, alg: "EdDSA", use: "sig" }] },
        application_type: "web",
        grant_types: ["authorization_code", "client_credentials"],
        response_types: ["code"],
        scope: "points.reservations.status",
        client_credentials_scopes: ["points.reservations.status"],
        subject_type: "public",
      },
    });

    const now = Math.floor(Date.now() / 1_000);
    const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid })).toString(
      "base64url",
    );
    const payload = Buffer.from(
      JSON.stringify({
        iss: client.client_id,
        sub: client.client_id,
        aud: tokenEndpoint,
        iat: now,
        exp: now + 60,
        jti: crypto.randomUUID(),
      }),
    ).toString("base64url");
    const signingInput = `${header}.${payload}`;
    const assertionSignature = await crypto.subtle.sign(
      { name: "Ed25519" },
      keyPair.privateKey,
      new TextEncoder().encode(signingInput),
    );
    const assertion = `${signingInput}.${Buffer.from(assertionSignature).toString("base64url")}`;

    const tokenResponse = await auth.handler(
      new Request(tokenEndpoint, {
        body: new URLSearchParams({
          client_id: client.client_id,
          client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          client_assertion: assertion,
          grant_type: "client_credentials",
          scope: "points.reservations.status",
          resource,
        }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      }),
    );
    expect(tokenResponse.status).toBe(200);
    const token = (await tokenResponse.json()) as { access_token: string; token_type: string };
    expect(token.token_type.toLowerCase()).toBe("bearer");

    const originalFetch = globalThis.fetch;
    const jwksFetch = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (
        new URL(input instanceof Request ? input.url : String(input)).pathname === "/api/auth/jwks"
      ) {
        return auth.handler(new Request(`${origin}/api/auth/jwks`, init));
      }
      return originalFetch(input, init);
    });
    try {
      const principal = await verifyPointsResourceRequest(
        new Request(`${resource}/point-reservations/status`, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        }),
        {
          allowedScopes: pointsOAuthScopes.M2M,
          audience: resource,
          db,
          issuer: `${origin}/api/auth`,
          jwksUrl: `${origin}/api/auth/jwks`,
          kind: "M2M",
        },
        ["points.reservations.status"],
      );
      expect(principal).toMatchObject({ clientId: client.client_id, kind: "M2M" });

      const app = new Hono<BackendContext>();
      registerOAuthResourceRoutes(app);
      const resourceResponse = await app.request(
        `${resource}/point-reservations/status`,
        {
          body: JSON.stringify({ lookupBy: "POINT_RESERVATION_ID", pointReservationIds: [] }),
          headers: {
            Authorization: `Bearer ${token.access_token}`,
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
  });
});
