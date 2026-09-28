/** @jsxImportSource hono/jsx */
import type { Child } from "hono/jsx";

import { buildFaviconUrl } from "../../shared/favicon-url";
import { formatUtcDateTime } from "../../shared/format-date-time";
import { selectServiceIcon } from "../../shared/service-icon";
import type { ServiceIconSource } from "../../shared/service-icon";
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
// スタイル
// --------------------------------------------------

/**
 * 基準の寸法に、管理画面と同じ倍率（`--scale`）を掛けた値を返す。
 * @see ../../../docs/specification/v0.1/design-system/design-system.ja.md
 */
const scaled = (basePx: number) => `calc(${basePx}px*var(--scale))`;

/**
 * 管理画面と同じ色の組と寸法の倍率をライト・ダークで持つ最小限のスタイル。
 * Webフォントは読み込まず（CSPで外部の読み込みを許可しない）、見出しとロゴは閲覧者の端末にある丸ゴシックを使う。
 * OAuth Providerのアイコンは台の中央に置く。
 * faviconは、地球儀の上に不透明な背景のinlineの画像を中央揃えで重ねる。
 * 画像に寸法を指定しないため、読めない画像（`alt=""`）は大きさ0になり、地球儀だけが見える。
 */
const styles = [
  ":root{color-scheme:light dark;--scale:1.1;--background:#F2F4FA;--surface:#FFFFFF;--surface-secondary:#F5F7FC;--border:#E2E6F0;--border-strong:#C7CDDC;--foreground:#1B2033;--muted:#69708A;--accent:#3B6FF0;--accent-soft:#E8EEFE;--link:#2553C9;--favicon-plate:#FFFFFF;--favicon-fallback:#69708A;--shadow:0 1px 2px rgba(27,32,51,.04),0 6px 20px rgba(27,32,51,.05);--shadow-pop:0 4px 12px rgba(27,32,51,.08),0 18px 44px rgba(27,32,51,.16)}",
  "@media (prefers-color-scheme:dark){:root{--background:#10131C;--surface:#181C28;--surface-secondary:#1F2433;--border:#2A3042;--border-strong:#3C4560;--foreground:#E6E9F2;--muted:#969DB3;--accent:#7DA0FF;--accent-soft:#1E2A4A;--link:#9DB8FF;--favicon-plate:#E6E9F2;--favicon-fallback:#4A5270;--shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.3);--shadow-pop:0 4px 12px rgba(0,0,0,.4),0 18px 44px rgba(0,0,0,.5)}}",
  "*{box-sizing:border-box}",
  `body{margin:0;background:var(--background);color:var(--foreground);font-family:"Noto Sans JP","Hiragino Sans",system-ui,sans-serif;font-size:${scaled(14)};line-height:1.7}`,
  'h1,h2,.brand{font-family:"Zen Maru Gothic","Hiragino Maru Gothic ProN","Noto Sans JP",sans-serif;font-weight:700}h1,h2{margin:0;line-height:1.35}',
  "a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}",
  "svg{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}",
  `.profile-header{display:flex;align-items:center;justify-content:space-between;gap:${scaled(12)};padding:${scaled(16)} ${scaled(24)};border-bottom:1px solid var(--border);background:var(--surface)}`,
  `.brand{display:flex;align-items:center;gap:${scaled(8)};font-size:${scaled(16)};color:var(--foreground)}.brand:hover{text-decoration:none}.brand img{width:${scaled(28)};height:${scaled(28)}}`,
  ".lang-switch{position:relative}",
  `.lang-switch summary{list-style:none;height:${scaled(40)};display:inline-flex;align-items:center;gap:${scaled(8)};padding:0 ${scaled(12)};border:1px solid var(--border);border-radius:999px;background:var(--surface);font-size:${scaled(13)};cursor:pointer;white-space:nowrap}`,
  ".lang-switch summary::-webkit-details-marker{display:none}.lang-switch summary:hover{border-color:var(--border-strong)}",
  `.lang-switch summary svg{width:${scaled(20)};height:${scaled(20)}}.lang-switch summary .caret{width:${scaled(16)};height:${scaled(16)};color:var(--muted)}`,
  ".lang-switch[open] summary{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}.lang-switch[open] .caret{transform:rotate(180deg)}",
  `.lang-menu{position:absolute;top:calc(100% + ${scaled(8)});right:0;z-index:5;width:${scaled(200)};margin:0;padding:${scaled(8)};list-style:none;display:flex;flex-direction:column;gap:${scaled(4)};background:var(--surface);border:1px solid var(--border);border-radius:${scaled(20)};box-shadow:var(--shadow-pop)}`,
  `.menu-item{display:flex;align-items:center;gap:${scaled(12)};padding:${scaled(8)} ${scaled(12)};border-radius:${scaled(14)};line-height:1.35;color:var(--foreground)}.menu-item:hover{background:var(--surface-secondary);text-decoration:none}`,
  `.menu-item svg{width:${scaled(16)};height:${scaled(16)};margin-left:auto;color:var(--accent);stroke-width:2.6}`,
  `.profile-page{max-width:${scaled(640)};margin-inline:auto;padding:${scaled(32)} ${scaled(24)} ${scaled(40)};display:flex;flex-direction:column;gap:${scaled(24)}}`,
  `.profile-hero h1{font-size:${scaled(26)};overflow-wrap:anywhere}`,
  `.mono{font-family:"M PLUS 1 Code",ui-monospace,Menlo,monospace;font-size:${scaled(12)};color:var(--muted)}`,
  `.profile-section{display:flex;flex-direction:column;gap:${scaled(12)}}.profile-section h2{font-size:${scaled(16)}}`,
  `.proof-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:${scaled(12)}}`,
  `.proof-item{display:grid;grid-template-columns:auto minmax(0,1fr);gap:${scaled(12)};align-items:start;padding:${scaled(16)};background:var(--surface);border:1px solid var(--border);border-radius:${scaled(20)};box-shadow:var(--shadow)}`,
  `.svc-badge{position:relative;display:inline-block;width:${scaled(36)};height:${scaled(36)};font-size:0;line-height:${scaled(34)};text-align:center;border:1px solid var(--border);border-radius:${scaled(12)};background:var(--favicon-plate)}`,
  `.favicon-fallback,.brand-icon{position:absolute;inset:0;margin:auto;width:${scaled(20)};height:${scaled(20)}}.favicon-fallback{color:var(--favicon-fallback)}`,
  `.favicon{position:relative;vertical-align:middle;max-width:${scaled(20)};max-height:${scaled(20)};background:var(--favicon-plate)}`,
  `.acct-text{display:flex;flex-direction:column;gap:${scaled(4)};min-width:0;line-height:1.35;overflow-wrap:anywhere}`,
  ".acct-name{font-weight:500}",
  `.other-urls{margin-left:${scaled(8)};font-size:${scaled(12)};font-weight:400}.other-urls a{color:var(--muted);margin-right:${scaled(8)}}`,
  `.proof-meta{font-size:${scaled(12)};color:var(--muted)}`,
  `.notfound{padding:${scaled(56)} ${scaled(24)};text-align:center}.notfound h1{font-size:${scaled(20)}}`,
  `@media (max-width:640px){.profile-header{padding:${scaled(12)} ${scaled(16)}}.profile-page{padding:${scaled(24)} ${scaled(16)} ${scaled(32)}}}`,
].join("");

