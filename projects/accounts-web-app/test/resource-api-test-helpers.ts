import { exports } from "cloudflare:workers";

import {
  createDpopProof,
  fetchOAuthClients,
  generateTestKeyPair,
  requestClientAccessToken,
  testOrigin,
  toJwks,
  type TestKeyPair,
} from "./oauth-client-test-helpers";

/**
 * 公開設定・同意画面・資源APIのWorkers結合テストの共通部品。
 * 利用側サービス（Points）の役割として、クライアント登録・トークン取得・DPoP付きの資源API要求を行う。
 * @see ../src/backend/routes/visibility-routes.worker.test.ts
 * @see ../src/backend/routes/consent-flow.worker.test.ts
 * @see ../src/backend/routes/resource-api-routes.worker.test.ts
 */

/**
 * 登録するクライアントの戻り先。
 */
export const testRedirectUri = "https://points.example/callback";

// --------------------------------------------------
// BFF
// --------------------------------------------------

/**
 * ログイン中のユーザーとしてBFFを呼ぶ。
 */
export function fetchBff(
  headers: Headers,
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  return exports.default.fetch(`${testOrigin}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * ログイン中のユーザーとしてOAuthクライアントを登録し、Client IDと利用側が保管する鍵を返す。
 */
export async function registerTestClient(headers: Headers, name = "Points") {
  const clientKey = await generateTestKeyPair("client-key");
  const response = await fetchOAuthClients(headers, "", {
    method: "POST",
    body: {
      name,
      uri: null,
      description: null,
      redirectUris: [testRedirectUri],
      jwks: toJwks(clientKey),
    },
  });
  const { data } = (await response.json()) as { data: { clientId: string } };
  return { clientId: data.clientId, clientKey };
}

/**
 * 公開設定を保存する。
 */
export function saveVisibility(
  headers: Headers,
  settings: {
    accounts?: { externalAccountId: string; isPublic: boolean }[];
    clients?: { clientId: string; consented: boolean; visibleAccountIds: string[] }[];
  },
): Promise<Response> {
  return fetchBff(headers, "/api/visibility", {
    method: "PUT",
    body: { accounts: settings.accounts ?? [], clients: settings.clients ?? [] },
  });
}

// --------------------------------------------------
// 資源API
// --------------------------------------------------

/**
 * 資源APIを呼ぶ利用側サービス。
 * Client CredentialsでDPoP付きのAccess Tokenを取得し、要求ごとに新しいDPoP proofを付ける。
 */
export type ResourceApiCaller = {
  clientId: string;
  accessToken: string;
  dpopKey: TestKeyPair;
};

/**
 * 登録済みクライアントのAccess Tokenを取得する。
 */
export async function createResourceApiCaller(
  clientId: string,
  clientKey: TestKeyPair,
): Promise<ResourceApiCaller> {
  const dpopKey = await generateTestKeyPair("dpop-key");
  const response = await requestClientAccessToken({ clientId, clientKey, dpopKey });
  if (response.status !== 200) {
    throw new Error(
      `Access Tokenを取得できませんでした: ${response.status} ${await response.text()}`,
    );
  }
  const { access_token: accessToken } = (await response.json()) as { access_token: string };
  return { clientId, accessToken, dpopKey };
}

/**
 * DPoP proofとAccess Tokenを付けて資源APIを呼ぶ。
 * `body`が文字列の場合はそのまま送り、それ以外はJSONにする。
 */
export async function fetchResourceApi(
  caller: ResourceApiCaller,
  path: string,
  {
    method = "QUERY",
    body,
    contentType = "application/json",
  }: { method?: string; body?: unknown; contentType?: string | null } = {},
): Promise<Response> {
  const url = `${testOrigin}${path}`;
  const headers = new Headers({
    Authorization: `DPoP ${caller.accessToken}`,
    DPoP: await createDpopProof(caller.dpopKey, { method, url, accessToken: caller.accessToken }),
  });
  if (contentType !== null) headers.set("Content-Type", contentType);
  const text = body === undefined || typeof body === "string" ? body : JSON.stringify(body);
  // 文字列のbodyはfetchが`Content-Type: text/plain`を補うため、bytesで送る。
  return exports.default.fetch(url, {
    method,
    headers,
    body: text === undefined ? undefined : new TextEncoder().encode(text),
  });
}
