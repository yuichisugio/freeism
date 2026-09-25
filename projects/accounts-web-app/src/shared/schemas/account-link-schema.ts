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
 * 証明方法ごとの記録（本人向け）。
 * `verifiedAt`は現在の紐付けの根拠となる成功日時、`checkedAt`・`result`・`failureCode`は直近の試行。
 * `authAccountId`は`oauth`証明の標準`account.id`で、「OAuthの認証連携だけ解除する」に使う。
 */
export const linkedVerificationSchema = v.object({
  id: v.string(),
  method: verificationMethodSchema,
  authAccountId: v.nullable(v.string()),
  evidenceUrl: v.nullable(v.string()),
  verifiedAt: v.nullable(v.string()),
  checkedAt: v.string(),
  result: verificationResultSchema,
  failureCode: v.nullable(verificationFailureCodeSchema),
  identifierIds: v.array(v.string()),
});

/**
 * 外部アカウント1行。
 * `visibility`はClient IDごとの公開選択、`hasImportedVerifications`はバックアップから取り込んだ証明情報（再証明待ちの参考値）を持つか。
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
  consented: v.boolean(),
  isConsentRequest: v.boolean(),
});

export const accountLinksSchema = v.object({
  profileUrl: v.string(),
  accounts: v.array(linkedAccountSchema),
  clients: v.array(linkedClientSchema),
});

export type LinkedIdentifier = v.InferOutput<typeof linkedIdentifierSchema>;
export type LinkedVerification = v.InferOutput<typeof linkedVerificationSchema>;
export type LinkedAccount = v.InferOutput<typeof linkedAccountSchema>;
export type LinkedClient = v.InferOutput<typeof linkedClientSchema>;
export type AccountLinks = v.InferOutput<typeof accountLinksSchema>;
