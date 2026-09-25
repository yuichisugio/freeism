import { describe, expect, it } from "vitest";

import { extractEvidenceUrls } from "./html-evidence-extractor";
import type { FetchedPage } from "./safe-page-fetcher";

const profileUrl = "https://accounts.freeism.app/profiles/ausr_alice";

/**
 * 最終取得URLが`https://blog.example.com/posts/1`のページを作る。
 */
function fetchedPage(body: string, overrides: Partial<FetchedPage> = {}): FetchedPage {
  return {
    finalUrl: "https://blog.example.com/posts/1",
    contentType: "text/html",
    charset: "utf-8",
    linkHeader: null,
    body: new TextEncoder().encode(body),
    ...overrides,
  };
}

describe("extractEvidenceUrls", () => {
  // --------------------------------------------------
  // リンク
  // --------------------------------------------------

  it("`a[href]`と`link[href]`を最終取得URL基準で解決して正規化する", async () => {
    const html = `<html><head><link rel="me" href="${profileUrl}"><base href="https://other.example.com/"></head>
      <body><a href="/about">about</a><a href="../tags">tags</a><a href="HTTPS://Example.COM/x#top">x</a></body></html>`;

    await expect(extractEvidenceUrls(fetchedPage(html))).resolves.toEqual([
      profileUrl,
      "https://blog.example.com/about",
      "https://blog.example.com/tags",
      "https://example.com/x",
    ]);
  });

  it("属性値の文字参照を復号してから解決する", async () => {
    const html = `<a href="https://example.com/?a=1&amp;b=2">x</a><a href="https&#x3A;//accounts.freeism.app/profiles/ausr_alice">me</a>`;

    await expect(extractEvidenceUrls(fetchedPage(html))).resolves.toEqual([
      "https://example.com/?a=1&b=2",
      profileUrl,
    ]);
  });

  it("HTTPS以外のhrefを候補にしない", async () => {
    const html = `<a href="http://accounts.freeism.app/profiles/ausr_alice">x</a><a href="mailto:a@example.com">m</a><a href="javascript:void(0)">j</a>`;

    await expect(extractEvidenceUrls(fetchedPage(html))).resolves.toEqual([]);
  });

  // --------------------------------------------------
  // 本文テキスト
  // --------------------------------------------------

  it("読者コメントと`code`・`pre`内のコード例のURLを抽出する", async () => {
    const html = `<article><p>本文</p></article>
      <section class="comments"><p>読者: ${profileUrl} を見ました</p></section>
      <pre><code>curl https://example.com/api</code></pre>`;

    await expect(extractEvidenceUrls(fetchedPage(html))).resolves.toEqual([
      profileUrl,
      "https://example.com/api",
    ]);
  });

  it("テキストの文字参照（`&lt;`・`&amp;`・`&#x26;`）を復号してから抽出する", async () => {
    const html = `<pre><code>&lt;${profileUrl}&gt;</code></pre><p>https://example.com/?a=1&amp;b=2 https://example.com/?c=3&#x26;d=4</p>`;

    await expect(extractEvidenceUrls(fetchedPage(html))).resolves.toEqual([
      profileUrl,
      "https://example.com/?a=1&b=2",
      "https://example.com/?c=3&d=4",
    ]);
  });

  it("除外する要素・HTML comment・属性値のURLを候補にしない", async () => {
    const html = `<!-- ${profileUrl} -->
      <script type="application/ld+json">{"sameAs":["${profileUrl}"]}</script>
      <script>const url = "${profileUrl}";</script>
      <style>.a { background: url(${profileUrl}); }</style>
      <template><p>${profileUrl}</p><a href="${profileUrl}">t</a></template>
      <noscript><p>${profileUrl}</p><a href="${profileUrl}">n</a></noscript>
      <iframe>${profileUrl}</iframe>
      <img alt="${profileUrl}" src="/image.png">
      <p title="${profileUrl}">本文にURLは無い</p>`;

    await expect(extractEvidenceUrls(fetchedPage(html))).resolves.toEqual([]);
  });

  it("除外する要素の後のテキストは抽出する", async () => {
    const html = `<template><p>template</p></template><script>1</script><p>${profileUrl}</p>`;

    await expect(extractEvidenceUrls(fetchedPage(html))).resolves.toEqual([profileUrl]);
  });

  it("SVG内の自己終了した`style`・`script`の後も抽出を続ける", async () => {
    const html = `<svg><style/><script/></svg><p>${profileUrl}</p>`;

    await expect(extractEvidenceUrls(fetchedPage(html))).resolves.toEqual([profileUrl]);
  });

  it("要素やHTML commentをまたいでテキストを連結しない", async () => {
    const html = `<p>https://accounts.freeism.app/pro<b>files/ausr_alice</b></p><p>https://accounts.freeism.app/profiles/<!-- -->ausr_alice</p>`;

    const candidates = await extractEvidenceUrls(fetchedPage(html));

    expect(candidates).not.toContain(profileUrl);
  });

  it("大きなテキストノードで分割されたチャンクを連結して抽出する", async () => {
    const padding = "あ".repeat(10_000);
    const urls = Array.from({ length: 20 }, (_, index) => `https://example.com/${index}`);
    const html = `<p>${urls.map((url) => `${padding} ${url} `).join("")}</p>`;

    await expect(extractEvidenceUrls(fetchedPage(html))).resolves.toEqual(urls);
  });

  // --------------------------------------------------
  // HTTP Link・text/plain
  // --------------------------------------------------

  it("HTTP `Link`ヘッダーのURLを最終取得URL基準で解決して候補に含める", async () => {
    const page = fetchedPage("<p>no links</p>", {
      linkHeader: `<${profileUrl}>; rel="me", </feed>; rel="alternate"`,
    });

    await expect(extractEvidenceUrls(page)).resolves.toEqual([
      profileUrl,
      "https://blog.example.com/feed",
    ]);
  });

  it("`text/plain`の本文全体から完全なHTTPS URLを抽出する", async () => {
    const page = fetchedPage(
      `accounts: ${profileUrl}\nsite: example.com/about\nold: http://example.com/`,
      {
        contentType: "text/plain",
      },
    );

    await expect(extractEvidenceUrls(page)).resolves.toEqual([profileUrl]);
  });

  it("charsetに従って本文を復号する", async () => {
    // pathの末尾にShift_JISの「証明」（0x8FD8 0x96BE）を置く。
    const body = new Uint8Array([
      ...new TextEncoder().encode("https://example.com/"),
      0x8f,
      0xd8,
      0x96,
      0xbe,
    ]);
    const page = fetchedPage("", { contentType: "text/plain", charset: "shift_jis", body });

    await expect(extractEvidenceUrls(page)).resolves.toEqual([
      "https://example.com/%E8%A8%BC%E6%98%8E",
    ]);
  });
});
