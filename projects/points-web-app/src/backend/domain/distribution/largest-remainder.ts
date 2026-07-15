const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function positiveSafe(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function calculateRetentionAmounts(input: {
  minimumUnitScaled: number;
  retentionAmountScaled?: number;
  retentionRatePpm?: number;
  sourceAmountScaled: number;
}) {
  if (!positiveSafe(input.minimumUnitScaled) || !positiveSafe(input.sourceAmountScaled)) {
    throw new RangeError("AUTO_DISTRIBUTION_RETENTION_INVALID");
  }
  const hasRate = input.retentionRatePpm !== undefined;
  const hasFixed = input.retentionAmountScaled !== undefined;
  if (hasRate === hasFixed) throw new RangeError("AUTO_DISTRIBUTION_RETENTION_INVALID");

  const amount = BigInt(input.sourceAmountScaled);
  const unit = BigInt(input.minimumUnitScaled);
  let retained: bigint;
  if (hasRate) {
    if (
      !Number.isSafeInteger(input.retentionRatePpm) ||
      input.retentionRatePpm! < 10 ||
      input.retentionRatePpm! > 1_000_000
    ) {
      throw new RangeError("AUTO_DISTRIBUTION_RETENTION_INVALID");
    }
    retained = ((amount * BigInt(input.retentionRatePpm!)) / 1_000_000n / unit) * unit;
  } else {
    if (!Number.isSafeInteger(input.retentionAmountScaled) || input.retentionAmountScaled! < 0) {
      throw new RangeError("AUTO_DISTRIBUTION_RETENTION_INVALID");
    }
    const fixed = BigInt(input.retentionAmountScaled!);
    retained = ((fixed < amount ? fixed : amount) / unit) * unit;
  }
  return {
    distributionAmountScaled: Number(amount - retained),
    retainedAmountScaled: Number(retained),
  };
}

export function calculateEffectiveDistributionAmounts(input: {
  minimumUnitScaled: number;
  retentionAmountScaled?: number;
  retentionRatePpm?: number;
  sourceAmountScaled: number;
  targetCount: number;
}) {
  assertDistributionTargetLimit(input.targetCount);
  const amounts = calculateRetentionAmounts(input);
  if (input.targetCount === 0) {
    return {
      distributionAmountScaled: 0,
      retainedAmountScaled: input.sourceAmountScaled,
    };
  }
  return amounts;
}

export interface DistributionCandidateInput {
  components: Array<{
    evaluationCriterionId?: string;
    evaluationCriterionRevisionId?: string;
    evaluationTotalScaled: number;
    weight: number;
  }>;
  pointsUserId: string;
}

export function assertDistributionTargetLimit(targetCount: number): void {
  if (!Number.isSafeInteger(targetCount) || targetCount < 0 || targetCount > 1_000) {
    throw new RangeError("AUTO_DISTRIBUTION_TARGET_LIMIT_EXCEEDED");
  }
}

export function buildEligibleDistributionCandidates(input: {
  candidates: DistributionCandidateInput[];
  sourcePointsUserId: string;
}) {
  const result: Array<{ pointsUserId: string; score: number }> = [];
  for (const candidate of input.candidates) {
    if (candidate.pointsUserId === input.sourcePointsUserId) continue;
    let score = 0n;
    for (const component of candidate.components) {
      if (
        !Number.isSafeInteger(component.evaluationTotalScaled) ||
        !Number.isSafeInteger(component.weight)
      ) {
        throw new RangeError("AUTO_DISTRIBUTION_SCORE_SAFE_INTEGER_EXCEEDED");
      }
      if (component.evaluationTotalScaled > 0 && component.weight > 0) {
        score += BigInt(component.evaluationTotalScaled) * BigInt(component.weight);
      }
    }
    if (score > MAX_SAFE) {
      throw new RangeError("AUTO_DISTRIBUTION_SCORE_SAFE_INTEGER_EXCEEDED");
    }
    if (score > 0n) result.push({ pointsUserId: candidate.pointsUserId, score: Number(score) });
  }
  return result.sort((left, right) => left.pointsUserId.localeCompare(right.pointsUserId));
}

export function allocateByLargestRemainder(input: {
  candidates: Array<{ pointsUserId: string; score: number }>;
  distributionAmountScaled: number;
  minimumUnitScaled: number;
}) {
  return allocateByLargestRemainderDetailed(input)
    .filter((row) => row.amountScaled > 0)
    .map(({ amountScaled, pointsUserId }) => ({ amountScaled, pointsUserId }));
}

export function allocateByLargestRemainderDetailed(input: {
  candidates: Array<{ pointsUserId: string; score: number }>;
  distributionAmountScaled: number;
  minimumUnitScaled: number;
}) {
  if (
    !Number.isSafeInteger(input.distributionAmountScaled) ||
    input.distributionAmountScaled < 0 ||
    !positiveSafe(input.minimumUnitScaled) ||
    input.distributionAmountScaled % input.minimumUnitScaled !== 0
  ) {
    throw new RangeError("AUTO_DISTRIBUTION_AMOUNT_INVALID");
  }
  const positive = input.candidates
    .filter((candidate) => positiveSafe(candidate.score))
    .sort((left, right) => left.pointsUserId.localeCompare(right.pointsUserId));
  if (positive.length === 0 || input.distributionAmountScaled === 0) return [];
  const totalScore = positive.reduce((sum, candidate) => sum + BigInt(candidate.score), 0n);
  const unitCount = BigInt(input.distributionAmountScaled / input.minimumUnitScaled);
  const rows = positive.map((candidate) => {
    const product = unitCount * BigInt(candidate.score);
    return {
      baseQuotientUnits: product / totalScore,
      pointsUserId: candidate.pointsUserId,
      quotient: product / totalScore,
      remainder: product % totalScore,
      score: candidate.score,
      tieBreakOrder: 0,
    };
  });
  let remaining = unitCount - rows.reduce((sum, row) => sum + row.quotient, 0n);
  for (const [tieBreakOrder, row] of [...rows]
    .sort((left, right) => {
      if (left.remainder === right.remainder)
        return left.pointsUserId.localeCompare(right.pointsUserId);
      return left.remainder > right.remainder ? -1 : 1;
    })
    .entries()) {
    row.tieBreakOrder = tieBreakOrder;
    if (remaining > 0n) {
      row.quotient += 1n;
      remaining -= 1n;
    }
  }
  return rows
    .sort((left, right) => left.pointsUserId.localeCompare(right.pointsUserId))
    .map((row) => ({
      amountScaled: Number(row.quotient * BigInt(input.minimumUnitScaled)),
      baseQuotientUnits: row.baseQuotientUnits.toString(),
      finalUnitCount: row.quotient.toString(),
      pointsUserId: row.pointsUserId,
      remainder: row.remainder.toString(),
      score: row.score,
      tieBreakOrder: row.tieBreakOrder,
    }));
}
