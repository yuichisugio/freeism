import { describe, expect, it } from "vite-plus/test";

import { createFakeAccounts, type FakeAccounts } from "../../../test/support/fake-accounts";
import { discoverAccounts } from "./accounts-discovery";
import {
  generateAccountsSigningKey,
  importAccountsSigningKeyPair,
  toAccountsPublicJwks,
} from "./accounts-key-vault";
import {
  exchangeAccountsCodeForGenericOAuth,
  requestAccountsClientCredentialsToken,
  type AccountsOAuthContext,
} from "./accounts-oauth-client";
import { decodeBase64Url } from "./base64url";
import {
  calculatePKCECodeChallenge,
  generateRandomCodeVerifier,
  generateRandomNonce,
} from "oauth4webapi";

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

/** テスト用の認可コードとPKCE・nonceを発行する。 */
async function issueConsentCode(
  accounts: FakeAccounts,
  idToken: { idTokenClaims?: Record<string, unknown>; signIdTokenWithUnknownKey?: boolean } = {},
) {
  const codeVerifier = generateRandomCodeVerifier();
  const nonce = generateRandomNonce();
  const code = accounts.issueCode({
    clientId,
    sub: "ausr_owner",
    nonce,
    codeChallenge: await calculatePKCECodeChallenge(codeVerifier),
    redirectUri,
    ...idToken,
  });
  return { code, codeVerifier, nonce };
}

function tokenRequests(accounts: FakeAccounts) {
  return accounts.requests.filter(({ url }) => url.endsWith("/api/auth/oauth2/token"));
}

describe("exchangeAccountsCodeForGenericOAuth", () => {
  it("Proxy callbackのcodeVerifierと保存nonceで署名済みID Tokenを検証する", async () => {
    const { accounts, context } = await setUp();
    const attempt = await issueConsentCode(accounts);

    const tokens = await exchangeAccountsCodeForGenericOAuth(context, {
      code: attempt.code,
      redirectUri,
      codeVerifier: attempt.codeVerifier,
      nonce: attempt.nonce,
    });

    expect(tokens.idToken).toEqual(expect.any(String));
    expect(tokens.tokenType).toBe("dpop");
    expect(tokenRequests(accounts)).toHaveLength(1);
    expect(tokenRequests(accounts)[0]?.headers.get("DPoP")).toEqual(expect.any(String));
  });

  it("Proxy callbackでもnonce不一致のID Tokenを拒否する", async () => {
    const { accounts, context } = await setUp();
    const attempt = await issueConsentCode(accounts, {
      idTokenClaims: { nonce: "different-nonce" },
    });

    await expect(
      exchangeAccountsCodeForGenericOAuth(context, {
        code: attempt.code,
        redirectUri,
        codeVerifier: attempt.codeVerifier,
        nonce: attempt.nonce,
      }),
    ).rejects.toMatchObject({ code: "ID_TOKEN_INVALID" });
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
