import { env, exports } from "cloudflare:workers";

import { getTestAuthContext } from "./auth-test-helpers";

/**
 * OAuthクライアントの結合テストで、利用側サービスの役割（鍵の保管・client assertion・DPoP proofの生成）を担う。
 * 秘密鍵はテスト内で生成し、実credentialを置かない。
 * @see ../src/backend/routes/oauth-client-routes.worker.test.ts
 * @see ../src/backend/auth/verify-client-access-token.worker.test.ts
 */

/**
 * テストで使うAccountsのorigin（`wrangler.jsonc`のローカル設定）。
 */
export const testOrigin = env.ACCOUNTS_ORIGIN;

/**
 * Better Authのtoken endpoint。
 */
export const tokenEndpoint = `${testOrigin}/api/auth/oauth2/token`;

/**
 * Accounts資源APIのresource。
 */
export const resourceApiIdentifier = `${testOrigin}/api/v1`;

// --------------------------------------------------
// 鍵とJWS
// --------------------------------------------------

/**
 * Ed25519の鍵ペアと、公開鍵のJWK。
 */
export type TestKeyPair = {
  kid: string;
  publicJwk: { kty: string; crv: string; x: string; kid: string; alg: "EdDSA"; use: "sig" };
  privateKey: CryptoKey;
};

/**
 * Ed25519の鍵ペアを生成する。
 */
export async function generateTestKeyPair(kid: string): Promise<TestKeyPair> {
  const keyPair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const { kty, crv, x } = (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as JsonWebKey;
  return {
    kid,
    publicJwk: { kty: kty ?? "", crv: crv ?? "", x: x ?? "", kid, alg: "EdDSA", use: "sig" },
    privateKey: keyPair.privateKey,
  };
}

/**
 * 鍵ペアの公開鍵からインラインのJWK Setを作る。
 */
export function toJwks(...keyPairs: TestKeyPair[]) {
  return { keys: keyPairs.map((keyPair) => keyPair.publicJwk) };
}

function encodeBase64Url(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Buffer.from(bytes).toString("base64url");
}

/**
 * EdDSAのcompact JWSを作る。
 */
async function signJws(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
): Promise<string> {
  const signingInput = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}

/**
 * `private_key_jwt`のclient assertion（RFC 7523）を作る。
 */
export function createClientAssertion(clientId: string, keyPair: TestKeyPair): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signJws(
    { alg: "EdDSA", typ: "JWT", kid: keyPair.kid },
    {
      iss: clientId,
      sub: clientId,
      aud: tokenEndpoint,
      iat: now,
      exp: now + 60,
      jti: crypto.randomUUID(),
    },
    keyPair.privateKey,
  );
}

/**
 * DPoP proof（RFC 9449）を作る。
 * 資源APIへの要求では、Access Tokenのhashを`ath`に入れる。
 */
export async function createDpopProof(
  keyPair: TestKeyPair,
  { method, url, accessToken }: { method: string; url: string; accessToken?: string },
): Promise<string> {
  const { kty, crv, x } = keyPair.publicJwk;
  const ath = accessToken
    ? encodeBase64Url(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessToken)),
        ),
      )
    : undefined;
  return signJws(
    { alg: "EdDSA", typ: "dpop+jwt", jwk: { kty, crv, x } },
    { jti: crypto.randomUUID(), htm: method, htu: url, iat: Math.floor(Date.now() / 1000), ath },
    keyPair.privateKey,
  );
}

// --------------------------------------------------
// HTTP
// --------------------------------------------------

/**
 * Client CredentialsでDPoP付きのAccess Tokenを要求する。
 */
export async function requestClientAccessToken({
  clientId,
  clientKey,
  dpopKey,
  scope,
}: {
  clientId: string;
  clientKey: TestKeyPair;
  dpopKey: TestKeyPair;
  scope?: string;
}): Promise<Response> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: await createClientAssertion(clientId, clientKey),
    resource: resourceApiIdentifier,
    ...(scope === undefined ? {} : { scope }),
  });
  return exports.default.fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: await createDpopProof(dpopKey, { method: "POST", url: tokenEndpoint }),
    },
    body,
  });
}

/**
 * `testUtils`でユーザーを作ってログインし、BFFを呼ぶためのヘッダーを返す。
 */
export async function loginAsNewUser(): Promise<{ userId: string; headers: Headers }> {
  const context = await getTestAuthContext();
  const user = await context.test.saveUser(context.test.createUser());
  const { headers } = await context.test.login({ userId: user.id });
  headers.set("Origin", testOrigin);
  return { userId: user.id, headers };
}

/**
 * ログイン中のユーザーとして`/api/oauth-clients`を呼ぶ。
 */
export function fetchOAuthClients(
  headers: Headers,
  path = "",
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const requestHeaders = new Headers(headers);
  if (init.body !== undefined) requestHeaders.set("Content-Type", "application/json");
  return exports.default.fetch(`${testOrigin}/api/oauth-clients${path}`, {
    method: init.method ?? "GET",
    headers: requestHeaders,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
