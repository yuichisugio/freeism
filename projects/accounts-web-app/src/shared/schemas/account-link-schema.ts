import * as v from "valibot";

import {
  verificationFailureCodeSchema,
  verificationMethodSchema,
  verificationResultSchema,
  verificationStatusSchema,
} from "./verification-schema";

/**
 * `GET /api/account-links?consentClientId=`の`data`。
 * 本人向けの外部アカウント一覧と、公開先の列にするOAuthクライアントを返す。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */

/**
 * 外部アカウントの識別子（本人向け）。
 * `isActive`は現在の証明済み紐付けとして照合に使われるかを表し、`false`は登録候補。
 */
export const linkedIdentifierSchema = v.object({
  id: v.string(),
  type: v.picklist(["url", "provider_account", "provider_username"]),
  provider: v.nullable(v.string()),
  value: v.string(),
  isActive: v.boolean(),
});

/**
 * 成功した証明1件（本人向け）。
 * `id`は「この証明を解除」の`verificationId`、`verifiedAt`は現在の紐付けの根拠となる成功日時。
 * `evidence`は双方向リンクでは証拠を確認したページ、DNS TXTではTXTレコード名（`_accounts.{host}`）、OAuthでは`null`。
 * `identifiers`はその証明が確認した識別子。
 */
export const linkedVerificationSchema = v.object({
  id: v.string(),
  method: verificationMethodSchema,
  verifiedAt: v.string(),
  evidence: v.nullable(v.string()),
  identifiers: v.array(linkedIdentifierSchema),
});

/**
 * 未検証の行の直近の試行。
 * 同じ日時の試行が複数ある場合（同じ要求のリンクとDNS TXT）は、先に確かめるリンクの結果とする。
 */
export const latestAttemptSchema = v.object({
  checkedAt: v.string(),
  result: verificationResultSchema,
  failureCode: v.nullable(verificationFailureCodeSchema),
});

/**
 * 外部アカウント1行。
 * `verifications`は成功した証明だけを持ち、`latestAttempt`は未検証の行の直近の試行（証明済みの行と試行の無い行は`null`）。
 * `primaryUrl`は行の「再検証」に使うURL識別子（URL識別子の無い行は`null`）。
 * `visibility`はClient IDごとの公開選択、`hasImportedVerifications`は、有効な識別子が無く、バックアップから取り込んだ証明情報（再証明待ちの参考値）を持つか。
 */
export const linkedAccountSchema = v.object({
  id: v.string(),
  service: v.nullable(v.string()),
  displayName: v.nullable(v.string()),
  email: v.nullable(v.string()),
  linkedAt: v.nullable(v.string()),
  isPublic: v.boolean(),
  verificationStatus: verificationStatusSchema,
  identifiers: v.array(linkedIdentifierSchema),
  verifications: v.array(linkedVerificationSchema),
  latestAttempt: v.nullable(latestAttemptSchema),
  primaryUrl: v.nullable(v.string()),
  visibility: v.record(v.string(), v.boolean()),
  hasImportedVerifications: v.boolean(),
});

/**
 * 公開先の列にするOAuthクライアント。
 * 保存済みの有効な提供先と、`consentClientId`で指定した今回の認可要求の連携先（`isConsentRequest: true`）を含む。
 */
export const linkedClientSchema = v.object({
  clientId: v.string(),
  name: v.string(),
  uri: v.nullable(v.string()),
  isConsentRequest: v.boolean(),
});

export const accountLinksSchema = v.object({
  profileUrl: v.string(),
  accounts: v.array(linkedAccountSchema),
  clients: v.array(linkedClientSchema),
});

export type LinkedVerification = v.InferOutput<typeof linkedVerificationSchema>;
export type LatestAttempt = v.InferOutput<typeof latestAttemptSchema>;
export type LinkedAccount = v.InferOutput<typeof linkedAccountSchema>;
export type LinkedClient = v.InferOutput<typeof linkedClientSchema>;
export type AccountLinks = v.InferOutput<typeof accountLinksSchema>;
