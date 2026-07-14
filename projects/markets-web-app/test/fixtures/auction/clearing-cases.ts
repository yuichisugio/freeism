import type {
  AuctionClearing,
  ClearAuctionInput,
} from "../../../src/backend/auction/domain/auction-types";

type ClearingCase = {
  expected: AuctionClearing;
  input: ClearAuctionInput;
  name: string;
};

const none = new Set<string>();

export const clearingCases: readonly ClearingCase[] = [
  {
    name: "clears at zero when every unit of demand fits",
    input: {
      excludedUserIds: none,
      positions: [
        { marketsUserId: "user-a", priceTickCount: 10, quantity: 1, reachedSequence: 1 },
        { marketsUserId: "user-b", priceTickCount: 5, quantity: 2, reachedSequence: 2 },
      ],
      saleQuantity: 3,
    },
    expected: {
      allocations: [
        {
          allocatedQuantity: 1,
          bidPriceTickCount: 10,
          marketsUserId: "user-a",
          reachedSequence: 1,
        },
        {
          allocatedQuantity: 2,
          bidPriceTickCount: 5,
          marketsUserId: "user-b",
          reachedSequence: 2,
        },
      ],
      clearingPriceTickCount: 0,
      highestLosingPriceTickCount: null,
      lowestWinningPriceTickCount: 5,
      totalAllocatedQuantity: 3,
      unallocatedQuantity: 0,
    },
  },
  {
    name: "uses reached sequence to resolve same-price demand",
    input: {
      excludedUserIds: none,
      positions: [
        { marketsUserId: "user-late", priceTickCount: 10, quantity: 2, reachedSequence: 2 },
        { marketsUserId: "user-early", priceTickCount: 10, quantity: 2, reachedSequence: 1 },
      ],
      saleQuantity: 2,
    },
    expected: {
      allocations: [
        {
          allocatedQuantity: 2,
          bidPriceTickCount: 10,
          marketsUserId: "user-early",
          reachedSequence: 1,
        },
      ],
      clearingPriceTickCount: 10,
      highestLosingPriceTickCount: 10,
      lowestWinningPriceTickCount: 10,
      totalAllocatedQuantity: 2,
      unallocatedQuantity: 0,
    },
  },
  {
    name: "adds one tick count above a lower losing price",
    input: {
      excludedUserIds: none,
      positions: [
        { marketsUserId: "user-c", priceTickCount: 5, quantity: 1, reachedSequence: 3 },
        { marketsUserId: "user-a", priceTickCount: 10, quantity: 1, reachedSequence: 1 },
        { marketsUserId: "user-b", priceTickCount: 8, quantity: 1, reachedSequence: 2 },
      ],
      saleQuantity: 2,
    },
    expected: {
      allocations: [
        {
          allocatedQuantity: 1,
          bidPriceTickCount: 10,
          marketsUserId: "user-a",
          reachedSequence: 1,
        },
        {
          allocatedQuantity: 1,
          bidPriceTickCount: 8,
          marketsUserId: "user-b",
          reachedSequence: 2,
        },
      ],
      clearingPriceTickCount: 6,
      highestLosingPriceTickCount: 5,
      lowestWinningPriceTickCount: 8,
      totalAllocatedQuantity: 2,
      unallocatedQuantity: 0,
    },
  },
  {
    name: "treats the unallocated remainder of a partial winner as losing demand",
    input: {
      excludedUserIds: none,
      positions: [
        { marketsUserId: "user-a", priceTickCount: 10, quantity: 2, reachedSequence: 1 },
        { marketsUserId: "user-b", priceTickCount: 7, quantity: 3, reachedSequence: 2 },
      ],
      saleQuantity: 3,
    },
    expected: {
      allocations: [
        {
          allocatedQuantity: 2,
          bidPriceTickCount: 10,
          marketsUserId: "user-a",
          reachedSequence: 1,
        },
        {
          allocatedQuantity: 1,
          bidPriceTickCount: 7,
          marketsUserId: "user-b",
          reachedSequence: 2,
        },
      ],
      clearingPriceTickCount: 7,
      highestLosingPriceTickCount: 7,
      lowestWinningPriceTickCount: 7,
      totalAllocatedQuantity: 3,
      unallocatedQuantity: 0,
    },
  },
  {
    name: "removes excluded users before allocation and price derivation",
    input: {
      excludedUserIds: new Set(["user-excluded"]),
      positions: [
        {
          marketsUserId: "user-excluded",
          priceTickCount: 100,
          quantity: 2,
          reachedSequence: 1,
        },
        { marketsUserId: "user-b", priceTickCount: 3, quantity: 2, reachedSequence: 2 },
      ],
      saleQuantity: 2,
    },
    expected: {
      allocations: [
        {
          allocatedQuantity: 2,
          bidPriceTickCount: 3,
          marketsUserId: "user-b",
          reachedSequence: 2,
        },
      ],
      clearingPriceTickCount: 0,
      highestLosingPriceTickCount: null,
      lowestWinningPriceTickCount: 3,
      totalAllocatedQuantity: 2,
      unallocatedQuantity: 0,
    },
  },
  {
    name: "reports unsold supply without inventing losing demand",
    input: {
      excludedUserIds: none,
      positions: [{ marketsUserId: "user-a", priceTickCount: 4, quantity: 2, reachedSequence: 1 }],
      saleQuantity: 5,
    },
    expected: {
      allocations: [
        {
          allocatedQuantity: 2,
          bidPriceTickCount: 4,
          marketsUserId: "user-a",
          reachedSequence: 1,
        },
      ],
      clearingPriceTickCount: 0,
      highestLosingPriceTickCount: null,
      lowestWinningPriceTickCount: 4,
      totalAllocatedQuantity: 2,
      unallocatedQuantity: 3,
    },
  },
];
