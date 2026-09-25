import { normalizeProviderUsername, type ProviderId } from "../identity/providers";

/**
 * 個別対応サービスのURL規則による、サービス名・URLの種類・ユーザー名の判定。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./classify-service-url.test.ts
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

/**
 * URL規則で判定するProvider識別子。
 */
export type ServiceUrlProvider = Extract<
  ProviderId,
  | "github"
  | "gitlab"
  | "stackoverflow"
  | "qiita"
  | "note"
  | "zenn"
  | "codeberg"
  | "x"
  | "huggingface"
>;

/**
 * URLの判定結果。
 * 個別対応サービスのhostでプロフィールの形に当たるURLは`profile`、それ以外のpathは`content`、その他のhostは`generic`とする。
 * `content`と`generic`は、どちらも汎用Webページとして入力URL単独で検証する。
 */
export type ServiceUrlClassification =
  | { urlType: "profile"; provider: ServiceUrlProvider; username: string }
  | { urlType: "content"; provider: ServiceUrlProvider; username: null }
  | { urlType: "generic"; provider: null; username: null };

/**
 * 個別対応サービスのURL規則。
 * `readUsername`はpathのセグメント列からユーザー名（大文字小文字は入力どおり）を返し、プロフィールの形でなければ`null`を返す。
 */
type ServiceUrlRule = {
  provider: ServiceUrlProvider;
  readUsername: (segments: readonly string[]) => string | null;
};

// --------------------------------------------------
// URL規則
// --------------------------------------------------

/**
 * ユーザー名・namespaceとして受け付ける文字の形。
 */
const usernamePattern = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

/**
 * `/{username}`の1セグメントをプロフィールとする規則を作る。
 * `reservedSegments`は各サービスのトップレベルの機能パスで、プロフィールとして扱わない。
 */
function singleSegmentProfile(reservedSegments: readonly string[]): ServiceUrlRule["readUsername"] {
  return (segments) => {
    const [username] = segments;
    if (segments.length !== 1 || username === undefined || !usernamePattern.test(username))
      return null;
    return reservedSegments.includes(username.toLowerCase()) ? null : username;
  };
}

/**
 * hostごとのURL規則。
 * hostは完全一致で判定し、`www.`などの別hostは汎用Webページとする。
 */
const serviceUrlRules: ReadonlyMap<string, ServiceUrlRule> = new Map<string, ServiceUrlRule>([
  [
    "github.com",
    {
      provider: "github",
      readUsername: singleSegmentProfile([
        "about",
        "apps",
        "codespaces",
        "collections",
        "dashboard",
        "enterprise",
        "explore",
        "features",
        "issues",
        "login",
        "marketplace",
        "new",
        "notifications",
        "orgs",
        "organizations",
        "pricing",
        "pulls",
        "search",
        "settings",
        "signup",
        "sponsors",
        "topics",
        "trending",
      ]),
    },
  ],
  [
    "gitlab.com",
    {
      provider: "gitlab",
      readUsername: singleSegmentProfile([
        "admin",
        "dashboard",
        "explore",
        "groups",
        "help",
        "projects",
        "search",
        "users",
      ]),
    },
  ],
  [
    "stackoverflow.com",
    {
      provider: "stackoverflow",
      // `/users/{数値ID}`または`/users/{数値ID}/{slug}`。slugは識別子にしない。
      readUsername: ([section, userId, ...rest]) =>
        section === "users" && userId !== undefined && /^\d+$/.test(userId) && rest.length <= 1
          ? userId
          : null,
    },
  ],
  [
    "qiita.com",
    {
      provider: "qiita",
      readUsername: singleSegmentProfile([
        "api",
        "login",
        "organizations",
        "search",
        "settings",
        "signup",
        "tags",
        "timeline",
        "trend",
      ]),
    },
  ],
  [
    "note.com",
    {
      provider: "note",
      readUsername: singleSegmentProfile([
        "hashtag",
        "interests",
        "login",
        "notifications",
        "premium",
        "search",
        "settings",
        "signup",
        "topics",
      ]),
    },
  ],
  [
    "zenn.dev",
    {
      provider: "zenn",
      // `/p/{publication}`はPublicationのため、`p`を機能パスとして扱う。
      readUsername: singleSegmentProfile([
        "p",
        "articles",
        "books",
        "dashboard",
        "enter",
        "events",
        "scraps",
        "search",
        "settings",
        "topics",
      ]),
    },
  ],
  [
    "codeberg.org",
    {
      provider: "codeberg",
      readUsername: singleSegmentProfile([
        "admin",
        "api",
        "explore",
        "issues",
        "milestones",
        "notifications",
        "org",
        "pulls",
        "repo",
        "user",
      ]),
    },
  ],
  [
    "x.com",
    {
      provider: "x",
      readUsername: singleSegmentProfile([
        "compose",
        "explore",
        "hashtag",
        "home",
        "i",
        "intent",
        "login",
        "messages",
        "notifications",
        "search",
        "settings",
        "share",
        "signup",
      ]),
    },
  ],
  [
    "huggingface.co",
    {
      provider: "huggingface",
      readUsername: singleSegmentProfile([
        "api",
        "blog",
        "chat",
        "collections",
        "datasets",
        "docs",
        "enterprise",
        "join",
        "learn",
        "login",
        "models",
        "new",
        "organizations",
        "papers",
        "posts",
        "pricing",
        "search",
        "settings",
        "spaces",
        "tasks",
      ]),
    },
  ],
]);

// --------------------------------------------------
// 判定
// --------------------------------------------------

/**
 * 正規化したURLのサービス名・URLの種類・ユーザー名を判定する。
 * ユーザー名はProvider表の小文字化規則を適用して返す。
 * queryを持つURLはプロフィールとして扱わない。
 * @param normalizedUrl `normalizeUrl`で正規化したURL。redirect後は最終取得URLで判定し直す。
 */
export function classifyServiceUrl(normalizedUrl: string): ServiceUrlClassification {
  const url = new URL(normalizedUrl);
  const rule = serviceUrlRules.get(url.hostname);
  if (rule === undefined) return { urlType: "generic", provider: null, username: null };

  const username = normalizedUrl.includes("?")
    ? null
    : rule.readUsername(splitPathSegments(url.pathname));
  if (username === null) return { urlType: "content", provider: rule.provider, username: null };

  return {
    urlType: "profile",
    provider: rule.provider,
    username: normalizeProviderUsername(rule.provider, username),
  };
}

/**
 * pathをセグメントへ分割する。
 * 末尾の`/`は無視し、`/`だけのpathは空配列にする。
 */
function splitPathSegments(pathname: string): string[] {
  const trimmed = pathname.replace(/^\//, "").replace(/\/$/, "");
  return trimmed === "" ? [] : trimmed.split("/");
}
