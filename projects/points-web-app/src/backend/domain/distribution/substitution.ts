const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

function assertPositiveSafe(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError("SUBSTITUTION_SIMILARITY_INVALID");
  }
}

function gcd(left: number, right: number): number {
  let a = BigInt(left);
  let b = BigInt(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return Number(a);
}

export function normalizeSimilarityFactor(numerator: number, denominator: number) {
  assertPositiveSafe(numerator);
  assertPositiveSafe(denominator);
  if (numerator > denominator) {
    throw new RangeError("SUBSTITUTION_SIMILARITY_INVALID");
  }
  const divisor = gcd(numerator, denominator);
  return { denominator: denominator / divisor, numerator: numerator / divisor };
}

export function calculateSubstitutionAmount(input: {
  exchangeDenominator: number;
  exchangeNumerator: number;
  similarityDenominator: number;
  similarityNumerator: number;
  sourceTotalScaled: number;
  targetMinimumUnitScaled: number;
}): number {
  for (const value of [
    input.exchangeDenominator,
    input.exchangeNumerator,
    input.similarityDenominator,
    input.similarityNumerator,
    input.targetMinimumUnitScaled,
  ]) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError("SUBSTITUTION_FACTOR_INVALID");
    }
  }
  if (!Number.isSafeInteger(input.sourceTotalScaled)) {
    throw new RangeError("SUBSTITUTION_AMOUNT_SAFE_INTEGER_EXCEEDED");
  }
  const numerator =
    BigInt(input.sourceTotalScaled) *
    BigInt(input.similarityNumerator) *
    BigInt(input.exchangeNumerator);
  const denominator = BigInt(input.similarityDenominator) * BigInt(input.exchangeDenominator);
  const unit = BigInt(input.targetMinimumUnitScaled);
  const rounded = (numerator / denominator / unit) * unit;
  if (rounded < MIN_SAFE || rounded > MAX_SAFE) {
    throw new RangeError("SUBSTITUTION_AMOUNT_SAFE_INTEGER_EXCEEDED");
  }
  return Number(rounded);
}

export function parseEvaluationMonth(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) throw new TypeError("EVALUATION_MONTH_INVALID");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  if (start.getUTCFullYear() !== year || start.getUTCMonth() !== monthIndex) {
    throw new TypeError("EVALUATION_MONTH_INVALID");
  }
  return { endExclusive: end.toISOString(), startInclusive: start.toISOString() };
}
