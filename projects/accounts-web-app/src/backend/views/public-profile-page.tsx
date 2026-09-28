/** @jsxImportSource hono/jsx */
import type { Child } from "hono/jsx";

import { buildFaviconUrl } from "../../shared/favicon-url";
import { formatUtcDateTime } from "../../shared/format-date-time";
import { formatServiceName } from "../../shared/service-names";
import type { VerificationMethod } from "../domain/identity/verification-method";
import type {
  PublicExternalAccount,
  PublicProfile,
} from "../usecases/profile/read-public-profile";

/**
 * 公開プロフィールのHTML。
 * JavaScriptを実行しない外部サイトが読めるよう、静的なHTMLだけを返す（言語の切替も`<details>`とリンクで行う）。
 * 文言は`?lang=ja|en`の言語ごとに分け、URLごとにキャッシュする。
 * 外部の表示名・URLはhono/jsxの自動エスケープで出力し、`href`には`https:`のURLだけを使う。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./public-profile-page.test.tsx
 */

// --------------------------------------------------
// 言語と文言
// --------------------------------------------------

/**
 * 公開プロフィールの言語。
 */
export type PublicProfileLanguage = "ja" | "en";

/**
 * 言語ごとの固定文言。
 */
const messages = {
  ja: {
    languageName: "日本語",
    heading: "証明済みのアカウント",
    method: "証明方法",
    verified: "証明日時",
    notFound: "このプロフィールは存在しません",
    separator: "：",
    joiner: "・",
    methods: { oauth: "OAuth", bidirectional_link: "双方向リンク", dns_txt: "DNS TXT" },
  },
  en: {
    languageName: "English",
    heading: "Verified external accounts",
    method: "Method",
    verified: "Verified",
    notFound: "Profile not found",
    separator: ": ",
    joiner: ", ",
    methods: { oauth: "OAuth", bidirectional_link: "Two-way link", dns_txt: "DNS TXT" },
  },
} satisfies Record<
  PublicProfileLanguage,
  Record<string, string | Record<VerificationMethod, string>>
>;

/**
 * 言語の表示順。
 */
const languages: readonly PublicProfileLanguage[] = ["ja", "en"];

/**
 * `?lang`の値を言語にする。
 * 指定が無い・未知の値は日本語とする。
 */
export function readPublicProfileLanguage(value: string | undefined): PublicProfileLanguage {
  return value === "en" ? "en" : "ja";
}

// --------------------------------------------------
// サービスアイコン
// --------------------------------------------------

/**
 * URLを持たないことがあるOAuth Providerの、アイコン用のhost。
 */
const oauthServiceHosts: Partial<Record<string, string>> = {
  google: "google.com",
  github: "github.com",
  orcid: "orcid.org",
};

// --------------------------------------------------
// スタイル
// --------------------------------------------------

/**
 * 管理画面と同じ色の組をライト・ダークで持つ最小限のスタイル。
 * サービスアイコンは、地球儀の上に不透明な背景のinlineの画像を中央揃えで重ねる。
 * 画像に寸法を指定しないため、読めない画像（`alt=""`）は大きさ0になり、地球儀だけが見える。
 */
