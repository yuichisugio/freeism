import type { D1AuctionRepository } from "../../db/d1-auction-repository";
import type { MarketsActor } from "../../http/context";
import { AuctionCommitError, auctionPayloadHash } from "../import/commit-auction-import";

export interface CancelAuctionInput {
  actor: MarketsActor;
  auctionId: string;
  expectedAuctionVersion: number;
  idempotencyKey: string;
  reason?: string;
}

export interface CancelAuctionDependencies {
  repository: D1AuctionRepository;
  now(): Date;
  environment?: string;
}

export interface CancellationReceipt {
  auctionId: string;
  status: "CANCELLED";
  version: number;
}

export async function cancelAuction(
  input: CancelAuctionInput,
  dependencies: CancelAuctionDependencies,
): Promise<CancellationReceipt> {
  const payloadHash = await auctionPayloadHash({
    auctionId: input.auctionId,
    expectedAuctionVersion: input.expectedAuctionVersion,
    reason: input.reason ?? null,
  });
  const replay = await dependencies.repository.lookupIdempotency<CancellationReceipt>(
    input.actor.marketsUserId,
    "auction-cancel-before-start",
    input.idempotencyKey,
    payloadHash,
  );
  if (replay.kind === "CONFLICT") throw new AuctionCommitError("IDEMPOTENCY_KEY_REUSED");
  if (replay.kind === "REPLAY") return replay.value;

  const auction = await dependencies.repository.findForManagement(input.auctionId);
  if (!auction) throw new AuctionCommitError("AUCTION_NOT_FOUND");
  if (auction.sellerMarketsUserId !== input.actor.marketsUserId) {
    throw new AuctionCommitError("AUCTION_FORBIDDEN");
  }
  if (auction.version !== input.expectedAuctionVersion) {
    throw new AuctionCommitError("AUCTION_VERSION_CONFLICT");
  }
  if (!(["DRAFT", "SCHEDULED"] as const).includes(auction.status as "DRAFT" | "SCHEDULED")) {
    throw new AuctionCommitError("AUCTION_NOT_CANCELLABLE");
  }
  const commitStartedAt = dependencies.now();
  if (commitStartedAt.getTime() >= Date.parse(auction.startsAt)) {
    throw new AuctionCommitError("AUCTION_ALREADY_STARTED");
  }
  return dependencies.repository.cancelBeforeStart(auction, {
    actorMarketsUserId: input.actor.marketsUserId,
    commitStartedAt: commitStartedAt.toISOString(),
    environment: dependencies.environment ?? "test",
    idempotencyKey: input.idempotencyKey,
    operation: "auction-cancel-before-start",
    payloadHash,
    reason: input.reason,
    requestId: `req_${crypto.randomUUID()}`,
  });
}
