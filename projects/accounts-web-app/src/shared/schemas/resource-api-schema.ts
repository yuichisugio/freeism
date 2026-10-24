import * as v from "valibot";

import { resolveIdentifierLimit } from "../constants";
import {
  externalIdentifierSchema,
  identifierValueSchema,
  providerAccountIdentifierSchema,
  providerUsernameIdentifierSchema,
} from "./identifier-schema";
import {
  verificationMethodSchema,
  verificationResultSchema,
  verificationStatusSchema,
} from "./verification-schema";

/**
 * Accounts資源API（`/api/v1/*`）の入出力。
 * 主仕様「APIの具体案」の形を外部契約として使い、BFFの`{ data }`・RFC 9457とは異なる形にする。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */

// --------------------------------------------------
// エラー
// --------------------------------------------------

/**
 * 要求全体のエラーと照合入力ごとのエラーで共通の1件。
 * `path`は要求bodyの最上位から対象項目までの位置で、特定の項目を指せない場合は`null`。
 */
export const resourceApiErrorSchema = v.object({
  code: v.string(),
  message: v.string(),
  path: v.nullable(v.array(v.union([v.string(), v.number()]))),
});

/**
 * 要求全体が失敗した場合の応答。
 */
export const resourceApiErrorResponseSchema = v.object({
  errors: v.array(resourceApiErrorSchema),
});

// --------------------------------------------------
// 一覧取得（QUERY /api/v1/external-accounts）
// --------------------------------------------------

export const externalAccountListRequestSchema = v.strictObject({
  accountsUserId: identifierValueSchema,
});

/**
 * 提供する外部アカウントの証明1件。
 * 一度でも成功した証明だけを含め、`checkedAt`・`result`は直近の試行を表す。
 */
export const providedVerificationSchema = v.object({
  method: verificationMethodSchema,
  identifiers: v.array(externalIdentifierSchema),
  verifiedAt: v.nullable(v.string()),
  checkedAt: v.nullable(v.string()),
  result: verificationResultSchema,
  evidenceUrl: v.nullable(v.string()),
});

export const providedExternalAccountSchema = v.object({
  service: v.nullable(v.string()),
  displayName: v.nullable(v.string()),
  identifiers: v.array(externalIdentifierSchema),
  linkedAt: v.nullable(v.string()),
  verificationStatus: verificationStatusSchema,
  verifications: v.array(providedVerificationSchema),
});

export const externalAccountListResponseSchema = v.object({
  accountsOrigin: v.string(),
  accountsUserId: v.string(),
  externalAccounts: v.array(providedExternalAccountSchema),
});

// --------------------------------------------------
// 照合（QUERY /api/v1/identities/resolve）
// --------------------------------------------------

/**
 * 照合入力のURL。
 * 登録と同じく、HTTPS・port・userinfo・hostの受付制約と正規化後の長さはバックエンドの正規化で検査する。
 */
export const resolveUrlIdentifierSchema = v.strictObject({
  type: v.literal("url"),
  url: v.string(),
});

export const accountsUserIdentifierSchema = v.strictObject({
  type: v.literal("accounts_user"),
  accountsUserId: identifierValueSchema,
});

/**
 * 照合入力の識別子1件。
 * 要求全体とは別に各要素を検査し、不備はその要素の`errors`へまとめる。
 */
export const resolveIdentifierSchema = v.variant("type", [
  resolveUrlIdentifierSchema,
  providerAccountIdentifierSchema,
  providerUsernameIdentifierSchema,
  accountsUserIdentifierSchema,
]);

/**
 * 照合要求全体の形式。
 * 各要素の形式は`resolveIdentifierSchema`で個別に検査する。
 */
export const resolveRequestSchema = v.strictObject({
  identifiers: v.pipe(v.array(v.unknown()), v.maxLength(resolveIdentifierLimit)),
});

/**
 * 入力1件の照合結果。
 * `identifier`は正規化前の入力値をそのまま返す。
 */
export const resolveResultSchema = v.object({
  index: v.number(),
  identifier: v.unknown(),
  status: v.picklist(["matched", "no_match", "invalid_input"]),
  accountsUserId: v.nullable(v.string()),
  errors: v.array(resourceApiErrorSchema),
});

export const resolveResponseSchema = v.object({
  accountsOrigin: v.string(),
  results: v.array(resolveResultSchema),
});

export type ResourceApiError = v.InferOutput<typeof resourceApiErrorSchema>;
export type ResolveIdentifier = v.InferOutput<typeof resolveIdentifierSchema>;
export type ResolveResult = v.InferOutput<typeof resolveResultSchema>;
export type ProvidedExternalAccount = v.InferOutput<typeof providedExternalAccountSchema>;
export type ExternalAccountListResponse = v.InferOutput<typeof externalAccountListResponseSchema>;
