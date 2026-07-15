import { describe, expect, it } from "vite-plus/test";

import { assertGoogleFreshProof } from "./google-fresh-proof";

const nowSeconds = 2_000_000_000;

function proof(authTime: number, subject = "google-account") {
  return {
    claims: {
      aud: "google-client",
      auth_time: authTime,
      iss: "https://accounts.google.com",
      sub: subject,
    },
    expectedAudience: "google-client",
    expectedSubject: "google-account",
    nowSeconds,
    sessionCreatedAtMs: (nowSeconds - 100) * 1000,
  };
}

describe("assertGoogleFreshProof", () => {
  it.each([899, 900])("accepts auth_time at the %s second boundary", (age) => {
    expect(() => assertGoogleFreshProof(proof(nowSeconds - age))).not.toThrow();
  });

  it("rejects auth_time older than 15 minutes", () => {
    expect(() => assertGoogleFreshProof(proof(nowSeconds - 901))).toThrow(
      "FRESH_GOOGLE_AUTH_REQUIRED",
    );
  });

  it("rejects a different linked Google subject", () => {
    expect(() => assertGoogleFreshProof(proof(nowSeconds - 100, "other-account"))).toThrow(
      "GOOGLE_SUBJECT_MISMATCH",
    );
  });

  it("rejects a stale Better Auth session", () => {
    expect(() =>
      assertGoogleFreshProof({
        ...proof(nowSeconds - 100),
        sessionCreatedAtMs: (nowSeconds - 901) * 1000,
      }),
    ).toThrow("FRESH_GOOGLE_AUTH_REQUIRED");
  });

  it("rejects an invalid session timestamp", () => {
    expect(() =>
      assertGoogleFreshProof({
        ...proof(nowSeconds - 100),
        sessionCreatedAtMs: Number.NaN,
      }),
    ).toThrow("FRESH_GOOGLE_AUTH_REQUIRED");
  });
});
