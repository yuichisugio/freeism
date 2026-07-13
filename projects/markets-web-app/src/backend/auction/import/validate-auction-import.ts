import type { components } from "../../../generated/points-markets-api";
import type { CsvError } from "../../csv/csv-errors";
import { parseCsv } from "../../csv/parse-csv";
import {
  AUCTION_IMPORT_HEADERS,
  type AuctionImportRow,
  normalizeAuctionImportRows,
} from "./auction-import-row";
import type {
  PackageRevisionReader,
  PointPackageRevisionHttpResult,
} from "./package-revision-reader";

type PublicRevision = components["schemas"]["PublicPointPackageRevisionData"];
type EligibilityRequest = components["schemas"]["AuctionEligibilityRequest"];
type EligibilityResponse = components["schemas"]["AuctionEligibilityResponse"];

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const POSITIVE_INTEGER_STRING = /^[1-9]\d*$/;

export class AuctionImportValidationError extends Error {
  constructor(
    readonly code: string,
    readonly errors: readonly CsvError[] = [],
  ) {
    super(code);
  }
}

export interface VerifiedPackageRevision extends Omit<PublicRevision, "components"> {
  components: Array<
    Omit<PublicRevision["components"][number], "minimumUnitScaled"> & {
      minimumUnitScaled: number;
    }
  >;
}

export interface AuctionImportPreviewRow extends AuctionImportRow {
  eligible: true;
  packageEligibilityVersion: number;
  packageSnapshot: VerifiedPackageRevision;
}

export interface AuctionImportPreview {
  fileHash: string;
  auctionCommandId: string;
  auctionCommandHash: string;
  rows: readonly AuctionImportPreviewRow[];
}

export interface AuctionEligibilityClient {
  checkEligibility(
    request: EligibilityRequest,
    idempotencyKey: string,
  ): Promise<EligibilityResponse>;
}

export interface ValidateAuctionImportInput {
  bytes: Uint8Array;
  idempotencyKey: string;
}

export interface ValidateAuctionImportDependencies extends AuctionEligibilityClient {
  packageRevisionReader: PackageRevisionReader;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AuctionImportValidationError("MALFORMED_REQUEST");
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
  throw new AuctionImportValidationError("MALFORMED_REQUEST");
}

async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function lcm(left: bigint, right: bigint): bigint {
  return (left / gcd(left, right)) * right;
}

function positiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parsedMinimumUnit(value: unknown): number | null {
  if (typeof value !== "string" || !POSITIVE_INTEGER_STRING.test(value)) return null;
  const parsed = Number(value);
  return positiveSafeInteger(parsed) ? parsed : null;
}

function compareOpaqueId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalRevisionContent(revision: PublicRevision) {
  return {
    pointPackageId: revision.pointPackageId,
    pointPackageRevisionId: revision.pointPackageRevisionId,
    status: revision.status,
    name: revision.name,
    description: revision.description,
    relatedUrl: revision.relatedUrl,
    totalWeight: revision.totalWeight,
    packageTick: revision.packageTick,
    components: [...revision.components]
      .sort(
        (left, right) =>
          left.displayOrder - right.displayOrder ||
          compareOpaqueId(left.evaluationCriterionId, right.evaluationCriterionId),
      )
      .map((component) => ({
        evaluationCriterionId: component.evaluationCriterionId,
        evaluationCriterionRevisionId: component.evaluationCriterionRevisionId,
        name: component.name,
        displayOrder: component.displayOrder,
        weight: component.weight,
        minimumUnitScaled: component.minimumUnitScaled,
        buyNowEnabled: component.buyNowEnabled,
      })),
  };
}

async function verifyRevision(
  row: AuctionImportRow,
  result: PointPackageRevisionHttpResult,
): Promise<VerifiedPackageRevision> {
  const revision = result.body?.data;
  if (!revision || revision.pointPackageRevisionId !== row.pointPackageRevisionId) {
    throw new AuctionImportValidationError("POINT_PACKAGE_REVISION_MISMATCH");
  }
  if (revision.pointPackageId !== row.pointPackageId) {
    throw new AuctionImportValidationError("POINT_PACKAGE_MISMATCH");
  }
  if (revision.status !== "ACTIVE") {
    throw new AuctionImportValidationError("POINT_PACKAGE_REVISION_INACTIVE");
  }
  if (
    typeof revision.pointPackageId !== "string" ||
    typeof revision.pointPackageRevisionId !== "string" ||
    typeof revision.name !== "string" ||
    !(revision.description === null || typeof revision.description === "string") ||
    !(revision.relatedUrl === null || typeof revision.relatedUrl === "string") ||
    !HASH_PATTERN.test(revision.contentHash) ||
    result.etag !== `"${revision.contentHash}"` ||
    result.etag.startsWith("W/") ||
    result.cacheControl !== IMMUTABLE_CACHE ||
    !positiveSafeInteger(revision.totalWeight) ||
    !positiveSafeInteger(revision.packageTick) ||
    revision.components.length < 1
  ) {
    throw new AuctionImportValidationError("POINT_PACKAGE_INTEGRITY_INVALID");
  }

  const sorted = [...revision.components].sort(
    (left, right) =>
      left.displayOrder - right.displayOrder ||
      compareOpaqueId(left.evaluationCriterionId, right.evaluationCriterionId),
  );
  const parsedComponents = sorted.map((component, index) => {
    const minimumUnitScaled = parsedMinimumUnit(component.minimumUnitScaled);
    if (
      component.displayOrder !== index ||
      !positiveSafeInteger(component.weight) ||
      minimumUnitScaled === null ||
      typeof component.evaluationCriterionId !== "string" ||
      typeof component.evaluationCriterionRevisionId !== "string" ||
      typeof component.name !== "string" ||
      typeof component.buyNowEnabled !== "boolean"
    ) {
      throw new AuctionImportValidationError("POINT_PACKAGE_INTEGRITY_INVALID");
    }
    return { ...component, minimumUnitScaled };
  });
  if (
    new Set(parsedComponents.map((component) => component.evaluationCriterionId)).size !==
    parsedComponents.length
  ) {
    throw new AuctionImportValidationError("POINT_PACKAGE_INTEGRITY_INVALID");
  }

  const totalWeight = parsedComponents.reduce(
    (sum, component) => sum + BigInt(component.weight),
    0n,
  );
  if (
    totalWeight > BigInt(Number.MAX_SAFE_INTEGER) ||
    Number(totalWeight) !== revision.totalWeight
  ) {
    throw new AuctionImportValidationError("POINT_PACKAGE_INTEGRITY_INVALID");
  }
  const calculatedTick = parsedComponents.reduce((tick, component) => {
    const divisor = totalWeight * BigInt(component.minimumUnitScaled);
    return lcm(tick, divisor / gcd(BigInt(component.weight), divisor));
  }, 1n);
  if (
    calculatedTick > BigInt(Number.MAX_SAFE_INTEGER) ||
    Number(calculatedTick) !== revision.packageTick
  ) {
    throw new AuctionImportValidationError("POINT_PACKAGE_INTEGRITY_INVALID");
  }

  const contentHash = await sha256(canonicalJson(canonicalRevisionContent(revision)));
  if (contentHash !== revision.contentHash) {
    throw new AuctionImportValidationError("POINT_PACKAGE_INTEGRITY_INVALID");
  }
  return { ...revision, components: parsedComponents };
}

