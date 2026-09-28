/**
 * 外部アカウントのホストのサービスアイコン（ファビコン）のURL。
 * Googleのファビコン配信から64pxで読み込み、未知のホストはHTTP 404になる（画面は地球儀のアイコンに差し替える）。
 * 閲覧者のブラウザーからGoogleへホスト名が送られる。
 * @see ../../docs/specification/v0.1/design-system.ja.md
 */
export function buildFaviconUrl(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}
