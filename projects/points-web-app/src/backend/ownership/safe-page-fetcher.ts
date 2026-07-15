import { normalizeIdentityUrl } from "../domain/ownership/normalize-identity-url";

const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;

export class SafePageFetchError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function readLimitedBody(response: Response): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new SafePageFetchError("WEB_PAGE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface SafePage {
  contentHash: string;
  finalUrl: string;
  linkHeader: string | null;
  mediaType: "text/html" | "text/plain";
  text: string;
}

export async function fetchSafePage(
  inputUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SafePage> {
  let currentUrl: string;
  try {
    currentUrl = normalizeIdentityUrl(inputUrl);
  } catch {
    throw new SafePageFetchError("WEB_URL_UNSAFE");
  }
  const signal = AbortSignal.timeout(5_000);
  for (let redirectCount = 0; ; redirectCount += 1) {
    let response: Response;
    try {
      response = await fetchImpl(
        new Request(currentUrl, {
          cache: "no-store",
          headers: new Headers(),
          method: "GET",
          redirect: "manual",
          signal,
        }),
      );
    } catch {
      throw new SafePageFetchError("WEB_PAGE_FETCH_FAILED");
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location || redirectCount >= MAX_REDIRECTS)
        throw new SafePageFetchError("WEB_PAGE_REDIRECT_REJECTED");
      try {
        currentUrl = normalizeIdentityUrl(new URL(location, currentUrl).toString());
      } catch {
        throw new SafePageFetchError("WEB_URL_UNSAFE");
      }
      continue;
    }
    if (!response.ok) throw new SafePageFetchError("WEB_PAGE_FETCH_FAILED");
    const cacheStatus = response.headers.get("CF-Cache-Status")?.toUpperCase();
    if (
      response.headers.has("Age") ||
      (cacheStatus !== undefined && !["MISS", "DYNAMIC", "BYPASS"].includes(cacheStatus))
    )
      throw new SafePageFetchError("WEB_PAGE_CACHED_RESPONSE");
    const contentType = response.headers
      .get("Content-Type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (contentType !== "text/html" && contentType !== "text/plain")
      throw new SafePageFetchError("WEB_PAGE_CONTENT_TYPE_REJECTED");
    const bytes = await readLimitedBody(response);
    return {
      contentHash: await sha256Hex(bytes),
      finalUrl: currentUrl,
      linkHeader: response.headers.get("Link"),
      mediaType: contentType,
      text: new TextDecoder().decode(bytes),
    };
  }
}
