import { describe, expect, it } from "vitest";

import {
  extractTextUrls,
  normalizeEvidenceCandidates,
  parseLinkHeaderUrls,
} from "./evidence-candidates";

describe("extractTextUrls", () => {
  it.each([
    [
      "文末の句読点を含めない",
      "Accounts: https://accounts.freeism.app/profiles/ausr_alice.",
      ["https://accounts.freeism.app/profiles/ausr_alice"],
    ],
    [
      "山括弧で囲んだURL",
      "<https://accounts.freeism.app/profiles/ausr_alice>",
      ["https://accounts.freeism.app/profiles/ausr_alice"],
    ],
    ["丸括弧で囲んだURL", "(https://example.com/a)", ["https://example.com/a"]],
    [
      "複数のURL",
      "https://example.com/a and https://example.com/b",
      ["https://example.com/a", "https://example.com/b"],
    ],
    [
      "queryに別URLを含むURLは全体を1件とする",
      "https://example.com/?next=https://accounts.freeism.app/profiles/ausr_alice",
      ["https://example.com/?next=https://accounts.freeism.app/profiles/ausr_alice"],
    ],
  ])("%s", (_, text, expected) => {
    expect(extractTextUrls(text)).toEqual(expected);
  });

  it.each([
    ["HTTP", "http://accounts.freeism.app/profiles/ausr_alice"],
    ["schemeの無いURL", "accounts.freeism.app/profiles/ausr_alice"],
    ["scheme相対URL", "//accounts.freeism.app/profiles/ausr_alice"],
    ["mailto", "mailto:alice@example.com"],
    ["schemeの無いメールアドレス", "alice@example.com"],
    ["ftp", "ftp://example.com/file"],
  ])("HTTPS以外（%s）を抽出しない", (_, text) => {
    expect(extractTextUrls(text)).toEqual([]);
  });
});

describe("parseLinkHeaderUrls", () => {
  it("relを問わず、すべてのlink-valueのURIを取り出す", () => {
    expect(
      parseLinkHeaderUrls(
        '<https://example.com/me>; rel="me", </feed.xml>; rel="alternate"; type="application/rss+xml"',
      ),
    ).toEqual(["https://example.com/me", "/feed.xml"]);
  });
});

describe("normalizeEvidenceCandidates", () => {
  const baseUrl = "https://site.example.com/blog/post";

  it("相対URLを最終取得URL基準で解決して正規化する", () => {
    expect(
      normalizeEvidenceCandidates(
        ["/profiles/a", "../about", "HTTPS://Accounts.Freeism.app/profiles/ausr_alice#top"],
        baseUrl,
      ),
    ).toEqual([
      "https://site.example.com/profiles/a",
      "https://site.example.com/about",
      "https://accounts.freeism.app/profiles/ausr_alice",
    ]);
  });

  it("正規化できない候補を捨て、重複を1件にする", () => {
    expect(
      normalizeEvidenceCandidates(
        [
          "http://example.com/",
          "mailto:alice@example.com",
          "javascript:void(0)",
          "https://localhost/",
          "https://example.com/",
          "https://example.com/#x",
        ],
        baseUrl,
      ),
    ).toEqual(["https://example.com/"]);
  });
});
