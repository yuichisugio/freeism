// --------------------------------------------------
// FIX 受領者の識別子を Accounts で照合する port
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

/** 1つの接続先 Accounts に対して、識別子の現在の照合結果を問い合わせる。 */
export type AccountsRecipientResolver = (
  identifiers: readonly RecipientIdentifier[],
) => Promise<AccountsRecipientResolution>;

/** 接続先 ID から、その接続先に対する照合関数を作る。 */
export type CreateAccountsRecipientResolver = (
  accountsConnectionId: string,
) => AccountsRecipientResolver;

/** 照合を実行できない時のエラー。 */
export class AccountsRecipientResolutionError extends Error {
  constructor(readonly code: "ACCOUNTS_CONNECTION_REQUIRED") {
    super(code);
  }
}

/**
 * Accounts との照合が未設定の時の既定値。
 * 照合を要する操作をすべて `ACCOUNTS_CONNECTION_REQUIRED` で拒否する。
 */
export const createUnconfiguredAccountsRecipientResolver: CreateAccountsRecipientResolver =
  () => async () => {
    throw new AccountsRecipientResolutionError("ACCOUNTS_CONNECTION_REQUIRED");
  };

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
