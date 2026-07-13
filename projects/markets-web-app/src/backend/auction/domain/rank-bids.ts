import type { BidPosition } from "./auction-types";

function compareSafeInteger(left: number, right: number): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertBidPositions(positions: readonly BidPosition[]): void {
  const marketsUserIds = new Set<string>();
  const reachedSequences = new Set<number>();

  for (const position of positions) {
    if (
      position.marketsUserId.length === 0 ||
      !Number.isSafeInteger(position.quantity) ||
      position.quantity < 1 ||
      position.quantity > 1_000 ||
      !Number.isSafeInteger(position.priceTickCount) ||
      position.priceTickCount < 0 ||
      !Number.isSafeInteger(position.reachedSequence) ||
      position.reachedSequence < 1
    ) {
      throw new Error("INVALID_AUCTION_CLEARING_INPUT");
    }
    if (marketsUserIds.has(position.marketsUserId)) {
      throw new Error("DUPLICATE_BID_POSITION_USER");
    }
    if (reachedSequences.has(position.reachedSequence)) {
      throw new Error("DUPLICATE_REACHED_SEQUENCE");
    }
    marketsUserIds.add(position.marketsUserId);
    reachedSequences.add(position.reachedSequence);
  }
}

export function rankBidPositions(positions: readonly BidPosition[]): readonly BidPosition[] {
  assertBidPositions(positions);
  return [...positions].sort((left, right) => {
    const priceOrder = compareSafeInteger(right.priceTickCount, left.priceTickCount);
    return priceOrder === 0
      ? compareSafeInteger(left.reachedSequence, right.reachedSequence)
      : priceOrder;
  });
}
