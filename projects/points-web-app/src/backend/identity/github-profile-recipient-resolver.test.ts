import { describe, expect, it, vi } from "vite-plus/test";

import {
  normalizeGitHubProfileUrl,
  resolveGitHubProfileRecipients,
} from "./github-profile-recipient-resolver";

const credentials = {
  clientId: "client-id",
  clientSecret: "client-secret",
};

function githubUser(login: string, id: number) {
  return new Response(
    JSON.stringify({ html_url: `https://github.com/${login}`, id, login, type: "User" }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": "4999",
        "X-RateLimit-Reset": "1893456000",
      },
      status: 200,
    },
  );
}

describe("GitHub profile recipient resolver", () => {
  it("accepts only one-level HTTPS GitHub profile URLs", () => {
    expect(normalizeGitHubProfileUrl("https://github.com/Alice/")).toBe("https://github.com/alice");
    for (const invalid of [
      "http://github.com/alice",
      "https://github.com/",
      "https://github.com/alice/repos",
      "https://github.com/alice?tab=repositories",
      "https://github.com/alice#readme",
      "https://example.com/alice",
    ]) {
      expect(() => normalizeGitHubProfileUrl(invalid)).toThrow("GITHUB_PROFILE_URL_INVALID");
    }
  });

  it("deduplicates normalized URLs and sends the required authenticated REST headers", async () => {
    const fetcher = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      expect(String(request)).toBe("https://api.github.com/users/alice");
      const headers = new Headers(init?.headers);
      expect(headers.get("Accept")).toBe("application/vnd.github+json");
      expect(headers.get("X-GitHub-Api-Version")).toBe("2026-03-10");
      expect(headers.get("User-Agent")).toContain("freeism-points-worker");
      expect(headers.get("Authorization")).toMatch(/^Basic /);
      return githubUser("Alice", 12345);
    });

    const results = await resolveGitHubProfileRecipients(
      ["https://github.com/Alice", "https://github.com/alice/"],
      { ...credentials, fetcher },
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect([...results.entries()]).toEqual([
      [
        "https://github.com/alice",
        {
          accountId: "12345",
          normalizedProfileUrl: "https://github.com/alice",
          providerId: "github",
        },
      ],
    ]);
  });

  it("rejects organization, malformed identity, unavailable, and rate-limited responses", async () => {
    const cases: Array<[Response, string]> = [
      [
        new Response(
          JSON.stringify({
            html_url: "https://github.com/acme",
            id: 1,
            login: "acme",
            type: "Organization",
          }),
          { status: 200 },
        ),
        "GITHUB_IDENTITY_LOOKUP_INVALID",
      ],
      [new Response("missing", { status: 404 }), "GITHUB_IDENTITY_LOOKUP_UNAVAILABLE"],
      [
        new Response("limited", {
          headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
          status: 403,
        }),
        "GITHUB_IDENTITY_LOOKUP_RATE_LIMITED",
      ],
      [new Response("limited", { status: 429 }), "GITHUB_IDENTITY_LOOKUP_RATE_LIMITED"],
      [new Response("down", { status: 503 }), "GITHUB_IDENTITY_LOOKUP_UNAVAILABLE"],
    ];

    for (const [response, code] of cases) {
      const result = resolveGitHubProfileRecipients(["https://github.com/acme"], {
        ...credentials,
        fetcher: async () => response.clone(),
      });
      await expect(result).rejects.toMatchObject({ code });
    }
  });

  it("limits lookup concurrency to six and aborts on the overall deadline", async () => {
    let active = 0;
    let maximumActive = 0;
    const fetcher = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      const login = new URL(String(request)).pathname.split("/").pop()!;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, 5);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timeout);
          reject(new DOMException("aborted", "AbortError"));
        });
      });
      active -= 1;
      return githubUser(login, Number(login.slice(1)) + 1);
    });
    const urls = Array.from({ length: 20 }, (_, index) => `https://github.com/u${index}`);

    await resolveGitHubProfileRecipients(urls, { ...credentials, fetcher });
    expect(maximumActive).toBe(6);

    await expect(
      resolveGitHubProfileRecipients(["https://github.com/slow"], {
        ...credentials,
        fetcher: (_request, init) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            ),
          ),
        overallTimeoutMs: 10,
      }),
    ).rejects.toMatchObject({ code: "GITHUB_IDENTITY_LOOKUP_TIMEOUT" });
  });
});
