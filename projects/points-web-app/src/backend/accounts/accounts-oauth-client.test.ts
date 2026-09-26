import { describe, expect, it } from "vite-plus/test";

import { createFakeAccounts, type FakeAccounts } from "../../../test/support/fake-accounts";
import { discoverAccounts } from "./accounts-discovery";
import {
  generateAccountsSigningKey,
  importAccountsSigningKeyPair,
  toAccountsPublicJwks,
} from "./accounts-key-vault";
import {
  createAccountsAuthorizationRequest,
  exchangeAccountsAuthorizationCode,
  requestAccountsClientCredentialsToken,
  type AccountsOAuthContext,
} from "./accounts-oauth-client";
import { decodeBase64Url, encodeBase64Url } from "./base64url";

const clientId = "points-client";
const redirectUri = "https://points.example.test/api/accounts-links/callback";

// --------------------------------------------------
// 準備
// --------------------------------------------------

function decodeJwt(jwt: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
} {
  const [header = "", payload = ""] = jwt.split(".");
  const decode = (part: string) =>
    JSON.parse(new TextDecoder().decode(decodeBase64Url(part))) as Record<string, unknown>;
  return { header: decode(header), payload: decode(payload) };
}

/**
 * テスト用Accountsへクライアントを登録し、Pointsの接続先を用意する。
 */
async function setUp(): Promise<{ accounts: FakeAccounts; context: AccountsOAuthContext }> {
  const accounts = await createFakeAccounts();
  const clientKey = await generateAccountsSigningKey();
  const dpopKey = await generateAccountsSigningKey();
  accounts.registerClient(clientId, toAccountsPublicJwks(clientKey.publicJwk));
  const endpoint = { accountsOrigin: accounts.origin, fetch: accounts.fetch };
  const context: AccountsOAuthContext = {
    endpoint,
    authorizationServer: await discoverAccounts(endpoint),
    client: {
      clientId,
      clientKey: await importAccountsSigningKeyPair(clientKey.privateJwk),
      dpopKey: await importAccountsSigningKeyPair(dpopKey.privateJwk),
    },
  };
  accounts.requests.length = 0;
  return { accounts, context };
}

/**
 * 連携を開始し、利用者が同意した後の戻り先のqueryを作る。
 */
async function startAndConsent(
  accounts: FakeAccounts,
  context: AccountsOAuthContext,
  idToken: { idTokenClaims?: Record<string, unknown>; signIdTokenWithUnknownKey?: boolean } = {},
) {
  const { authorizationUrl, attempt } = await createAccountsAuthorizationRequest(
    context.authorizationServer,
    { clientId, redirectUri },
  );
  const query = new URL(authorizationUrl).searchParams;
  const code = accounts.issueCode({
    clientId,
    sub: "ausr_owner",
    nonce: query.get("nonce") ?? "",
    codeChallenge: query.get("code_challenge") ?? "",
    redirectUri: query.get("redirect_uri") ?? "",
    ...idToken,
  });
  const callbackParameters = new URLSearchParams({
    code,
    state: attempt.state,
    iss: accounts.origin,
  });
  return { attempt, callbackParameters };
}

function tokenRequests(accounts: FakeAccounts) {
  return accounts.requests.filter(({ url }) => url.endsWith("/api/auth/oauth2/token"));
}

// --------------------------------------------------
// 認可要求
// --------------------------------------------------

describe("createAccountsAuthorizationRequest", () => {
  it("prompt=consent・PKCE（S256）・nonce・state付きの認可URLを作る", async () => {
    const { accounts, context } = await setUp();

    const { authorizationUrl, attempt } = await createAccountsAuthorizationRequest(
      context.authorizationServer,
      { clientId, redirectUri },
    );

    const url = new URL(authorizationUrl);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(attempt.codeVerifier),
    );
    expect(`${url.origin}${url.pathname}`).toBe(`${accounts.origin}/api/auth/oauth2/authorize`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "openid",
      state: attempt.state,
      nonce: attempt.nonce,
      code_challenge: encodeBase64Url(new Uint8Array(digest)),
      code_challenge_method: "S256",
      prompt: "consent",
    });
  });

  it("state・nonce・code verifierは要求ごとに異なる", async () => {
    const { context } = await setUp();

    const first = await createAccountsAuthorizationRequest(context.authorizationServer, {
      clientId,
      redirectUri,
    });
    const second = await createAccountsAuthorizationRequest(context.authorizationServer, {
      clientId,
      redirectUri,
    });

    expect(second.attempt.state).not.toBe(first.attempt.state);
    expect(second.attempt.nonce).not.toBe(first.attempt.nonce);
    expect(second.attempt.codeVerifier).not.toBe(first.attempt.codeVerifier);
  });
});

