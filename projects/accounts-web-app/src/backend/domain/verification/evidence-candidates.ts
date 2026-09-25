import { LinkifyIt } from "linkify-it";

import { normalizeUrl } from "./normalize-url";

/**
 * 外部ページの本文テキスト・HTTP `Link`ヘッダーからの証拠候補の抽出と、候補の正規化。
 * HTMLの走査は`HTMLRewriter`を使うWorkers側の部品が行い、本ファイルは実行環境に依存しない処理だけを持つ。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./evidence-candidates.test.ts
 */

// --------------------------------------------------
// 本文テキスト
// --------------------------------------------------

/**
 * 完全な`https:`のURLだけを抽出するURL抽出器。
 * schemeの無いURL（fuzzy link）を無効にし、`https:`以外の既定schemaを外す。
 */
const httpsLinkify = new LinkifyIt({ fuzzyLink: false, fuzzyEmail: false, fuzzyIP: false })
  .add("http:", null)
  .add("ftp:", null)
  .add("//", null)
  .add("mailto:", null);

/**
 * 文字参照を復号済みのテキストから、完全なHTTPS URLを出現順に抽出する。
 */
export function extractTextUrls(text: string): string[] {
  return (httpsLinkify.match(text) ?? []).map((match) => match.url);
}

// --------------------------------------------------
// HTTP Linkヘッダー
// --------------------------------------------------

/**
 * `Link`ヘッダーの各link-valueから`<URI-Reference>`を取り出す。
 * `rel`は問わず、相対参照は`normalizeEvidenceCandidates`で解決する。
 */
export function parseLinkHeaderUrls(linkHeader: string): string[] {
  return [...linkHeader.matchAll(/<([^>]*)>/g)].map(([, uriReference]) => uriReference ?? "");
}

// --------------------------------------------------
// 候補の正規化
// --------------------------------------------------

/**
 * 証拠候補を最終取得URL基準で解決し、`normalizeUrl`で正規化する。
 * 解決・正規化できない候補とHTTPS以外の候補は捨て、同じURLは1件にする。
 * @param rawCandidates 文字参照を復号済みの候補（相対URLを含む）。
 * @param baseUrl 最終取得URL。
 */
export function normalizeEvidenceCandidates(
  rawCandidates: readonly string[],
  baseUrl: string,
): string[] {
  const normalizedCandidates = new Set<string>();
  for (const candidate of rawCandidates) {
    const resolved = URL.parse(candidate, baseUrl);
    if (resolved === null) continue;

    const normalized = normalizeUrl(resolved.href);
    if (normalized.ok) normalizedCandidates.add(normalized.url);
  }
  return [...normalizedCandidates];
}
