import type { LinkedAccount } from "../../../../shared/schemas/account-link-schema";
import { formatServiceName } from "../../../../shared/service-names";

/**
 * 行の表示に使う、外部アカウントのサービス名・識別子・サービスアイコンのホスト。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ./account-label.test.ts
 */
export type AccountDescription = {
  serviceName: string;
  identifier: string;
  iconHost: string | undefined;
};

/**
 * URLを持たないことがあるOAuth Providerの、アイコン用のホスト。
 */
const oauthServiceHosts: Partial<Record<string, string>> = {
  google: "google.com",
  github: "github.com",
  orcid: "orcid.org",
};

/**
 * URLをスキームと末尾の`/`を除いて表示する。
 */
export function formatUrlForDisplay(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * 外部アカウントを見分けるためのサービス名・識別子・アイコンのホスト。
 * 識別子は、ユーザー名、URL、メールアドレス（本人画面だけ）、固有IDの順に、取得できたものを使う。
 */
export function describeAccount(account: LinkedAccount): AccountDescription {
  const findIdentifier = (type: LinkedAccount["identifiers"][number]["type"]) =>
    account.identifiers.find((identifier) => identifier.type === type)?.value;
  const url = findIdentifier("url");
  const identifier =
    findIdentifier("provider_username") ??
    (url === undefined ? undefined : formatUrlForDisplay(url)) ??
    account.email ??
    findIdentifier("provider_account") ??
    account.id;
  const iconHost =
    (account.service === null ? undefined : oauthServiceHosts[account.service]) ??
    (url === undefined ? undefined : new URL(url).hostname);
  return { serviceName: formatServiceName(account.service), identifier, iconHost };
}

/**
 * 「サービス名：識別子」の表示名（確認ダイアログ・読み上げ名に使う）。
 * `separator`は表示言語の区切り（日本語は「：」、英語は「: 」）。
 */
export function formatAccountLabel(account: LinkedAccount, separator: string): string {
  const { serviceName, identifier } = describeAccount(account);
  return `${serviceName}${separator}${identifier}`;
}
