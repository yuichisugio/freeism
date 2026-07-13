import { describe, expect, it } from "vite-plus/test";

import {
  calculateSubstitutionAmount,
  normalizeSimilarityFactor,
  parseEvaluationMonth,
} from "./substitution";

describe("substitution", () => {
  it("normalizes a directed similarity factor and rejects invalid values", () => {
    expect(normalizeSimilarityFactor(6, 9)).toEqual({ denominator: 3, numerator: 2 });

    for (const [numerator, denominator] of [
      [0, 1],
      [-1, 1],
      [1, 0],
      [1, -1],
      [2, 1],
      [Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 1],
    ] as Array<[number, number]>) {
      expect(() => normalizeSimilarityFactor(numerator, denominator)).toThrow(
        "SUBSTITUTION_SIMILARITY_INVALID",
      );
    }
  });

  it("calculates signed substitution amounts with BigInt intermediates and truncates toward zero", () => {
    const base = {
      exchangeDenominator: 3,
      exchangeNumerator: 2,
      similarityDenominator: 2,
      similarityNumerator: 1,
      targetMinimumUnitScaled: 10_000,
    };

    expect(calculateSubstitutionAmount({ ...base, sourceTotalScaled: 100_000 })).toBe(30_000);
    expect(calculateSubstitutionAmount({ ...base, sourceTotalScaled: -50_000 })).toBe(-10_000);
    expect(calculateSubstitutionAmount({ ...base, sourceTotalScaled: 0 })).toBe(0);

    expect(
      calculateSubstitutionAmount({
        exchangeDenominator: 1,
        exchangeNumerator: Number.MAX_SAFE_INTEGER,
        similarityDenominator: Number.MAX_SAFE_INTEGER,
        similarityNumerator: 1,
        sourceTotalScaled: Number.MAX_SAFE_INTEGER,
        targetMinimumUnitScaled: 1,
      }),
    ).toBe(Number.MAX_SAFE_INTEGER);

    expect(() =>
      calculateSubstitutionAmount({
        exchangeDenominator: 1,
        exchangeNumerator: 2,
        similarityDenominator: 1,
        similarityNumerator: 1,
        sourceTotalScaled: Number.MAX_SAFE_INTEGER,
        targetMinimumUnitScaled: 1,
      }),
    ).toThrow("SUBSTITUTION_AMOUNT_SAFE_INTEGER_EXCEEDED");
  });

  it("parses an ASCII evaluation month into an exact UTC half-open interval", () => {
    expect(parseEvaluationMonth("2026-07")).toEqual({
      endExclusive: "2026-08-01T00:00:00.000Z",
      startInclusive: "2026-07-01T00:00:00.000Z",
    });

    for (const value of ["２０２６-07", "2026-7", "2026-07-01", "2026-00", "2026-13"]) {
      expect(() => parseEvaluationMonth(value)).toThrow("EVALUATION_MONTH_INVALID");
    }
  });
});
