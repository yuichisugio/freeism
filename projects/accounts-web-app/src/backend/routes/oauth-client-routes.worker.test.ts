import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchOAuthClients,
  generateTestKeyPair,
  loginAsNewUser,
  resourceApiIdentifier,
  toJwks,
} from "../../../test/oauth-client-test-helpers";
import { oauthClientLimitPerUser } from "../../shared/constants";
import { createDatabase } from "../db/database";
import { D1OAuthClientRepository } from "../db/repositories/d1-oauth-client-repository";
import { createRandomId } from "../db/id";
import {
  clientConsents,
  externalAccounts,
  externalAccountVisibility,
  oauthClient,
  oauthClientResource,
  user,
} from "../db/schema";

const db = createDatabase(env.DB);

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

/**
 * Better Authのadapterが文字列化して保存したJSON列を読む。
 * Drizzleの`mode: "json"`の読取結果はJSON文字列のままになる。
 */
function readJsonColumn(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

/**
 * 登録入力を作る。
 */
async function createClientInput(overrides: Record<string, unknown> = {}) {
  const keyPair = await generateTestKeyPair("key-1");
  return {
    name: "Points",
    uri: "https://points.example",
    description: "貢献の記録",
    redirectUris: ["https://points.example/callback"],
    jwks: toJwks(keyPair),
    ...overrides,
  };
}

/**
 * ログインしてクライアントを1件登録する。
 */
async function registerClient(overrides: Record<string, unknown> = {}) {
  const { userId, headers } = await loginAsNewUser();
  const response = await fetchOAuthClients(headers, "", {
    method: "POST",
    body: await createClientInput(overrides),
  });
  expect(response.status).toBe(201);
  const { data } = (await response.json()) as { data: { clientId: string } };
  return { userId, headers, clientId: data.clientId };
}

/**
 * 別ユーザーの、指定クライアントへの情報提供同意と公開選択を保存する。
 */
async function saveClientSettings(clientId: string) {
  const userId = createRandomId("ausr_");
  const accountId = createRandomId();
  await db.insert(user).values({ id: userId, name: "仮ユーザー", email: `${userId}@example.com` });
  await db.insert(externalAccounts).values({ id: accountId, userId });
  await db
    .insert(clientConsents)
    .values({ userId, clientId, displayName: "Points", consented: true });
  await db.insert(externalAccountVisibility).values({ accountId, clientId, isPublic: true });
  return { userId, accountId };
}

// --------------------------------------------------
// 認証と入力検証
// --------------------------------------------------

describe("/api/oauth-clientsの認証と入力検証", () => {
  it("ログインしていない要求は401を返す", async () => {
    const response = await fetchOAuthClients(new Headers());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("必須項目の不足・HTTPのリダイレクトURLは項目の位置付きで400を返す", async () => {
    const { headers } = await loginAsNewUser();

    const response = await fetchOAuthClients(headers, "", {
      method: "POST",
      body: await createClientInput({ name: "", redirectUris: ["http://points.example/callback"] }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    const problem = (await response.json()) as { code: string; errors: { path: unknown[] }[] };
    expect(problem.code).toBe("INVALID_VALUE");
    expect(problem.errors.map((error) => error.path)).toEqual([["name"], ["redirectUris", 0]]);
  });

  it("リダイレクトURLが0件なら400を返す", async () => {
    const { headers } = await loginAsNewUser();

    const response = await fetchOAuthClients(headers, "", {
      method: "POST",
      body: await createClientInput({ redirectUris: [] }),
    });

    expect(response.status).toBe(400);
  });

  it.each([
    { label: "秘密鍵を含む", key: { kty: "OKP", crv: "Ed25519", x: "AAAA", d: "AAAA" } },
    { label: "共通鍵", key: { kty: "oct", k: "AAAA" } },
    { label: "鍵種別と合わないalg", key: { kty: "OKP", crv: "Ed25519", x: "AAAA", alg: "RS256" } },
  ])("標準の検査で不正な公開鍵（$label）は400 INVALID_JWKSを返す", async ({ key }) => {
    const { headers } = await loginAsNewUser();

    const response = await fetchOAuthClients(headers, "", {
      method: "POST",
      body: await createClientInput({ jwks: { keys: [key] } }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_JWKS" });
  });
});

// --------------------------------------------------
// 登録・一覧・取得
// --------------------------------------------------

describe("OAuthクライアントの登録", () => {
  it("private_key_jwt・DPoP・Client Credentials用scopeを設定して登録し、一覧と取得で返す", async () => {
    const input = await createClientInput();
    const { headers } = await loginAsNewUser();

    const created = await fetchOAuthClients(headers, "", { method: "POST", body: input });

    expect(created.status).toBe(201);
    const { data } = (await created.json()) as { data: { clientId: string } };
    expect(data).toEqual({
      clientId: expect.any(String),
      name: "Points",
      uri: "https://points.example",
      description: "貢献の記録",
      redirectUris: ["https://points.example/callback"],
      jwks: input.jwks,
    });

    const [row] = await db
      .select()
      .from(oauthClient)
      .where(eq(oauthClient.clientId, data.clientId));
    expect(row).toMatchObject({
      tokenEndpointAuthMethod: "private_key_jwt",
      dpopBoundAccessTokens: true,
      applicationType: "web",
      clientSecret: null,
    });
    expect({
      clientCredentialsScopes: readJsonColumn(row?.clientCredentialsScopes),
      scopes: readJsonColumn(row?.scopes),
      grantTypes: readJsonColumn(row?.grantTypes),
      responseTypes: readJsonColumn(row?.responseTypes),
    }).toEqual({
      clientCredentialsScopes: ["identities:read"],
      scopes: ["openid"],
      grantTypes: ["authorization_code", "client_credentials"],
      responseTypes: ["code"],
    });
    const resources = await db
      .select({ resourceId: oauthClientResource.resourceId })
      .from(oauthClientResource)
      .where(eq(oauthClientResource.clientId, data.clientId));
    expect(resources).toEqual([{ resourceId: resourceApiIdentifier }]);

    const list = await fetchOAuthClients(headers);
    expect(await list.json()).toEqual({ data: { clients: [data] } });

    const detail = await fetchOAuthClients(headers, `/${data.clientId}`);
    expect(await detail.json()).toEqual({ data });
  });

  it("紹介URL・説明文が未入力でも登録できる", async () => {
    const { headers } = await loginAsNewUser();

    const response = await fetchOAuthClients(headers, "", {
      method: "POST",
      body: await createClientInput({ uri: null, description: null }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { uri: null, description: null } });
  });

  it("ローカル開発用のリダイレクトURLを含むクライアントはnativeとして登録する", async () => {
    const { clientId } = await registerClient({
      redirectUris: ["https://points.example/callback", "http://localhost:3000/callback"],
    });

    const [row] = await db.select().from(oauthClient).where(eq(oauthClient.clientId, clientId));
    expect(row?.applicationType).toBe("native");
  });

  it(`1人が所有できるのは${oauthClientLimitPerUser}件までで、超える登録は409を返す`, async () => {
    const { userId, headers } = await loginAsNewUser();
    for (let index = 0; index < oauthClientLimitPerUser; index += 1) {
      const response = await fetchOAuthClients(headers, "", {
        method: "POST",
        body: await createClientInput({ name: `Client ${index}` }),
      });
      expect(response.status).toBe(201);
    }

    const response = await fetchOAuthClients(headers, "", {
      method: "POST",
      body: await createClientInput(),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "CLIENT_LIMIT_REACHED" });
    expect(await db.select().from(oauthClient).where(eq(oauthClient.userId, userId))).toHaveLength(
      oauthClientLimitPerUser,
    );
  });

  it("他人のクライアントは取得・更新・削除で404を返す", async () => {
    const { clientId } = await registerClient();
    const other = await loginAsNewUser();

    const read = await fetchOAuthClients(other.headers, `/${clientId}`);
    const update = await fetchOAuthClients(other.headers, `/${clientId}`, {
      method: "PUT",
      body: await createClientInput(),
    });
    const remove = await fetchOAuthClients(other.headers, `/${clientId}`, { method: "DELETE" });

    expect([read.status, update.status, remove.status]).toEqual([404, 404, 404]);
    expect(
      await db.select().from(oauthClient).where(eq(oauthClient.clientId, clientId)),
    ).toHaveLength(1);
  });
});

// --------------------------------------------------
// 更新
// --------------------------------------------------

describe("OAuthクライアントの更新", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("アプリ情報・リダイレクトURL・application_type・公開鍵を1回の保存で反映する", async () => {
    const { headers, clientId } = await registerClient();
    const oldKey = await generateTestKeyPair("key-1");
    const newKey = await generateTestKeyPair("key-2");

    const response = await fetchOAuthClients(headers, `/${clientId}`, {
      method: "PUT",
      body: {
        name: "Points (staging)",
        uri: null,
        description: null,
        redirectUris: ["https://points.example/callback", "http://127.0.0.1:8787/callback"],
        jwks: toJwks(oldKey, newKey),
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        clientId,
        name: "Points (staging)",
        uri: null,
        description: null,
        redirectUris: ["https://points.example/callback", "http://127.0.0.1:8787/callback"],
        jwks: toJwks(oldKey, newKey),
      },
    });
    const [row] = await db.select().from(oauthClient).where(eq(oauthClient.clientId, clientId));
    expect(row).toMatchObject({ applicationType: "native", uri: null });
    expect(JSON.parse(row?.jwks ?? "null")).toEqual(toJwks(oldKey, newKey));
    expect(row?.tokenEndpointAuthMethod).toBe("private_key_jwt");
    expect(readJsonColumn(row?.clientCredentialsScopes)).toEqual(["identities:read"]);
  });

  it("公開鍵の保存だけが失敗した場合は500 `CLIENT_KEY_SAVE_FAILED`を返し、同じ内容の再保存で反映する", async () => {
    const { headers, clientId } = await registerClient();
    const newKey = await generateTestKeyPair("key-2");
    const input = await createClientInput({ name: "Renamed", jwks: toJwks(newKey) });
    vi.spyOn(D1OAuthClientRepository.prototype, "updateAccountsManagedFields").mockRejectedValueOnce(
      new Error("D1_ERROR"),
    );

    const failed = await fetchOAuthClients(headers, `/${clientId}`, { method: "PUT", body: input });
    const retried = await fetchOAuthClients(headers, `/${clientId}`, { method: "PUT", body: input });

    expect(failed.status).toBe(500);
    expect(await failed.json()).toMatchObject({ code: "CLIENT_KEY_SAVE_FAILED" });
    expect(retried.status).toBe(200);
    const [row] = await db.select().from(oauthClient).where(eq(oauthClient.clientId, clientId));
    expect(row?.name).toBe("Renamed");
    expect(JSON.parse(row?.jwks ?? "null")).toEqual(toJwks(newKey));
  });

  it("不正な公開鍵は標準の更新より前に拒否し、保存済みの設定を変えない", async () => {
    const { headers, clientId } = await registerClient();
    const [before] = await db.select().from(oauthClient).where(eq(oauthClient.clientId, clientId));

    const response = await fetchOAuthClients(headers, `/${clientId}`, {
      method: "PUT",
      body: await createClientInput({
        name: "Renamed",
        jwks: { keys: [{ kty: "oct", k: "AAAA" }] },
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_JWKS" });
    const [after] = await db.select().from(oauthClient).where(eq(oauthClient.clientId, clientId));
    expect(after).toEqual(before);
  });
});

// --------------------------------------------------
// 削除
// --------------------------------------------------

describe("OAuthクライアントの削除", () => {
  it("標準のクライアントと、そのClient IDの同意・公開選択だけを削除する", async () => {
    const { headers, clientId } = await registerClient();
    const other = await registerClient();
    const settings = await saveClientSettings(clientId);
    await db.insert(clientConsents).values({
      userId: settings.userId,
      clientId: other.clientId,
      displayName: "Other",
      consented: true,
    });
    await db
      .insert(externalAccountVisibility)
      .values({ accountId: settings.accountId, clientId: other.clientId, isPublic: true });

    const response = await fetchOAuthClients(headers, `/${clientId}`, { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { ok: true } });
    expect(await db.select().from(oauthClient).where(eq(oauthClient.clientId, clientId))).toEqual(
      [],
    );
    expect(
      await db
        .select({ clientId: clientConsents.clientId })
        .from(clientConsents)
        .where(eq(clientConsents.userId, settings.userId)),
    ).toEqual([{ clientId: other.clientId }]);
    expect(
      await db
        .select({ clientId: externalAccountVisibility.clientId })
        .from(externalAccountVisibility)
        .where(eq(externalAccountVisibility.accountId, settings.accountId)),
    ).toEqual([{ clientId: other.clientId }]);

    const read = await fetchOAuthClients(headers, `/${clientId}`);
    expect(read.status).toBe(404);
  });
});
