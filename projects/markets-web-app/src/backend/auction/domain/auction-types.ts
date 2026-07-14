export interface BidPosition {
  marketsUserId: string;
  priceTickCount: number;
  quantity: number;
  reachedSequence: number;
}

export interface ClearAuctionInput {
  excludedUserIds: ReadonlySet<string>;
  positions: readonly BidPosition[];
  saleQuantity: number;
}

export interface AuctionAllocation {
  allocatedQuantity: number;
  bidPriceTickCount: number;
  marketsUserId: string;
  reachedSequence: number;
}

export interface AuctionClearing {
  allocations: readonly AuctionAllocation[];
  clearingPriceTickCount: number;
  highestLosingPriceTickCount: number | null;
  lowestWinningPriceTickCount: number | null;
  totalAllocatedQuantity: number;
  unallocatedQuantity: number;
}
