import { exports } from "cloudflare:workers";
import * as v from "valibot";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRandomId } from "../../src/backend/db/id";
import {
  externalAccountListResponseSchema,
  resolveResponseSchema,
  resourceApiErrorResponseSchema,
} from "../../src/shared/schemas/resource-api-schema";
import { encryptTestOAuthToken, getTestAuthContext } from "../auth-test-helpers";
import { readExternalAccounts } from "../external-account-test-helpers";
import {
  createClientAssertion,
  createDpopProof,
  fetchOAuthClients,
  generateTestKeyPair,
  loginAsNewUser,
  resourceApiIdentifier,
  testOrigin,
  type TestKeyPair,
} from "../oauth-client-test-helpers";
import {
  fetchResourceApi,
  registerTestClient,
  saveVisibility,
  testRedirectUri,
  type ResourceApiCaller,
} from "../resource-api-test-helpers";

/**
 * 利用側サービス（Points）とAccountsの契約テスト。
 * Pointsを模したクライアントが、主仕様「貢献者照合の流れ」の順にAccountsを呼ぶ。
 * 応答の形は、資源APIが外部契約として公開する共有schemaで検査する。
 * @see ../../docs/specification/v0.1/main.ja.md
 * @see ../../src/backend/openapi/resource-api-openapi-document.ts
 */

afterEach(() => {
  vi.restoreAllMocks();
});

// --------------------------------------------------
// 基本部品
// --------------------------------------------------

/**
 * 認可サーバーのメタデータのうち、Pointsが使う項目。
 */
type OpenIdConfiguration = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

/**
 * Better Authのレート制限はIPごとに数えるため、テストごとに別の送信元IPを使う。
 */
function createTestIp(): string {
  const [first = 0, second = 0, third = 0] = crypto.getRandomValues(new Uint8Array(3));
  return `10.${first}.${second}.${third}`;
}

function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/**
 * JWTのheader・payloadを読む。
 */
function decodeJwtPart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

/**
 * 応答bodyを共有schemaで検査して返す。
 */
async function readAs<TSchema extends v.GenericSchema>(
  response: Response,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
  return v.parse(schema, await response.json());
}

// --------------------------------------------------
// Pointsのバックエンド
// --------------------------------------------------

/**
 * Accountsへ接続するPointsのバックエンド。
 * 秘密鍵（client assertion用・DPoP用）を保管し、Accountsから取得したメタデータで各endpointを呼ぶ。
 */
type PointsBackend = {
  clientId: string;
  clientKey: TestKeyPair;
  dpopKey: TestKeyPair;
  ip: string;
  configuration: OpenIdConfiguration;
};

/**
 * 接続先AccountsのOpenID Providerメタデータを取得する。
 */
async function discoverAccounts(): Promise<OpenIdConfiguration> {
  const response = await exports.default.fetch(`${testOrigin}/.well-known/openid-configuration`);
  expect(response.status).toBe(200);
  return (await response.json()) as OpenIdConfiguration;
}

/**
 * `private_key_jwt`のclient assertionとDPoP proofを付けてtoken endpointを呼ぶ。
 */
async function requestToken(points: PointsBackend, grant: Record<string, string>) {
  const tokenEndpoint = points.configuration.token_endpoint;
  return exports.default.fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "CF-Connecting-IP": points.ip,
      DPoP: await createDpopProof(points.dpopKey, { method: "POST", url: tokenEndpoint }),
    },
    body: new URLSearchParams({
      ...grant,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: await createClientAssertion(points.clientId, points.clientKey),
    }),
  });
}

/**
 * Client Credentialsで資源API用のAccess Tokenを取得し、資源APIの呼出し元を返す。
 */
async function connectResourceApi(points: PointsBackend): Promise<ResourceApiCaller> {
  const response = await requestToken(points, {
    grant_type: "client_credentials",
    scope: "identities:read",
    resource: resourceApiIdentifier,
  });
  expect(response.status).toBe(200);
  const token = (await response.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };
  expect(token).toMatchObject({ token_type: "DPoP", expires_in: 900 });
  return { clientId: points.clientId, accessToken: token.access_token, dpopKey: points.dpopKey };
}

/**
 * ID Tokenの署名をAccountsのJWKSで検証し、claimsを返す。
 */
