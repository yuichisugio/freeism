import { describe, expect, it } from "vitest";

import { createSafePageFetcher } from "./safe-page-fetcher";
import { createMockServer } from "./mock-page-server";

const accountsOrigin = "https://accounts.freeism.app";

/**
 * HTML応答を作る。
 */
function htmlResponse(
  body: BodyInit,
  { status = 200, headers = {} }: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

/**
 * 相対`Location`でredirectする応答を作る。
 */
function redirectResponse(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

describe("createSafePageFetcher", () => {
  // --------------------------------------------------
  // 取得成功
  // --------------------------------------------------

  it("Accountsが組み立てたヘッダーで取得し、本文と応答情報を返す", async () => {
    const server = createMockServer({
      "https://site.example.com/": () =>
        htmlResponse("<p>hello</p>", {
          headers: { link: '<https://site.example.com/me>; rel="me"' },
        }),
    });
    const fetcher = createSafePageFetcher({ accountsOrigin, fetch: server.fetch });

    const fetched = await fetcher.fetchPage("https://site.example.com/");

    expect(fetched).toEqual({
      ok: true,
      page: {
        finalUrl: "https://site.example.com/",
        contentType: "text/html",
        charset: "utf-8",
        linkHeader: '<https://site.example.com/me>; rel="me"',
        body: new TextEncoder().encode("<p>hello</p>"),
      },
    });
    const [request] = server.requests;
    expect(request?.redirect).toBe("manual");
    expect(Object.fromEntries(request?.headers ?? [])).toEqual({
      accept: "text/html, text/plain;q=0.9",
      "user-agent": "FreeismAccountsVerifier/0.1 (+https://accounts.freeism.app/help)",
    });
  });

  it("`text/plain`とcharsetを受け付け、Content-Typeの値を小文字で返す", async () => {
    const server = createMockServer({
      "https://site.example.com/": () =>
        new Response("text", { headers: { "content-type": 'Text/Plain; Charset="Shift_JIS"' } }),
    });

    const fetched = await createSafePageFetcher({ accountsOrigin, fetch: server.fetch }).fetchPage(
      "https://site.example.com/",
    );

    expect(fetched.ok && [fetched.page.contentType, fetched.page.charset]).toEqual([
      "text/plain",
      "shift_jis",
    ]);
  });

  it("本文がちょうど1MiBなら受け付ける", async () => {
    const server = createMockServer({
      "https://site.example.com/": () => htmlResponse(new Uint8Array(1024 * 1024)),
    });

    const fetched = await createSafePageFetcher({ accountsOrigin, fetch: server.fetch }).fetchPage(
      "https://site.example.com/",
    );

    expect(fetched.ok && fetched.page.body.byteLength).toBe(1024 * 1024);
  });

  // --------------------------------------------------
  // redirect
  // --------------------------------------------------

  it("相対`Location`を解決してredirectを追跡し、最終取得URLを返す", async () => {
    const server = createMockServer({
      "https://site.example.com/old": () => redirectResponse("/new", 301),
      "https://site.example.com/new": () =>
        redirectResponse("https://Other.example.com/final#top", 308),
      "https://other.example.com/final": () => htmlResponse("ok"),
    });

    const fetched = await createSafePageFetcher({ accountsOrigin, fetch: server.fetch }).fetchPage(
      "https://site.example.com/old",
    );

    expect(fetched.ok && fetched.page.finalUrl).toBe("https://other.example.com/final");
    expect(server.requests.map((request) => request.url)).toEqual([
      "https://site.example.com/old",
      "https://site.example.com/new",
      "https://other.example.com/final",
    ]);
  });

  it("redirectを3回まで追跡し、4回目のredirectは判断不能にする", async () => {
    const threeRedirects = createMockServer({
      "https://site.example.com/1": () => redirectResponse("/2"),
      "https://site.example.com/2": () => redirectResponse("/3"),
      "https://site.example.com/3": () => redirectResponse("/4"),
      "https://site.example.com/4": () => htmlResponse("ok"),
    });
    const fourRedirects = createMockServer({
      "https://site.example.com/0": () => redirectResponse("/1"),
      "https://site.example.com/1": () => redirectResponse("/2"),
      "https://site.example.com/2": () => redirectResponse("/3"),
      "https://site.example.com/3": () => redirectResponse("/4"),
      "https://site.example.com/4": () => htmlResponse("ok"),
    });

    const followed = await createSafePageFetcher({
      accountsOrigin,
      fetch: threeRedirects.fetch,
    }).fetchPage("https://site.example.com/1");
    const exceeded = await createSafePageFetcher({
      accountsOrigin,
      fetch: fourRedirects.fetch,
    }).fetchPage("https://site.example.com/0");

    expect(followed.ok && followed.page.finalUrl).toBe("https://site.example.com/4");
    expect(exceeded).toEqual({
      ok: false,
      failure: { result: "indeterminate", failureCode: "TOO_MANY_REDIRECTS" },
    });
    expect(fourRedirects.requests).toHaveLength(4);
  });

  it.each([
    ["HTTP", "http://site.example.com/"],
    ["IP literal", "https://169.254.169.254/latest/meta-data/"],
    ["localhost", "https://localhost/"],
    ["443以外のport", "https://site.example.com:8443/"],
  ])("redirect先が%sなら取得せずに不一致にする", async (_, location) => {
    const server = createMockServer({
      "https://site.example.com/": () => redirectResponse(location),
    });

    const fetched = await createSafePageFetcher({ accountsOrigin, fetch: server.fetch }).fetchPage(
      "https://site.example.com/",
    );

    expect(fetched).toEqual({
      ok: false,
      failure: { result: "not_verified", failureCode: "REDIRECT_TARGET_BLOCKED" },
    });
    expect(server.requests).toHaveLength(1);
  });

  it("`Location`の無いredirectはHTTPの失敗にする", async () => {
    const server = createMockServer({
      "https://site.example.com/": () => new Response(null, { status: 302 }),
    });

    const fetched = await createSafePageFetcher({ accountsOrigin, fetch: server.fetch }).fetchPage(
      "https://site.example.com/",
    );

    expect(fetched).toEqual({
      ok: false,
      failure: { result: "indeterminate", failureCode: "HTTP_ERROR" },
    });
  });

  // --------------------------------------------------
  // 取得不能・上限超過・形式不明
  // --------------------------------------------------

  it.each([
    [404, "not_verified", "PAGE_NOT_FOUND"],
    [403, "indeterminate", "ACCESS_RESTRICTED"],
    [503, "indeterminate", "HTTP_ERROR"],
  ])("HTTP %iを分類する", async (status, result, failureCode) => {
    const server = createMockServer({
      "https://site.example.com/": () => htmlResponse("error", { status }),
    });

    const fetched = await createSafePageFetcher({ accountsOrigin, fetch: server.fetch }).fetchPage(
      "https://site.example.com/",
    );

    expect(fetched).toEqual({ ok: false, failure: { result, failureCode } });
  });

  it.each([
    ["JSON", "application/json"],
    ["XHTML", "application/xhtml+xml"],
    ["解釈できないcharset", "text/html; charset=unknown-charset"],
  ])("%sの応答を形式不明にする", async (_, contentType) => {
    const server = createMockServer({
      "https://site.example.com/": () =>
        new Response("{}", { headers: { "content-type": contentType } }),
    });

    const fetched = await createSafePageFetcher({ accountsOrigin, fetch: server.fetch }).fetchPage(
      "https://site.example.com/",
    );

    expect(fetched).toEqual({
      ok: false,
      failure: { result: "indeterminate", failureCode: "UNSUPPORTED_CONTENT_TYPE" },
    });
  });

  it("Content-Typeの無い応答を形式不明にする", async () => {
    const server = createMockServer({
      "https://site.example.com/": () => new Response(new Uint8Array([60, 112, 62])),
    });

    const fetched = await createSafePageFetcher({ accountsOrigin, fetch: server.fetch }).fetchPage(
      "https://site.example.com/",
    );

    expect(fetched).toEqual({
      ok: false,
      failure: { result: "indeterminate", failureCode: "UNSUPPORTED_CONTENT_TYPE" },
    });
  });

  it("本文が1MiBを超えたら読込を打ち切り、上限超過にする", async () => {
    let canceled = false;
    const endlessBody = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(64 * 1024));
      },
      cancel() {
        canceled = true;
      },
    });
    const server = createMockServer({
      "https://site.example.com/": () => htmlResponse(endlessBody),
    });

    const fetched = await createSafePageFetcher({ accountsOrigin, fetch: server.fetch }).fetchPage(
      "https://site.example.com/",
    );

    expect(fetched).toEqual({
      ok: false,
      failure: { result: "indeterminate", failureCode: "RESPONSE_TOO_LARGE" },
    });
    expect(canceled).toBe(true);
  });

  it("応答が期限までに届かなければ判断不能にする", async () => {
    const server = createMockServer({
      "https://site.example.com/": (request) =>
        new Promise<Response>((_, reject) => {
          request.signal.addEventListener("abort", () => reject(request.signal.reason));
        }),
    });

    const fetched = await createSafePageFetcher({
      accountsOrigin,
      fetch: server.fetch,
      timeoutMilliseconds: 50,
    }).fetchPage("https://site.example.com/");

    expect(fetched).toEqual({
      ok: false,
      failure: { result: "indeterminate", failureCode: "FETCH_TIMEOUT" },
    });
  });

  it("本文の読込中に期限を過ぎたら判断不能にする", async () => {
    const server = createMockServer({
      "https://site.example.com/": (request) =>
        htmlResponse(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("<p>"));
              request.signal.addEventListener("abort", () =>
                controller.error(request.signal.reason),
              );
            },
          }),
        ),
    });

    const fetched = await createSafePageFetcher({
      accountsOrigin,
      fetch: server.fetch,
      timeoutMilliseconds: 50,
    }).fetchPage("https://site.example.com/");

    expect(fetched).toEqual({
      ok: false,
      failure: { result: "indeterminate", failureCode: "FETCH_TIMEOUT" },
    });
  });

  it("接続できなければ判断不能にする", async () => {
    const server = createMockServer({
      "https://site.example.com/": () => {
        throw new TypeError("Network connection lost.");
      },
    });

    const fetched = await createSafePageFetcher({ accountsOrigin, fetch: server.fetch }).fetchPage(
      "https://site.example.com/",
    );

    expect(fetched).toEqual({
      ok: false,
      failure: { result: "indeterminate", failureCode: "NETWORK_ERROR" },
    });
  });
});
