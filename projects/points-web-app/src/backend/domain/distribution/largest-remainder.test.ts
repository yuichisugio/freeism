import { describe, expect, it } from "vite-plus/test";

import {
  allocateByLargestRemainder,
  assertDistributionTargetLimit,
  buildEligibleDistributionCandidates,
  calculateEffectiveDistributionAmounts,
  calculateRetentionAmounts,
} from "./largest-remainder";

describe("auto distribution", () => {
  it("calculates PERCENT or FIXED retention in minimum units with BigInt intermediates", () => {
    expect(
      calculateRetentionAmounts({
        minimumUnitScaled: 1_000,
        retentionRatePpm: 10,
        sourceAmountScaled: 12_000,
      }),
    ).toEqual({ distributionAmountScaled: 12_000, retainedAmountScaled: 0 });
    expect(
      calculateRetentionAmounts({
        minimumUnitScaled: 1_000,
        retentionRatePpm: 1_000_000,
        sourceAmountScaled: 12_000,
      }),
    ).toEqual({ distributionAmountScaled: 0, retainedAmountScaled: 12_000 });
    expect(
      calculateRetentionAmounts({
        minimumUnitScaled: 1_000,
        retentionAmountScaled: 2_500,
        sourceAmountScaled: 12_000,
      }),
    ).toEqual({ distributionAmountScaled: 10_000, retainedAmountScaled: 2_000 });
    expect(
      calculateRetentionAmounts({
        minimumUnitScaled: 1,
        retentionRatePpm: 1_000_000,
        sourceAmountScaled: Number.MAX_SAFE_INTEGER,
      }),
    ).toEqual({
      distributionAmountScaled: 0,
      retainedAmountScaled: Number.MAX_SAFE_INTEGER,
    });
    expect(
      calculateEffectiveDistributionAmounts({
        minimumUnitScaled: 1_000,
        retentionRatePpm: 500_000,
        sourceAmountScaled: 12_000,
        targetCount: 0,
      }),
    ).toEqual({ distributionAmountScaled: 0, retainedAmountScaled: 12_000 });

    for (const input of [
      { retentionRatePpm: 9 },
      { retentionRatePpm: 1_000_001 },
      { retentionAmountScaled: 0, retentionRatePpm: 10 },
      {},
    ]) {
      expect(() =>
        calculateRetentionAmounts({
          minimumUnitScaled: 1_000,
          sourceAmountScaled: 12_000,
          ...input,
        }),
      ).toThrow("AUTO_DISTRIBUTION_RETENTION_INVALID");
    }
  });

  it("builds safe scores from positive component totals and excludes the source and zero scores", () => {
    expect(
      buildEligibleDistributionCandidates({
        candidates: [
          {
            components: [{ evaluationTotalScaled: 100, weight: 10 }],
            pointsUserId: "source-user",
          },
          {
            components: [
              { evaluationTotalScaled: 10, weight: 2 },
              { evaluationTotalScaled: -50, weight: 9 },
              { evaluationTotalScaled: 3, weight: 4 },
            ],
            pointsUserId: "positive-user",
          },
          {
            components: [
              { evaluationTotalScaled: 0, weight: 10 },
              { evaluationTotalScaled: -1, weight: 10 },
            ],
            pointsUserId: "zero-user",
          },
        ],
        sourcePointsUserId: "source-user",
      }),
    ).toEqual([{ pointsUserId: "positive-user", score: 32 }]);

    expect(() =>
      buildEligibleDistributionCandidates({
        candidates: [
          {
            components: [{ evaluationTotalScaled: Number.MAX_SAFE_INTEGER, weight: 2 }],
            pointsUserId: "overflow-user",
          },
        ],
        sourcePointsUserId: "source-user",
      }),
    ).toThrow("AUTO_DISTRIBUTION_SCORE_SAFE_INTEGER_EXCEEDED");
  });

  it("allocates every unit deterministically by remainder and accepts 1,000 candidates", () => {
    const candidates = [
      { pointsUserId: "user-c", score: 1 },
      { pointsUserId: "user-a", score: 1 },
      { pointsUserId: "zero-user", score: 0 },
      { pointsUserId: "user-b", score: 1 },
    ];
    const input = {
      candidates,
      distributionAmountScaled: 500,
      minimumUnitScaled: 100,
    };

    const expected = [
      { amountScaled: 200, pointsUserId: "user-a" },
      { amountScaled: 200, pointsUserId: "user-b" },
      { amountScaled: 100, pointsUserId: "user-c" },
    ];
    expect(allocateByLargestRemainder(input)).toEqual(expected);
    expect(allocateByLargestRemainder({ ...input, candidates: [...candidates].reverse() })).toEqual(
      expected,
    );
    expect(expected.reduce((sum, allocation) => sum + allocation.amountScaled, 0)).toBe(500);

    const thousandAllocations = allocateByLargestRemainder({
      candidates: Array.from({ length: 1_000 }, (_, index) => ({
        pointsUserId: `user-${index.toString().padStart(4, "0")}`,
        score: 1,
      })),
      distributionAmountScaled: 100_000,
      minimumUnitScaled: 100,
    });
    expect(thousandAllocations).toHaveLength(1_000);
    expect(thousandAllocations.reduce((sum, allocation) => sum + allocation.amountScaled, 0)).toBe(
      100_000,
    );
    expect(() => assertDistributionTargetLimit(thousandAllocations.length)).not.toThrow();
    expect(() => assertDistributionTargetLimit(1_001)).toThrow(
      "AUTO_DISTRIBUTION_TARGET_LIMIT_EXCEEDED",
    );
  });
});
