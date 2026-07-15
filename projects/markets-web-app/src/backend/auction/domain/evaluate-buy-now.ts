export type BuyNowRejectionCode =
  | "AUCTION_NOT_OPEN"
  | "BUY_NOW_QUANTITY_UNAVAILABLE"
  | "BUY_NOW_UNAVAILABLE"
  | "SELLER_CANNOT_BUY_NOW";

export interface EvaluateBuyNowInput {
  allComponentsBuyNowEnabled: boolean;
  availableQuantity: number;
  buyerMarketsUserId: string;
  buyNowPriceTickCount: number | null;
  commandSequence: number;
  endAtMs: number;
  nowMs: number;
  requestedQuantity: number;
  sellerMarketsUserId: string;
  status: string;
}

export type BuyNowDecision =
  | {
      accepted: true;
      hold: {
        buyerMarketsUserId: string;
        commandSequence: number;
        priceTickCount: number;
        quantity: number;
      };
    }
  | { accepted: false; code: BuyNowRejectionCode };

function isSafeIntegerInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

export function evaluateBuyNow(input: EvaluateBuyNowInput): BuyNowDecision {
  if (
    input.buyerMarketsUserId.length === 0 ||
    input.sellerMarketsUserId.length === 0 ||
    !isSafeIntegerInRange(input.commandSequence, 1, Number.MAX_SAFE_INTEGER) ||
    !isSafeIntegerInRange(input.requestedQuantity, 1, 1_000) ||
    !isSafeIntegerInRange(input.availableQuantity, 0, 1_000) ||
    !isSafeIntegerInRange(input.nowMs, 0, Number.MAX_SAFE_INTEGER) ||
    !isSafeIntegerInRange(input.endAtMs, 0, Number.MAX_SAFE_INTEGER) ||
    (input.buyNowPriceTickCount !== null &&
      !isSafeIntegerInRange(input.buyNowPriceTickCount, 1, Number.MAX_SAFE_INTEGER))
  ) {
    throw new Error("INVALID_BUY_NOW_INPUT");
  }
  if (input.status !== "OPEN" || input.nowMs >= input.endAtMs) {
    return { accepted: false, code: "AUCTION_NOT_OPEN" };
  }
  if (input.buyerMarketsUserId === input.sellerMarketsUserId) {
    return { accepted: false, code: "SELLER_CANNOT_BUY_NOW" };
  }
  if (input.buyNowPriceTickCount === null || !input.allComponentsBuyNowEnabled) {
    return { accepted: false, code: "BUY_NOW_UNAVAILABLE" };
  }
  if (input.requestedQuantity > input.availableQuantity) {
    return { accepted: false, code: "BUY_NOW_QUANTITY_UNAVAILABLE" };
  }
  return {
    accepted: true,
    hold: {
      buyerMarketsUserId: input.buyerMarketsUserId,
      commandSequence: input.commandSequence,
      priceTickCount: input.buyNowPriceTickCount,
      quantity: input.requestedQuantity,
    },
  };
}
