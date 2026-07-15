import { describe, expect, it } from "vite-plus/test";

import { buyNowCases, extensionCases } from "../../../../test/fixtures/auction/command-cases";
import { applyExtensionRule } from "./apply-extension-rule";
import { reduceAuctionCommand } from "./auction-command";
import { evaluateBuyNow } from "./evaluate-buy-now";
import { resolveAutoBids, type AutoBidPosition } from "./resolve-auto-bids";

const position: AutoBidPosition = {
  autoBidMaxTickCount: 30,
  marketsUserId: "buyer-a",
  priceTickCount: 12,
  quantity: 2,
  reachedSequence: 5,
};

describe("AutoBid resolution", () => {
  it("moves directly to the required price without exceeding the private maximum", () => {
    const result = resolveAutoBids({
      commands: [
        {
          autoBidMaxTickCount: 30,
          commandSequence: 8,
          kind: "SET_AUTO_BID",
          marketsUserId: "buyer-a",
          quantity: 2,
          reachedSequence: 6,
          requiredPriceTickCount: 20,
        },
      ],
      positions: [position],
    });

    expect(result.positions).toEqual([{ ...position, priceTickCount: 20, reachedSequence: 6 }]);
    expect(result.publicEvents).toEqual([
      {
        commandSequence: 8,
        marketsUserId: "buyer-a",
        priceChanged: true,
        priceTickCount: 20,
        quantity: 2,
        reachedSequence: 6,
        type: "BID_POSITION_UPDATED",
      },
    ]);
  });

  it("rejects a lower current price or a price above the AutoBid maximum", () => {
    const command = {
      autoBidMaxTickCount: 30,
      commandSequence: 8,
      kind: "SET_AUTO_BID" as const,
      marketsUserId: "buyer-a",
      quantity: 2,
      reachedSequence: 6,
      requiredPriceTickCount: 11,
    };
    expect(() => resolveAutoBids({ commands: [command], positions: [position] })).toThrow(
      "AUTO_BID_PRICE_DECREASED",
    );
    expect(() =>
      resolveAutoBids({
        commands: [{ ...command, requiredPriceTickCount: 31 }],
        positions: [position],
      }),
    ).toThrow("AUTO_BID_MAX_EXCEEDED");
  });

  it("raises a private maximum without emitting an unchanged public position", () => {
    const result = resolveAutoBids({
      commands: [
        {
          autoBidMaxTickCount: 40,
          commandSequence: 8,
          kind: "SET_AUTO_BID",
          marketsUserId: "buyer-a",
          quantity: 2,
          reachedSequence: 6,
          requiredPriceTickCount: 12,
        },
      ],
      positions: [position],
    });

    expect(result.positions).toEqual([{ ...position, autoBidMaxTickCount: 40 }]);
    expect(result.publicEvents).toEqual([]);
  });

  it("cancels only future AutoBid raises and preserves the reached position", () => {
    const result = resolveAutoBids({
      commands: [
        {
          commandSequence: 8,
          kind: "CANCEL_AUTO_BID",
          marketsUserId: "buyer-a",
        },
      ],
      positions: [position],
    });

    expect(result.positions).toEqual([{ ...position, autoBidMaxTickCount: null }]);
    expect(result.publicEvents).toEqual([]);
  });

  it("processes commands by server sequence, independent of input order", () => {
    const commands = [
      {
        commandSequence: 12,
        kind: "CANCEL_AUTO_BID" as const,
        marketsUserId: "buyer-a",
      },
      {
        autoBidMaxTickCount: 40,
        commandSequence: 11,
        kind: "SET_AUTO_BID" as const,
        marketsUserId: "buyer-a",
        quantity: 2,
        reachedSequence: 6,
        requiredPriceTickCount: 20,
      },
    ];

    expect(resolveAutoBids({ commands, positions: [position] })).toEqual(
      resolveAutoBids({ commands: [...commands].reverse(), positions: [position] }),
    );
    expect(resolveAutoBids({ commands, positions: [position] }).positions).toEqual([
      {
        ...position,
        autoBidMaxTickCount: null,
        priceTickCount: 20,
        reachedSequence: 6,
      },
    ]);
  });

  it("never includes an AutoBid maximum in a public event", () => {
    const result = resolveAutoBids({
      commands: [
        {
          autoBidMaxTickCount: 40,
          commandSequence: 8,
          kind: "SET_AUTO_BID",
          marketsUserId: "buyer-a",
          quantity: 3,
          reachedSequence: 6,
          requiredPriceTickCount: 20,
        },
      ],
      positions: [position],
    });

    expect(JSON.stringify(result.publicEvents)).not.toContain("autoBidMax");
    expect(Object.keys(result.publicEvents[0] ?? {})).not.toContain("autoBidMaxTickCount");
  });
});

describe("buy now", () => {
  it.each(buyNowCases)("$name", ({ expected, input }) => {
    expect(evaluateBuyNow(input)).toEqual(expected);
  });

  it("rejects a zero buy-now price tick count", () => {
    expect(() =>
      evaluateBuyNow({
        ...buyNowCases[0]!.input,
        buyNowPriceTickCount: 0,
      }),
    ).toThrow("INVALID_BUY_NOW_INPUT");
  });
});

describe("Auction extension", () => {
  it.each(extensionCases)("$name", ({ expected, input }) => {
    expect(applyExtensionRule(input)).toEqual(expected);
  });
});

describe("Auction command reducer", () => {
  it("extends only when an accepted AutoBid command updates the public price", () => {
    const result = reduceAuctionCommand({
      command: {
        autoBidMaxTickCount: 30,
        commandSequence: 8,
        kind: "SET_AUTO_BID",
        marketsUserId: "buyer-a",
        quantity: 2,
        reachedSequence: 6,
        requiredPriceTickCount: 20,
      },
      extension: {
        commandAuctionRevision: 4,
        currentAuctionRevision: 4,
        currentExtensionCount: 0,
        endAtMs: 60_000,
        nowMs: 55_000,
        rule: { durationSeconds: 20, maxExtensions: 2, thresholdSeconds: 10 },
      },
      positions: [position],
    });

    expect(result.extension).toEqual({
      endAtMs: 80_000,
      extended: true,
      extensionCount: 1,
    });
    expect(result.publicEvents).toHaveLength(1);
    expect(JSON.stringify(result.publicEvents)).not.toContain("autoBidMax");
  });
});
