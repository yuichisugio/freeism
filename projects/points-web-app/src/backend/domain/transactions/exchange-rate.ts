const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function assertPositiveSafe(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(code);
}

function toSafeAmount(value: bigint): number {
  if (value <= 0n || value > MAX_SAFE) {
    throw new RangeError("EXCHANGE_AMOUNT_SAFE_INTEGER_EXCEEDED");
  }
  return Number(value);
}

function gcd(left: number, right: number): number {
  let a = BigInt(left);
  let b = BigInt(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return Number(a);
}

export function normalizeExchangeRate(numerator: number, denominator: number) {
  assertPositiveSafe(numerator, "EXCHANGE_RATE_INVALID");
  assertPositiveSafe(denominator, "EXCHANGE_RATE_INVALID");
  const divisor = gcd(numerator, denominator);
  return { denominator: denominator / divisor, numerator: numerator / divisor };
}

export interface ExchangeAmountInput {
  denominator: number;
  numerator: number;
  sourceAmountScaled?: number | null;
  sourceMinimumUnitScaled: number;
  targetAmountScaled?: number | null;
  targetMinimumUnitScaled: number;
}

export interface ExchangeAmountResult {
  minimumUnitRemainderScaled: number;
  rateDivisionRemainder: number;
  roundingRule: "FLOOR";
  sourceAmountScaled: number;
  targetAmountScaled: number;
}

function calculateFromSource(
  input: Omit<ExchangeAmountInput, "sourceAmountScaled" | "targetAmountScaled">,
  sourceAmountScaled: number,
): ExchangeAmountResult {
  assertPositiveSafe(sourceAmountScaled, "EXCHANGE_SOURCE_AMOUNT_INVALID");
  assertPositiveSafe(input.sourceMinimumUnitScaled, "EXCHANGE_MINIMUM_UNIT_INVALID");
  assertPositiveSafe(input.targetMinimumUnitScaled, "EXCHANGE_MINIMUM_UNIT_INVALID");
  if (sourceAmountScaled % input.sourceMinimumUnitScaled !== 0) {
    throw new RangeError("EXCHANGE_SOURCE_MINIMUM_UNIT_MISMATCH");
  }
  const rate = normalizeExchangeRate(input.numerator, input.denominator);
  const product = BigInt(sourceAmountScaled) * BigInt(rate.numerator);
  const denominator = BigInt(rate.denominator);
  const quotient = product / denominator;
  const rateDivisionRemainder = product % denominator;
  const targetUnit = BigInt(input.targetMinimumUnitScaled);
  const minimumUnitRemainder = quotient % targetUnit;
  const targetAmount = quotient - minimumUnitRemainder;
  if (targetAmount === 0n) throw new RangeError("EXCHANGE_TARGET_ROUNDS_TO_ZERO");
  return {
    minimumUnitRemainderScaled: Number(minimumUnitRemainder),
    rateDivisionRemainder: Number(rateDivisionRemainder),
    roundingRule: "FLOOR",
    sourceAmountScaled,
    targetAmountScaled: toSafeAmount(targetAmount),
  };
}

function ceilDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor - 1n) / divisor;
}

export function calculateExchangeAmounts(input: ExchangeAmountInput): ExchangeAmountResult {
  const hasSource = input.sourceAmountScaled !== undefined && input.sourceAmountScaled !== null;
  const hasTarget = input.targetAmountScaled !== undefined && input.targetAmountScaled !== null;
  if (!hasSource && !hasTarget) throw new RangeError("EXCHANGE_AMOUNT_REQUIRED");
  assertPositiveSafe(input.sourceMinimumUnitScaled, "EXCHANGE_MINIMUM_UNIT_INVALID");
  assertPositiveSafe(input.targetMinimumUnitScaled, "EXCHANGE_MINIMUM_UNIT_INVALID");
  const rate = normalizeExchangeRate(input.numerator, input.denominator);

  if (hasSource) {
    const result = calculateFromSource(input, input.sourceAmountScaled!);
    if (hasTarget) {
      assertPositiveSafe(input.targetAmountScaled!, "EXCHANGE_TARGET_AMOUNT_INVALID");
      if (
        input.targetAmountScaled! % input.targetMinimumUnitScaled !== 0 ||
        result.targetAmountScaled !== input.targetAmountScaled
      ) {
        throw new RangeError("EXCHANGE_AMOUNT_MISMATCH");
      }
    }
    return result;
  }

  const targetAmountScaled = input.targetAmountScaled!;
  assertPositiveSafe(targetAmountScaled, "EXCHANGE_TARGET_AMOUNT_INVALID");
  if (targetAmountScaled % input.targetMinimumUnitScaled !== 0) {
    throw new RangeError("EXCHANGE_TARGET_MINIMUM_UNIT_MISMATCH");
  }
  const sourceUnit = BigInt(input.sourceMinimumUnitScaled);
  const requiredSourceUnits = ceilDiv(
    BigInt(targetAmountScaled) * BigInt(rate.denominator),
    BigInt(rate.numerator) * sourceUnit,
  );
  const sourceAmountScaled = toSafeAmount(requiredSourceUnits * sourceUnit);
  const result = calculateFromSource(input, sourceAmountScaled);
  if (result.targetAmountScaled !== targetAmountScaled) {
    throw new RangeError("EXCHANGE_TARGET_NOT_EXACT");
  }
  return result;
}
