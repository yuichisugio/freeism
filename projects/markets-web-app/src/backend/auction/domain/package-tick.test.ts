import { describe, expect, it } from "vite-plus/test";

import {
  calculatePackageTick,
  expandPackageVector,
  requiredBaseFactor,
  toPointsPriceTicks,
} from "./package-tick";

describe("package tick arithmetic", () => {
  it("preserves an exact 1:2 ratio and finds the least package tick", () => {
    const tick = calculatePackageTick({
      totalWeight: 3,
      components: [
        { evaluationCriterionId: "criterion-a", minimumUnitScaled: 1, weight: 1 },
        { evaluationCriterionId: "criterion-b", minimumUnitScaled: 25, weight: 2 },
      ],
    });

    expect(tick.packageTick).toBe(75);
    expect(expandPackageVector(1, 1, tick)).toEqual([
      {
        amountScaled: 25,
        evaluationCriterionId: "criterion-a",
        minimumUnitScaled: 1,
      },
      {
        amountScaled: 50,
        evaluationCriterionId: "criterion-b",
        minimumUnitScaled: 25,
      },
    ]);
  });

  it("uses GCD and LCM across one or several components", () => {
    expect(requiredBaseFactor({ minimumUnitScaled: 25, weight: 2 }, 3)).toBe(75n);
    expect(
      calculatePackageTick({
        components: [{ minimumUnitScaled: 25, weight: 1 }],
        totalWeight: 1,
      }).packageTick,
    ).toBe(25);
    expect(
      calculatePackageTick({
        components: [
          { minimumUnitScaled: 3, weight: 2 },
          { minimumUnitScaled: 3, weight: 3 },
          { minimumUnitScaled: 5, weight: 5 },
        ],
        totalWeight: 10,
      }).packageTick,
    ).toBe(30);
  });

  it.each([
    { components: [], totalWeight: 1 },
    { components: [{ minimumUnitScaled: 1, weight: 0 }], totalWeight: 1 },
    { components: [{ minimumUnitScaled: 1, weight: -1 }], totalWeight: 1 },
    { components: [{ minimumUnitScaled: 0, weight: 1 }], totalWeight: 1 },
    { components: [{ minimumUnitScaled: 1, weight: 1 }], totalWeight: 0 },
    { components: [{ minimumUnitScaled: 1, weight: 1 }], totalWeight: 2 },
  ])("rejects invalid weights, units, or totalWeight: %o", (input) => {
    expect(() => calculatePackageTick(input)).toThrow("INVALID_PACKAGE_TICK_INPUT");
  });

  it("uses BigInt intermediates and rejects only an unsafe final package tick", () => {
    const tick = calculatePackageTick({
      components: [
        {
          minimumUnitScaled: Number.MAX_SAFE_INTEGER,
          weight: Number.MAX_SAFE_INTEGER,
        },
      ],
      totalWeight: Number.MAX_SAFE_INTEGER,
    });
    expect(tick.packageTick).toBe(Number.MAX_SAFE_INTEGER);

    expect(() =>
      calculatePackageTick({
        components: [
          { minimumUnitScaled: Number.MAX_SAFE_INTEGER, weight: 1 },
          { minimumUnitScaled: Number.MAX_SAFE_INTEGER - 1, weight: 1 },
        ],
        totalWeight: 2,
      }),
    ).toThrow("SAFE_INTEGER_OVERFLOW");
  });

  it("expands price and quantity exactly and validates final safe integers", () => {
    const tick = calculatePackageTick({
      components: [
        { evaluationCriterionId: "a", minimumUnitScaled: 1, weight: 1 },
        { evaluationCriterionId: "b", minimumUnitScaled: 25, weight: 2 },
      ],
      totalWeight: 3,
    });
    expect(expandPackageVector(4, 3, tick).map((component) => component.amountScaled)).toEqual([
      300, 600,
    ]);
    expect(expandPackageVector(0, 1, tick).map((component) => component.amountScaled)).toEqual([
      0, 0,
    ]);
    expect(() => expandPackageVector(-1, 1, tick)).toThrow("INVALID_PACKAGE_VECTOR_INPUT");
    expect(() => expandPackageVector(1, 0, tick)).toThrow("INVALID_PACKAGE_VECTOR_INPUT");
    expect(() => expandPackageVector(Number.MAX_SAFE_INTEGER, 1_000, tick)).toThrow(
      "SAFE_INTEGER_OVERFLOW",
    );
  });

  it("converts tick counts to the scale-preserving Points price only at the boundary", () => {
    expect(toPointsPriceTicks(15, 25)).toBe(375);
    expect(toPointsPriceTicks(0, 25)).toBe(0);
    expect(() => toPointsPriceTicks(Number.MAX_SAFE_INTEGER, 2)).toThrow("SAFE_INTEGER_OVERFLOW");
    expect(() => toPointsPriceTicks(-1, 25)).toThrow("INVALID_PACKAGE_PRICE_INPUT");
  });
});
