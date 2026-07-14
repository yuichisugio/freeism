import { describe, expect, it } from "vite-plus/test";

import { PointsOAuthClient } from "../../src/backend/points/points-oauth-client";
import {
  assertNoSettlementRetryReturnTargetInput,
  normalizeSettlementRetryReason,
  settlementRetryReturnPath,
  validateSettlementRetryAssertionClaims,
} from "../../src/backend/settlement/admin-retry-authorization";

const nowSeconds = 2_000_000_000;
const baseClaims = {
  admin: true,
  auctionId: "auction_1",
  aud: "https://markets.example.test",
  authTime: nowSeconds - 899,
  clientId: "settlement-client",
  exp: nowSeconds + 60,
  iat: nowSeconds,
  iss: "https://points.example.test/api/auth",
  jti: "jti_1",
  reasonHash: `sha256:${"a".repeat(64)}`,
  scope: "points.admin.settlement.retry",
  settlementId: "settlement_1",
  sub: "pairwise_admin_1",
  tokenClass: "SETTLEMENT_ADMIN_STEP_UP",
} as const;
const expected = {
  auctionId: "auction_1",
  audience: "https://markets.example.test",
  clientId: "settlement-client",
  issuer: "https://points.example.test/api/auth",
  nowSeconds,
  reasonHash: baseClaims.reasonHash,
  settlementId: "settlement_1",
};

describe("settlement admin assertion contract", () => {
  it("uses only the dedicated authorization-code client, exact scope, and PKCE S256", () => {
    const oauth = new PointsOAuthClient(
      { fetch: async () => new Response() },
      {
        audience: "https://points.example.test/api/v1",
        issuer: "https://points.example.test/api/auth",
        m2mClientId: "m2m-client",
        m2mClientSecret: "m2m-secret",
        settlementClientId: "settlement-client",
        settlementClientSecret: "settlement-secret",
        userClientId: "user-client",
        userClientSecret: "user-secret",
      },
    );
    const url = new URL(
      oauth.settlementAuthorizationUrl({
        callbackUri: "https://markets.example.test/api/settlements/retry-callback",
        nonce: "nonce_1",
        pkceChallenge: "challenge_1",
        resource: "https://markets.example.test",
        state: "state_1",
      }),
    );

    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "settlement-client",
      code_challenge: "challenge_1",
      code_challenge_method: "S256",
      resource: "https://markets.example.test",
      response_type: "code",
      scope: "points.admin.settlement.retry",
      state: "state_1",
    });
  });

  it("validates signature result and every target-bound assertion field", () => {
    expect(validateSettlementRetryAssertionClaims(baseClaims, expected, true)).toEqual(baseClaims);
    for (const claims of [
      { ...baseClaims, aud: "https://other.example.test" },
      { ...baseClaims, clientId: "user-client" },
      { ...baseClaims, scope: "points.admin.settlement.retry points.balance.read" },
      { ...baseClaims, settlementId: "settlement_2" },
      { ...baseClaims, reasonHash: `sha256:${"b".repeat(64)}` },
    ]) {
      expect(() => validateSettlementRetryAssertionClaims(claims, expected, true)).toThrow(
        "ADMIN_ASSERTION_INVALID",
      );
    }
    expect(() => validateSettlementRetryAssertionClaims(baseClaims, expected, false)).toThrow(
      "ADMIN_ASSERTION_SIGNATURE_INVALID",
    );
  });

  it("accepts 899 and 900 seconds of Google freshness and rejects 901 seconds", () => {
    for (const age of [899, 900]) {
      expect(() =>
        validateSettlementRetryAssertionClaims(
          { ...baseClaims, authTime: nowSeconds - age },
          expected,
          true,
        ),
      ).not.toThrow();
    }
    expect(() =>
      validateSettlementRetryAssertionClaims(
        { ...baseClaims, authTime: nowSeconds - 901 },
        expected,
        true,
      ),
    ).toThrow("ADMIN_ASSERTION_NOT_FRESH");
  });

  it("requires ADMIN and a maximum 60 second assertion", () => {
    expect(() =>
      validateSettlementRetryAssertionClaims(
        { ...baseClaims, exp: nowSeconds + 61 },
        expected,
        true,
      ),
    ).toThrow("ADMIN_ASSERTION_LIFETIME_INVALID");
    expect(() =>
      validateSettlementRetryAssertionClaims({ ...baseClaims, admin: false }, expected, true),
    ).toThrow("ADMIN_ASSERTION_ADMIN_REQUIRED");
  });

  it("rejects missing, non-finite, and fractional temporal claims", () => {
    for (const claims of [
      { ...baseClaims, authTime: Number.NaN },
      { ...baseClaims, iat: Number.NaN },
      { ...baseClaims, exp: Number.NaN },
      { ...baseClaims, authTime: nowSeconds - 899.5 },
      { ...baseClaims, iat: nowSeconds - 0.5 },
      { ...baseClaims, exp: nowSeconds + 59.5 },
    ]) {
      expect(() => validateSettlementRetryAssertionClaims(claims, expected, true)).toThrow(
        "ADMIN_ASSERTION_LIFETIME_INVALID",
      );
    }
  });

  it("normalizes reason hashing and never accepts a caller-controlled return path", async () => {
    const first = await normalizeSettlementRetryReason("  Balance\tstatus  unknown ");
    const second = await normalizeSettlementRetryReason("Balance status unknown");
    expect(first).toEqual(second);
    expect(first.reasonHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(settlementRetryReturnPath("settlement_1")).toBe("/settlements/settlement_1");

    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/x?token=1",
      "/x#fragment",
      "/settlements%252fother",
      "/settlements\\other",
    ]) {
      expect(() =>
        assertNoSettlementRetryReturnTargetInput(new URLSearchParams({ returnTo: value })),
      ).toThrow("SETTLEMENT_RETRY_RETURN_TARGET_FORBIDDEN");
    }
  });
});