function assertEligibilityResponse(
  request: EligibilityRequest,
  response: EligibilityResponse,
): Map<string, number> {
  if (
    response.data.auctionCommandId !== request.auctionCommandId ||
    response.data.auctionCommandHash !== request.auctionCommandHash ||
    response.data.items.length !== request.items.length
  ) {
    throw new AuctionImportValidationError("POINTS_ELIGIBILITY_RESPONSE_INVALID");
  }
  const requested = new Map(request.items.map((item) => [item.auctionItemId, item]));
  const versions = new Map<string, number>();
  for (const item of response.data.items) {
    const expected = requested.get(item.auctionItemId);
    if (
      !expected ||
      versions.has(item.auctionItemId) ||
      item.pointPackageId !== expected.pointPackageId ||
      item.pointPackageRevisionId !== expected.pointPackageRevisionId ||
      item.contentHash !== expected.contentHash ||
      !positiveSafeInteger(item.packageEligibilityVersion)
    ) {
      throw new AuctionImportValidationError("POINTS_ELIGIBILITY_RESPONSE_INVALID");
    }
    versions.set(item.auctionItemId, item.packageEligibilityVersion);
  }
  return versions;
}

export async function validateAuctionImport(
  input: ValidateAuctionImportInput,
  dependencies: ValidateAuctionImportDependencies,
): Promise<AuctionImportPreview> {
  const parsed = await parseCsv(input.bytes, AUCTION_IMPORT_HEADERS);
  const normalized = normalizeAuctionImportRows(parsed.rows);
  const errors = [...parsed.errors, ...normalized.errors];
  if (errors.length > 0) {
    throw new AuctionImportValidationError("AUCTION_IMPORT_VALIDATION_FAILED", errors);
  }

  const revisionsById = new Map<string, Promise<PointPackageRevisionHttpResult>>();
  const snapshotFor = (row: AuctionImportRow) => {
    let loading = revisionsById.get(row.pointPackageRevisionId);
    if (!loading) {
      loading = dependencies.packageRevisionReader.get(row.pointPackageRevisionId);
      revisionsById.set(row.pointPackageRevisionId, loading);
    }
    return loading.then((result) => verifyRevision(row, result));
  };
  const snapshots = await Promise.all(normalized.rows.map(snapshotFor));
  const fileHash = await sha256(input.bytes);
  const commandSeed = await sha256(`${fileHash}\n${input.idempotencyKey}`);
  const auctionCommandId = `acmd_${commandSeed.slice("sha256:".length, 39)}`;
  const commandRows = normalized.rows.map((row, index) => ({
    ...row,
    packageSnapshot: snapshots[index]!,
  }));
  const auctionCommandHash = await sha256(
    canonicalJson({ auctionCommandId, fileHash, rows: commandRows }),
  );
  const eligibilityRequest: EligibilityRequest = {
    auctionCommandId,
    auctionCommandHash,
    items: commandRows.map((row) => ({
      auctionItemId: row.clientRowId,
      pointPackageId: row.pointPackageId,
      pointPackageRevisionId: row.pointPackageRevisionId,
      contentHash: row.packageSnapshot.contentHash,
    })),
  };

  let eligibility: EligibilityResponse;
  try {
    eligibility = await dependencies.checkEligibility(eligibilityRequest, input.idempotencyKey);
  } catch (error) {
    const code = error instanceof Error ? error.message : "POINTS_DEPENDENCY_UNAVAILABLE";
    if (code === "POINT_PACKAGE_AUCTION_INELIGIBLE") {
      throw new AuctionImportValidationError(code);
    }
    throw new AuctionImportValidationError("POINTS_DEPENDENCY_UNAVAILABLE");
  }
  const versions = assertEligibilityResponse(eligibilityRequest, eligibility);
  return {
    fileHash,
    auctionCommandId,
    auctionCommandHash,
    rows: commandRows.map((row) => ({
      ...row,
      eligible: true,
      packageEligibilityVersion: versions.get(row.clientRowId)!,
    })),
  };
}
