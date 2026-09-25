/**
 * Accountsが扱うProvider識別子と、サービス内ユーザー名の正規化規則。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./providers.test.ts
 */
const providerRules = {
  google: { lowercasesUsername: false },
  github: { lowercasesUsername: true },
  orcid: { lowercasesUsername: false },
  gitlab: { lowercasesUsername: true },
  stackoverflow: { lowercasesUsername: false },
  qiita: { lowercasesUsername: true },
  note: { lowercasesUsername: true },
  zenn: { lowercasesUsername: true },
  codeberg: { lowercasesUsername: true },
  x: { lowercasesUsername: true },
  huggingface: { lowercasesUsername: true },
} as const satisfies Record<string, { lowercasesUsername: boolean }>;

/**
 * Provider表のProvider識別子。
 */
export type ProviderId = keyof typeof providerRules;

/**
 * ログイン・追加連携に使うOAuth ProviderのProvider識別子。
 */
export type OAuthProviderId = Extract<ProviderId, "google" | "github" | "orcid">;

const oauthProviderIds: readonly string[] = [
  "google",
  "github",
  "orcid",
] satisfies OAuthProviderId[];

/**
 * 値がProvider表のProvider識別子かを判定する。
 */
export function isProviderId(value: string): value is ProviderId {
  return Object.hasOwn(providerRules, value);
}

/**
 * 標準`account`の`providerId`が、ログイン・追加連携に使うOAuth Providerかを判定する。
 */
export function isOAuthProviderId(value: string): value is OAuthProviderId {
  return oauthProviderIds.includes(value);
}

/**
 * Provider表の小文字化規則に従ってサービス内ユーザー名を正規化する。
 */
export function normalizeProviderUsername(provider: ProviderId, username: string): string {
  return providerRules[provider].lowercasesUsername ? username.toLowerCase() : username;
}
