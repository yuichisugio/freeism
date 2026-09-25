import { describe, expect, it } from "vitest";

import { createMockServer } from "./mock-page-server";
import { createSafePageFetcher } from "./safe-page-fetcher";
import { verifyLinkEvidence } from "./verify-link-evidence";

const target = { accountsOrigin: "https://accounts.freeism.app", accountsUserId: "ausr_alice" };

/**
 * モックサーバーから取得するsafe fetchを作る。
 */
function pageFetcherFor(handlers: Parameters<typeof createMockServer>[0]) {
  return createSafePageFetcher({
    accountsOrigin: target.accountsOrigin,
    fetch: createMockServer(handlers).fetch,
  });
}

/**
 * HTML応答を作る。
 */
function htmlResponse(html: string): Response {
  return new Response(html, { headers: { "content-type": "text/html" } });
}

describe("verifyLinkEvidence", () => {
  it("redirect後のページに期待URLがあれば成功とし、最終取得URLを返す", async () => {
    const pageFetcher = pageFetcherFor({
      "https://github.com/old-name": () =>
        new Response(null, { status: 301, headers: { location: "/new-name" } }),
      "https://github.com/new-name": () =>
        htmlResponse(
          '<a rel="me nofollow" href="https://accounts.freeism.app/profiles/ausr_alice">Accounts</a>',
        ),
    });

    await expect(
      verifyLinkEvidence("https://github.com/old-name", target, pageFetcher),
    ).resolves.toEqual({
      result: "verified",
      failureCode: null,
      finalUrl: "https://github.com/new-name",
    });
  });

  it("取得できたページに期待URLが無ければ不一致とする", async () => {
    const pageFetcher = pageFetcherFor({
      "https://example.com/": () => htmlResponse("<p>https://example.com/other</p>"),
    });

    await expect(verifyLinkEvidence("https://example.com/", target, pageFetcher)).resolves.toEqual({
      result: "not_verified",
      failureCode: "LINK_NOT_FOUND",
      finalUrl: "https://example.com/",
    });
  });

  it("コード例に異なるユーザーのプロフィールURLが併存すれば判断不能とする", async () => {
    const pageFetcher = pageFetcherFor({
      "https://example.com/": () =>
        htmlResponse(
          "<p>https://accounts.freeism.app/profiles/ausr_alice</p><pre><code>https://accounts.freeism.app/profiles/ausr_bob</code></pre>",
        ),
    });

    await expect(verifyLinkEvidence("https://example.com/", target, pageFetcher)).resolves.toEqual({
      result: "indeterminate",
      failureCode: "MULTIPLE_ACCOUNTS_PROFILES",
      finalUrl: "https://example.com/",
    });
  });

  it("HTMLとして解析できないページは形式不明とする", async () => {
    const pageFetcher = pageFetcherFor({
      "https://example.com/": () =>
        new Response("<p>https://accounts.freeism.app/profiles/ausr_alice</p>", {
          headers: { "content-type": "text/html; charset=utf-16le" },
        }),
    });

    await expect(verifyLinkEvidence("https://example.com/", target, pageFetcher)).resolves.toEqual({
      result: "indeterminate",
      failureCode: "UNSUPPORTED_CONTENT_TYPE",
      finalUrl: "https://example.com/",
    });
  });

  it("取得できなければ取得の失敗を返し、最終取得URLを持たない", async () => {
    const pageFetcher = pageFetcherFor({
      "https://example.com/": () => new Response("forbidden", { status: 403 }),
    });

    await expect(verifyLinkEvidence("https://example.com/", target, pageFetcher)).resolves.toEqual({
      result: "indeterminate",
      failureCode: "ACCESS_RESTRICTED",
      finalUrl: null,
    });
  });
});
