import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { smoke, smokeChecks } from "../../scripts/smoke";

const pagePaths = ["/", "/terms", "/privacy", "/help", "/docs", "/search"];

function mockStagingResponses(
  pageStatus = 401,
  challenge: string | null = 'Basic realm="Secure Area"',
) {
  const fetchMock = vi.fn(async (url: URL) => {
    if (pagePaths.includes(url.pathname)) {
      const headers = new Headers({ "Content-Type": "text/html" });
      if (challenge) headers.set("WWW-Authenticate", challenge);
      return new Response(null, { status: pageStatus, headers });
    }
    return new Response("{}", {
      status: url.pathname === "/api/accounts-links" ? 401 : 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("staging deployment smoke", () => {
  it("retains production HTML and navigation checks", () => {
    expect(
      smokeChecks("production")
        .slice(0, 6)
        .map((check) => check.expected),
    ).toEqual(["html", "html", "html", "html", "html", "navigation"]);
  });
  it("accepts Basic challenges on pages and checks the existing API responses", async () => {
    const fetchMock = mockStagingResponses();

    await expect(smoke("staging")).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([url]) => url.pathname)).toEqual([
      ...pagePaths,
      "/api/v1/search",
      "/api/auth/get-session",
      "/api/accounts-links",
    ]);
  });

  it("rejects pages that remain anonymously accessible", async () => {
    mockStagingResponses(200);

    await expect(smoke("staging")).rejects.toThrow("expected Basic authentication 401");
  });

  it("rejects a 401 without a Basic challenge", async () => {
    mockStagingResponses(401, null);

    await expect(smoke("staging")).rejects.toThrow("expected Basic authentication 401");
  });
});
