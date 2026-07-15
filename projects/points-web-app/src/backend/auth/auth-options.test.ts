import { describe, expect, it } from "vite-plus/test";

import { parseBetterAuthSecrets } from "./auth-options";

describe("parseBetterAuthSecrets", () => {
  it("keeps the declared current-to-previous order", () => {
    expect(
      parseBetterAuthSecrets(
        "2:current-secret-at-least-32-characters,1:previous-secret-at-least-32-characters",
      ),
    ).toEqual([
      { value: "current-secret-at-least-32-characters", version: 2 },
      { value: "previous-secret-at-least-32-characters", version: 1 },
    ]);
  });

  it.each([
    "",
    "missing-version-separator",
    "01:secret-value-at-least-32-characters",
    "1:short",
    "1:secret-value-at-least-32-characters,1:another-secret-at-least-32-characters",
  ])("rejects invalid versioned secret input %j", (input) => {
    expect(() => parseBetterAuthSecrets(input)).toThrow("BETTER_AUTH_SECRETS");
  });
});
