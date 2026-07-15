export interface ExtensionRule {
  durationSeconds: number;
  maxExtensions: number;
  thresholdSeconds: number;
}

export interface ApplyExtensionInput {
  acceptedPublicPriceUpdate: boolean;
  commandAuctionRevision: number;
  currentAuctionRevision: number;
  currentExtensionCount: number;
  endAtMs: number;
  nowMs: number;
  rule: ExtensionRule | null;
}

export interface ExtensionDecision {
  endAtMs: number;
  extended: boolean;
  extensionCount: number;
}

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function nonNegativeSafe(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function positiveSafe(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function applyExtensionRule(input: ApplyExtensionInput): ExtensionDecision {
  if (
    !positiveSafe(input.commandAuctionRevision) ||
    !positiveSafe(input.currentAuctionRevision) ||
    !nonNegativeSafe(input.currentExtensionCount) ||
    !nonNegativeSafe(input.endAtMs) ||
    !nonNegativeSafe(input.nowMs) ||
    (input.rule !== null &&
      (!positiveSafe(input.rule.durationSeconds) ||
        !positiveSafe(input.rule.maxExtensions) ||
        !nonNegativeSafe(input.rule.thresholdSeconds) ||
        input.currentExtensionCount > input.rule.maxExtensions))
  ) {
    throw new Error("INVALID_EXTENSION_INPUT");
  }

  const unchanged: ExtensionDecision = {
    endAtMs: input.endAtMs,
    extended: false,
    extensionCount: input.currentExtensionCount,
  };
  if (
    input.rule === null ||
    !input.acceptedPublicPriceUpdate ||
    input.commandAuctionRevision !== input.currentAuctionRevision ||
    input.nowMs >= input.endAtMs ||
    input.currentExtensionCount >= input.rule.maxExtensions
  ) {
    return unchanged;
  }

  const thresholdMs = BigInt(input.rule.thresholdSeconds) * 1_000n;
  const remainingMs = BigInt(input.endAtMs) - BigInt(input.nowMs);
  if (remainingMs > thresholdMs) return unchanged;

  const nextEndAtMs = BigInt(input.endAtMs) + BigInt(input.rule.durationSeconds) * 1_000n;
  if (nextEndAtMs > MAX_SAFE_BIGINT) throw new Error("INVALID_EXTENSION_INPUT");
  return {
    endAtMs: Number(nextEndAtMs),
    extended: true,
    extensionCount: input.currentExtensionCount + 1,
  };
}
