import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { ContentSource, SourceEntry } from "blume/sources/types.ts";

const canonicalDocuments = [
  { file: new URL("./freeism.ja.md", import.meta.url), ref: "index.ja.md" },
  { file: new URL("./freeism.en.md", import.meta.url), ref: "index.en.md" },
  { file: new URL("./note/note.ja.md", import.meta.url), ref: "notes.ja.md" },
  { file: new URL("./note/note.en.md", import.meta.url), ref: "notes.en.md" },
] as const;

const documentByRef = new Map<
  string,
  (typeof canonicalDocuments)[number]
>(
  canonicalDocuments.map((document) => [document.ref, document]),
);

const canonicalLocaleLinks = new Map<string, readonly [string, string]>([
  ["index.ja.md", ["(freeism.en.md)", "(/en/)"]],
  ["index.en.md", ["(freeism.ja.md)", "(/)"]],
] as const);

const prepareRenderedSource = (source: string, ref: string) => {
  const localeLink = canonicalLocaleLinks.get(ref);
  if (!localeLink) {
    return source;
  }

  const [legacyTarget, publicTarget] = localeLink;
  return source.replace(legacyTarget, publicTarget);
};

const loadEntry = async (
  document: (typeof canonicalDocuments)[number],
): Promise<SourceEntry> => {
  const source = await readFile(document.file, "utf8");
  const renderedSource = prepareRenderedSource(source, document.ref);

  return {
    body: { format: "md", text: renderedSource },
    data: {},
    raw: renderedSource,
    ref: document.ref,
    sourcePath: fileURLToPath(document.file),
  };
};

export const canonicalContentSource: ContentSource = {
  name: "canonical",
  staged: true,
  load: async () => ({
    diagnostics: [],
    entries: await Promise.all(canonicalDocuments.map(loadEntry)),
  }),
  read: async (ref) => {
    const document = documentByRef.get(ref);
    if (!document) {
      throw new Error(`Unknown canonical documentation ref: ${ref}`);
    }
    return readFile(document.file, "utf8");
  },
};
