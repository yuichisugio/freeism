import { env, SELF } from "cloudflare:test";
import type { TestHelpers } from "better-auth/plugins";
import { describe, expect, it } from "vite-plus/test";

import { createPointsAuth } from "../../src/backend/auth/create-auth";
import { pointsOAuthScopes } from "../../src/backend/auth/points-oauth-provider";
import type { Bindings } from "../../src/backend/http/context";
import { oauthClientLimitPerUser } from "../../src/shared/schemas/oauth-client-schema";

const origin = "http://localhost:3000";

async function login() {
  const auth = createPointsAuth(env as Bindings, { enableTestUtils: true });
  const context = await auth.$context;
  const test = (context as unknown as { test: TestHelpers }).test;
  const user = await test.saveUser(test.createUser());
  const { headers } = await test.login({ userId: user.id });
  headers.set("Origin", origin);
  return { headers, userId: user.id };
}

async function makeInput(overrides: Record<string, unknown> = {}) {
  const keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  return {
    name: "Markets",
    uri: "https://markets.example.test",
    description: "Markets app",
    redirectUris: ["https://markets.example.test/callback"],
    jwks: { keys: [{ ...jwk, kid: crypto.randomUUID(), alg: "EdDSA", use: "sig" }] },
    ...overrides,
  };
}

function request(headers: Headers, path = "", init: { method?: string; body?: unknown } = {}) {
  const requestHeaders = new Headers(headers);
  if (init.body !== undefined) requestHeaders.set("Content-Type", "application/json");
  return SELF.fetch(`${origin}/api/oauth-clients${path}`, {
    method: init.method ?? "GET",
    headers: requestHeaders,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function directAuthRequest(headers: Headers, path: string, body: unknown, method = "POST") {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Content-Type", "application/json");
  return SELF.fetch(`${origin}/api/auth${path}`, {
    method,
    headers: requestHeaders,
    body: JSON.stringify(body),
  });
}

async function register(headers: Headers, input = makeInput()) {
  const response = await request(headers, "", { method: "POST", body: await input });
  expect(response.status).toBe(201);
  const { data } = (await response.json()) as { data: { clientId: string } };
  return data.clientId;
}

describe("Points OAuth クライアント管理", () => {
  it("ログインしていない利用者を拒否する", async () => {
    const response = await request(new Headers());
    expect(response.status).toBe(401);
  });

  it("本人が private_key_jwt クライアントを登録し、一覧と詳細を読める", async () => {
    const { headers, userId } = await login();
    const input = await makeInput({
      uri: null,
      description: null,
      redirectUris: ["https://markets.example.test/callback", "http://localhost:3000/callback"],
    });
    const clientId = await register(headers, Promise.resolve(input));
    const list = await request(headers);
    const detail = await request(headers, `/${clientId}`);
    expect(await list.json()).toMatchObject({ data: { clients: [{ clientId }] } });
    expect(await detail.json()).toEqual({ data: { ...input, clientId } });

    const stored = await env.DB.prepare(
      "SELECT user_id AS userId, client_secret AS clientSecret, token_endpoint_auth_method AS tokenEndpointAuthMethod, application_type AS applicationType, grant_types AS grantTypes FROM oauth_client WHERE client_id = ?",
    )
      .bind(clientId)
      .first<{
        userId: string;
        clientSecret: string | null;
        tokenEndpointAuthMethod: string;
        applicationType: string;
        grantTypes: string;
      }>();
    expect(stored).toMatchObject({
      userId,
      clientSecret: null,
      tokenEndpointAuthMethod: "private_key_jwt",
      applicationType: "native",
    });
    expect(stored?.grantTypes).toContain("client_credentials");
    expect(pointsOAuthScopes.M2M).toHaveLength(6);
  });

  it("必須項目と鍵を検査する", async () => {
    const { headers } = await login();
    const badMetadata = await request(headers, "", {
      method: "POST",
      body: await makeInput({ redirectUris: [] }),
    });
    const badKey = await request(headers, "", {
      method: "POST",
      body: await makeInput({ jwks: { keys: [{ kty: "oct", k: "secret" }] } }),
    });
    expect(badMetadata.status).toBe(400);
    expect(await badMetadata.json()).toMatchObject({ code: "INVALID_VALUE" });
    expect(badKey.status).toBe(400);
    expect(await badKey.json()).toMatchObject({ code: "INVALID_JWKS" });
  });

  it("1人の所有数を5件に制限する", async () => {
    const { headers } = await login();
    for (let index = 0; index < oauthClientLimitPerUser; index += 1) {
      await register(headers, makeInput({ name: `App ${index}` }));
    }
    const response = await request(headers, "", { method: "POST", body: await makeInput() });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "CLIENT_LIMIT_REACHED" });

    const direct = await directAuthRequest(headers, "/oauth2/create-client", {
      client_name: "Sixth app",
      redirect_uris: ["https://markets.example.test/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    });
    expect(direct.status).toBe(404);
  });

  it("Better Auth の直接クライアント変更 API を公開しない", async () => {
    const { headers } = await login();
    const clientId = await register(headers);
    const paths = [
      [
        "/oauth2/update-client",
        { client_id: clientId, update: { client_name: "Bypassed" } },
        "POST",
      ],
      ["/oauth2/delete-client", { client_id: clientId }, "POST"],
      ["/oauth2/client/rotate-secret", { client_id: clientId }, "POST"],
      ["/admin/oauth2/create-client", { client_name: "Bypassed" }, "POST"],
      [
        "/admin/oauth2/update-client",
        { client_id: clientId, update: { client_name: "Bypassed" } },
        "PATCH",
      ],
    ] as const;
    for (const [path, body, method] of paths) {
      const response = await directAuthRequest(headers, path, body, method);
      expect(response.status, path).toBe(404);
    }
    expect((await request(headers, `/${clientId}`)).status).toBe(200);
  });

  it("他人のクライアントを取得・更新・削除できない", async () => {
    const owner = await login();
    const clientId = await register(owner.headers);
    const other = await login();
    const responses = await Promise.all([
      request(other.headers, `/${clientId}`),
      request(other.headers, `/${clientId}`, { method: "PUT", body: await makeInput() }),
      request(other.headers, `/${clientId}`, { method: "DELETE" }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
    expect((await request(owner.headers, `/${clientId}`)).status).toBe(200);
  });

  it("情報・公開鍵の更新と紹介URLの削除を反映し、本人が削除できる", async () => {
    const { headers } = await login();
    const clientId = await register(headers);
    const updated = await makeInput({
      name: "Updated",
      uri: null,
      description: null,
      redirectUris: ["http://127.0.0.1:8787/callback"],
    });
    const response = await request(headers, `/${clientId}`, { method: "PUT", body: updated });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { ...updated, clientId } });
    const row = await env.DB.prepare("SELECT uri, jwks FROM oauth_client WHERE client_id = ?")
      .bind(clientId)
      .first<{ uri: string | null; jwks: string }>();
    expect(row?.uri).toBeNull();
    expect(JSON.parse(row!.jwks)).toEqual(updated.jwks);
    const deleted = await request(headers, `/${clientId}`, { method: "DELETE" });
    expect(deleted.status).toBe(200);
    expect((await request(headers, `/${clientId}`)).status).toBe(404);
  });
});
