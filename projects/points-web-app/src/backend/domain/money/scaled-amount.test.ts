import { describe, expect, it } from "vite-plus/test";

import { POINT_SCALE, scaledAmountCodec } from "./scaled-amount";

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

function toSafeNumber(value: bigint): number {
  expect(value).toBeGreaterThanOrEqual(MIN_SAFE_INTEGER_BIGINT);
  expect(value).toBeLessThanOrEqual(MAX_SAFE_INTEGER_BIGINT);
  return Number(value);
}

function expectedRoundedResult(
  amountScaled: number,
  numerator: number,
  denominator: number,
  rounding: "FLOOR" | "CEILING" | "HALF_UP",
): number {
  const product = BigInt(amountScaled) * BigInt(numerator);
  const divisor = BigInt(denominator);
  const quotient = product / divisor;
  const remainder = product % divisor;

  if (remainder === 0n) {
    return toSafeNumber(quotient);
  }

  if (rounding === "FLOOR") {
    return toSafeNumber(product < 0n ? quotient - 1n : quotient);
  }

  if (rounding === "CEILING") {
    return toSafeNumber(product > 0n ? quotient + 1n : quotient);
  }

  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const adjustment = absoluteRemainder * 2n >= divisor ? (product < 0n ? -1n : 1n) : 0n;
  return toSafeNumber(quotient + adjustment);
}

describe("scaledAmountCodec", () => {
  describe("parse and format", () => {
    it.each([
      ["0.0001", 1, "0.0001"],
      ["1", POINT_SCALE, "1"],
      ["-1.2500", -12_500, "-1.25"],
      ["0", 0, "0"],
    ] as const)("round-trips %s as its canonical decimal", (input, scaled, canonical) => {
      expect(scaledAmountCodec.parse(input)).toBe(scaled);
      expect(scaledAmountCodec.format(scaled)).toBe(canonical);
    });

    it.each(["0.00001", "1e4", "−1", "NaN", "Infinity", "01", "-01", "+1", ".1", "1.", " 1"])(
      "rejects input outside the exact decimal grammar: %s",
      (input) => {
        expect(() => scaledAmountCodec.parse(input)).toThrow();
      },
    );

    it("accepts only values whose scaled result is a safe integer", () => {
      expect(scaledAmountCodec.parse("900719925474.0991")).toBe(Number.MAX_SAFE_INTEGER);
      expect(scaledAmountCodec.parse("-900719925474.0991")).toBe(Number.MIN_SAFE_INTEGER);
      expect(() => scaledAmountCodec.parse("900719925474.0992")).toThrow();
      expect(() => scaledAmountCodec.parse("-900719925474.0992")).toThrow();
    });

    it("formats safe integers canonically at the safe-integer boundaries", () => {
      expect(scaledAmountCodec.format(Number.MAX_SAFE_INTEGER)).toBe("900719925474.0991");
      expect(scaledAmountCodec.format(Number.MIN_SAFE_INTEGER)).toBe("-900719925474.0991");
      expect(scaledAmountCodec.format(-0)).toBe("0");
    });

    it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
      "rejects a non-safe scaled value when formatting: %s",
      (amountScaled) => {
        expect(() => scaledAmountCodec.format(amountScaled)).toThrow();
      },
    );
  });

  describe("assertMultiple", () => {
    it.each([0, 6, -6, 12, -12])(
      "accepts %i as a multiple of a positive minimum unit",
      (amountScaled) => {
        expect(() => scaledAmountCodec.assertMultiple(amountScaled, 3)).not.toThrow();
      },
    );

    it.each([1, -1, 5, -5])("rejects %i when it is not a minimum-unit multiple", (amountScaled) => {
      expect(() => scaledAmountCodec.assertMultiple(amountScaled, 3)).toThrow();
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
      "rejects a minimum unit that is not a positive safe integer: %s",
      (minimumUnitScaled) => {
        expect(() => scaledAmountCodec.assertMultiple(10, minimumUnitScaled)).toThrow();
      },
    );

    it("rejects a non-safe amount", () => {
      expect(() => scaledAmountCodec.assertMultiple(Number.MAX_SAFE_INTEGER + 1, 1)).toThrow();
    });
  });

  describe("multiplyDivide", () => {
    it("uses a BigInt intermediate without overflowing a safe final result", () => {
      expect(
        scaledAmountCodec.multiplyDivide(
          Number.MAX_SAFE_INTEGER,
          Number.MAX_SAFE_INTEGER,
          Number.MAX_SAFE_INTEGER,
          "FLOOR",
        ),
      ).toBe(Number.MAX_SAFE_INTEGER);
    });

    it.each([
      [5, 1, 2, "FLOOR", 2],
      [-5, 1, 2, "FLOOR", -3],
      [5, 1, 2, "CEILING", 3],
      [-5, 1, 2, "CEILING", -2],
      [5, 1, 2, "HALF_UP", 3],
      [-5, 1, 2, "HALF_UP", -3],
      [4, 1, 3, "HALF_UP", 1],
      [-4, 1, 3, "HALF_UP", -1],
    ] as const)(
      "%s * %s / %s with %s rounds to %s",
      (amountScaled, numerator, denominator, rounding, expected) => {
        expect(
          scaledAmountCodec.multiplyDivide(amountScaled, numerator, denominator, rounding),
        ).toBe(expected);
      },
    );

    it.each([
      [1.5, 1, 1],
      [1, 1.5, 1],
      [1, 1, 1.5],
      [Number.NaN, 1, 1],
      [1, Number.POSITIVE_INFINITY, 1],
      [1, 1, Number.MAX_SAFE_INTEGER + 1],
      [1, 1, 0],
      [1, 1, -1],
    ])(
      "rejects unsafe integers or a non-positive denominator: %s, %s, %s",
      (amount, numerator, denominator) => {
        expect(() =>
          scaledAmountCodec.multiplyDivide(amount, numerator, denominator, "FLOOR"),
        ).toThrow();
      },
    );

    it("rejects a rounded result outside the safe-integer range", () => {
      expect(() =>
        scaledAmountCodec.multiplyDivide(
          Number.MAX_SAFE_INTEGER,
          Number.MAX_SAFE_INTEGER,
          1,
          "FLOOR",
        ),
      ).toThrow();
    });

    it("matches exact BigInt rounding for 10,000 deterministic inputs", () => {
      const roundings = ["FLOOR", "CEILING", "HALF_UP"] as const;

      for (let index = 0; index < 10_000; index += 1) {
        const magnitude = (index * 7_919) % 20_001;
        const amountScaled = index % 2 === 0 ? magnitude : -magnitude;
        const numeratorMagnitude = (index * 104_729) % 9_973;
        const numerator = index % 3 === 0 ? -numeratorMagnitude : numeratorMagnitude;
        const denominator = ((index * 65_537) % 9_971) + 1;

        for (const rounding of roundings) {
          expect(
            scaledAmountCodec.multiplyDivide(amountScaled, numerator, denominator, rounding),
          ).toBe(expectedRoundedResult(amountScaled, numerator, denominator, rounding));
        }
      }
    });
  });
});
