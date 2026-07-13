import { describe, expect, it } from "vite-plus/test";

import { calculateExchangeAmounts, normalizeExchangeRate } from "./exchange-rate";

describe("directed exchange rate", () => {
  it("reduces a positive safe-integer ratio by its GCD", () => {
    expect(normalizeExchangeRate(6, 9)).toEqual({ denominator: 3, numerator: 2 });
  });

  it.each([
    [0, 1],
    [-1, 1],
    [1, 0],
    [1, -1],
    [Number.MAX_SAFE_INTEGER + 1, 1],
  ])("rejects an invalid ratio %s/%s", (numerator, denominator) => {
    expect(() => normalizeExchangeRate(numerator, denominator)).toThrow("EXCHANGE_RATE_INVALID");
  });
});

describe("exchange amount calculation", () => {
  const base = {
    denominator: 3,
    numerator: 2,
    sourceMinimumUnitScaled: 100,
    targetMinimumUnitScaled: 1_000,
  };

  it("calculates and floors a source-only amount with safe integer remainders", () => {
    expect(calculateExchangeAmounts({ ...base, sourceAmountScaled: 10_000 })).toEqual({
      minimumUnitRemainderScaled: 666,
      rateDivisionRemainder: 2,
      roundingRule: "FLOOR",
      sourceAmountScaled: 10_000,
      targetAmountScaled: 6_000,
    });
  });

  it("finds the smallest source minimum-unit amount for an exact target", () => {
    expect(calculateExchangeAmounts({ ...base, targetAmountScaled: 6_000 })).toMatchObject({
      sourceAmountScaled: 9_000,
      targetAmountScaled: 6_000,
    });
  });

  it("rejects a target amount that no source minimum-unit can produce exactly", () => {
    expect(() =>
      calculateExchangeAmounts({
        denominator: 1,
        numerator: 10,
        sourceMinimumUnitScaled: 1_000,
        targetAmountScaled: 1_000,
        targetMinimumUnitScaled: 1_000,
      }),
    ).toThrow("EXCHANGE_TARGET_NOT_EXACT");
  });

  it("requires both supplied amounts to agree with the source calculation", () => {
    expect(
      calculateExchangeAmounts({
        ...base,
        sourceAmountScaled: 9_000,
        targetAmountScaled: 6_000,
      }),
    ).toMatchObject({ sourceAmountScaled: 9_000, targetAmountScaled: 6_000 });
    expect(() =>
      calculateExchangeAmounts({
        ...base,
        sourceAmountScaled: 10_000,
        targetAmountScaled: 7_000,
      }),
    ).toThrow("EXCHANGE_AMOUNT_MISMATCH");
  });

  it("rejects zero output and unsafe persisted results", () => {
    expect(() =>
      calculateExchangeAmounts({
        ...base,
        sourceAmountScaled: 100,
      }),
    ).toThrow("EXCHANGE_TARGET_ROUNDS_TO_ZERO");
    expect(() =>
      calculateExchangeAmounts({
        denominator: 1,
        numerator: Number.MAX_SAFE_INTEGER,
        sourceAmountScaled: Number.MAX_SAFE_INTEGER,
        sourceMinimumUnitScaled: 1,
        targetMinimumUnitScaled: 1,
      }),
    ).toThrow("EXCHANGE_AMOUNT_SAFE_INTEGER_EXCEEDED");
  });
});