async function verifyIdTokenSignature(
  points: PointsBackend,
  idToken: string,
): Promise<Record<string, unknown>> {
  const [encodedHeader = "", encodedPayload = "", encodedSignature = ""] = idToken.split(".");
  const header = decodeJwtPart(encodedHeader);
  const jwksResponse = await exports.default.fetch(points.configuration.jwks_uri);
  const { keys } = (await jwksResponse.json()) as { keys: (JsonWebKey & { kid?: string })[] };
  const jwk = keys.find((key) => key.kid === header.kid);
  expect(header.alg).toBe("EdDSA");
  expect(jwk).toBeDefined();

  const publicKey = await crypto.subtle.importKey("jwk", jwk ?? {}, { name: "Ed25519" }, false, [
    "verify",
  ]);
  const isValid = await crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    Buffer.from(encodedSignature, "base64url"),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  expect(isValid).toBe(true);
  return decodeJwtPart(encodedPayload);
}

// --------------------------------------------------
// 利用者のブラウザー
// --------------------------------------------------

/**
 * Pointsが連携開始時に作り、戻り先の処理まで保持する値。
 */
type LinkingSession = {
  state: string;
  nonce: string;
  codeVerifier: string;
};

/**
 * 連携開始時のstate・nonce・PKCEのcode verifierとcode challengeを作る。
 */
async function startLinking(): Promise<LinkingSession & { codeChallenge: string }> {
  const codeVerifier = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return {
    state: crypto.randomUUID(),
    nonce: crypto.randomUUID(),
    codeVerifier,
    codeChallenge: encodeBase64Url(new Uint8Array(digest)),
  };
}

/**
 * 利用者のブラウザーで認可エンドポイントを開く（`prompt=consent`付き）。
 * 移動先を確認するため、リダイレクトをたどらない。
 */
async function openAuthorization(
  browser: Headers,
  points: PointsBackend,
  linking: LinkingSession & { codeChallenge: string },
): Promise<Response> {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: points.clientId,
    redirect_uri: testRedirectUri,
    scope: "openid",
    state: linking.state,
    nonce: linking.nonce,
    code_challenge: linking.codeChallenge,
    code_challenge_method: "S256",
    prompt: "consent",
  });
  return exports.default.fetch(`${points.configuration.authorization_endpoint}?${query}`, {
    headers: browser,
    redirect: "manual",
  });
}

/**
 * 認可要求が「アカウント連携」画面（同意画面）へ移動したことを確認し、画面が`oauth2.consent`へ渡す署名付きクエリを返す。
 */
function readConsentPageQuery(response: Response): string {
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("location") ?? "", testOrigin);
  expect(location.pathname).toBe("/account-links");
  expect(location.searchParams.get("sig")).toEqual(expect.any(String));
  return location.search.slice(1);
}

/**
 * 同意画面で「同意して戻る」を押す（Better Auth標準の`oauth2.consent`）。
 * 画面は、同意ONと公開対象を保存してから`accept: true`を送る。
 * @returns 利用側の戻り先URL
 */
async function acceptOnConsentPage(
  browser: Headers,
  oauthQuery: string,
  { clientId, visibleAccountIds }: { clientId: string; visibleAccountIds: string[] },
): Promise<URL> {
  const saved = await saveVisibility(browser, {
    clients: [{ clientId, consented: true, visibleAccountIds }],
  });
  expect(saved.status).toBe(200);

  const headers = new Headers(browser);
  headers.set("Content-Type", "application/json");
  const response = await exports.default.fetch(`${testOrigin}/api/auth/oauth2/consent`, {
    method: "POST",
    headers,
    body: JSON.stringify({ accept: true, oauth_query: oauthQuery }),
  });
  expect(response.status).toBe(200);
  return new URL(((await response.json()) as { url: string }).url);
}

// --------------------------------------------------
// 利用者と外部アカウント
// --------------------------------------------------

/**
 * AccountsへログインしてGitHubを連携した利用者を作る。
 * GitHubの連携は標準の`account`作成から独自表の同期までを通し、Provider APIの応答だけを固定する。
 */
async function createOwnerWithGitHub() {
  const owner = await loginAsNewUser();
  owner.headers.set("CF-Connecting-IP", createTestIp());
  const login = `Octo${createRandomId().slice(0, 8).replace(/[^A-Za-z0-9]/g, "x")}`;
  const githubAccountId = String(crypto.getRandomValues(new Uint32Array(1))[0]);
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    if (request.url === "https://api.github.com/user") {
      return Response.json({ id: Number(githubAccountId), login, name: null, email: null });
    }
    if (request.url === "https://api.github.com/user/emails") {
      return Response.json([]);
    }
    throw new Error(`Unexpected fetch: ${request.url}`);
  });

  const context = await getTestAuthContext();
  await context.internalAdapter.createAccount({
    userId: owner.userId,
    providerId: "github",
    accountId: githubAccountId,
    accessToken: await encryptTestOAuthToken("gho_contract_test"),
  });
  fetchSpy.mockRestore();

  const [externalAccount] = await readExternalAccounts(owner.userId);
  expect(externalAccount?.service).toBe("github");
  return {
    ...owner,
    github: { externalAccountId: externalAccount?.id ?? "", login, accountId: githubAccountId },
  };
}

