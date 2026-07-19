import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);

const publicPages = [
  ["/", "index.html", "https://docs.freeism.app", 150],
  ["/en/", "en/index.html", "https://docs.freeism.app/en/", 150],
  ["/notes/", "notes/index.html", "https://docs.freeism.app/notes/", 7],
  ["/en/notes/", "en/notes/index.html", "https://docs.freeism.app/en/notes/", 6],
] as const;

const generatedAliases = [
  "freeism/index.html",
  "en/freeism/index.html",
  "note/note/index.html",
  "en/note/note/index.html",
] as const;

const expectedSitemapUrls = publicPages.map(([, , canonical]) =>
  canonical === "https://docs.freeism.app"
    ? "https://docs.freeism.app/"
    : canonical.replace(/\/$/u, ""),
);

describe("Blume production build contract", () => {
  it(
    "publishes and indexes only the four supported documentation routes",
    async () => {
      await execFileAsync("pnpm", ["run", "build"], {
        cwd: projectRoot,
      });

      const pagefindFragments = await readdir(new URL("pagefind/fragment/", dist));
      expect(pagefindFragments.filter((file) => file.endsWith(".pf_fragment"))).toHaveLength(4);

      for (const [route, outputPath, canonical, headingCount] of publicPages) {
        const html = await readFile(new URL(outputPath, dist), "utf8");

        expect(html.match(/<h[1-6][^>]*>/gu) ?? [], route).toHaveLength(
          headingCount,
        );
        expect(
          html.match(/<pre[^>]*data-language="mermaid"[^>]*>/gu) ?? [],
          route,
        ).toHaveLength(5);
        expect(html, route).toContain(
          `<link rel="canonical" href="${canonical}">`,
        );
        expect(html, route).not.toMatch(
          /href="\/?(?:en\/)?(?:freeism|note\/note)\/?(?:[#?"])/u,
        );
        expect(html, route).not.toMatch(
          /href="(?:\.\/)?freeism\.(?:ja|en)\.md"/u,
        );
      }

      expect(await readFile(new URL("index.html", dist), "utf8")).toContain(
        'href="/en/"',
      );
      expect(await readFile(new URL("en/index.html", dist), "utf8")).toContain(
        'href="/"',
      );

      for (const alias of generatedAliases) {
        await expect(access(new URL(alias, dist))).rejects.toThrow();
      }

      const sitemap = await readFile(new URL("sitemap.xml", dist), "utf8");
      const actualSitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)]
        .map((match) => match[1])
        .sort();

      expect(actualSitemapUrls).toEqual([...expectedSitemapUrls].sort());
    },
    30_000,
  );
});
