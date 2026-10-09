const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** HTTPS originを受け付け、開発時のみloopback HTTPを許す。 */
export function parsePointsProviderOrigin(
  input: unknown,
  allowLoopbackHttp: boolean,
): string | null {
  if (typeof input !== "string") return null;
  const url = URL.parse(input);
  if (!url) return null;
  const allowed =
    url.protocol === "https:" ||
    (allowLoopbackHttp && url.protocol === "http:" && loopback.has(url.hostname));
  if (!allowed || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    return null;
  }
  return url.origin;
}
