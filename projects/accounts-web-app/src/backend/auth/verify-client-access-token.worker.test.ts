import { env, exports } from "cloudflare:workers";
import { deriveDpopJkt } from "better-auth/oauth2";
import { describe, expect, it } from "vitest";

import { testAuth } from "../../../test/auth-test-helpers";
import {
  createClientAssertion,
  createDpopProof,
  fetchOAuthClients,
  generateTestKeyPair,
  loginAsNewUser,
  requestClientAccessToken,
  resourceApiIdentifier,
  testOrigin,
  tokenEndpoint,
  toJwks,
  type TestKeyPair,
} from "../../../test/oauth-client-test-helpers";
import { verifyClientAccessToken } from "./verify-client-access-token";

const resourceUrl = `${testOrigin}/api/v1/external-accounts`;

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

/**
 * ログインしてクライアントを登録し、利用側サービスが保管する鍵を返す。
 */
async function registerClient() {
  const clientKey = await generateTestKeyPair("client-key-1");
  const { headers } = await loginAsNewUser();
  const response = await fetchOAuthClients(headers, "", {
    method: "POST",
    body: {
      name: "Points",
      uri: null,
      description: null,
      redirectUris: ["https://points.example/callback"],
      jwks: toJwks(clientKey),
    },
  });
  const { data } = (await response.json()) as { data: { clientId: string } };
  return { headers, clientId: data.clientId, clientKey };
}

/**
 * 登録済みクライアントの公開鍵を差し替える。
 */
async function replaceClientKeys(headers: Headers, clientId: string, ...keyPairs: TestKeyPair[]) {
  const response = await fetchOAuthClients(headers, `/${clientId}`, {
    method: "PUT",
    body: {
      name: "Points",
      uri: null,
      description: null,
      redirectUris: ["https://points.example/callback"],
      jwks: toJwks(...keyPairs),
    },
  });
  expect(response.status).toBe(200);
}

/**
 * Client CredentialsでDPoP付きのAccess Tokenを取得する。
 */
async function obtainAccessToken(clientId: string, clientKey: TestKeyPair, dpopKey: TestKeyPair) {
  const response = await requestClientAccessToken({ clientId, clientKey, dpopKey });
  expect(response.status).toBe(200);
  const { access_token: accessToken } = (await response.json()) as { access_token: string };
  return accessToken;
}

/**
 * Access TokenとDPoP proofを付けた資源APIの要求を作る。
 */
async function createResourceRequest(
  accessToken: string,
  dpopKey: TestKeyPair,
  { scheme = "DPoP" }: { scheme?: string } = {},
) {
  return new Request(resourceUrl, {
    method: "POST",
    headers: {
      Authorization: `${scheme} ${accessToken}`,
      DPoP: await createDpopProof(dpopKey, { method: "POST", url: resourceUrl, accessToken }),
    },
  });
}

/**
 * Accountsの署名鍵で、任意のclaimsのAccess Tokenを作る（標準のtoken endpointが発行しない形の確認用）。
 */
async function signAccessToken(claims: Record<string, unknown>, dpopKey: TestKeyPair) {
  const now = Math.floor(Date.now() / 1000);
  const { token } = await testAuth.api.signJWT({
    body: {
      payload: {
        iss: testOrigin,
        aud: resourceApiIdentifier,
        iat: now,
        exp: now + 900,
        scope: "identities:read",
        cnf: { jkt: await deriveDpopJkt(dpopKey.publicJwk) },
        ...claims,
      },
    },
  });
  return token;
}

function verify(request: Request) {
  return verifyClientAccessToken(request, { auth: testAuth, accountsOrigin: env.ACCOUNTS_ORIGIN });
}

// --------------------------------------------------
// token endpoint
// --------------------------------------------------

describe("Client Credentialsのtoken endpoint", () => {
  it("private_key_jwtとDPoPで、identities:read・Accounts資源API向けの15分のAccess Tokenを発行する", async () => {
    const { clientId, clientKey } = await registerClient();
    const dpopKey = await generateTestKeyPair("dpop-key");

    const response = await requestClientAccessToken({ clientId, clientKey, dpopKey });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ token_type: "DPoP", expires_in: 900, scope: "identities:read" });
    expect(body.refresh_token).toBeUndefined();
    const [, payload] = String(body.access_token).split(".");
    expect(JSON.parse(Buffer.from(payload ?? "", "base64url").toString())).toMatchObject({
      iss: testOrigin,
      aud: resourceApiIdentifier,
      sub: clientId,
      client_id: clientId,
      scope: "identities:read",
      cnf: { jkt: await deriveDpopJkt(dpopKey.publicJwk) },
    });
  });

  it("DPoP proofの無いトークン要求は拒否する", async () => {
    const { clientId, clientKey } = await registerClient();

    const response = await exports.default.fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: await createClientAssertion(clientId, clientKey),
        resource: resourceApiIdentifier,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_dpop_proof" });
  });

  it("identities:read以外のscopeは発行しない", async () => {
    const { clientId, clientKey } = await registerClient();
    const dpopKey = await generateTestKeyPair("dpop-key");

    const response = await requestClientAccessToken({
      clientId,
      clientKey,
      dpopKey,
      scope: "openid",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_scope" });
  });

  it("鍵の差し替え後は新しい鍵だけで認証し、新旧の併存中はどちらでも認証する", async () => {
    const { headers, clientId, clientKey: oldKey } = await registerClient();
    const newKey = await generateTestKeyPair("client-key-2");
    const dpopKey = await generateTestKeyPair("dpop-key");

    await replaceClientKeys(headers, clientId, oldKey, newKey);
    const withOldKey = await requestClientAccessToken({ clientId, clientKey: oldKey, dpopKey });
    const withNewKey = await requestClientAccessToken({ clientId, clientKey: newKey, dpopKey });
    expect([withOldKey.status, withNewKey.status]).toEqual([200, 200]);

    await replaceClientKeys(headers, clientId, newKey);
    const afterRemoval = await requestClientAccessToken({ clientId, clientKey: oldKey, dpopKey });
    const afterRemovalWithNewKey = await requestClientAccessToken({
      clientId,
      clientKey: newKey,
      dpopKey,
    });
    expect(afterRemoval.status).toBe(401);
    expect(await afterRemoval.json()).toMatchObject({ error: "invalid_client" });
    expect(afterRemovalWithNewKey.status).toBe(200);
  });
});