// --------------------------------------------------
// 接続の準備
// --------------------------------------------------

/**
 * 開発者がPointsをOAuthクライアントとして登録し、利用者がPointsからAccountsとの連携を完了するまで。
 * Pointsは連携開始時のstate・nonce・PKCEを戻り先の処理で照合し、ID Tokenで本人を確定する。
 */
async function linkPointsToAccounts() {
  // (a) 開発者が「開発者向け」画面でクライアントを登録する。
  const developer = await loginAsNewUser();
  const { clientId, clientKey } = await registerTestClient(developer.headers);
  const points: PointsBackend = {
    clientId,
    clientKey,
    dpopKey: await generateTestKeyPair("points-dpop-key"),
    ip: createTestIp(),
    configuration: await discoverAccounts(),
  };

  // (b) 利用者がPointsから連携を開始し、同意画面で提供するアカウントを選んで同意する。
  const owner = await createOwnerWithGitHub();
  const linking = await startLinking();
  const oauthQuery = readConsentPageQuery(await openAuthorization(owner.headers, points, linking));
  const callback = await acceptOnConsentPage(owner.headers, oauthQuery, {
    clientId,
    visibleAccountIds: [owner.github.externalAccountId],
  });
  expect(`${callback.origin}${callback.pathname}`).toBe(testRedirectUri);
  expect(callback.searchParams.get("state")).toBe(linking.state);

  const tokenResponse = await requestToken(points, {
    grant_type: "authorization_code",
    code: callback.searchParams.get("code") ?? "",
    redirect_uri: testRedirectUri,
    code_verifier: linking.codeVerifier,
  });
  expect(tokenResponse.status).toBe(200);
  const { id_token: idToken } = (await tokenResponse.json()) as { id_token: string };
  const idTokenClaims = await verifyIdTokenSignature(points, idToken);

  return { developer, owner, points, linking, idTokenClaims };
}

function listExternalAccounts(caller: ResourceApiCaller, accountsUserId: string) {
  return fetchResourceApi(caller, "/api/v1/external-accounts", { body: { accountsUserId } });
}

function resolve(caller: ResourceApiCaller, identifiers: unknown[]) {
  return fetchResourceApi(caller, "/api/v1/identities/resolve", { body: { identifiers } });
}

// --------------------------------------------------
// 契約
// --------------------------------------------------

