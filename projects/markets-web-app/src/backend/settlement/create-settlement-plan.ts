const MAX_ELIGIBLE_BIDS = 1_000;

export interface EligibleSettlementBid {
  bidPositionId: string;
  marketsUserId: string;
  priceTickCount: number;
  quantity: number;
  reachedSequence: number;
}

export interface EndOfAuctionPlanInput {
  algorithmVersion: string;
  auctionId: string;
  auctionRevisionId: string;
  cutoffAt: string;
  eligibleBids: readonly EligibleSettlementBid[];
  kind: "END_OF_AUCTION";
  maxBidSeq: number;
  packageTick: number;
  pointPackageRevisionId: string;
  quantity: number;
}

export interface BuyNowPlanInput {
  algorithmVersion: string;
  auctionId: string;
  auctionRevisionId: string;
  availableQuantityBeforeHold: number;
  buyerMarketsUserId: string;
  buyNowHoldId: string;
  kind: "BUY_NOW";
  packageTick: number;
  pointPackageRevisionId: string;
  priceTickCount: number;
  quantity: number;
}

export type SettlementPlan =
  | {
      algorithmVersion: string;
      auctionId: string;
      auctionRevisionId: string;
      cutoffAt: string;
      eligibleBidIds: readonly string[];
      kind: "END_OF_AUCTION";
      maxBidSeq: number;
      packageTick: number;
      pointPackageRevisionId: string;
      quantity: number;
      rankingInputHash: string;
    }
  | {
      algorithmVersion: string;
      auctionId: string;
      auctionRevisionId: string;
      availableQuantityBeforeHold: number;
      buyerMarketsUserId: string;
      buyNowHoldId: string;
      kind: "BUY_NOW";
      packageTick: number;
      pointPackageRevisionId: string;
      priceTickCount: number;
      quantity: number;
    };

function assertSafeInteger(value: number, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error("INVALID_SETTLEMENT_PLAN_INPUT");
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertCommon(input: EndOfAuctionPlanInput | BuyNowPlanInput): void {
  if (!input.auctionId || !input.auctionRevisionId || !input.algorithmVersion) {
    throw new Error("INVALID_SETTLEMENT_PLAN_INPUT");
  }
  assertSafeInteger(input.packageTick, 1);
  assertSafeInteger(input.quantity, 1);
  if (input.quantity > 1_000) throw new Error("INVALID_SETTLEMENT_PLAN_INPUT");
}

export async function createSettlementPlan(
  input: EndOfAuctionPlanInput | BuyNowPlanInput,
): Promise<{ plan: SettlementPlan; planHash: string; planJson: string }> {
  assertCommon(input);
  let plan: SettlementPlan;
  if (input.kind === "BUY_NOW") {
    assertSafeInteger(input.availableQuantityBeforeHold, 1);
    assertSafeInteger(input.priceTickCount, 1);
    if (!input.buyNowHoldId || !input.buyerMarketsUserId) {
      throw new Error("INVALID_SETTLEMENT_PLAN_INPUT");
    }
    plan = {
      algorithmVersion: input.algorithmVersion,
      auctionId: input.auctionId,
      auctionRevisionId: input.auctionRevisionId,
      availableQuantityBeforeHold: input.availableQuantityBeforeHold,
      buyerMarketsUserId: input.buyerMarketsUserId,
      buyNowHoldId: input.buyNowHoldId,
      kind: "BUY_NOW",
      packageTick: input.packageTick,
      pointPackageRevisionId: input.pointPackageRevisionId,
      priceTickCount: input.priceTickCount,
      quantity: input.quantity,
    };
  } else {
    if (!Number.isFinite(Date.parse(input.cutoffAt)))
      throw new Error("INVALID_SETTLEMENT_PLAN_INPUT");
    assertSafeInteger(input.maxBidSeq, 0);
    if (input.eligibleBids.length > MAX_ELIGIBLE_BIDS) {
      throw new Error("INVALID_SETTLEMENT_PLAN_INPUT");
    }
    const eligibleBids = [...input.eligibleBids].sort(
      (left, right) =>
        left.reachedSequence - right.reachedSequence ||
        left.bidPositionId.localeCompare(right.bidPositionId),
    );
    const ids = new Set<string>();
    for (const bid of eligibleBids) {
      if (!bid.bidPositionId || !bid.marketsUserId || ids.has(bid.bidPositionId)) {
        throw new Error("INVALID_SETTLEMENT_PLAN_INPUT");
      }
      ids.add(bid.bidPositionId);
      assertSafeInteger(bid.priceTickCount, 0);
      assertSafeInteger(bid.quantity, 1);
      assertSafeInteger(bid.reachedSequence, 1);
    }
    const rankingInputHash = await sha256(JSON.stringify(eligibleBids));
    plan = {
      algorithmVersion: input.algorithmVersion,
      auctionId: input.auctionId,
      auctionRevisionId: input.auctionRevisionId,
      cutoffAt: input.cutoffAt,
      eligibleBidIds: eligibleBids.map((bid) => bid.bidPositionId),
      kind: "END_OF_AUCTION",
      maxBidSeq: input.maxBidSeq,
      packageTick: input.packageTick,
      pointPackageRevisionId: input.pointPackageRevisionId,
      quantity: input.quantity,
      rankingInputHash,
    };
  }
  const planJson = JSON.stringify(plan);
  return { plan, planHash: `sha256:${await sha256(planJson)}`, planJson };
}
