/**
 * Accountsが扱うProvider識別子。
 * 照合入力・バックアップJSONの`provider`の許可値に使う。
 * @see ../../docs/specification/v0.1/verify-url.ja.md
 */
export const providerIds = [
  "google",
  "github",
  "orcid",
  "gitlab",
  "stackoverflow",
  "qiita",
  "note",
  "zenn",
  "codeberg",
  "x",
  "huggingface",
] as const;

/**
 * Provider表のProvider識別子。
 */
export type ProviderId = (typeof providerIds)[number];

/**
 * ログイン・追加連携に使うOAuth Provider。
 */
export const loginProviderIds = ["google", "github", "orcid"] as const;

/**
 * ログイン・追加連携に使うOAuth ProviderのProvider識別子。
 */
export type LoginProviderId = (typeof loginProviderIds)[number];