describe("Pointsを模した利用側クライアント", () => {
  it("(a)(b) 登録したクライアントでprompt=consentの同意を経てコードを交換し、ID Tokenのiss・sub・nonce・audを確認できる", async () => {
    const { owner, points, linking, idTokenClaims } = await linkPointsToAccounts();

    expect(points.configuration.issuer).toBe(testOrigin);
    expect(idTokenClaims).toMatchObject({
      iss: testOrigin,
      sub: owner.userId,
      aud: points.clientId,
      nonce: linking.nonce,
    });
    expect(idTokenClaims.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it("(c) Client CredentialsのDPoP付きAccess Tokenで、提供された一覧を取得し、4種類の識別子を照合できる", async () => {
    const { owner, points } = await linkPointsToAccounts();
    const caller = await connectResourceApi(points);

    const list = await readAs(
      await listExternalAccounts(caller, owner.userId),
      externalAccountListResponseSchema,
    );
    const resolveResponse = await resolve(caller, [
      { type: "url", url: `https://github.com/${owner.github.login}` },
      { type: "provider_username", provider: "github", username: owner.github.login },
      { type: "provider_account", provider: "github", accountId: owner.github.accountId },
      { type: "accounts_user", accountsUserId: owner.userId },
      { type: "url", url: "https://example.org/not-linked" },
    ]);

    expect(list).toMatchObject({ accountsOrigin: testOrigin, accountsUserId: owner.userId });
    expect(list.externalAccounts).toEqual([
      expect.objectContaining({
        service: "github",
        verificationStatus: "verified",
        identifiers: expect.arrayContaining([
          { type: "provider_account", provider: "github", accountId: owner.github.accountId },
          { type: "url", url: `https://github.com/${owner.github.login}` },
        ]),
      }),
    ]);
    expect(resolveResponse.status).toBe(200);
    const { results } = await readAs(resolveResponse, resolveResponseSchema);
    expect(results.map(({ status, accountsUserId }) => ({ status, accountsUserId }))).toEqual([
      { status: "matched", accountsUserId: owner.userId },
      { status: "matched", accountsUserId: owner.userId },
      { status: "matched", accountsUserId: owner.userId },
      { status: "matched", accountsUserId: owner.userId },
      { status: "no_match", accountsUserId: null },
    ]);
  });

  it("(c) 照合は1,000件まで入力順に返し、1,001件は照合せずに最上位のerrorsで400を返す", async () => {
    const { owner, points } = await linkPointsToAccounts();
    const caller = await connectResourceApi(points);
    const unknownUsers = Array.from({ length: 999 }, (_, index) => ({
      type: "provider_username",
      provider: "github",
      username: `unknown-${index}`,
    }));
    const matched = { type: "accounts_user", accountsUserId: owner.userId };

    const atLimit = await resolve(caller, [...unknownUsers, matched]);
    const overLimit = await resolve(caller, [...unknownUsers, matched, matched]);

    expect(atLimit.status).toBe(200);
    const { results } = await readAs(atLimit, resolveResponseSchema);
    expect(results).toHaveLength(1000);
    expect(results[999]).toMatchObject({ index: 999, status: "matched" });
    expect(overLimit.status).toBe(400);
    expect(await readAs(overLimit, resourceApiErrorResponseSchema)).toEqual({
      errors: [expect.objectContaining({ code: "INVALID_VALUE", path: ["identifiers"] })],
    });
  });

  it("(d) 同意をOFFで保存すると一覧は404・照合はno_matchになり、再連携では同意画面を表示する", async () => {
    const { owner, points } = await linkPointsToAccounts();
    const caller = await connectResourceApi(points);

    const saved = await saveVisibility(owner.headers, {
      clients: [
        {
          clientId: points.clientId,
          consented: false,
          visibleAccountIds: [owner.github.externalAccountId],
        },
      ],
    });
    const list = await listExternalAccounts(caller, owner.userId);
    const resolveResponse = await resolve(caller, [
      { type: "url", url: `https://github.com/${owner.github.login}` },
      { type: "accounts_user", accountsUserId: owner.userId },
    ]);
    const relinking = await openAuthorization(owner.headers, points, await startLinking());

    expect(saved.status).toBe(200);
    expect(list.status).toBe(404);
    expect(await readAs(list, resourceApiErrorResponseSchema)).toEqual({
      errors: [expect.objectContaining({ code: "NOT_FOUND", path: null })],
    });
    const { results } = await readAs(resolveResponse, resolveResponseSchema);
    expect(results.map(({ status }) => status)).toEqual(["no_match", "no_match"]);
    readConsentPageQuery(relinking);
  });

  it("(e) 開発者がクライアントを削除すると、発行済みのAccess Tokenは401になる", async () => {
    const { developer, owner, points } = await linkPointsToAccounts();
    const caller = await connectResourceApi(points);

    const removed = await fetchOAuthClients(developer.headers, `/${points.clientId}`, {
      method: "DELETE",
    });
    const response = await listExternalAccounts(caller, owner.userId);

    expect(removed.status).toBe(200);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toEqual(expect.any(String));
    expect(await readAs(response, resourceApiErrorResponseSchema)).toEqual({
      errors: [expect.objectContaining({ code: "UNAUTHORIZED", path: null })],
    });
  });

  it("(f) 利用者が退会すると、一覧は404・照合はno_matchになる", async () => {
    const { owner, points } = await linkPointsToAccounts();
    const caller = await connectResourceApi(points);

    const withdrawn = await exports.default.fetch(`${testOrigin}/api/auth/delete-user`, {
      method: "POST",
      headers: new Headers([...owner.headers, ["Content-Type", "application/json"]]),
      body: JSON.stringify({}),
    });
    const list = await listExternalAccounts(caller, owner.userId);
    const resolveResponse = await resolve(caller, [
      { type: "provider_account", provider: "github", accountId: owner.github.accountId },
      { type: "accounts_user", accountsUserId: owner.userId },
    ]);

    expect(withdrawn.status).toBe(200);
    expect(list.status).toBe(404);
    expect(await readAs(list, resourceApiErrorResponseSchema)).toEqual({
      errors: [expect.objectContaining({ code: "NOT_FOUND" })],
    });
    const { results } = await readAs(resolveResponse, resolveResponseSchema);
    expect(results.map(({ status }) => status)).toEqual(["no_match", "no_match"]);
  });
});
