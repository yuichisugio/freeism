import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import wranglerConfigSource from "../../wrangler.jsonc?raw";

const wranglerConfig = JSON.parse(wranglerConfigSource.replace(/,\s*([}\]])/g, "$1")) as {
  assets: {
    html_handling: string;
    not_found_handling: string;
    run_worker_first: string[];
  };
  compatibility_flags: string[];
};

describe("Points Static Assets routing boundary", () => {
  it("keeps unmatched assets out of automatic SPA handling", () => {
    expect(wranglerConfig.assets).toMatchObject({
      html_handling: "auto-trailing-slash",
      not_found_handling: "none",
      run_worker_first: ["/api/*", "/.well-known/*"],
    });
  });

  it("keeps the required Workers compatibility flags", () => {
    expect(wranglerConfig.compatibility_flags).toEqual(
      expect.arrayContaining([
        "nodejs_compat",
        "assets_navigation_has_no_effect",
        "global_fetch_strictly_public",
      ]),
    );
  });

  it.each(["/api/missing", "/.well-known/missing", "/missing.js"])(
    "returns a non-HTML 404 for %s",
    async (path) => {
      const response = await SELF.fetch(`https://points.test${path}`, {
        headers: { Accept: "text/html" },
      });

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/problem+json");
      expect(await response.text()).not.toContain("data-points-shell");
    },
  );

  it("uses the shell only for dynamic document navigation", async () => {
    const response = await SELF.fetch("https://points.test/settings/profile", {
      headers: {
        Accept: "text/html",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("data-points-shell");
  });

  it("does not use the shell for non-navigation or non-HTML requests", async () => {
    const responses = await Promise.all([
      SELF.fetch("https://points.test/settings/profile", {
        headers: { Accept: "application/json" },
      }),
      SELF.fetch("https://points.test/settings/profile", {
        headers: { Accept: "text/html", "Sec-Fetch-Mode": "cors" },
      }),
      SELF.fetch("https://points.test/settings/profile", {
        headers: { Accept: "text/html" },
        method: "POST",
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
  });
});
