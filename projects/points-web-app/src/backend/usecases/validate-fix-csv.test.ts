import { describe, expect, it } from "vite-plus/test";

import { normalizeGenericWebProfileUrl } from "./validate-fix-csv";

describe("generic Web FIX recipient URL normalization", () => {
  it("removes only the fragment while preserving path, query, and trailing slash", () => {
    expect(
      normalizeGenericWebProfileUrl(
        "https://freeism.app:443/profiles/alice/?view=activity#ownership-proof",
      ),
    ).toBe("https://freeism.app/profiles/alice/?view=activity");
  });

  it("rejects userinfo, non-HTTPS ports, IP literals, localhost, and private or reserved names", () => {
    for (const invalid of [
      "https://user@freeism.app/profile",
      "https://freeism.app:444/profile",
      "https://127.0.0.1/profile",
      "https://[::1]/profile",
      "https://localhost/profile",
      "https://sub.localhost/profile",
      "https://host.local/profile",
      "https://metadata.google.internal/profile",
      "https://profile.example.test/profile",
      "https://intranet/profile",
    ]) {
      expect(() => normalizeGenericWebProfileUrl(invalid)).toThrow("RECIPIENT_PROFILE_URL_INVALID");
    }
  });
});