// --------------------------------------------------
// 部品
// --------------------------------------------------

/**
 * ページ内で`<use>`から参照するアイコン。
 * OAuth Providerのロゴは、管理画面のログインボタンと同じ形を固定の色で持つ（全体の`svg`の線の指定を受けないよう、塗りと線を図形ごとに指定する）。
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
      <symbol id="i-google" viewBox="0 0 24 24">
        <g fill="none" stroke-width="3.6" stroke-linecap="butt">
          <path d="M17.3 6.7A7.5 7.5 0 0 0 4.95 9.43" stroke="#EA4335" />
          <path d="M4.95 9.43a7.5 7.5 0 0 0 0 5.14" stroke="#FBBC05" />
          <path d="M4.95 14.57A7.5 7.5 0 0 0 17.3 17.3" stroke="#34A853" />
          <path d="M17.3 17.3A7.5 7.5 0 0 0 19.5 12H12" stroke="#4285F4" />
        </g>
      </symbol>
      <symbol id="i-github" viewBox="0 0 16 16">
        <path
          fill="#24292F"
          stroke="none"
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
        />
      </symbol>
      <symbol id="i-orcid" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#A6CE39" stroke="none" />
        <rect x="6.6" y="9.6" width="2" height="7.4" rx=".4" fill="#FFFFFF" stroke="none" />
        <circle cx="7.6" cy="7.3" r="1.25" fill="#FFFFFF" stroke="none" />
        <path
          d="M11.2 9.9h2.3a3.55 3.55 0 0 1 0 7.1h-2.3z"
          fill="none"
          stroke="#FFFFFF"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
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
        {/* `<style>`の中は文字参照を解釈しないため、書体名の引用符をエスケープせずに出力する（固定の文字列だけを入れる）。 */}
        <style dangerouslySetInnerHTML={{ __html: styles }} />
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
 * OAuth Providerはページ内のブランドのアイコンにする。
 * faviconはJavaScriptで実寸を確かめられないため配信の画像をそのまま表示し、画像を読めないときは背後の地球儀が見える。
 */
function ServiceIcon({ icon }: { icon: ServiceIconSource | undefined }) {
  if (icon?.type === "provider") {
    return (
      <span class="svc-badge">
        <svg class="brand-icon" aria-hidden="true">
          <use href={`#i-${icon.provider}`} />
        </svg>
      </span>
    );
  }
  return (
    <span class="svc-badge">
      <svg class="favicon-fallback" aria-hidden="true">
        <use href="#i-globe" />
      </svg>
      {icon === undefined ? null : (
        <img
          class="favicon"
          src={buildFaviconUrl(icon.host)}
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
 * 外部のページは、公開プロフィールを残すため新しいタブで開く。
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

  return (
    <li class="proof-item">
      <ServiceIcon icon={selectServiceIcon(externalAccount.service, primaryUrl)} />
      <div class="acct-text">
        <span class="acct-name">
          {primaryUrl === undefined ? (
            label
          ) : (
            <a href={primaryUrl} rel="me noopener" target="_blank">
              {label}
            </a>
          )}
          {otherUrls.length === 0 ? null : (
            <span class="other-urls">
              {otherUrls.map((url) => (
                <a key={url} href={url} rel="me noopener" target="_blank">
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
