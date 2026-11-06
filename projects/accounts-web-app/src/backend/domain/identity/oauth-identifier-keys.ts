import type { IdentifierKey } from "./identifier-key";
import type { LoginProviderId } from "../../../shared/providers";
import { normalizeProviderUsername } from "./providers";

/**
 * OAuthの検証済み応答から得た識別子の元データ。
 */
export type OAuthIdentity = {
  providerId: LoginProviderId;
  accountId: string;
  username: string | null;
};

/**
 * OAuthの検証済み応答から、外部アカウントの識別子キーを組み立てる。
 * 固有IDは常に含め、GitHubはユーザー名とプロフィールURL、ORCIDはiDのプロフィールURLを加える。
 * GitHubのプロフィールURLはProvider応答の表記を使い、大文字小文字の揺れは小文字化したユーザー名で補う。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./oauth-identifier-keys.test.ts
 */
export function buildOAuthIdentifierKeys(identity: OAuthIdentity): IdentifierKey[] {
  const keys: IdentifierKey[] = [
    {
      kind: "provider_account",
      provider: identity.providerId,
      issuer: "",
      value: identity.accountId,
      host: null,
    },
  ];

  if (identity.providerId === "github" && identity.username) {
    keys.push(
      {
        kind: "provider_username",
        provider: "github",
        issuer: "",
        value: normalizeProviderUsername("github", identity.username),
        host: null,
      },
      {
        kind: "url",
        provider: "",
        issuer: "",
        value: `https://github.com/${identity.username}`,
        host: "github.com",
      },
    );
  }

  if (identity.providerId === "orcid") {
    keys.push({
      kind: "url",
      provider: "",
      issuer: "",
      value: `https://orcid.org/${identity.accountId}`,
      host: "orcid.org",
    });
  }

  return keys;
}
