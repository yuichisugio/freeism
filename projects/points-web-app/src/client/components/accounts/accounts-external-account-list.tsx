/**
 * Accountsから取得した連携アカウント一覧の表示（設定画面と公開プロフィールで共通）。
 * 値はAccountsが返したものだけをテキストで示し、URLは`http(s):`のものだけをリンクにする。
 * 項目名はAccounts資源APIの応答（`accountsProvidedExternalAccountSchema`）に揃える。
 * @see ../../../backend/accounts/accounts-api-schema.ts
 * @see ../../../../docs/v0.2/details-ja/profile-setting.md
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
 * 外部アカウント1件に対する証明の試行。
 */
export type AccountsExternalAccountVerification = {
  method: "oauth" | "bidirectional_link" | "dns_txt";
  result: "verified" | "not_verified" | "indeterminate";
  verifiedAt: string | null;
  checkedAt: string | null;
  evidenceUrl: string | null;
};

/**
 * 表示に使う項目だけを持つ外部アカウント。
 */
export type AccountsExternalAccount = {
  service: string | null;
  displayName: string | null;
  identifiers: AccountsExternalAccountIdentifier[];
  linkedAt: string | null;
  verificationStatus: "verified" | "unverified";
  verifications: AccountsExternalAccountVerification[];
};

// --------------------------------------------------
// 文言
// --------------------------------------------------

const verificationMethodLabels: Record<AccountsExternalAccountVerification["method"], string> = {
  oauth: "OAuth",
  bidirectional_link: "公開ページのリンク確認",
  dns_txt: "DNS TXT",
};

const verificationResultLabels: Record<AccountsExternalAccountVerification["result"], string> = {
  verified: "成功",
  not_verified: "証拠を確認できませんでした",
  indeterminate: "判断できませんでした",
};

// --------------------------------------------------
// 表示
// --------------------------------------------------

/**
 * `javascript:`などをリンクにしないよう、HTTP(S)のURLかを判定する。
 */
function isHttpUrl(url: string): boolean {
  const protocol = URL.parse(url)?.protocol;
  return protocol === "https:" || protocol === "http:";
}

/**
 * Accountsが返した日時をそのままテキストで示す。
 */
function DateTimeText({ label, value }: Readonly<{ label: string; value: string | null }>) {
  if (value === null) return null;
  return (
    <>
      {` / ${label}: `}
      <time dateTime={value}>{value}</time>
    </>
  );
}

/**
 * HTTP(S)のURLだけをリンクにし、それ以外はテキストで示す。
 */
function IdentifierText({
  identifier,
}: Readonly<{ identifier: AccountsExternalAccountIdentifier }>) {
  switch (identifier.type) {
    case "url":
      return isHttpUrl(identifier.url) ? (
        <a href={identifier.url} rel="me nofollow noopener noreferrer ugc">
          {identifier.url}
        </a>
      ) : (
        <>{identifier.url}</>
      );
    case "provider_username":
      return <>{`${identifier.provider}: @${identifier.username}`}</>;
    case "provider_account":
      return <>{`${identifier.provider} ID: ${identifier.accountId}`}</>;
  }
}

/**
 * 証明の方法・結果・日時・証拠URLを示す。
 * 証拠URLは本人のアカウントではないため`rel="me"`を付けない。
 */
function VerificationText({
  verification,
}: Readonly<{ verification: AccountsExternalAccountVerification }>) {
  const { evidenceUrl } = verification;
  return (
    <small>
      {`${verificationMethodLabels[verification.method]}: ${verificationResultLabels[verification.result]}`}
      <DateTimeText label="検証日時" value={verification.verifiedAt} />
      <DateTimeText label="確認日時" value={verification.checkedAt} />
      {evidenceUrl === null ? null : (
        <>
          {" / 証拠: "}
          {isHttpUrl(evidenceUrl) ? (
            <a href={evidenceUrl} rel="nofollow noopener noreferrer ugc">
              {evidenceUrl}
            </a>
          ) : (
            evidenceUrl
          )}
        </>
      )}
    </small>
  );
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
          <small>
            {account.verificationStatus === "verified" ? "確認済み" : "未確認"}
            <DateTimeText label="連携日時" value={account.linkedAt} />
          </small>
          {account.verifications.map((verification, verificationIndex) => (
            <VerificationText key={verificationIndex} verification={verification} />
          ))}
        </li>
      ))}
    </ul>
  );
}