// --------------------------------------------------
// コード交換とID Token
// --------------------------------------------------

describe("exchangeAccountsAuthorizationCode", () => {
  it("コードを交換し、検証したID Tokenのsubを返す", async () => {
    const { accounts, context } = await setUp();
    const { attempt, callbackParameters } = await startAndConsent(accounts, context);

    await expect(
      exchangeAccountsAuthorizationCode(context, { callbackParameters, redirectUri, attempt }),
    ).resolves.toEqual({ accountsUserId: "ausr_owner" });
  });

  it("token要求にprivate_key_jwtのclient assertionとDPoP proofを付ける", async () => {
    const { accounts, context } = await setUp();
    const { attempt, callbackParameters } = await startAndConsent(accounts, context);

    await exchangeAccountsAuthorizationCode(context, { callbackParameters, redirectUri, attempt });

    const [request] = tokenRequests(accounts);
    const form = new URLSearchParams(request?.body);
    const assertion = decodeJwt(form.get("client_assertion") ?? "");
    const proof = decodeJwt(request?.headers.get("DPoP") ?? "");
    const tokenEndpoint = `${accounts.origin}/api/auth/oauth2/token`;
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code_verifier")).toBe(attempt.codeVerifier);
    expect(form.get("client_assertion_type")).toBe(
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    );
    expect(assertion.header).toEqual({
      alg: "EdDSA",
      typ: "JWT",
      kid: context.client.clientKey.kid,
    });
    expect(assertion.payload).toMatchObject({ iss: clientId, sub: clientId, aud: tokenEndpoint });
    expect(Number(assertion.payload.exp) - Number(assertion.payload.iat)).toBe(60);
    expect(proof.header).toEqual({
      alg: "EdDSA",
      typ: "dpop+jwt",
      jwk: { kty: "OKP", crv: "Ed25519", x: expect.any(String) },
    });
    expect(proof.payload).toEqual({
      iat: expect.any(Number),
      jti: expect.any(String),
      htm: "POST",
      htu: tokenEndpoint,
    });
  });

  it("同意画面での拒否をAUTHORIZATION_DENIEDにする", async () => {
    const { accounts, context } = await setUp();
    const { attempt } = await startAndConsent(accounts, context);
    const callbackParameters = new URLSearchParams({
      error: "access_denied",
      state: attempt.state,
      iss: accounts.origin,
    });

    await expect(
      exchangeAccountsAuthorizationCode(context, { callbackParameters, redirectUri, attempt }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_DENIED" });
  });

  it.each([
    ["issの不一致", { iss: "https://other.example.test" }],
    ["issの欠落", { iss: undefined }],
    ["stateの不一致", { state: "other-state" }],
    ["access_denied以外のerror", { error: "invalid_request", code: undefined }],
  ])("認可応答の%sをAUTHORIZATION_RESPONSE_INVALIDにする", async (_, override) => {
    const { accounts, context } = await setUp();
    const { attempt, callbackParameters } = await startAndConsent(accounts, context);
    for (const [name, value] of Object.entries(override)) {
      if (value === undefined) callbackParameters.delete(name);
      else callbackParameters.set(name, value);
    }

    await expect(
      exchangeAccountsAuthorizationCode(context, { callbackParameters, redirectUri, attempt }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_RESPONSE_INVALID" });
    expect(tokenRequests(accounts)).toHaveLength(0);
  });

  it("使用済みのコード・異なるcode verifierをAUTHORIZATION_CODE_INVALIDにする", async () => {
    const { accounts, context } = await setUp();
    const { attempt, callbackParameters } = await startAndConsent(accounts, context);
    await exchangeAccountsAuthorizationCode(context, { callbackParameters, redirectUri, attempt });
    const second = await startAndConsent(accounts, context);

    await expect(
      exchangeAccountsAuthorizationCode(context, { callbackParameters, redirectUri, attempt }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_CODE_INVALID" });
    await expect(
      exchangeAccountsAuthorizationCode(context, {
        callbackParameters: second.callbackParameters,
        redirectUri,
        attempt: { ...second.attempt, codeVerifier: attempt.codeVerifier },
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_CODE_INVALID" });
  });

  it.each([
    ["署名が登録外の鍵", { signIdTokenWithUnknownKey: true }],
    ["issの不一致", { idTokenClaims: { iss: "https://other.example.test" } }],
    ["audの不一致", { idTokenClaims: { aud: "other-client" } }],
    ["nonceの不一致", { idTokenClaims: { nonce: "other-nonce" } }],
    ["期限切れ", { idTokenClaims: { exp: Math.floor(Date.now() / 1000) - 3600 } }],
    ["subの欠落", { idTokenClaims: { sub: undefined } }],
  ])("ID Tokenの%sをID_TOKEN_INVALIDにする", async (_, idToken) => {
    const { accounts, context } = await setUp();
    const { attempt, callbackParameters } = await startAndConsent(accounts, context, idToken);

    await expect(
      exchangeAccountsAuthorizationCode(context, { callbackParameters, redirectUri, attempt }),
    ).rejects.toMatchObject({ code: "ID_TOKEN_INVALID" });
  });

  it("OAuthのエラー応答でない403をINVALID_RESPONSEにする", async () => {
    const { accounts, context } = await setUp();
    const { attempt, callbackParameters } = await startAndConsent(accounts, context);
    accounts.interceptNext(
      "/api/auth/oauth2/token",
      new Response("<html>blocked</html>", {
        status: 403,
        headers: { "Content-Type": "text/html" },
      }),
    );

    await expect(
      exchangeAccountsAuthorizationCode(context, { callbackParameters, redirectUri, attempt }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("登録していない鍵のclient assertionをCLIENT_UNAUTHORIZEDにする", async () => {
    const { accounts, context } = await setUp();
    const { attempt, callbackParameters } = await startAndConsent(accounts, context);
    const otherKey = await generateAccountsSigningKey();
    const client = {
      ...context.client,
      clientKey: await importAccountsSigningKeyPair(otherKey.privateJwk),
    };

    await expect(
      exchangeAccountsAuthorizationCode(
        { ...context, client },
        { callbackParameters, redirectUri, attempt },
      ),
    ).rejects.toMatchObject({ code: "CLIENT_UNAUTHORIZED" });
  });
});

// --------------------------------------------------
// Client Credentials
// --------------------------------------------------

describe("requestAccountsClientCredentialsToken", () => {
  it("identities:readと資源APIの識別子でDPoP付きのトークンを取得し、失効時刻を返す", async () => {
    const { accounts, context } = await setUp();
    const before = Date.now();

    const token = await requestAccountsClientCredentialsToken(context);

    const [request] = tokenRequests(accounts);
    const form = new URLSearchParams(request?.body);
    expect(token.accessToken).toEqual(expect.any(String));
    expect(token.expiresAt).toBeGreaterThanOrEqual(before + 900_000);
    expect(token.expiresAt).toBeLessThanOrEqual(Date.now() + 900_000);
    expect(form.get("grant_type")).toBe("client_credentials");
    expect(form.get("scope")).toBe("identities:read");
    expect(form.get("resource")).toBe(`${accounts.origin}/api/v1`);
    expect(request?.headers.get("DPoP")).toEqual(expect.any(String));
  });

  it("DPoP-Nonceを要求された場合は、受け取ったnonceを入れたproofで1回だけ送り直す", async () => {
    const { accounts, context } = await setUp();
    accounts.requireDpopNonce("server-nonce");

    await requestAccountsClientCredentialsToken(context);

    const proofs = tokenRequests(accounts).map(
      ({ headers }) => decodeJwt(headers.get("DPoP") ?? "").payload,
    );
    expect(proofs).toHaveLength(2);
    expect(proofs[0]).not.toHaveProperty("nonce");
    expect(proofs[1]).toMatchObject({ nonce: "server-nonce" });
  });

  it.each([
    [
      "Bearerのトークン",
      Response.json({ access_token: "token", token_type: "Bearer", expires_in: 900 }),
      "INVALID_RESPONSE",
      null,
    ],
    [
      "expires_inの欠落",
      Response.json({ access_token: "token", token_type: "DPoP" }),
      "INVALID_RESPONSE",
      null,
    ],
    [
      "invalid_client",
      Response.json({ error: "invalid_client" }, { status: 401 }),
      "CLIENT_UNAUTHORIZED",
      null,
    ],
    [
      "invalid_target",
      Response.json({ error: "invalid_target" }, { status: 400 }),
      "TOKEN_REQUEST_REJECTED",
      null,
    ],
    [
      "429",
      new Response(null, { status: 429, headers: { "Retry-After": "30" } }),
      "RATE_LIMITED",
      "30",
    ],
    ["503", new Response(null, { status: 503 }), "UNAVAILABLE", null],
    ["通信失敗", "network" as const, "NETWORK_ERROR", null],
  ])("%sを分類する", async (_, interception, code, retryAfter) => {
    const { accounts, context } = await setUp();
    accounts.interceptNext("/api/auth/oauth2/token", interception);

    await expect(requestAccountsClientCredentialsToken(context)).rejects.toMatchObject({
      code,
      retryAfter,
    });
  });
});
