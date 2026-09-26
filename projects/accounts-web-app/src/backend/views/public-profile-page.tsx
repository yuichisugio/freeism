/** @jsxImportSource hono/jsx */
import type { Child } from "hono/jsx";

import { formatServiceName } from "../../shared/service-names";
import type { IdentifierKind } from "../domain/identity/identifier-key";
import type { VerificationMethod } from "../domain/identity/verification-method";
import type { VerificationResult } from "../domain/verification/verification-result";
import type {
  PublicExternalAccount,
  PublicProfile,
} from "../usecases/profile/read-public-profile";

/**
 * 公開プロフィールのHTML。
 * JavaScriptを実行しない外部サイトが読めるよう、静的なHTMLだけを返す。
 * キャッシュキーがURLだけのため、固定の文言は日本語と英語を併記する。
 * 外部の表示名・URLはhono/jsxの自動エスケープで出力し、`href`には`https:`のURLだけを使う。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./public-profile-page.test.tsx
 */

// --------------------------------------------------
// 文言
// --------------------------------------------------

/**
 * 証明方法のバッジ。
 */
const methodBadges: Record<VerificationMethod, string> = {
  oauth: "OAuth",
  bidirectional_link: "公開ページのリンク確認 / Public page link",
  dns_txt: "DNS TXT",
};

/**
 * 直近の試行結果。
 */
const resultLabels: Record<VerificationResult, string> = {
  verified: "成功 / Verified",
  not_verified: "証拠を確認できませんでした / Evidence not found",
  indeterminate: "判断できませんでした / Could not be determined",
};

/**
 * URL以外の識別子の種類。
 */
const identifierLabels: Record<Exclude<IdentifierKind, "url">, string> = {
  provider_account: "固有ID / Account ID",
  provider_username: "ユーザー名 / Username",
};

// --------------------------------------------------
// 部品
// --------------------------------------------------

/**
 * 日英併記の固定文言と最小限のスタイルを持つ文書。
 * ファビコンは管理画面と同じassetsの`/favicon.svg`を指定する。
 */
function Document({ title, children }: { title: string; children: Child }) {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <style>{
          "body{font-family:system-ui,sans-serif;line-height:1.6;max-width:48rem;margin:0 auto;padding:1rem}" +
            ".badge{display:inline-block;border:1px solid currentColor;border-radius:.25rem;padding:0 .4rem;font-size:.85em}"
        }</style>
      </head>
      <body>{children}</body>
    </html>
  );
}

/**
 * 日時をUTCのRFC 3339で表示する。
 */
function DateTime({ value }: { value: Date }) {
  const text = value.toISOString();
  return <time datetime={text}>{text}</time>;
}

/**
 * 外部のURLをリンクにする。
 * 外部アカウントのURLは`rel="me"`を付け、証拠URL（取得時の最終URL）は付けない。
 * 保存値は正規化済みの`https:` URLだが、`https:`以外はリンクにしない。
 */
function ExternalLink({ url, rel }: { url: string; rel?: "me" }) {
  return url.startsWith("https://") ? (
    <a href={url} rel={rel}>
      {url}
    </a>
  ) : (
    <span>{url}</span>
  );
}

/**
 * 外部アカウント1件。
 */
function ExternalAccountItem({ externalAccount }: { externalAccount: PublicExternalAccount }) {
  return (
    <li>
      <h3>
        {formatServiceName(externalAccount.service)}
        {externalAccount.displayName === null ? null : ` — ${externalAccount.displayName}`}
      </h3>
      <ul>
        {externalAccount.identifiers.map((identifier) => (
          <li key={`${identifier.kind}:${identifier.value}`}>
            {identifier.kind === "url" ? (
              <ExternalLink url={identifier.value} rel="me" />
            ) : (
              `${identifierLabels[identifier.kind]}: ${identifier.value}`
            )}
          </li>
        ))}
      </ul>
      {externalAccount.linkedAt === null ? null : (
        <p>
          連携日時 / Linked at: <DateTime value={externalAccount.linkedAt} />
        </p>
      )}
      <ul>
        {externalAccount.verifications.map((verification) => (
          <li key={verification.method}>
            <span class="badge">{methodBadges[verification.method]}</span> 検証日時 / Verified at:{" "}
            <DateTime value={verification.verifiedAt} />
            {" · "}直近の確認 / Last checked: <DateTime value={verification.checkedAt} /> (
            {resultLabels[verification.result]})
            {verification.evidenceUrl === null ? null : (
              <>
                {" · "}証拠URL / Evidence: <ExternalLink url={verification.evidenceUrl} />
              </>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}

// --------------------------------------------------
// ページ
// --------------------------------------------------

/**
 * 公開プロフィールのHTMLを生成する。
 */
export async function renderPublicProfilePage(profile: PublicProfile): Promise<string> {
  const page = (
    <Document title={`${profile.displayName} | Accounts`}>
      <main>
        <h1>{profile.displayName}</h1>
        <p>
          AccountsユーザーID / Accounts user ID: <code>{profile.accountsUserId}</code>
        </p>
        <section>
          <h2>外部アカウント / External accounts</h2>
          {profile.externalAccounts.length === 0 ? (
            <p>公開している外部アカウントはありません。 / No external accounts are public.</p>
          ) : (
            <ul>
              {profile.externalAccounts.map((externalAccount) => (
                <ExternalAccountItem key={externalAccount.id} externalAccount={externalAccount} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </Document>
  );
  return `<!doctype html>${await page}`;
}

/**
 * 存在しない・banされたユーザーのプロフィールのHTMLを生成する。
 */
export async function renderPublicProfileNotFoundPage(): Promise<string> {
  const page = (
    <Document title="Not found | Accounts">
      <main>
        <h1>プロフィールが見つかりません / Profile not found</h1>
      </main>
    </Document>
  );
  return `<!doctype html>${await page}`;
}
