import { describe, expect, it } from "vite-plus/test";

import { normalizeSettlementRetryReason } from "../../src/backend/settlement/admin-retry-authorization";

describe("settlement retry reason", () => {
  it("normalizes equivalent reasons and rejects an empty or oversized reason", async () => {
    const first = await normalizeSettlementRetryReason("  Balance\tstatus  unknown ");
    const second = await normalizeSettlementRetryReason("Balance status unknown");
    expect(first).toEqual(second);
    expect(first.reasonHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    await expect(normalizeSettlementRetryReason("  ")).rejects.toThrow(
      "SETTLEMENT_RETRY_REASON_INVALID",
    );
    await expect(normalizeSettlementRetryReason("a".repeat(501))).rejects.toThrow(
      "SETTLEMENT_RETRY_REASON_INVALID",
    );
  });
});
