import { allowInsecureRequests, customFetch, type HttpRequestOptions } from "oauth4webapi";

/**
 * 接続先Accountsへの要求で共通の部品（接続先、失敗の分類、oauth4webapiへ渡すoption）。
 * @see ./accounts-discovery.ts
 * @see ./accounts-oauth-client.ts
 * @see ./accounts-resource-client.ts
 */

// --------------------------------------------------
// 接続先
// --------------------------------------------------

/**
 * 要求先のAccountsと、要求に使う`fetch`。
 * `fetch`はテストでテスト用Accountsへ差し替える。
 */
export type AccountsEndpoint = {
  accountsOrigin: string;
  fetch: typeof fetch;
};

/**
 * 1回の要求の上限時間。
 */
const requestTimeoutMs = 10_000;

// --------------------------------------------------
// 失敗
// --------------------------------------------------

/**
 * Accountsとのやり取りの失敗の種類。
 * - `NETWORK_ERROR`: 通信失敗・タイムアウト
 * - `UNAVAILABLE`: 5xx
 * - `RATE_LIMITED`: 429（`retryAfter`に`Retry-After`を転記する）
 * - `INVALID_RESPONSE`: 想定外のHTTP status、応答のschema・`accountsOrigin`の不一致
 * - `DISCOVERY_INVALID`: メタデータの不足・不一致
 * - `AUTHORIZATION_DENIED`: 利用者が同意画面で拒否した（`error=access_denied`）
 * - `AUTHORIZATION_RESPONSE_INVALID`: 認可応答の`iss`・`state`の不一致、`access_denied`以外のerror
 * - `AUTHORIZATION_CODE_INVALID`: 認可コードの期限切れ・再使用など（`invalid_grant`）
 * - `ID_TOKEN_INVALID`: ID Tokenの署名・`iss`・`aud`・`nonce`・`exp`の不正
 * - `CLIENT_UNAUTHORIZED`: クライアント認証の失敗、資源APIが再取得したトークンでも401
 * - `TOKEN_REQUEST_REJECTED`: token endpointがその他の理由で要求を拒否した
 * - `FORBIDDEN`: 資源APIの403
 * - `REQUEST_INVALID`: 資源APIが要求全体を拒否した（400・415）
 * - `PAYLOAD_TOO_LARGE`: 資源APIの413
 */
export type AccountsClientErrorCode =
  | "NETWORK_ERROR"
  | "UNAVAILABLE"
  | "RATE_LIMITED"
  | "INVALID_RESPONSE"
  | "DISCOVERY_INVALID"
  | "AUTHORIZATION_DENIED"
  | "AUTHORIZATION_RESPONSE_INVALID"
  | "AUTHORIZATION_CODE_INVALID"
  | "ID_TOKEN_INVALID"
  | "CLIENT_UNAUTHORIZED"
  | "TOKEN_REQUEST_REJECTED"
  | "FORBIDDEN"
  | "REQUEST_INVALID"
  | "PAYLOAD_TOO_LARGE";

/**
 * Accountsとのやり取りの失敗。
 */
export class AccountsClientError extends Error {
  constructor(
    readonly code: AccountsClientErrorCode,
    readonly retryAfter: string | null = null,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "AccountsClientError";
  }
}

/**
 * 応答の内容によらず、HTTP statusだけで決まる失敗（429・5xx）を返す。
 * @returns それ以外のstatusは`null`
 */
export function toAccountsUnavailableError(response: Response): AccountsClientError | null {
  if (response.status === 429) {
    return new AccountsClientError("RATE_LIMITED", response.headers.get("Retry-After"));
  }
  if (response.status >= 500) return new AccountsClientError("UNAVAILABLE");
  return null;
}

// --------------------------------------------------
// oauth4webapiへ渡すoption
// --------------------------------------------------

/**
 * oauth4webapiの要求に共通するoption。
 * 通信失敗は`NETWORK_ERROR`に変換し、HTTPはloopbackのoriginを検査済みの場合だけ許可する。
 */
export function toAccountsRequestOptions(
  endpoint: AccountsEndpoint,
): Pick<
  HttpRequestOptions<string, unknown>,
  "signal" | typeof customFetch | typeof allowInsecureRequests
> {
  return {
    signal: () => AbortSignal.timeout(requestTimeoutMs),
    [customFetch]: async (url, options) => {
      // Workersのglobal `fetch`は、`endpoint`をthisにして呼ぶとIllegal invocationになる。
      const accountsFetch = endpoint.fetch;
      try {
        return await accountsFetch(url, options as RequestInit);
      } catch (cause) {
        throw new AccountsClientError("NETWORK_ERROR", null, { cause });
      }
    },
    [allowInsecureRequests]: endpoint.accountsOrigin.startsWith("http:"),
  };
}
