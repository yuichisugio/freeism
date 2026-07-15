import { describe, expect, it } from "vite-plus/test";
import { betterAuth } from "better-auth/minimal";
import { oauthProvider } from "@better-auth/oauth-provider";

async function signTestIdToken(clientId: string, clientSecret: string): Promise<string> {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://points.example.test/api/auth",
      aud: clientId,
      sub: "test-user",
      exp: Math.floor(Date.now() / 1000) + 300,
    }),
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${Buffer.from(signature).toString("base64url")}`;
}

describe("Better Auth OAuth provider contract", () => {
  it("enforces separate user and M2M clients and rejects ID tokens as access tokens", async () => {
    const auth = betterAuth({
      baseURL: "https://points.example.test",
      basePath: "/api/auth",
      secret: "test-auth-secret-at-least-thirty-two-characters",
      logger: { disabled: true },
      plugins: [
        oauthProvider({
          loginPage: "/login",
          consentPage: "/oauth/consent",
          disableJwtPlugin: true,
          pairwiseSecret: "test-pairwise-secret-at-least-thirty-two-characters",
          scopes: ["openid", "profile", "points.connection.read", "points.reservations.capture"],
          allowDynamicClientRegistration: true,
          validateInitialAccessToken: ({ initialAccessToken }) =>
            initialAccessToken === "test-initial-access" ? {} : false,
        }),
      ],
    });
    const registration = await auth.handler(
      new Request("https://points.example.test/api/auth/oauth2/register", {
        method: "POST",
        headers: {
          authorization: "Bearer test-initial-access",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          client_name: "Gate A test client",
          redirect_uris: ["https://markets.example.test/callback"],
          grant_types: ["authorization_code"],
          response_types: ["code"],
          token_endpoint_auth_method: "client_secret_post",
          scope: "openid profile points.connection.read",
          subject_type: "pairwise",
        }),
      }),
    );
    expect(registration.ok).toBe(true);
    const client = (await registration.json()) as {
      client_id: string;
      client_secret: string;
    };
    const m2mRegistration = await auth.handler(
      new Request("https://points.example.test/api/auth/oauth2/register", {
        method: "POST",
        headers: {
          authorization: "Bearer test-initial-access",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          client_name: "Gate A M2M client",
          grant_types: ["client_credentials"],
          token_endpoint_auth_method: "client_secret_post",
          scope: "points.reservations.capture",
        }),
      }),
    );
    expect(m2mRegistration.ok).toBe(true);
    const m2mClient = (await m2mRegistration.json()) as {
      client_id: string;
      client_secret: string;
    };

    const m2mTokenResponse = await auth.handler(
      new Request("https://points.example.test/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: m2mClient.client_id,
          client_secret: m2mClient.client_secret,
          scope: "points.reservations.capture",
        }),
      }),
    );
    expect(m2mTokenResponse.ok).toBe(true);
    const m2mToken = (await m2mTokenResponse.json()) as {
      access_token: string;
      scope: string;
    };
    expect(m2mToken.access_token.split(".")).toHaveLength(1);
    expect(m2mToken.scope).toBe("points.reservations.capture");

    const m2mIntrospection = await auth.handler(
      new Request("https://points.example.test/api/auth/oauth2/introspect", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: m2mClient.client_id,
          client_secret: m2mClient.client_secret,
          token: m2mToken.access_token,
          token_type_hint: "access_token",
        }),
      }),
    );
    expect(m2mIntrospection.ok).toBe(true);
    const m2mPayload = (await m2mIntrospection.json()) as {
      active: boolean;
      scope: string;
      sub?: string;
    };
    expect(m2mPayload).toMatchObject({
      active: true,
      scope: "points.reservations.capture",
    });
    expect(m2mPayload.sub).toBeUndefined();

    const m2mWithUserScope = await auth.handler(
      new Request("https://points.example.test/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: m2mClient.client_id,
          client_secret: m2mClient.client_secret,
          scope: "points.connection.read",
        }),
      }),
    );
    expect(m2mWithUserScope.ok).toBe(false);

    const userClientCredentials = await auth.handler(
      new Request("https://points.example.test/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: client.client_id,
          client_secret: client.client_secret,
          scope: "points.connection.read",
        }),
      }),
    );
    expect(userClientCredentials.ok).toBe(false);

    const idToken = await signTestIdToken(client.client_id, client.client_secret);

    const introspection = await auth.handler(
      new Request("https://points.example.test/api/auth/oauth2/introspect", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: client.client_id,
          client_secret: client.client_secret,
          token: idToken,
          token_type_hint: "access_token",
        }),
      }),
    );
    expect(introspection.ok).toBe(false);
  });
});
