/**
 * Accountsから取得した連携アカウント一覧の表示（設定画面と公開プロフィールで共通）。
 * 値はAccountsが返したものだけをテキストで示し、URLは`rel="me nofollow noopener noreferrer ugc"`のリンクにする。
 * @see ./accounts-external-account-list.test.tsx
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

export type AccountsExternalAccountIdentifier =
  | { type: "url"; url: string }
  | { type: "provider_account"; provider: string; accountId: string }
  | { type: "provider_username"; provider: string; username: string };

/**
 * 表示に使う項目だけを持つ外部アカウント。
 */
export type AccountsExternalAccount = {
  service: string | null;
  displayName: string | null;
  identifiers: AccountsExternalAccountIdentifier[];
  verificationStatus: "verified" | "unverified";
};

// --------------------------------------------------
// 表示
// --------------------------------------------------

/**
 * HTTP(S)のURLだけをリンクにし、それ以外はテキストで示す。
 */
function IdentifierText({
  identifier,
}: Readonly<{ identifier: AccountsExternalAccountIdentifier }>) {
  switch (identifier.type) {
    case "url": {
      const protocol = URL.parse(identifier.url)?.protocol;
      return protocol === "https:" || protocol === "http:" ? (
        <a href={identifier.url} rel="me nofollow noopener noreferrer ugc">
          {identifier.url}
        </a>
      ) : (
        <>{identifier.url}</>
      );
    }
    case "provider_username":
      return <>{`${identifier.provider}: @${identifier.username}`}</>;
    case "provider_account":
      return <>{`${identifier.provider} ID: ${identifier.accountId}`}</>;
  }
}

export function AccountsExternalAccountList({
  externalAccounts,
}: Readonly<{ externalAccounts: AccountsExternalAccount[] }>) {
  if (externalAccounts.length === 0) {
    return <p>公開されている外部アカウントはありません。</p>;
  }
  return (
    <ul className="signed-list">
      {externalAccounts.map((account, index) => (
        <li key={index}>
          <strong>{account.displayName ?? account.service ?? "外部アカウント"}</strong>
          <span>
            {account.identifiers.map((identifier, identifierIndex) => (
              <span key={identifierIndex}>
                {identifierIndex > 0 ? " / " : null}
                <IdentifierText identifier={identifier} />
              </span>
            ))}
          </span>
          <small>{account.verificationStatus === "verified" ? "確認済み" : "未確認"}</small>
        </li>
      ))}
    </ul>
  );
}
