import { describe, expect, it } from "vite-plus/test";

import { computeFixRevisionDeltas } from "./fix-revision";

const entry = (pointsUserId: string, amountScaled: number) => ({
  amountScaled,
  evaluationCriterionId: "criterion-a",
  pointsUserId,
  recipientKey: `github:${pointsUserId}`,
});

describe("FIX revision delta", () => {
  it("emits the initial amount and only the signed correction difference", () => {
    expect(computeFixRevisionDeltas([], [entry("pusr_a", 10000)])).toEqual([
      { ...entry("pusr_a", 10000), deltaAmountScaled: 10000 },
    ]);
    expect(computeFixRevisionDeltas([entry("pusr_a", 10000)], [entry("pusr_a", 3000)])).toEqual([
      { ...entry("pusr_a", 3000), deltaAmountScaled: -7000 },
    ]);
    expect(computeFixRevisionDeltas([entry("pusr_a", -2000)], [entry("pusr_a", 1000)])).toEqual([
      { ...entry("pusr_a", 1000), deltaAmountScaled: 3000 },
    ]);
  });

  it("omits zero deltas and reverses an old recipient when the recipient changes", () => {
    expect(computeFixRevisionDeltas([entry("pusr_a", 10000)], [entry("pusr_a", 10000)])).toEqual(
      [],
    );
    expect(computeFixRevisionDeltas([entry("pusr_a", 10000)], [entry("pusr_b", 10000)])).toEqual([
      { ...entry("pusr_a", 10000), deltaAmountScaled: -10000 },
      { ...entry("pusr_b", 10000), deltaAmountScaled: 10000 },
    ]);
  });
});
