import { classifyServiceUrl } from "../verification/classify-service-url";
import type { IdentifierKey } from "./identifier-key";

/**
 * 正規化したURLから、URL登録・証明で保存する識別子キーを作る。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./url-identifier-keys.test.ts
 */

/**
 * 正規化URL全体を値、正規化hostを`host`にしたURL識別子のキーを作る。
 * @param normalizedUrl `normalizeUrl`で正規化したURL。
 */
export function buildUrlIdentifierKey(normalizedUrl: string): IdentifierKey {
  return {
    kind: "url",
    provider: "",
    issuer: "",
    value: normalizedUrl,
    host: new URL(normalizedUrl).hostname,
  };
}

/**
 * 個別対応サービスのプロフィールURLに当たる場合、URL規則で得たユーザー名とプロフィールURLの識別子キーを作る。
 * プロフィールでないURLは空配列を返す。
 * @param normalizedUrl `normalizeUrl`で正規化したURL。リンク証明では最終取得URLを渡す。
 */
export function buildUrlRuleIdentifierKeys(normalizedUrl: string): IdentifierKey[] {
  const classification = classifyServiceUrl(normalizedUrl);
  if (classification.urlType !== "profile") return [];

  return [
    {
      kind: "provider_username",
      provider: classification.provider,
      issuer: "",
      value: classification.username,
      host: null,
    },
    buildUrlIdentifierKey(normalizedUrl),
  ];
}
