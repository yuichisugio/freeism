import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { fixedPages } from "virtual:fixed-pages";

import { FixedPageView } from "../../src/content/fixed-pages";

const routes = ["terms", "privacy", "help", "docs"] as const;
const languages = ["ja", "en"] as const;

const renderedTextHashes = {
  docs: {
    en: "af74d77d0f4c1bb0864739bc9b151db430caa068bf73f8cf02c11f5752da655c",
    ja: "25839473541b0025ee0d4803ee2202283b58f2083d4876e535f7a0f0f8394396",
  },
  help: {
    en: "31ce236c685f5e97df5b2a2cb1b9df753185fbbe6829df2d99f21b2b1c0add61",
    ja: "b9282a86072c442c1c7417de14da06f7797cb95d7c10d182b2089a9263e4323f",
  },
  privacy: {
    en: "30fa99375e995bbc999a90745117e086ec3628281295e7308750befda0742401",
    ja: "8a8053860cf8eaf3b8b55ccaa143d68a69ba3022ac2c47a3ec53af8416de6e5e",
  },
  terms: {
    en: "bbc1d1f2f2ed90389053bf2e8fe7e110409b3f7e34fd40fdde5d69723d44ff2f",
    ja: "33b151ce28ed4a776a022ca9cc5c5338e29ec73a28af0b16e5e071c01481c094",
  },
} as const;

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

  it("renders each locale once with its canonical structured text", () => {
    const actualHashes: Record<string, Record<string, string>> = {};
    for (const route of routes) {
      actualHashes[route] = {};
      const template = document.createElement("template");
      template.innerHTML = renderToStaticMarkup(
        createElement(FixedPageView, { page: fixedPages[route] }),
      );

      for (const language of languages) {
        const articles = template.content.querySelectorAll(
          `article[data-language="${language}"]`,
        );
        expect(articles).toHaveLength(1);
        const article = articles[0]!;
        expect(article.getAttribute("data-source-sha256")).toBe(
          fixedPages[route][language].sourceSha256,
        );
        const structuredText = [...article.querySelectorAll("h1,h2,h3,h4,h5,h6,p:not(.authority-note),li")]
          .map((element) => `${element.tagName.toLowerCase()}:${element.textContent}`)
          .join("\n");
        actualHashes[route]![language] = createHash("sha256")
          .update(structuredText)
          .digest("hex");
      }
    }
    expect(actualHashes).toEqual(renderedTextHashes);
  });
});
