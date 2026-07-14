export function evaluationAtMilliseconds(value: string): number {
  const normalized =
    value.length === 7
      ? `${value}-01T00:00:00Z`
      : value.length === 10
        ? `${value}T00:00:00Z`
        : value;
  const milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds)) throw new Error("EVALUATION_AT_INVALID");
  return milliseconds;
}

export function isEligibleForOwnershipEpoch(input: {
  effectiveAt: number;
  evaluationAt: string;
  identityType: "GITHUB_OAUTH" | "WEB_URL";
  priorEpochCount: number;
}): boolean {
  if (input.identityType === "GITHUB_OAUTH" || input.priorEpochCount === 0) return true;
  return evaluationAtMilliseconds(input.evaluationAt) >= input.effectiveAt;
}
