import { describe, expect, it } from "vite-plus/test";

import { normalizeIdentityUrl } from "./normalize-identity-url";

describe("normalizeIdentityUrl", () => {
  it.each([
    ["HTTPS://B\u00dcCHER.Example.COM:443#proof", "https://xn--bcher-kva.example.com/"],
    ["https://Example.COM", "https://example.com/"],
    [
      "https://example.com/profile?from=campaign#proof",
      "https://example.com/profile?from=campaign",
    ],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeIdentityUrl(input)).toBe(expected);
  });

  it("does not merge meaningful paths, trailing slashes, subdomains, or queries", () => {
    const values = [
      "https://example.com/alice",
      "https://example.com/alice/",
      "https://example.com/alice/about",
      "https://www.example.com/alice",
      "https://example.com/alice?tab=about",
    ].map(normalizeIdentityUrl);
    expect(new Set(values).size).toBe(values.length);
  });

  it.each([
    "http://example.com/alice",
    "https://user:secret@example.com/alice",
    "https://example.com:8443/alice",
    "https://127.0.0.1/alice",
    "https://[::1]/alice",
    "https://localhost/alice",
    "https://service.internal/alice",
    "https://metadata.google.internal/alice",
    "https://printer/alice",
  ])("rejects an unsafe identity URL: %s", (input) => {
    expect(() => normalizeIdentityUrl(input)).toThrow("IDENTITY_URL_INVALID");
  });
});
