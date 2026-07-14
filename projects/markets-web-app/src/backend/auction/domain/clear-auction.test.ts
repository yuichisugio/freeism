import { describe, expect, it } from "vite-plus/test";

import { clearingCases } from "../../../../test/fixtures/auction/clearing-cases";
import { clearAuction } from "./clear-auction";
import { rankBidPositions } from "./rank-bids";
import type { BidPosition } from "./auction-types";

describe("uniform auction clearing", () => {
  it.each(clearingCases)("$name", ({ expected, input }) => {
    expect(clearAuction(input)).toEqual(expected);
  });

  it("is invariant to storage row order", () => {
    const positions: BidPosition[] = [
      { marketsUserId: "user-a", priceTickCount: 21, quantity: 2, reachedSequence: 4 },
      { marketsUserId: "user-b", priceTickCount: 21, quantity: 1, reachedSequence: 1 },
      { marketsUserId: "user-c", priceTickCount: 18, quantity: 3, reachedSequence: 2 },
      { marketsUserId: "user-d", priceTickCount: 7, quantity: 1, reachedSequence: 3 },
    ];
    const expected = JSON.stringify(
      clearAuction({ excludedUserIds: new Set(), positions, saleQuantity: 4 }),
    );

    let state = 7;
    for (let iteration = 0; iteration < 1_000; iteration += 1) {
      const shuffled = [...positions];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        state = (state * 48_271) % 2_147_483_647;
        const other = state % (index + 1);
        [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
      }
      expect(
        JSON.stringify(
          clearAuction({ excludedUserIds: new Set(), positions: shuffled, saleQuantity: 4 }),
        ),
      ).toBe(expected);
    }
  });

  it("orders safe-integer extremes without subtracting comparator values", () => {
    expect(
      rankBidPositions([
        {
          marketsUserId: "lowest",
          priceTickCount: 0,
          quantity: 1,
          reachedSequence: Number.MAX_SAFE_INTEGER,
        },
        {
          marketsUserId: "highest-late",
          priceTickCount: Number.MAX_SAFE_INTEGER,
          quantity: 1,
          reachedSequence: 2,
        },
        {
          marketsUserId: "highest-early",
          priceTickCount: Number.MAX_SAFE_INTEGER,
          quantity: 1,
          reachedSequence: 1,
        },
      ]).map(({ marketsUserId }) => marketsUserId),
    ).toEqual(["highest-early", "highest-late", "lowest"]);
  });

  it.each([
    ["zero sale quantity", { positions: [], saleQuantity: 0 }],
    ["sale quantity above the auction maximum", { positions: [], saleQuantity: 1_001 }],
    ["unsafe sale quantity", { positions: [], saleQuantity: Number.MAX_SAFE_INTEGER + 1 }],
    [
      "zero bid quantity",
      {
        positions: [
          { marketsUserId: "user-a", priceTickCount: 1, quantity: 0, reachedSequence: 1 },
        ],
        saleQuantity: 1,
      },
    ],
    [
      "negative price tick count",
      {
        positions: [
          { marketsUserId: "user-a", priceTickCount: -1, quantity: 1, reachedSequence: 1 },
        ],
        saleQuantity: 1,
      },
    ],
    [
      "unsafe reached sequence",
      {
        positions: [
          {
            marketsUserId: "user-a",
            priceTickCount: 1,
            quantity: 1,
            reachedSequence: Number.MAX_SAFE_INTEGER + 1,
          },
        ],
        saleQuantity: 1,
      },
    ],
  ])("rejects %s", (_name, partial) => {
    expect(() => clearAuction({ excludedUserIds: new Set(), ...partial })).toThrow(
      "INVALID_AUCTION_CLEARING_INPUT",
    );
  });

  it("rejects duplicate users before applying exclusions", () => {
    const positions: BidPosition[] = [
      { marketsUserId: "user-a", priceTickCount: 2, quantity: 1, reachedSequence: 1 },
      { marketsUserId: "user-a", priceTickCount: 1, quantity: 1, reachedSequence: 2 },
    ];

    expect(() =>
      clearAuction({
        excludedUserIds: new Set(["user-a"]),
        positions,
        saleQuantity: 1,
      }),
    ).toThrow("DUPLICATE_BID_POSITION_USER");
  });

  it("rejects duplicate reached sequences", () => {
    expect(() =>
      rankBidPositions([
        { marketsUserId: "user-a", priceTickCount: 2, quantity: 1, reachedSequence: 1 },
        { marketsUserId: "user-b", priceTickCount: 1, quantity: 1, reachedSequence: 1 },
      ]),
    ).toThrow("DUPLICATE_REACHED_SEQUENCE");
  });
});
