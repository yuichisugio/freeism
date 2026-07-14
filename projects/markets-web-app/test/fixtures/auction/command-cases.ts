import type {
  ApplyExtensionInput,
  ExtensionDecision,
} from "../../../src/backend/auction/domain/apply-extension-rule";
import type {
  BuyNowDecision,
  EvaluateBuyNowInput,
} from "../../../src/backend/auction/domain/evaluate-buy-now";

export const buyNowCases: readonly {
  expected: BuyNowDecision;
  input: EvaluateBuyNowInput;
  name: string;
}[] = [
  {
    name: "accepts the full requested quantity",
    input: {
      allComponentsBuyNowEnabled: true,
      availableQuantity: 3,
      buyerMarketsUserId: "buyer-a",
      buyNowPriceTickCount: 12,
      commandSequence: 7,
      endAtMs: 2_000,
      nowMs: 1_000,
      requestedQuantity: 3,
      sellerMarketsUserId: "seller-a",
      status: "OPEN",
    },
    expected: {
      accepted: true,
      hold: {
        buyerMarketsUserId: "buyer-a",
        commandSequence: 7,
        priceTickCount: 12,
        quantity: 3,
      },
    },
  },
  {
    name: "rejects all quantity when stock is insufficient",
    input: {
      allComponentsBuyNowEnabled: true,
      availableQuantity: 2,
      buyerMarketsUserId: "buyer-a",
      buyNowPriceTickCount: 12,
      commandSequence: 7,
      endAtMs: 2_000,
      nowMs: 1_000,
      requestedQuantity: 3,
      sellerMarketsUserId: "seller-a",
      status: "OPEN",
    },
    expected: { accepted: false, code: "BUY_NOW_QUANTITY_UNAVAILABLE" },
  },
  {
    name: "rejects the seller",
    input: {
      allComponentsBuyNowEnabled: true,
      availableQuantity: 3,
      buyerMarketsUserId: "seller-a",
      buyNowPriceTickCount: 12,
      commandSequence: 7,
      endAtMs: 2_000,
      nowMs: 1_000,
      requestedQuantity: 1,
      sellerMarketsUserId: "seller-a",
      status: "OPEN",
    },
    expected: { accepted: false, code: "SELLER_CANNOT_BUY_NOW" },
  },
  {
    name: "rejects exactly at endAt",
    input: {
      allComponentsBuyNowEnabled: true,
      availableQuantity: 3,
      buyerMarketsUserId: "buyer-a",
      buyNowPriceTickCount: 12,
      commandSequence: 7,
      endAtMs: 2_000,
      nowMs: 2_000,
      requestedQuantity: 1,
      sellerMarketsUserId: "seller-a",
      status: "OPEN",
    },
    expected: { accepted: false, code: "AUCTION_NOT_OPEN" },
  },
  {
    name: "rejects when any package component disables buy now",
    input: {
      allComponentsBuyNowEnabled: false,
      availableQuantity: 3,
      buyerMarketsUserId: "buyer-a",
      buyNowPriceTickCount: 12,
      commandSequence: 7,
      endAtMs: 2_000,
      nowMs: 1_000,
      requestedQuantity: 1,
      sellerMarketsUserId: "seller-a",
      status: "OPEN",
    },
    expected: { accepted: false, code: "BUY_NOW_UNAVAILABLE" },
  },
];

const extensionBase: ApplyExtensionInput = {
  acceptedPublicPriceUpdate: true,
  commandAuctionRevision: 4,
  currentAuctionRevision: 4,
  currentExtensionCount: 0,
  endAtMs: 60_000,
  nowMs: 50_000,
  rule: {
    durationSeconds: 20,
    maxExtensions: 2,
    thresholdSeconds: 10,
  },
};

export const extensionCases: readonly {
  expected: ExtensionDecision;
  input: ApplyExtensionInput;
  name: string;
}[] = [
  {
    name: "extends at the exact threshold boundary",
    input: extensionBase,
    expected: { endAtMs: 80_000, extended: true, extensionCount: 1 },
  },
  {
    name: "does not extend outside the threshold",
    input: { ...extensionBase, nowMs: 49_999 },
    expected: { endAtMs: 60_000, extended: false, extensionCount: 0 },
  },
  {
    name: "does not extend a rejected or non-price update",
    input: { ...extensionBase, acceptedPublicPriceUpdate: false },
    expected: { endAtMs: 60_000, extended: false, extensionCount: 0 },
  },
  {
    name: "does not extend at endAt",
    input: { ...extensionBase, nowMs: 60_000 },
    expected: { endAtMs: 60_000, extended: false, extensionCount: 0 },
  },
  {
    name: "does not exceed the extension limit",
    input: { ...extensionBase, currentExtensionCount: 2 },
    expected: { endAtMs: 60_000, extended: false, extensionCount: 2 },
  },
  {
    name: "ignores a command for an old Auction revision",
    input: { ...extensionBase, commandAuctionRevision: 3 },
    expected: { endAtMs: 60_000, extended: false, extensionCount: 0 },
  },
  {
    name: "keeps the current end when no extension rule exists",
    input: { ...extensionBase, rule: null },
    expected: { endAtMs: 60_000, extended: false, extensionCount: 0 },
  },
];
