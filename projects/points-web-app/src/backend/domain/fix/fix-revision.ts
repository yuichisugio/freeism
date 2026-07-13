export interface FixRevisionValue {
  amountScaled: number;
  evaluationCriterionId: string;
  pointsUserId: string | null;
  recipientKey: string;
}

export interface FixRevisionDelta extends FixRevisionValue {
  deltaAmountScaled: number;
}

function keyOf(value: FixRevisionValue): string {
  return `${value.recipientKey}\u0000${value.evaluationCriterionId}`;
}

export function computeFixRevisionDeltas(
  previous: readonly FixRevisionValue[],
  next: readonly FixRevisionValue[],
): FixRevisionDelta[] {
  const previousByKey = new Map(previous.map((value) => [keyOf(value), value]));
  const nextByKey = new Map(next.map((value) => [keyOf(value), value]));
  const keys = [...new Set([...previousByKey.keys(), ...nextByKey.keys()])].sort();
  const deltas: FixRevisionDelta[] = [];
  for (const key of keys) {
    const before = previousByKey.get(key);
    const after = nextByKey.get(key);
    const deltaAmountScaled = (after?.amountScaled ?? 0) - (before?.amountScaled ?? 0);
    if (deltaAmountScaled === 0) continue;
    const value = after ?? before!;
    deltas.push({ ...value, deltaAmountScaled });
  }
  return deltas;
}