const styles = [
  ":root{color-scheme:light dark;--background:#F2F4FA;--surface:#FFFFFF;--surface-secondary:#F5F7FC;--border:#E2E6F0;--foreground:#1B2033;--muted:#69708A;--accent:#3B6FF0;--accent-soft:#E8EEFE;--favicon-plate:#FFFFFF;--favicon-fallback:#69708A;--shadow:0 1px 2px rgba(27,32,51,.04),0 6px 20px rgba(27,32,51,.05);--shadow-pop:0 4px 12px rgba(27,32,51,.08),0 18px 44px rgba(27,32,51,.16)}",
  "@media (prefers-color-scheme:dark){:root{--background:#10131C;--surface:#181C28;--surface-secondary:#1F2433;--border:#2A3042;--foreground:#E6E9F2;--muted:#969DB3;--accent:#7DA0FF;--accent-soft:#1E2A4A;--favicon-plate:#E6E9F2;--favicon-fallback:#4A5270;--shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.3);--shadow-pop:0 4px 12px rgba(0,0,0,.4),0 18px 44px rgba(0,0,0,.5)}}",
  "*{box-sizing:border-box}",
  'body{margin:0;background:var(--background);color:var(--foreground);font-family:"Noto Sans JP","Hiragino Sans",system-ui,sans-serif;line-height:1.6}',
  "a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}",
  "svg{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}",
  ".profile-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 24px;border-bottom:1px solid var(--border);background:var(--surface)}",
  ".brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:16px;color:var(--foreground)}.brand:hover{text-decoration:none}",
  ".lang-switch{position:relative}",
  ".lang-switch summary{list-style:none;height:40px;display:inline-flex;align-items:center;gap:8px;padding:0 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);font-size:13px;cursor:pointer;white-space:nowrap}",
  ".lang-switch summary::-webkit-details-marker{display:none}",
  ".lang-switch summary svg{width:20px;height:20px}.lang-switch summary .caret{width:16px;height:16px;color:var(--muted)}",
  ".lang-switch[open] summary{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}.lang-switch[open] .caret{transform:rotate(180deg)}",
  ".lang-menu{position:absolute;top:calc(100% + 8px);right:0;z-index:5;width:200px;margin:0;padding:8px;list-style:none;display:flex;flex-direction:column;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:var(--shadow-pop)}",
  ".menu-item{display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:14px;color:var(--foreground)}.menu-item:hover{background:var(--surface-secondary);text-decoration:none}",
  ".menu-item svg{width:16px;height:16px;margin-left:auto;color:var(--accent);stroke-width:2.6}",
  ".profile-page{max-width:640px;margin-inline:auto;padding:32px 24px 40px;display:flex;flex-direction:column;gap:24px}",
  ".profile-hero h1{margin:0;font-size:26px;line-height:1.3;overflow-wrap:anywhere}",
  '.mono{font-family:"M PLUS 1 Code",ui-monospace,Menlo,monospace;font-size:12px;color:var(--muted)}',
  ".profile-section{display:flex;flex-direction:column;gap:12px}.profile-section h2{margin:0;font-size:16px}",
  ".proof-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}",
  ".proof-item{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:var(--shadow)}",
  ".svc-badge{position:relative;display:inline-block;width:36px;height:36px;font-size:0;line-height:34px;text-align:center;border:1px solid var(--border);border-radius:12px;background:var(--favicon-plate)}",
  ".favicon-fallback{position:absolute;top:9px;left:9px;width:16px;height:16px;color:var(--favicon-fallback)}",
  ".favicon{position:relative;vertical-align:middle;max-width:20px;max-height:20px;background:var(--favicon-plate)}",
  ".acct-text{display:flex;flex-direction:column;min-width:0;overflow-wrap:anywhere}",
  ".acct-name{font-weight:500}.acct-name a{color:var(--foreground)}",
  ".other-urls{margin-left:8px;font-size:12px;font-weight:400}.other-urls a{color:var(--muted);margin-right:8px}",
  ".proof-meta{font-size:12px;color:var(--muted)}",
  ".notfound{padding:56px 24px;text-align:center}.notfound h1{margin:0;font-size:20px}",
  "@media (max-width:560px){.profile-header{padding:12px 16px}.profile-page{padding:24px 16px 32px}}",
].join("");

// --------------------------------------------------
// 部品
// --------------------------------------------------

/**
 * ページ内で`<use>`から参照するアイコン。
 */
function IconSymbols() {
  return (
    <svg aria-hidden="true" style="display:none">
      <symbol id="i-globe" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18M4.5 7.5h15M4.5 16.5h15" />
      </symbol>
      <symbol id="i-chevron" viewBox="0 0 24 24">
        <path d="m6 9 6 6 6-6" />
      </symbol>
      <symbol id="i-check" viewBox="0 0 24 24">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </symbol>
    </svg>
  );
}

/**
 * 言語ごとの文書。
 * ファビコンとロゴは管理画面と同じassetsの`/favicon.svg`を使う。
 */
function Document({
  language,
  title,
  head,
  children,
}: {
  language: PublicProfileLanguage;
  title: string;
  head?: Child;
  children: Child;
}) {
  return (
    <html lang={language}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {head}
        <style>{styles}</style>
      </head>
      <body>
        <IconSymbols />
        <Header language={language} />
        {children}
      </body>
    </html>
  );
}

/**
 * ロゴと、JavaScriptなしで開閉する言語ドロップダウン。
 * 各言語へのリンクは同じパスの`?lang=`だけを変える。
 */
