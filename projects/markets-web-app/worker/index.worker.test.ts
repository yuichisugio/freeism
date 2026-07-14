import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

describe("markets Worker routing", () => {
  it("serves the health contract", async () => {
    const response = await SELF.fetch("https://markets.test/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ service: "auction-worker", status: "ok" });
  });

  const nonHtmlCases = [
    "/api/missing",
    "/.well-known/missing",
    "/missing.js",
    "/missing.css",
    "/missing.png",
  ];

  for (const path of nonHtmlCases) {
    it(`returns a non-HTML 404 for ${path}`, async () => {
      const response = await SELF.fetch(`https://markets.test${path}`);

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/problem+json");
      expect(response.headers.get("content-type")).not.toContain("text/html");
    });
  }

  it("serves the SPA shell only for HTML navigation", async () => {
    const response = await SELF.fetch("https://markets.test/dashboard", {
      headers: {
        Accept: "text/html",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("data-markets-shell");
  });

  it("preserves shell headers for HEAD without returning a body", async () => {
    const response = await SELF.fetch("https://markets.test/dashboard", {
      method: "HEAD",
      headers: {
        Accept: "text/html",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("does not treat JSON or POST requests as navigation", async () => {
    const jsonResponse = await SELF.fetch("https://markets.test/dashboard", {
      headers: { Accept: "application/json" },
    });
    const postResponse = await SELF.fetch("https://markets.test/dashboard", {
      method: "POST",
      headers: { Accept: "text/html" },
    });

    expect(jsonResponse.status).toBe(404);
    expect(postResponse.status).toBe(404);
  });
});
