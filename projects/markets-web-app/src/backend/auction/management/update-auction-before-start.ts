import type { components } from "../../../generated/points-markets-api";
import type {
  AuctionImportPreviewRow,
  VerifiedPackageRevision,
} from "../import/validate-auction-import";
import { revalidateAuctionImportRows } from "../import/auction-import-row";
import type { MarketsActor } from "../../http/context";
import {
  assertEligibilityReceipt,
  assertFreshPackage,
  auctionPayloadHash,
  eligibilityRequest,
  AuctionCommitError,
} from "../import/commit-auction-import";
import type {
  D1AuctionRepository,
  StoredAuctionResult,
  WriteContext,
} from "../../db/d1-auction-repository";

type EligibilityRequest = components["schemas"]["AuctionEligibilityRequest"];
type EligibilityResponse = components["schemas"]["AuctionEligibilityResponse"];

export interface UpdateAuctionBeforeStartInput {
  actor: MarketsActor;
  auctionId: string;
  expectedAuctionVersion: number;
  idempotencyKey: string;
  row: AuctionImportPreviewRow;
  sellerIdentitySnapshot: unknown;
}

export interface UpdateAuctionBeforeStartDependencies {
  repository: D1AuctionRepository;
  now(): Date;
  refreshPackage(row: AuctionImportPreviewRow): Promise<VerifiedPackageRevision>;
  checkEligibility(
    request: EligibilityRequest,
    idempotencyKey: string,
  ): Promise<EligibilityResponse>;
  scheduleAuction(auctionId: string, revisionId: string, startsAt: string): Promise<void>;
  environment?: string;
}

function assertEditable(
  auction: Awaited<ReturnType<D1AuctionRepository["findForManagement"]>>,
  input: UpdateAuctionBeforeStartInput,
  now: Date,
) {
  if (!auction) throw new AuctionCommitError("AUCTION_NOT_FOUND");
  if (auction.sellerMarketsUserId !== input.actor.marketsUserId) {
    throw new AuctionCommitError("AUCTION_FORBIDDEN");
  }
  if (auction.version !== input.expectedAuctionVersion) {
    throw new AuctionCommitError("AUCTION_VERSION_CONFLICT");
  }
  if (!(["DRAFT", "SCHEDULED"] as const).includes(auction.status as "DRAFT" | "SCHEDULED")) {
    throw new AuctionCommitError("AUCTION_NOT_EDITABLE");
  }
  if (now.getTime() >= Date.parse(auction.startsAt)) {
    throw new AuctionCommitError("AUCTION_ALREADY_STARTED");
  }
  return auction;
}

export async function updateAuctionBeforeStart(
  input: UpdateAuctionBeforeStartInput,
  dependencies: UpdateAuctionBeforeStartDependencies,
): Promise<StoredAuctionResult> {
  const validation = revalidateAuctionImportRows([input.row]);
  if (validation.errors.length > 0) {
    throw new AuctionCommitError("AUCTION_IMPORT_VALIDATION_FAILED");
  }
  const row: AuctionImportPreviewRow = { ...input.row, ...validation.rows[0]! };
  const payloadHash = await auctionPayloadHash({
    auctionId: input.auctionId,
    expectedAuctionVersion: input.expectedAuctionVersion,
    row,
    sellerIdentitySnapshot: input.sellerIdentitySnapshot,
  });
  const replay = await dependencies.repository.lookupIdempotency<StoredAuctionResult>(
    input.actor.marketsUserId,
    "auction-update-before-start",
    input.idempotencyKey,
    payloadHash,
  );
  if (replay.kind === "CONFLICT") throw new AuctionCommitError("IDEMPOTENCY_KEY_REUSED");
  if (replay.kind === "REPLAY") {
    await dependencies.scheduleAuction(
      replay.value.auctionId,
      replay.value.revisionId,
      replay.value.startsAt,
    );
    return replay.value;
  }

  const commitStartedAt = dependencies.now();
  const auction = assertEditable(
    await dependencies.repository.findForManagement(input.auctionId),
    input,
    commitStartedAt,
  );
  if (Date.parse(row.startsAt) <= commitStartedAt.getTime()) {
    throw new AuctionCommitError("AUCTION_STARTS_AT_NOT_FUTURE");
  }
  assertFreshPackage(row, await dependencies.refreshPackage(row));
  const commandId = `acmd_${crypto.randomUUID()}`;
  const commandHash = `sha256:${await auctionPayloadHash({ commandId, row })}`;
  const request = eligibilityRequest(commandId, commandHash, [row]);
  const receipt = assertEligibilityReceipt(
    request,
    await dependencies.checkEligibility(request, `${input.idempotencyKey}:eligibility`),
    commitStartedAt,
  );
  const revisionId = `arev_${crypto.randomUUID()}`;
  const context: WriteContext = {
    actorMarketsUserId: input.actor.marketsUserId,
    commandHash,
    commandId,
    commitStartedAt: commitStartedAt.toISOString(),
    environment: dependencies.environment ?? "test",
    idempotencyKey: input.idempotencyKey,
    operation: "auction-update-before-start",
    payloadHash,
    receipt,
    requestId: `req_${crypto.randomUUID()}`,
    sellerIdentitySnapshot: input.sellerIdentitySnapshot,
  };
  const result = await dependencies.repository.updateBeforeStart(
    auction,
    { auctionId: input.auctionId, revisionId, row },
    context,
  );
  await dependencies.scheduleAuction(result.auctionId, result.revisionId, result.startsAt);
  return result;
}