function Header({ language }: { language: PublicProfileLanguage }) {
  return (
    <header class="profile-header">
      <a class="brand" href="/">
        <img src="/favicon.svg" alt="" width="28" height="28" />
        Freeism Accounts
      </a>
      <details class="lang-switch">
        <summary>
          <svg aria-hidden="true">
            <use href="#i-globe" />
          </svg>
          <span>{messages[language].languageName}</span>
          <svg class="caret" aria-hidden="true">
            <use href="#i-chevron" />
          </svg>
        </summary>
        <ul class="lang-menu">
          {languages.map((option) => (
            <li key={option}>
              <a
                class="menu-item"
                href={`?lang=${option}`}
                hreflang={option}
                lang={option}
                aria-current={option === language ? "true" : undefined}
              >
                {messages[option].languageName}
                {option === language ? (
                  <svg aria-hidden="true">
                    <use href="#i-check" />
                  </svg>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </header>
  );
}

/**
 * サービスアイコン。
 * 画像を読めないときは背後の地球儀が見える。
 */
function ServiceIcon({ host }: { host: string | undefined }) {
  return (
    <span class="svc-badge">
      <svg class="favicon-fallback" aria-hidden="true">
        <use href="#i-globe" />
      </svg>
      {host === undefined ? null : (
        <img
          class="favicon"
          src={buildFaviconUrl(host)}
          alt=""
          loading="lazy"
          referrerpolicy="no-referrer"
        />
      )}
    </span>
  );
}

/**
 * 日時をUTCの`YYYY/MM/DD HH:MM (UTC)`で表示する。
 */
function DateTime({ value }: { value: Date }) {
  const iso = value.toISOString();
  return <time datetime={iso}>{formatUtcDateTime(iso)}</time>;
}

/**
 * URLを表示用に、`https://`と末尾の`/`を除いた形にする。
 */
function formatUrlForDisplay(url: string): string {
  return url.replace(/^https:\/\//, "").replace(/\/$/, "");
}

/**
 * 外部アカウント1件。
 * 「サービス名：識別子」を主URL（最初のURL識別子）への`rel="me"`リンクにし、ほかのURL識別子は同じ行に小さく並べる。
 * 識別子はユーザー名・主URL・固有IDの順に最初にあるものを使い、表示名は使わない。
 */
function ExternalAccountItem({
  externalAccount,
  language,
}: {
  externalAccount: PublicExternalAccount;
  language: PublicProfileLanguage;
}) {
  const texts = messages[language];
  const [primaryUrl, ...otherUrls] = externalAccount.identifiers.flatMap(({ kind, value }) =>
    kind === "url" && value.startsWith("https://") ? [value] : [],
  );
  const username = externalAccount.identifiers.find(
    ({ kind }) => kind === "provider_username",
  )?.value;
  const identifier =
    username ??
    (primaryUrl === undefined ? undefined : formatUrlForDisplay(primaryUrl)) ??
    externalAccount.identifiers[0]?.value;
  const serviceName = formatServiceName(externalAccount.service);
  const label = `${serviceName}${texts.separator}${identifier ?? ""}`;
  const iconHost =
    (externalAccount.service === null ? undefined : oauthServiceHosts[externalAccount.service]) ??
    (primaryUrl === undefined ? undefined : new URL(primaryUrl).hostname);

  return (
    <li class="proof-item">
      <ServiceIcon host={iconHost} />
      <div class="acct-text">
        <span class="acct-name">
          {primaryUrl === undefined ? (
            label
          ) : (
            <a href={primaryUrl} rel="me">
              {label}
            </a>
          )}
          {otherUrls.length === 0 ? null : (
            <span class="other-urls">
              {otherUrls.map((url) => (
                <a key={url} href={url} rel="me">
                  {formatUrlForDisplay(url)}
                </a>
              ))}
            </span>
          )}
        </span>
        <span class="proof-meta">
          {texts.method}:{" "}
          {externalAccount.methods.map((method) => texts.methods[method]).join(texts.joiner)}
        </span>
        <span class="proof-meta">
          {texts.verified}: <DateTime value={externalAccount.verifiedAt} />
        </span>
      </div>
    </li>
  );
}

// --------------------------------------------------
// ページ
// --------------------------------------------------

/**
 * 公開プロフィールのHTMLを生成する。
 * `profileUrl`は言語ごとのURL（`<link rel="alternate" hreflang>`）の基点にする。
 */
export async function renderPublicProfilePage(
  profile: PublicProfile,
  { language, profileUrl }: { language: PublicProfileLanguage; profileUrl: string },
): Promise<string> {
  const texts = messages[language];
  const page = (
    <Document
      language={language}
      title={`${profile.displayName} | Freeism Accounts`}
      head={languages.map((option) => (
        <link
          key={option}
          rel="alternate"
          hreflang={option}
          href={`${profileUrl}?lang=${option}`}
        />
      ))}
    >
      <main class="profile-page">
        <div class="profile-hero">
          <h1>{profile.displayName}</h1>
          <span class="mono">{profile.accountsUserId}</span>
        </div>
        <section class="profile-section">
          <h2>{texts.heading}</h2>
          <ul class="proof-list">
            {profile.externalAccounts.map((externalAccount) => (
              <ExternalAccountItem
                key={externalAccount.id}
                externalAccount={externalAccount}
                language={language}
              />
            ))}
          </ul>
        </section>
      </main>
    </Document>
  );
  return `<!doctype html>${await page}`;
}

/**
 * 存在しない・banされた・証明済みの外部アカウントを公開していないユーザーのプロフィールのHTMLを生成する。
 */
export async function renderPublicProfileNotFoundPage(
  language: PublicProfileLanguage,
): Promise<string> {
  const texts = messages[language];
  const page = (
    <Document language={language} title={`${texts.notFound} | Freeism Accounts`}>
      <main class="notfound">
        <h1>{texts.notFound}</h1>
      </main>
    </Document>
  );
  return `<!doctype html>${await page}`;
}
