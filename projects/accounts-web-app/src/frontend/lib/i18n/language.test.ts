import { describe, expect, it } from "vitest";

import { detectLanguage } from "./language";

describe("detectLanguage", () => {
  it.each([
    [["ja"], "ja"],
    [["ja-JP", "en-US"], "ja"],
    [["en-US", "ja-JP"], "en"],
    [["fr"], "en"],
    [[], "en"],
  ] as const)("ブラウザーの優先言語%sの先頭から%sを選ぶ", (browserLanguages, expected) => {
    expect(detectLanguage(browserLanguages)).toBe(expected);
  });
});
