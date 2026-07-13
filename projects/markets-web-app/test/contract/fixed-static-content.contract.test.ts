import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { fixedPages } from "virtual:fixed-pages";

const routes = ["terms", "privacy", "help", "docs"] as const;
const languages = ["ja", "en"] as const;

describe("fixed static content contract", () => {
  it("loads every canonical Markdown source without rewriting it in route modules", async () => {
    for (const route of routes) {
      const routeSource = await readFile(resolve(process.cwd(), `src/routes/${route}.tsx`), "utf8");
      expect(routeSource).toContain(`<FixedPage route="${route}" />`);

      for (const language of languages) {
        const markdown = (
          await readFile(
            resolve(process.cwd(), `../../docs/web-app/v0.2/static-pages/${route}.${language}.md`),
            "utf8",
          )
        ).replace(/\r\n?/g, "\n");
        expect(fixedPages[route][language].markdown).toBe(markdown);
        expect(fixedPages[route][language].sourceSha256).toBe(
          createHash("sha256").update(markdown).digest("hex"),
        );
      }
    }
  });
});
