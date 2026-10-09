/**
 * 接続先Accountsのorigin。
 * Points設計書 §2.a の受付条件に従う。
 * @see ./accounts-origin.test.ts
 */

// --------------------------------------------------
// origin
// --------------------------------------------------

const loopbackHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * 入力値を接続先Accountsのoriginとして検査し、正規化したoriginを返す。
 * HTTPSでpath・query・fragment・userinfoを含まない値だけを受け付け、`allowLoopbackHttp`の時だけloopbackのHTTPも受け付ける。
 * @returns 受け付けない値は`null`
 */
export function parseAccountsOrigin(
  input: string,
  { allowLoopbackHttp }: { allowLoopbackHttp: boolean },
): string | null {
  const url = URL.parse(input);
  if (url === null) return null;
  const isHttps = url.protocol === "https:";
  const isLoopbackHttp =
    allowLoopbackHttp && url.protocol === "http:" && loopbackHostnames.has(url.hostname);
  if (!isHttps && !isLoopbackHttp) return null;
  const hasExtraParts =
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "";
  if (hasExtraParts) return null;
  return url.origin;
}

/**
 * 資源APIの識別子（client credentialsの`resource`）。
 * 仕様で`{origin}/api/v1`に固定されているため、protected resource metadataからは読まない。
 */
export function toAccountsResourceIdentifier(accountsOrigin: string): string {
  return `${accountsOrigin}/api/v1`;
}
