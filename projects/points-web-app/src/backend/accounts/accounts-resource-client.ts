import { WWWAuthenticateChallengeError, protectedResourceRequest } from "oauth4webapi";
import * as v from "valibot";

import {
  accountsExternalAccountListSchema,
  accountsResolveResponseSchema,
  type AccountsProvidedExternalAccount,
  type AccountsResolveIdentifier,
  type AccountsResolveResult,
} from "./accounts-api-schema";
import { createAccountsDpopHandle, withDpopNonceRetry } from "./accounts-dpop";
import {
  AccountsClientError,
  toAccountsRequestOptions,
  toAccountsUnavailableError,
  type AccountsEndpoint,
} from "./accounts-http";
import type { AccountsSigningKeyPair } from "./accounts-key-vault";
import { toAccountsResourceIdentifier } from "./accounts-origin";

/**
 * Accounts資源API（`QUERY /api/v1/*`）のクライアント。
 * 要求の失敗はすべて`AccountsClientError`として投げ、照合が正常に終わった該当なし（`no_match`）とは区別する。
 * FIXの取込では、投げられた失敗をファイル全体の0件反映として扱う。
 * @see ../../../../accounts-web-app/src/backend/routes/resource-api-routes.ts
 * @see ./accounts-resource-client.test.ts
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

/**
 * 資源APIに使うAccess Tokenの取得元。
 * 保存先（キャッシュ）は呼出し側が決める。
 */
export type AccountsAccessTokenSource = {
  /** 有効なAccess Tokenを返す。 */
  get(): Promise<string>;
  /** 資源APIが401を返した時に、保持しているAccess Tokenを破棄する。 */
  invalidate(): Promise<void>;
};

/**
 * 一覧取得の結果。
 * `NOT_PROVIDED`は、対象ユーザーが存在しない・同意OFF・ban・退会のいずれか（Accountsは区別しない）。
 */
export type AccountsExternalAccountListResult =
  | { status: "PROVIDED"; externalAccounts: AccountsProvidedExternalAccount[] }
  | { status: "NOT_PROVIDED" };

export type AccountsResourceClient = {
  listExternalAccounts(accountsUserId: string): Promise<AccountsExternalAccountListResult>;
  /**
   * 識別子を1回の要求で照合し、入力順の結果を返す。
   * 入力不備（`invalid_input`）を含む400も、入力ごとの結果として返す。
   */
  resolveIdentifiers(identifiers: AccountsResolveIdentifier[]): Promise<AccountsResolveResult[]>;
};

/**
 * 1回の照合要求に含められる識別子の上限（Accountsの契約）。
 */
export const accountsResolveIdentifierLimit = 1000;

// --------------------------------------------------
// 応答の検査
// --------------------------------------------------

/**
 * 成功として読めなかった応答を分類する。
 */
function toResourceApiError(response: Response): AccountsClientError {
  const unavailable = toAccountsUnavailableError(response);
  if (unavailable !== null) return unavailable;
  switch (response.status) {
    case 400:
    case 415:
      return new AccountsClientError("REQUEST_INVALID");
    case 403:
      return new AccountsClientError("FORBIDDEN");
    case 413:
      return new AccountsClientError("PAYLOAD_TOO_LARGE");
    default:
      return new AccountsClientError("INVALID_RESPONSE");
  }
}

/**
 * 応答bodyをschemaで読む。
 * @returns JSONでない・schemaに合わない場合は`null`
 */
async function readBody<TSchema extends v.GenericSchema>(
  response: Response,
  schema: TSchema,
): Promise<v.InferOutput<TSchema> | null> {
  const body: unknown = await response.json().catch(() => undefined);
  const result = v.safeParse(schema, body);
  return result.success ? result.output : null;
}

// --------------------------------------------------
// クライアント
// --------------------------------------------------

/**
 * 資源APIのクライアントを作る。
 * `dpopKey`は、`accessTokenSource`のトークンを取得した時と同じDPoP鍵にする。
 */
export function createAccountsResourceClient({
  endpoint,
  dpopKey,
  accessTokenSource,
}: {
  endpoint: AccountsEndpoint;
  dpopKey: AccountsSigningKeyPair;
  accessTokenSource: AccountsAccessTokenSource;
}): AccountsResourceClient {
  const { accountsOrigin } = endpoint;
  const options = {
    ...toAccountsRequestOptions(endpoint),
    DPoP: createAccountsDpopHandle(dpopKey),
  };

  /**
   * 1回の`QUERY`を送る。
   * `WWW-Authenticate`付きの応答（401・403）も、statusで分類するため応答として返す。
   */
  function send(path: string, body: string, accessToken: string): Promise<Response> {
    const url = new URL(`${toAccountsResourceIdentifier(accountsOrigin)}${path}`);
    const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
    return withDpopNonceRetry(() =>
      protectedResourceRequest(accessToken, "QUERY", url, headers, body, options),
    ).catch((error: unknown) => {
      if (error instanceof WWWAuthenticateChallengeError) return error.response;
      throw error;
    });
  }

  /**
   * `QUERY`を送り、401の場合はトークンを破棄して1回だけ再取得・再送する。
   * 再送しても401なら`CLIENT_UNAUTHORIZED`にする。
   */
  async function query(path: string, payload: unknown): Promise<Response> {
    const body = JSON.stringify(payload);
    const response = await send(path, body, await accessTokenSource.get());
    if (response.status !== 401) return response;
    await accessTokenSource.invalidate();
    const retried = await send(path, body, await accessTokenSource.get());
    if (retried.status === 401) throw new AccountsClientError("CLIENT_UNAUTHORIZED");
    return retried;
  }

  return {
    async listExternalAccounts(accountsUserId) {
      const response = await query("/external-accounts", { accountsUserId });
      if (response.status === 404) return { status: "NOT_PROVIDED" };
      if (response.status !== 200) throw toResourceApiError(response);
      const list = await readBody(response, accountsExternalAccountListSchema);
      if (list?.accountsOrigin !== accountsOrigin || list.accountsUserId !== accountsUserId) {
        throw new AccountsClientError("INVALID_RESPONSE");
      }
      return { status: "PROVIDED", externalAccounts: list.externalAccounts };
    },

    async resolveIdentifiers(identifiers) {
      if (identifiers.length > accountsResolveIdentifierLimit) {
        throw new RangeError(
          `Accounts resolves at most ${accountsResolveIdentifierLimit} identifiers per request`,
        );
      }
      const response = await query("/identities/resolve", { identifiers });
      if (response.status !== 200 && response.status !== 400) throw toResourceApiError(response);
      const resolved = await readBody(response, accountsResolveResponseSchema);
      if (resolved === null && response.status === 400) throw toResourceApiError(response);
      const isConsistent =
        resolved?.accountsOrigin === accountsOrigin &&
        resolved.results.length === identifiers.length &&
        resolved.results.every((result, index) => result.index === index);
      if (!isConsistent) throw new AccountsClientError("INVALID_RESPONSE");
      return resolved.results;
    },
  };
}
