/**
 * Accountsの公開プロフィールURL。
 * リンク証明とDNS TXTで期待する値であり、公開プロフィールの配信URLでもある。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./accounts-profile-url.test.ts
 */

/**
 * 証明先のAccountsユーザー。
 * `accountsOrigin`は環境設定の公開origin、`accountsUserId`はセッション本人のIDとし、ブラウザーから受け取った値を使わない。
 */
export type AccountsProfileTarget = {
  accountsOrigin: string;
  accountsUserId: string;
};

/**
 * 公開プロフィールURLの`{origin}/profiles/`までの部分を作る。
 */
export function buildAccountsProfileUrlPrefix(accountsOrigin: string): string {
  return `${new URL(accountsOrigin).origin}/profiles/`;
}

/**
 * 公開プロフィールURL`{origin}/profiles/{accountsUserId}`を作る。
 * AccountsユーザーIDはURL-safeな文字だけで構成されるため、そのまま連結する。
 */
export function buildAccountsProfileUrl({
  accountsOrigin,
  accountsUserId,
}: AccountsProfileTarget): string {
  return buildAccountsProfileUrlPrefix(accountsOrigin) + accountsUserId;
}
