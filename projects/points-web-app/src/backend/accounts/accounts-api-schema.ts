import * as v from "valibot";

/**
 * Accounts資源API（`/api/v1/*`）の要求と応答の形。
 * Accountsが外部契約として公開する共有schemaに合わせ、応答の未知の項目は取り除いて読む（Accountsは項目を追加しうるため）。
 * @see ../../../../accounts-web-app/src/shared/schemas/resource-api-schema.ts
 * @see ../../../../accounts-web-app/docs/specification/v0.1/main.ja.md
 * @see ./accounts-api-schema.test.ts
 */

// --------------------------------------------------
// エラー
// --------------------------------------------------

/**
 * 要求全体のエラーと照合入力ごとのエラーで共通の1件。
 */
export const accountsResourceErrorSchema = v.object({
  code: v.string(),
  message: v.string(),
  path: v.nullable(v.array(v.union([v.string(), v.number()]))),
});

/**
 * 要求全体が失敗した場合の応答。
 */
export const accountsResourceErrorResponseSchema = v.object({
  errors: v.array(accountsResourceErrorSchema),
});

// --------------------------------------------------
// 外部アカウントの識別子
// --------------------------------------------------

export const accountsExternalIdentifierSchema = v.variant("type", [
  v.object({ type: v.literal("url"), url: v.string() }),
  v.object({ type: v.literal("provider_account"), provider: v.string(), accountId: v.string() }),
  v.object({ type: v.literal("provider_username"), provider: v.string(), username: v.string() }),
]);

// --------------------------------------------------
// 一覧取得（QUERY /api/v1/external-accounts）
// --------------------------------------------------

export const accountsProvidedVerificationSchema = v.object({
  method: v.picklist(["oauth", "bidirectional_link", "dns_txt"]),
  identifiers: v.array(accountsExternalIdentifierSchema),
  verifiedAt: v.nullable(v.string()),
  checkedAt: v.nullable(v.string()),
  result: v.picklist(["verified", "not_verified", "indeterminate"]),
  evidenceUrl: v.nullable(v.string()),
});

export const accountsProvidedExternalAccountSchema = v.object({
  service: v.nullable(v.string()),
  displayName: v.nullable(v.string()),
  identifiers: v.array(accountsExternalIdentifierSchema),
  linkedAt: v.nullable(v.string()),
  verificationStatus: v.picklist(["verified", "unverified"]),
  verifications: v.array(accountsProvidedVerificationSchema),
});

export const accountsExternalAccountListSchema = v.object({
  accountsOrigin: v.string(),
  accountsUserId: v.string(),
  externalAccounts: v.array(accountsProvidedExternalAccountSchema),
});

// --------------------------------------------------
// 照合（QUERY /api/v1/identities/resolve）
// --------------------------------------------------

/**
 * Pointsが照合に使う識別子（FIX CSVの`recipientProfileUrl`・`recipientAccountsUserId`）。
 */
export type AccountsResolveIdentifier =
  | { type: "url"; url: string }
  | { type: "accounts_user"; accountsUserId: string };

/**
 * 入力1件の照合結果。
 * `identifier`は正規化前の入力値をそのまま返す。
 */
export const accountsResolveResultSchema = v.object({
  index: v.number(),
  identifier: v.unknown(),
  status: v.picklist(["matched", "no_match", "invalid_input"]),
  accountsUserId: v.nullable(v.string()),
  errors: v.array(accountsResourceErrorSchema),
});

export const accountsResolveResponseSchema = v.object({
  accountsOrigin: v.string(),
  results: v.array(accountsResolveResultSchema),
});

export type AccountsResourceError = v.InferOutput<typeof accountsResourceErrorSchema>;
export type AccountsProvidedExternalAccount = v.InferOutput<
  typeof accountsProvidedExternalAccountSchema
>;
export type AccountsExternalAccountList = v.InferOutput<typeof accountsExternalAccountListSchema>;
export type AccountsResolveResult = v.InferOutput<typeof accountsResolveResultSchema>;
export type AccountsResolveResponse = v.InferOutput<typeof accountsResolveResponseSchema>;
