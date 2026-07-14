import type { AuctionAllocation, AuctionClearing, ClearAuctionInput } from "./auction-types";
import { rankBidPositions } from "./rank-bids";

function assertSaleQuantity(saleQuantity: number): void {
  if (!Number.isSafeInteger(saleQuantity) || saleQuantity < 1 || saleQuantity > 1_000) {
    throw new Error("INVALID_AUCTION_CLEARING_INPUT");
  }
}

function deriveClearingPrice(
  highestLosingPriceTickCount: number | null,
  lowestWinningPriceTickCount: number | null,
): number {
  if (highestLosingPriceTickCount === null) return 0;
  if (lowestWinningPriceTickCount === null) {
    throw new Error("INVALID_AUCTION_CLEARING_INPUT");
  }
  if (highestLosingPriceTickCount === lowestWinningPriceTickCount) {
    return highestLosingPriceTickCount;
  }
  if (highestLosingPriceTickCount > lowestWinningPriceTickCount) {
    throw new Error("INVALID_AUCTION_CLEARING_INPUT");
  }

  const price = highestLosingPriceTickCount + 1;
  if (!Number.isSafeInteger(price) || price > lowestWinningPriceTickCount) {
    throw new Error("INVALID_AUCTION_CLEARING_INPUT");
  }
  return price;
}

export function clearAuction(input: ClearAuctionInput): AuctionClearing {
  assertSaleQuantity(input.saleQuantity);
  const ranked = rankBidPositions(input.positions).filter(
    (position) => !input.excludedUserIds.has(position.marketsUserId),
  );
  const allocations: AuctionAllocation[] = [];
  let remainingQuantity = input.saleQuantity;
  let highestLosingPriceTickCount: number | null = null;

  for (const position of ranked) {
    if (remainingQuantity === 0) {
      highestLosingPriceTickCount ??= position.priceTickCount;
      continue;
    }

    const allocatedQuantity = Math.min(position.quantity, remainingQuantity);
    allocations.push({
      allocatedQuantity,
      bidPriceTickCount: position.priceTickCount,
      marketsUserId: position.marketsUserId,
      reachedSequence: position.reachedSequence,
    });
    remainingQuantity -= allocatedQuantity;
    if (allocatedQuantity < position.quantity) {
      highestLosingPriceTickCount ??= position.priceTickCount;
    }
  }

  const lowestWinningPriceTickCount = allocations.at(-1)?.bidPriceTickCount ?? null;
  const totalAllocatedQuantity = input.saleQuantity - remainingQuantity;
  return {
    allocations,
    clearingPriceTickCount: deriveClearingPrice(
      highestLosingPriceTickCount,
      lowestWinningPriceTickCount,
    ),
    highestLosingPriceTickCount,
    lowestWinningPriceTickCount,
    totalAllocatedQuantity,
    unallocatedQuantity: remainingQuantity,
  };
}
