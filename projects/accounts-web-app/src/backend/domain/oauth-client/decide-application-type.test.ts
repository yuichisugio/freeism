import { describe, expect, it } from "vitest";

import { decideApplicationType } from "./decide-application-type";

describe("decideApplicationType", () => {
  it.each([
    { redirectUris: ["https://points.example/callback"], expected: "web" },
    {
      redirectUris: ["https://points.example/callback", "https://staging.points.example/callback"],
      expected: "web",
    },
    { redirectUris: ["http://localhost:3000/callback"], expected: "native" },
    { redirectUris: ["http://127.0.0.1:8787/callback"], expected: "native" },
    { redirectUris: ["http://[::1]/callback"], expected: "native" },
    {
      redirectUris: ["https://points.example/callback", "http://localhost:3000/callback"],
      expected: "native",
    },
  ] as const)("$redirectUrisは$expectedにする", ({ redirectUris, expected }) => {
    expect(decideApplicationType(redirectUris)).toBe(expected);
  });
});
