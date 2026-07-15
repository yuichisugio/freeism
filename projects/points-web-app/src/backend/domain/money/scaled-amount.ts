export const POINT_SCALE = 10_000;

export interface ScaledAmountCodec {
  parse(input: string): number;
  format(amountScaled: number): string;
  assertMultiple(amountScaled: number, minimumUnitScaled: number): void;
  multiplyDivide(
    amountScaled: number,
    numerator: number,
    denominator: number,
    rounding: "FLOOR" | "CEILING" | "HALF_UP",
  ): number;
}

const POINT_SCALE_BIGINT = BigInt(POINT_SCALE);
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);
const AMOUNT_TEXT_PATTERN = /^-?(0|[1-9][0-9]*)(\.[0-9]{1,4})?$/;

function assertSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer`);
  }
}

function toSafeNumber(value: bigint): number {
  if (value < MIN_SAFE_INTEGER_BIGINT || value > MAX_SAFE_INTEGER_BIGINT) {
    throw new RangeError("scaled amount exceeds the safe integer range");
  }

  return Number(value);
}

export const scaledAmountCodec: ScaledAmountCodec = {
  parse(input) {
    if (!AMOUNT_TEXT_PATTERN.test(input)) {
      throw new TypeError("amount must use the canonical ASCII decimal grammar");
    }

    const isNegative = input.startsWith("-");
    const unsignedInput = isNegative ? input.slice(1) : input;
    const [integerPart = "", fractionalPart = ""] = unsignedInput.split(".");
    const paddedFractionalPart = fractionalPart.padEnd(4, "0");
    const absoluteScaled =
      BigInt(integerPart) * POINT_SCALE_BIGINT + BigInt(paddedFractionalPart || "0");
    const scaled = isNegative ? -absoluteScaled : absoluteScaled;

    return toSafeNumber(scaled);
  },

  format(amountScaled) {
    assertSafeInteger(amountScaled, "amountScaled");

    const scaled = BigInt(amountScaled);
    const isNegative = scaled < 0n;
    const absoluteScaled = isNegative ? -scaled : scaled;
    const integerPart = absoluteScaled / POINT_SCALE_BIGINT;
    const fractionalPart = absoluteScaled % POINT_SCALE_BIGINT;

    if (fractionalPart === 0n) {
      return `${isNegative ? "-" : ""}${integerPart}`;
    }

    const canonicalFraction = fractionalPart.toString().padStart(4, "0").replace(/0+$/, "");
    return `${isNegative ? "-" : ""}${integerPart}.${canonicalFraction}`;
  },

  assertMultiple(amountScaled, minimumUnitScaled) {
    assertSafeInteger(amountScaled, "amountScaled");
    assertSafeInteger(minimumUnitScaled, "minimumUnitScaled");
    if (minimumUnitScaled <= 0) {
      throw new RangeError("minimumUnitScaled must be positive");
    }
    if (BigInt(amountScaled) % BigInt(minimumUnitScaled) !== 0n) {
      throw new RangeError("amountScaled must be a multiple of minimumUnitScaled");
    }
  },

  multiplyDivide(amountScaled, numerator, denominator, rounding) {
    assertSafeInteger(amountScaled, "amountScaled");
    assertSafeInteger(numerator, "numerator");
    assertSafeInteger(denominator, "denominator");
    if (denominator <= 0) {
      throw new RangeError("denominator must be positive");
    }

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

    if (rounding === "HALF_UP") {
      const absoluteRemainder = remainder < 0n ? -remainder : remainder;
      const adjustment = absoluteRemainder * 2n >= divisor ? (product < 0n ? -1n : 1n) : 0n;
      return toSafeNumber(quotient + adjustment);
    }

    throw new TypeError("unsupported rounding mode");
  },
};
