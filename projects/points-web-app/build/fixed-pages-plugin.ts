import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";

const VIRTUAL_MODULE_ID = "virtual:fixed-pages";
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
const STATIC_PAGES_DIRECTORY = fileURLToPath(
  new URL("../../../docs/web-app/v0.2/static-pages/", import.meta.url),
);
const ROUTES = ["terms", "privacy", "help", "docs"] as const;
const LANGUAGES = ["ja", "en"] as const;

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n");
}

export function fixedPagesPlugin(): Plugin {
  return {
    name: "freeism-fixed-pages",
    resolveId(id) {
      return id === VIRTUAL_MODULE_ID ? RESOLVED_VIRTUAL_MODULE_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) {
        return null;
      }

      const pages = Object.fromEntries(
        await Promise.all(
          ROUTES.map(async (route) => {
            const locales = Object.fromEntries(
              await Promise.all(
                LANGUAGES.map(async (language) => {
                  const filePath = new URL(
                    `${route}.${language}.md`,
                    `file://${STATIC_PAGES_DIRECTORY}/`,
                  );
                  const markdown = normalizeMarkdown(await readFile(filePath, "utf8"));
                  return [
                    language,
                    {
                      markdown,
                      sourceSha256: createHash("sha256").update(markdown).digest("hex"),
                    },
                  ];
                }),
              ),
            );
            return [route, { ...locales, route }];
          }),
        ),
      );

      return `export const fixedPages = ${JSON.stringify(pages)};`;
    },
  };
}