// --------------------------------------------------
// 資源側の検証
// --------------------------------------------------

describe("verifyClientAccessToken", () => {
  it("DPoPで送られたクライアント用Access Tokenを検証し、Client IDを返す", async () => {
    const { clientId, clientKey } = await registerClient();
    const dpopKey = await generateTestKeyPair("dpop-key");
    const accessToken = await obtainAccessToken(clientId, clientKey, dpopKey);

    const result = await verify(await createResourceRequest(accessToken, dpopKey));

    expect(result).toEqual({ ok: true, clientId });
  });

  it("DPoP proofを別の鍵で作った要求・同じproofの再送・Bearerでの送信は拒否する", async () => {
    const { clientId, clientKey } = await registerClient();
    const dpopKey = await generateTestKeyPair("dpop-key");
    const otherKey = await generateTestKeyPair("other-key");
    const accessToken = await obtainAccessToken(clientId, clientKey, dpopKey);

    const wrongKey = await verify(await createResourceRequest(accessToken, otherKey));
    const request = await createResourceRequest(accessToken, dpopKey);
    const first = await verify(new Request(request.url, request));
    const replayed = await verify(request);
    const bearer = await verify(
      await createResourceRequest(accessToken, dpopKey, { scheme: "Bearer" }),
    );

    const dpopChallenge = expect.stringContaining('DPoP error="invalid_dpop_proof"');
    expect(wrongKey).toEqual({ ok: false, status: 401, wwwAuthenticate: dpopChallenge });
    expect(first).toEqual({ ok: true, clientId });
    expect(replayed).toEqual({ ok: false, status: 401, wwwAuthenticate: dpopChallenge });
    expect(bearer).toMatchObject({ ok: false, status: 401 });
  });

  it("Authorizationヘッダーの無い要求は拒否し、DPoPのchallengeを示す", async () => {
    const result = await verify(new Request(resourceUrl, { method: "POST" }));

    expect(result).toEqual({
      ok: false,
      status: 401,
      wwwAuthenticate: expect.stringMatching(/^DPoP error="invalid_token", .*algs="EdDSA /),
    });
  });

  it("JWTとして読めない・署名が一致しないトークンは401で拒否する", async () => {
    const { clientId } = await registerClient();
    const dpopKey = await generateTestKeyPair("dpop-key");
    const token = await signAccessToken({ sub: clientId, client_id: clientId }, dpopKey);
    const [header, payload] = token.split(".");

    const malformed = await verify(await createResourceRequest("not-a-jwt", dpopKey));
    const tampered = await verify(
      await createResourceRequest(`${header}.${payload}.${"A".repeat(86)}`, dpopKey),
    );

    expect(malformed).toMatchObject({ ok: false, status: 401 });
    expect(tampered).toMatchObject({ ok: false, status: 401 });
  });

  it("ユーザー用トークン（subがclient_idと異なる）・別resource向けのトークンは拒否する", async () => {
    const { clientId } = await registerClient();
    const dpopKey = await generateTestKeyPair("dpop-key");
    const userToken = await signAccessToken(
      { sub: "ausr_user", client_id: clientId, azp: clientId },
      dpopKey,
    );
    const otherAudienceToken = await signAccessToken(
      {
        sub: clientId,
        client_id: clientId,
        azp: clientId,
        aud: `${testOrigin}/api/auth/oauth2/userinfo`,
      },
      dpopKey,
    );

    const userResult = await verify(await createResourceRequest(userToken, dpopKey));
    const audienceResult = await verify(await createResourceRequest(otherAudienceToken, dpopKey));

    expect(userResult).toMatchObject({ ok: false, status: 401 });
    expect(audienceResult).toMatchObject({ ok: false, status: 401 });
  });

  it("identities:readを持たないトークンはinsufficient_scopeで拒否する", async () => {
    const { clientId } = await registerClient();
    const dpopKey = await generateTestKeyPair("dpop-key");
    const token = await signAccessToken(
      { sub: clientId, client_id: clientId, azp: clientId, scope: "openid" },
      dpopKey,
    );

    const result = await verify(await createResourceRequest(token, dpopKey));

    expect(result).toEqual({
      ok: false,
      status: 403,
      wwwAuthenticate: expect.stringContaining(
        'error="insufficient_scope", scope="identities:read"',
      ),
    });
  });

  it("削除したクライアントの発行済みトークンは拒否する", async () => {
    const { headers, clientId, clientKey } = await registerClient();
    const dpopKey = await generateTestKeyPair("dpop-key");
    const accessToken = await obtainAccessToken(clientId, clientKey, dpopKey);

    const deleted = await fetchOAuthClients(headers, `/${clientId}`, { method: "DELETE" });
    expect(deleted.status).toBe(200);
    const result = await verify(await createResourceRequest(accessToken, dpopKey));

    expect(result).toMatchObject({ ok: false, status: 401 });
  });
});
