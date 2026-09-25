/**
 * URLの受付検査と比較用の正規化。
 * 登録するURL、照合の入力URL、証拠候補、DNS TXTの値に同じ規則を適用する。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./normalize-url.test.ts
 */

// --------------------------------------------------
// 型と定数
// --------------------------------------------------

/**
 * URLを受け付けない理由。
 */
export type NormalizeUrlErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_SCHEME"
  | "TRAILING_DOT_HOST"
  | "PORT_NOT_ALLOWED"
  | "USERINFO_NOT_ALLOWED"
  | "HOST_NOT_ALLOWED"
  | "VALUE_TOO_LONG";

/**
 * 正規化の結果。
 * `host`は正規化したhost（Punycode・小文字）で、DNS TXTの照会名と同じhostの判定に使う。
 */
export type NormalizeUrlResult =
  | { ok: true; url: string; host: string }
  | { ok: false; code: NormalizeUrlErrorCode };

/**
 * 正規化したURLの長さの上限（bytes）。
 * 正規化したURLはASCIIだけで表されるため、文字数とbytes数が一致する。
 */
const maxUrlBytes = 2048;

/**
 * 公開Internet上の宛先として扱わない特殊用途のTLD・名前。
 * `.internal`はCloud metadataのhost（`metadata.google.internal`など）を含む。
 */
const nonPublicSuffixes = [
  "localhost",
  "local",
  "internal",
  "localdomain",
  "arpa",
  "test",
  "example",
  "invalid",
  "onion",
];

// --------------------------------------------------
// 正規化
// --------------------------------------------------

/**
 * URLを検査し、比較用の文字列へ正規化する。
 * host小文字化・IDNのPunycode化・既定port除去・空path→`/`・dot segment解決はWHATWG URLのparserが行う。
 * 本関数はfragmentの除去、percent-encodingの統一、受付制約の検査を加える。
 */
export function normalizeUrl(input: string): NormalizeUrlResult {
  const parsed = URL.parse(input);
  if (parsed === null) return { ok: false, code: "INVALID_URL" };

  const errorCode = findUnacceptableUrlReason(parsed);
  if (errorCode !== null) return { ok: false, code: errorCode };

  parsed.hash = "";
  // userinfoとfragmentを持たないため、`href`はoriginの後にpathとqueryだけが続く。
  const pathAndQuery = unifyPercentEncoding(parsed.href.slice(parsed.origin.length));
  const url = parsed.origin + pathAndQuery;
  if (url.length > maxUrlBytes) return { ok: false, code: "VALUE_TOO_LONG" };

  return { ok: true, url, host: parsed.hostname };
}

/**
 * scheme・host・port・userinfoの受付制約に違反する理由を返す。
 * DNS解決後のprivate宛先へは、Workersの実行環境がprivateネットワークへの経路を持たないため到達しない。
 */
function findUnacceptableUrlReason(url: URL): NormalizeUrlErrorCode | null {
  if (url.protocol !== "https:") return "UNSUPPORTED_SCHEME";
  if (url.hostname.endsWith(".")) return "TRAILING_DOT_HOST";
  if (url.port !== "") return "PORT_NOT_ALLOWED";
  if (url.username !== "" || url.password !== "") return "USERINFO_NOT_ALLOWED";
  if (!isPublicHostname(url.hostname)) return "HOST_NOT_ALLOWED";
  return null;
}

/**
 * hostが公開Internet上の名前として受け付けられるかを判定する。
 * IP literalはすべて拒否する。
 * WHATWG URLは末尾ラベルが数値のhostをIPv4として解析するため、末尾ラベルが数字だけならIPv4 literalである。
 */
function isPublicHostname(hostname: string): boolean {
  if (hostname.startsWith("[")) return false;

  const labels = hostname.split(".");
  const topLevelLabel = labels.at(-1) ?? "";
  if (labels.length < 2 || /^\d+$/.test(topLevelLabel)) return false;

  return !nonPublicSuffixes.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

/**
 * percent-encodingの表記を統一する。
 * 非予約文字（`A-Z a-z 0-9 - . _ ~`）を表す`%XX`は復号し、残る`%xx`の16進は大文字にする（RFC 3986 §6.2.2.1–2）。
 */
function unifyPercentEncoding(value: string): string {
  return value.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) => {
    const character = String.fromCharCode(Number.parseInt(hex, 16));
    return /^[A-Za-z0-9\-._~]$/.test(character) ? character : `%${hex.toUpperCase()}`;
  });
}
