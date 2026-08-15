import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { normalizeMermaidSource } from "./normalize-mermaid-source";

const mainDocuments = [
  ["Japanese", new URL("./freeism.ja.md", import.meta.url), /無料主義 v3/],
  ["English", new URL("./freeism.en.md", import.meta.url), /Freeism v3/i],
] as const;

const countHeadings = (markdown: string) =>
  markdown.match(/^#{1,6}\s+.+$/gm)?.length ?? 0;

const countMermaidFences = (markdown: string) =>
  markdown.match(/^```mermaid\s*$/gm)?.length ?? 0;

describe("Blume canonical content", () => {
  it.each(mainDocuments)(
    "preserves the %s main document structure",
    async (_language, file, versionTitle) => {
      const markdown = await readFile(file, "utf8");

      expect(markdown).toMatch(versionTitle);
      expect(countHeadings(markdown)).toBeGreaterThanOrEqual(140);
      expect(countMermaidFences(markdown)).toBeGreaterThanOrEqual(5);
    },
  );
});

describe("Mermaid rendering bridge", () => {
  it("quotes an unquoted edge label containing parentheses", () => {
    const source =
      "F10D -.->|Phase 11 may be omitted (example Y)| F12";

    expect(normalizeMermaidSource(source)).toBe(
      'F10D -.->|"Phase 11 may be omitted (example Y)"| F12',
    );
  });

  it("leaves ordinary and already quoted edge labels unchanged", () => {
    const source = [
      "A -->|ordinary label| B",
      'B -->|"already quoted (label)"| C',
    ].join("\n");

    expect(normalizeMermaidSource(source)).toBe(source);
  });
});
