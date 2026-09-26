import type {
  AccountsResolveIdentifier,
  AccountsResolveResult,
} from "../accounts/accounts-api-schema";
import { createAccountsResourceContext } from "../accounts/accounts-connection-context";
import type { AccountsFailureReporter } from "../accounts/accounts-failure-reporter";
import { AccountsClientError } from "../accounts/accounts-http";
import { importAccountsKeyEncryptionKey } from "../accounts/accounts-key-vault";
import {
  accountsResolveIdentifierLimit,
  type AccountsResourceClient,
} from "../accounts/accounts-resource-client";

/**
 * FIX受領者の識別子を接続先Accountsで照合する。
 * 照合が正常に終わった該当なし（`no_match`）と、照合できなかった失敗（`AccountsRecipientResolutionError`）を区別する。
 * @see ../../../docs/v0.2/details-ja/unclaimed-fix-and-ownership.md
 * @see ./accounts-recipient-resolver.test.ts
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

/** FIX の受領者を表す入力識別子の種類。 */
export type RecipientIdentifierType = "url" | "accounts_user";

/** FIX の受領者を表す入力識別子。値は入力値そのまま。 */
export interface RecipientIdentifier {
  type: RecipientIdentifierType;
  value: string;
}

/** 1件の識別子の照合結果。 */
export type RecipientResolution =
  | { accountsUserId: string; status: "matched" }
  | { status: "invalid_input" }
  | { status: "no_match" };

/** 1回の照合の結果。`results` は入力と同じ順序で並ぶ。 */
export interface AccountsRecipientResolution {
  accountsOrigin: string;
  results: RecipientResolution[];
}

/**
 * 1つの接続先 Accounts に対して、識別子の現在の照合結果を問い合わせる。
 * 照合できなかった場合は `AccountsRecipientResolutionError` を投げる。
 */
export type AccountsRecipientResolver = (
  identifiers: readonly RecipientIdentifier[],
) => Promise<AccountsRecipientResolution>;

/** 接続先 ID から、その接続先に対する照合関数を作る。 */
export type CreateAccountsRecipientResolver = (
  accountsConnectionId: string,
) => AccountsRecipientResolver;

/**
 * 接続先の資源APIクライアントを開く。
 * @returns 接続先が ACTIVE でない（存在しない・登録待ち・取り下げ済み）場合は `null`
 */
export type OpenAccountsResourceContext = (accountsConnectionId: string) => Promise<{
  connection: { accountsOrigin: string };
  resourceClient: Pick<AccountsResourceClient, "resolveIdentifiers">;
} | null>;

// --------------------------------------------------
// 失敗
// --------------------------------------------------

/**
 * 照合できなかった理由。
 * - `ACCOUNTS_CONNECTION_NOT_ACTIVE`: 接続先が ACTIVE でない
 * - `ACCOUNTS_UNAVAILABLE`: 通信失敗・制限超過・不正な応答など、Accounts から照合結果を得られなかった
 * - `ACCOUNTS_CLIENT_UNAUTHORIZED`: Access Token を取り直しても Accounts が認証を拒否した
 */
export type AccountsRecipientResolutionErrorCode =
  | "ACCOUNTS_CONNECTION_NOT_ACTIVE"
  | "ACCOUNTS_UNAVAILABLE"
  | "ACCOUNTS_CLIENT_UNAUTHORIZED";

/** 照合を実行できない時のエラー。`retryAfter` は Accounts の制限超過時の `Retry-After`。 */
export class AccountsRecipientResolutionError extends Error {
  constructor(
    readonly code: AccountsRecipientResolutionErrorCode,
    readonly retryAfter: string | null = null,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "AccountsRecipientResolutionError";
  }
}

/**
 * Accounts とのやり取りの失敗を照合の失敗へ変換する。
 */
function toResolutionError(error: AccountsClientError): AccountsRecipientResolutionError {
  const code =
    error.code === "CLIENT_UNAUTHORIZED" ? "ACCOUNTS_CLIENT_UNAUTHORIZED" : "ACCOUNTS_UNAVAILABLE";
  return new AccountsRecipientResolutionError(code, error.retryAfter, { cause: error });
}

