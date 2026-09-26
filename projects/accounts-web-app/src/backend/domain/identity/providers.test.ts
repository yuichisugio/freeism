import { describe, expect, it } from "vitest";

import { isOAuthProviderId, isProviderId, normalizeProviderUsername } from "./providers";

describe("normalizeProviderUsername", () => {
  it.each([
    { provider: "github", username: "Alice", expected: "alice" },
    { provider: "gitlab", username: "Alice", expected: "alice" },
    { provider: "stackoverflow", username: "12345", expected: "12345" },
    { provider: "google", username: "Alice", expected: "Alice" },
  ] as const)(
    "$providerのユーザー名$usernameを$expectedにする",
    ({ provider, username, expected }) => {
      expect(normalizeProviderUsername(provider, username)).toBe(expected);
    },
  );
});

describe("isProviderId", () => {
  it("Provider表の値だけを受け付ける", () => {
    expect(isProviderId("orcid")).toBe(true);
    expect(isProviderId("GitHub")).toBe(false);
    expect(isProviderId("example")).toBe(false);
  });
});

describe("isOAuthProviderId", () => {
  it("ログイン・追加連携に使うGoogle・GitHub・ORCIDだけを受け付ける", () => {
    expect(["google", "github", "orcid", "gitlab", "credential"].filter(isOAuthProviderId)).toEqual(
      ["google", "github", "orcid"],
    );
  });
});
