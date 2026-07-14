import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { normalizeMermaidSource } from "./normalize-mermaid-source";

const canonicalFiles = [
  {
    name: "Japanese main document",
    file: new URL("./freeism.ja.md", import.meta.url),
    originMainSha256:
      "87350f6bc9d5f5b334c620bcc1ee7371cd7e4e96529291107d45753d7c9635c8",
  },
  {
    name: "English main document",
    file: new URL("./freeism.en.md", import.meta.url),
    originMainSha256:
      "334dc29c17d75763f3b12734824eaf2e4fd12c7665325b0f0a39b22285efba4d",
  },
  {
    name: "Japanese notes",
    file: new URL("./note/note.ja.md", import.meta.url),
    originMainSha256:
      "15418aae4565fb7e37369b62c5d986b9b9cc6cf382a58744cecf1cc72fdffc4d",
  },
  {
    name: "English notes",
    file: new URL("./note/note.en.md", import.meta.url),
    originMainSha256:
      "f3a3c0ae79213cdc1461aebbd0a1ed15789494d245832fe3d4246b95d2716389",
  },
  {
    name: "Japanese README",
    file: new URL("./readme/README.ja.md", import.meta.url),
    originMainSha256:
      "b42aad7e9509399d2df1e40e76fce3f2b498ccc4a5a265b1e672c7318e70a074",
  },
  {
    name: "package README",
    file: new URL("../README.md", import.meta.url),
    originMainSha256:
      "cbd484d937a37bcfffa7286450024f692ed45b4e07072ab6c38c2fb11f86d6b8",
  },
] as const;

const mainDocuments = [
  ["Japanese", canonicalFiles[0].file, /無料主義 v3/],
  ["English", canonicalFiles[1].file, /Freeism v3/i],
] as const;

const countHeadings = (markdown: string) =>
  markdown.match(/^#{1,6}\s+.+$/gm)?.length ?? 0;

const countMermaidFences = (markdown: string) =>
  markdown.match(/^```mermaid\s*$/gm)?.length ?? 0;

describe("Blume canonical content", () => {
  it.each(canonicalFiles)(
    "keeps $name byte-identical to branch base origin/main a8659964",
    async ({ file, originMainSha256 }) => {
      const contents = await readFile(file);
      const actualSha256 = createHash("sha256").update(contents).digest("hex");

      expect(actualSha256).toBe(originMainSha256);
    },
  );

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
