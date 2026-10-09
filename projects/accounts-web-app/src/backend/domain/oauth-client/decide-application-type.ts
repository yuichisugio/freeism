/**
 * OAuthクライアントの`application_type`。
 */
export type OAuthApplicationType = "web" | "native";

/**
 * ローカル開発用としてHTTPで登録できるhost。
 * `URL.hostname`はIPv6を`[::1]`の角括弧付きで返す。
 */
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * ローカル開発用のリダイレクトURL（HTTPのloopback）か判定する。
 */
function isLoopbackRedirectUri(redirectUri: string): boolean {
  const url = new URL(redirectUri);
  return url.protocol === "http:" && loopbackHosts.has(url.hostname);
}

/**
 * リダイレクトURLから、Better Authの標準の登録・更新APIへ渡す`application_type`を決める。
 * ローカル開発用のURLを1件でも含めば`native`、それ以外は`web`にする。
 * 入力は登録可能なリダイレクトURLとして検査済みであることを前提にする。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./decide-application-type.test.ts
 */
export function decideApplicationType(redirectUris: readonly string[]): OAuthApplicationType {
  return redirectUris.some(isLoopbackRedirectUri) ? "native" : "web";
}
