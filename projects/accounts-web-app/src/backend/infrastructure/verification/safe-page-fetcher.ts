import { classifyHttpStatus } from "../../domain/verification/classify-lookup-failure";
import { normalizeUrl } from "../../domain/verification/normalize-url";
import {
  failVerification,
  type VerificationFailure,
} from "../../domain/verification/verification-result";

/**
 * リンク証明で外部ページを取得するsafe fetch。
 * redirectの各遷移先に入力URLと同じ受付検査を適用し、期限・容量・内容種別を制限する。
 * DNS解決後のprivate宛先は、本番の`fetch`に掛かる`global_fetch_strictly_public`で拒否する。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./safe-page-fetcher.worker.test.ts
 */

// --------------------------------------------------
// 型と定数
// --------------------------------------------------

/**
 * 取得した外部ページ。
 * `finalUrl`はredirect後の最終取得URL（正規化済み）で、証拠URLと相対URLの解決基準になる。
 * `charset`はContent-Typeの値（小文字）で、指定が無ければ`utf-8`とする。
 */
export type FetchedPage = {
  finalUrl: string;
  contentType: "text/html" | "text/plain";
  charset: string;
  linkHeader: string | null;
  body: Uint8Array<ArrayBuffer>;
};

/**
 * 取得結果。
 * 取得不能・上限超過・形式不明は、`failure_code`と結果を持つ`failure`で返す。
 */
export type PageFetchResult =
  | { ok: true; page: FetchedPage }
  | { ok: false; failure: VerificationFailure };

/**
 * 外部ページの取得部品。
 * ユースケースのテストでは、この型の代替実装へ差し替える。
 */
export type PageFetcher = {
  /**
   * `normalizeUrl`で正規化・検査済みのURLを取得する。
   */
  fetchPage(normalizedUrl: string): Promise<PageFetchResult>;
};

/**
 * safe fetchの設定。
 * `fetch`はテストでモックサーバーへ差し替える。
 */
export type SafePageFetcherOptions = {
  accountsOrigin: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  timeoutMilliseconds?: number;
};

/**
 * redirectと本文読込を合わせた取得期限。
 */
const defaultFetchTimeoutMilliseconds = 5000;

/**
 * 追跡するredirectの最大回数。
 */
const maxRedirects = 3;

/**
 * 展開後の本文の上限（1MiB）。
 */
const maxBodyBytes = 1024 * 1024;

/**
 * `Location`へ遷移するredirectのステータス。
 */
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

// --------------------------------------------------
// 取得
// --------------------------------------------------

/**
 * safe fetchを作る。
 * 要求ヘッダーはAccountsが組み立て、Cookieや利用者の認証ヘッダーを付けない。
 */
export function createSafePageFetcher({
  accountsOrigin,
  fetch = (input, init) => globalThis.fetch(input, init),
  timeoutMilliseconds = defaultFetchTimeoutMilliseconds,
}: SafePageFetcherOptions): PageFetcher {
  const headers = {
    Accept: "text/html, text/plain;q=0.9",
    "User-Agent": `FreeismAccountsVerifier/0.1 (+${new URL(accountsOrigin).origin}/help)`,
  };

  return {
    async fetchPage(normalizedUrl) {
      const signal = AbortSignal.timeout(timeoutMilliseconds);
      try {
        let currentUrl = normalizedUrl;
        for (let redirectCount = 0; ; redirectCount++) {
          const response = await fetch(currentUrl, { headers, redirect: "manual", signal });
          if (!redirectStatuses.has(response.status)) return await readPage(currentUrl, response);

          await response.body?.cancel();
          if (redirectCount === maxRedirects)
            return { ok: false, failure: failVerification("TOO_MANY_REDIRECTS") };

          const location = response.headers.get("location");
          if (location === null) return { ok: false, failure: failVerification("HTTP_ERROR") };

          const nextUrl = normalizeUrl(URL.parse(location, currentUrl)?.href ?? "");
          if (!nextUrl.ok)
            return { ok: false, failure: failVerification("REDIRECT_TARGET_BLOCKED") };
          currentUrl = nextUrl.url;
        }
      } catch (error) {
        if (signal.aborted) return { ok: false, failure: failVerification("FETCH_TIMEOUT") };
        console.warn("外部ページの取得に失敗しました。", error);
        return { ok: false, failure: failVerification("NETWORK_ERROR") };
      }
    },
  };
}

/**
 * redirectでない応答の状態・内容種別・本文を検査して読み込む。
 */
async function readPage(finalUrl: string, response: Response): Promise<PageFetchResult> {
  if (!response.ok) {
    await response.body?.cancel();
    return { ok: false, failure: classifyHttpStatus(response.status) };
  }

  const contentType = parseContentType(response.headers.get("content-type"));
  if (contentType === null) {
    await response.body?.cancel();
    return { ok: false, failure: failVerification("UNSUPPORTED_CONTENT_TYPE") };
  }

  const body = await readBodyWithinLimit(response.body);
  if (body === null) return { ok: false, failure: failVerification("RESPONSE_TOO_LARGE") };

  return {
    ok: true,
    page: { finalUrl, ...contentType, linkHeader: response.headers.get("link"), body },
  };
}

/**
 * Content-Typeから受け付ける内容種別とcharsetを得る。
 * `text/html`・`text/plain`以外と、復号できないcharsetは`null`を返す。
 */
function parseContentType(
  headerValue: string | null,
): Pick<FetchedPage, "contentType" | "charset"> | null {
  const [mediaType = "", ...parameters] = (headerValue ?? "").toLowerCase().split(";");
  const contentType = mediaType.trim();
  if (contentType !== "text/html" && contentType !== "text/plain") return null;

  const charsetParameter = parameters
    .map((parameter) => parameter.trim())
    .find((parameter) => parameter.startsWith("charset="));
  const charset = charsetParameter?.slice("charset=".length).replace(/^"(.*)"$/, "$1") || "utf-8";
  return isDecodableCharset(charset) ? { contentType, charset } : null;
}

/**
 * charsetを`TextDecoder`で復号できるかを判定する。
 */
function isDecodableCharset(charset: string): boolean {
  try {
    new TextDecoder(charset);
    return true;
  } catch {
    return false;
  }
}

/**
 * 本文を読みながら累計し、上限を超えたら読込を打ち切って`null`を返す。
 */
async function readBodyWithinLimit(
  body: ReadableStream<Uint8Array> | null,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (body === null) return new Uint8Array();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maxBodyBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