// --------------------------------------------------
// 照合
// --------------------------------------------------

/**
 * Accounts の照合結果を1件の照合結果へ変換する。
 * `matched` なのに Accounts ユーザー ID が無い応答は、照合できなかったものとして扱う。
 */
function toRecipientResolution({
  status,
  accountsUserId,
}: AccountsResolveResult): RecipientResolution {
  if (status !== "matched") return { status };
  if (accountsUserId === null) throw new AccountsClientError("INVALID_RESPONSE");
  return { status, accountsUserId };
}

/** 入力識別子を Accounts 照合 API の識別子へ変換する。 */
function toAccountsResolveIdentifier({
  type,
  value,
}: RecipientIdentifier): AccountsResolveIdentifier {
  return type === "url" ? { type, url: value } : { type, accountsUserId: value };
}

/**
 * 接続先 Accounts で照合する本番の照合関数を作る。
 * 同じ識別子は1回だけ照合し、Accounts の上限（1,000件）ごとに要求を分ける。
 * Accounts とのやり取りの失敗は `reportFailure` へ記録してから投げる。
 */
export function createAccountsRecipientResolver(
  openResourceContext: OpenAccountsResourceContext,
  reportFailure: AccountsFailureReporter,
): CreateAccountsRecipientResolver {
  return (accountsConnectionId) => async (identifiers) => {
    try {
      const opened = await openResourceContext(accountsConnectionId);
      if (opened === null) {
        throw new AccountsRecipientResolutionError("ACCOUNTS_CONNECTION_NOT_ACTIVE");
      }
      const uniqueIdentifiers = [
        ...new Map(
          identifiers.map((identifier) => [recipientIdentifierKey(identifier), identifier]),
        ).values(),
      ];
      const resolved = new Map<string, RecipientResolution>();
      for (
        let start = 0;
        start < uniqueIdentifiers.length;
        start += accountsResolveIdentifierLimit
      ) {
        const chunk = uniqueIdentifiers.slice(start, start + accountsResolveIdentifierLimit);
        const results = await opened.resourceClient.resolveIdentifiers(
          chunk.map(toAccountsResolveIdentifier),
        );
        results.forEach((result, index) => {
          resolved.set(recipientIdentifierKey(chunk[index]!), toRecipientResolution(result));
        });
      }
      return {
        accountsOrigin: opened.connection.accountsOrigin,
        results: identifiers.map((identifier) => resolved.get(recipientIdentifierKey(identifier))!),
      };
    } catch (error) {
      if (!(error instanceof AccountsClientError)) throw error;
      await reportFailure({
        operation: "accounts_resolve",
        code: error.code,
        connectionId: accountsConnectionId,
      });
      throw toResolutionError(error);
    }
  };
}

/**
 * D1 に保存した接続先と Worker secret の KEK で、本番の照合関数を作る。
 * @param fetch Accounts への要求に使う `fetch`（テストではテスト用 Accounts へ差し替える）
 */
export function createD1AccountsRecipientResolver({
  db,
  keyEncryptionKey,
  fetch,
  reportFailure,
}: {
  db: D1Database;
  keyEncryptionKey: string;
  fetch: typeof globalThis.fetch;
  reportFailure: AccountsFailureReporter;
}): CreateAccountsRecipientResolver {
  return createAccountsRecipientResolver(
    async (connectionId) =>
      createAccountsResourceContext({
        db,
        kek: await importAccountsKeyEncryptionKey(keyEncryptionKey),
        connectionId,
        fetch,
      }),
    reportFailure,
  );
}

// --------------------------------------------------
// キー
// --------------------------------------------------

/** 識別子の同一性を判定するキー。 */
export function recipientIdentifierKey(identifier: RecipientIdentifier): string {
  return `${identifier.type}\u0000${identifier.value}`;
}

/**
 * 修正 revision で対象者を揃えるキー。
 * 照合結果ではなく入力識別子で決めるので、照合結果が変わっても対象者は揺れない。
 */
export function recipientBusinessKey(
  identifier: RecipientIdentifier,
  accountsOrigin: string,
): string {
  return identifier.type === "url"
    ? `url:${identifier.value}`
    : `accounts_user:${accountsOrigin}:${identifier.value}`;
}
