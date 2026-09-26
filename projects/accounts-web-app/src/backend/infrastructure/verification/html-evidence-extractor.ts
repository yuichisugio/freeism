import { decodeHTML, decodeHTMLAttribute } from "entities";

import {
  extractTextUrls,
  normalizeEvidenceCandidates,
  parseLinkHeaderUrls,
} from "../../domain/verification/evidence-candidates";
import type { FetchedPage } from "./safe-page-fetcher";

/**
 * 取得した外部ページからの証拠候補の抽出。
 * HTMLの要素・属性・テキストの走査にWorkersの`HTMLRewriter`を使うため、Workers上でだけ動く。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./html-evidence-extractor.worker.test.ts
 */

/**
 * 内容を証拠候補から除外する要素。
 */
const excludedElementsSelector = "script, style, template, noscript, iframe";

/**
 * HTTP `Link`ヘッダーと本文から証拠候補を抽出し、最終取得URL基準で解決・正規化して返す。
 * 同じURLは1件にまとめ、最初に現れた順に並べる。
 */
export async function extractEvidenceUrls(page: FetchedPage): Promise<string[]> {
  const headerCandidates = page.linkHeader === null ? [] : parseLinkHeaderUrls(page.linkHeader);
  const bodyCandidates =
    page.contentType === "text/html"
      ? await extractHtmlCandidates(page)
      : extractTextUrls(new TextDecoder(page.charset).decode(page.body));
  return normalizeEvidenceCandidates([...headerCandidates, ...bodyCandidates], page.finalUrl);
}

/**
 * HTMLの`a[href]`・`link[href]`とテキストノードから、未解決の候補を抽出する。
 * `HTMLRewriter`は文字参照を復号しないため、属性値とテキストノードを復号してから扱う。
 * テキストはチャンクをテキストノード単位で連結し、要素やHTML commentをまたいで連結しない。
 * 除外要素の内側のリンクとテキスト、HTML comment、`href`以外の属性値は読まない。
 */
async function extractHtmlCandidates(page: FetchedPage): Promise<string[]> {
  const candidates: string[] = [];
  let excludedDepth = 0;
  let textNode = "";

  const rewriter = new HTMLRewriter()
    .on(excludedElementsSelector, {
      element(element) {
        // SVG・MathML内の自己終了した要素（`<svg><style/>`など）は内容を持たず、`onEndTag`が例外を投げる。
        try {
          element.onEndTag(() => {
            excludedDepth--;
          });
        } catch {
          return;
        }
        excludedDepth++;
      },
    })
    .on("a[href], link[href]", {
      element(element) {
        if (excludedDepth === 0)
          candidates.push(decodeHTMLAttribute(element.getAttribute("href") ?? ""));
      },
    })
    .onDocument({
      text(chunk) {
        if (excludedDepth === 0) textNode += chunk.text;
        if (!chunk.lastInTextNode) return;
        candidates.push(...extractTextUrls(decodeHTML(textNode)));
        textNode = "";
      },
    });

  const html = new Response(page.body, {
    headers: { "content-type": `text/html; charset=${page.charset}` },
  });
  // 変換結果を読み切ることで、各handlerが文書全体に対して実行される。
  await rewriter.transform(html).arrayBuffer();
  return candidates;
}
