import { describe, expect, it } from "vite-plus/test";

import { resolveFixedPageLanguage } from "./fixed-page-language";

describe("resolveFixedPageLanguage", () => {
  it("prefers a valid saved language", () => {
    expect(resolveFixedPageLanguage("en", ["ja-JP"])).toBe("en");
  });

  it("uses the first supported browser language", () => {
    expect(resolveFixedPageLanguage(null, ["fr-FR", "en-US", "ja-JP"])).toBe("en");
  });

  it("falls back to Japanese for invalid inputs", () => {
    expect(resolveFixedPageLanguage("broken", ["fr-FR"])).toBe("ja");
  });
});
