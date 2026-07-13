import type { components } from "../../../generated/points-markets-api";
import type { MarketsActor } from "../../http/context";
import {
  D1AuctionRepository,
  type AuctionEligibilityReceipt,
  type ImportCommitResult,
  type WriteContext,
} from "../../db/d1-auction-repository";
import { revalidateAuctionImportRows } from "./auction-import-row";
import type {
  AuctionImportPreview,
  AuctionImportPreviewRow,
  VerifiedPackageRevision,
} from "./validate-auction-import";

type EligibilityRequest = components["schemas"]["AuctionEligibilityRequest"];
type EligibilityResponse = components["schemas"]["AuctionEligibilityResponse"];

export class AuctionCommitError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export interface CommitAuctionImportInput {
  actor: MarketsActor;
  idempotencyKey: string;
  preview: AuctionImportPreview;
  sellerIdentitySnapshot: unknown;
}

export interface CommitAuctionImportDependencies {
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

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  throw new AuctionCommitError("MALFORMED_REQUEST");
}

export async function auctionPayloadHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(value)),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function assertFreshPackage(
  preview: AuctionImportPreviewRow,
  fresh: VerifiedPackageRevision,
) {
  if (
    fresh.pointPackageId !== preview.pointPackageId ||
    fresh.pointPackageRevisionId !== preview.pointPackageRevisionId ||
    canonicalJson(fresh) !== canonicalJson(preview.packageSnapshot)
  ) {
    throw new AuctionCommitError("POINT_PACKAGE_REVISION_CHANGED");
  }
  if (
    preview.buyNowPriceTickCount !== null &&
    fresh.components.some((component) => !component.buyNowEnabled)
  ) {
    throw new AuctionCommitError("POINT_PACKAGE_BUY_NOW_DISABLED");
  }
}

export function eligibilityRequest(
  auctionCommandId: string,
  auctionCommandHash: string,
  rows: readonly AuctionImportPreviewRow[],
): EligibilityRequest {
  return {
    auctionCommandId,
    auctionCommandHash,
    items: rows.map((row) => ({
      auctionItemId: row.clientRowId,
      pointPackageId: row.pointPackageId,
      pointPackageRevisionId: row.pointPackageRevisionId,
      contentHash: row.packageSnapshot.contentHash,
    })),
  };
}

export function assertEligibilityReceipt(
  request: EligibilityRequest,
  response: EligibilityResponse,
  commitStartedAt: Date,
): AuctionEligibilityReceipt {
  const data = response.data;
  if (
    data.auctionCommandId !== request.auctionCommandId ||
    data.auctionCommandHash !== request.auctionCommandHash ||
    data.items.length !== request.items.length ||
    !data.eligibilityReceiptId ||
    !Number.isFinite(Date.parse(data.checkedAt)) ||
    !Number.isFinite(Date.parse(data.validUntil))
  ) {
    throw new AuctionCommitError("POINTS_ELIGIBILITY_RESPONSE_INVALID");
  }
  if (commitStartedAt.getTime() >= Date.parse(data.validUntil)) {
    throw new AuctionCommitError("POINTS_ELIGIBILITY_RECEIPT_EXPIRED");
  }
  const expected = new Map(request.items.map((item) => [item.auctionItemId, item]));
  const versions = new Map<string, number>();
  for (const item of data.items) {
    const match = expected.get(item.auctionItemId);
    if (
      !match ||
      versions.has(item.auctionItemId) ||
      item.pointPackageId !== match.pointPackageId ||
      item.pointPackageRevisionId !== match.pointPackageRevisionId ||
      item.contentHash !== match.contentHash ||
      !Number.isSafeInteger(item.packageEligibilityVersion) ||
      item.packageEligibilityVersion < 1
    ) {
      throw new AuctionCommitError("POINTS_ELIGIBILITY_RESPONSE_INVALID");
    }
    versions.set(item.auctionItemId, item.packageEligibilityVersion);
  }
  return {
    eligibilityReceiptId: data.eligibilityReceiptId,
    checkedAt: data.checkedAt,
    validUntil: data.validUntil,
    versions,
  };
}

export async function commitAuctionImport(
  input: CommitAuctionImportInput,
  dependencies: CommitAuctionImportDependencies,
): Promise<ImportCommitResult> {
  if (input.preview.rows.length < 1 || input.preview.rows.length > 1_000) {
    throw new AuctionCommitError("AUCTION_IMPORT_ROW_COUNT_INVALID");
  }
  const validation = revalidateAuctionImportRows(input.preview.rows);
  if (validation.errors.length > 0) {
    throw new AuctionCommitError("AUCTION_IMPORT_VALIDATION_FAILED");
  }
  const preview: AuctionImportPreview = {
    ...input.preview,
    rows: validation.rows.map((row, index) => ({ ...input.preview.rows[index]!, ...row })),
  };
  const payloadHash = await auctionPayloadHash({
    preview,
    sellerIdentitySnapshot: input.sellerIdentitySnapshot,
  });
  const replay = await dependencies.repository.lookupIdempotency<ImportCommitResult>(
    input.actor.marketsUserId,
    "auction-import-commit",
    input.idempotencyKey,
    payloadHash,
  );
  if (replay.kind === "CONFLICT") throw new AuctionCommitError("IDEMPOTENCY_KEY_REUSED");
  if (replay.kind === "REPLAY") {
    await Promise.all(
      replay.value.auctions.map((item) =>
        dependencies.scheduleAuction(item.auctionId, item.revisionId, item.startsAt),
      ),
    );
    return replay.value;
  }

  const fresh = await Promise.all(preview.rows.map((row) => dependencies.refreshPackage(row)));
  fresh.forEach((revision, index) => assertFreshPackage(preview.rows[index]!, revision));
  const commitStartedAt = dependencies.now();
  if (preview.rows.some((row) => Date.parse(row.startsAt) <= commitStartedAt.getTime())) {
    throw new AuctionCommitError("AUCTION_STARTS_AT_NOT_FUTURE");
  }
  const request = eligibilityRequest(
    preview.auctionCommandId,
    preview.auctionCommandHash,
    preview.rows,
  );
  const receipt = assertEligibilityReceipt(
    request,
    await dependencies.checkEligibility(request, `${input.idempotencyKey}:commit`),
    commitStartedAt,
  );
  const rows = preview.rows.map((row) => ({
    auctionId: `auc_${crypto.randomUUID()}`,
    revisionId: `arev_${crypto.randomUUID()}`,
    row,
  }));
  const context: WriteContext = {
    actorMarketsUserId: input.actor.marketsUserId,
    commandHash: preview.auctionCommandHash,
    commandId: preview.auctionCommandId,
    commitStartedAt: commitStartedAt.toISOString(),
    environment: dependencies.environment ?? "test",
    idempotencyKey: input.idempotencyKey,
    operation: "auction-import-commit",
    payloadHash,
    receipt,
    requestId: `req_${crypto.randomUUID()}`,
    sellerIdentitySnapshot: input.sellerIdentitySnapshot,
  };
  const result = await dependencies.repository.commitImport(rows, context);
  await Promise.all(
    result.auctions.map((item) =>
      dependencies.scheduleAuction(item.auctionId, item.revisionId, item.startsAt),
    ),
  );
  return result;
}
