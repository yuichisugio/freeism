import { describe, expect, it, vi } from "vite-plus/test";

import {
  createPackageRevisionReader,
  type PointPackageRevisionHttpResult,
} from "../../src/backend/auction/import/package-revision-reader";
import {
  AuctionImportValidationError,
  validateAuctionImport,
} from "../../src/backend/auction/import/validate-auction-import";
import { AUCTION_IMPORT_HEADERS } from "../../src/backend/auction/import/auction-import-row";
import type { components } from "../../src/generated/points-markets-api";

type PublicRevision = components["schemas"]["PublicPointPackageRevisionData"];
type EligibilityResponse = components["schemas"]["AuctionEligibilityResponse"];

const immutableCache = "public, max-age=31536000, immutable";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

async function publicRevision(overrides: Partial<PublicRevision> = {}): Promise<PublicRevision> {
  const content = {
    pointPackageId: "pkg_1",
    pointPackageRevisionId: "ppr_1",
    status: "ACTIVE" as const,
    name: "Package one",
    description: null,
    relatedUrl: null,
    totalWeight: 1,
    packageTick: 1,
    components: [
      {
        evaluationCriterionId: "criterion_1",
        evaluationCriterionRevisionId: "criterion_revision_1",
        name: "Quality",
        displayOrder: 0,
        weight: 1,
        minimumUnitScaled: "1",
        buyNowEnabled: true,
      },
    ],
    ...overrides,
  };
  const { contentHash: _, ...hashContent } = content as PublicRevision;
  return { ...content, contentHash: await sha256(canonicalJson(hashContent)) };
}

function csv(overrides: Record<string, string> = {}): Uint8Array {
  const values: Record<string, string> = {
    clientRowId: "row-1",
    title: "Auction one",
    description: "Description one",
    externalUrl: "https://example.com/item/1",
    pointPackageId: "pkg_1",
    pointPackageRevisionId: "ppr_1",
    quantity: "2",
    startsAt: "2027-01-01T00:00:00Z",
    endsAt: "2027-01-02T00:00:00Z",
    buyNowPriceTickCount: "10",
    extensionThresholdSeconds: "30",
    extensionDurationSeconds: "60",
    maxExtensions: "3",
    ...overrides,
  };
  return new TextEncoder().encode(
    `${AUCTION_IMPORT_HEADERS.join(",")}\n${AUCTION_IMPORT_HEADERS.map((key) => values[key]).join(",")}`,
  );
}

function httpResult(body: PublicRevision): PointPackageRevisionHttpResult {
  return {
    body: { data: body, meta: { requestId: "req_1" } },
    cacheControl: immutableCache,
    etag: `"${body.contentHash}"`,
  };
}

function eligibilityResponse(commandId: string, commandHash: string): EligibilityResponse {
  return {
    data: {
      pointPackageAuctionEligibilityReceiptId: "paer_1",
      auctionCommandId: commandId,
      auctionCommandHash: commandHash,
      items: [
        {
          auctionItemId: "row-1",
          pointPackageId: "pkg_1",
          pointPackageRevisionId: "ppr_1",
          contentHash: "replaced-by-test",
          packageEligibilityVersion: 7,
        },
      ],
      checkedAt: "2026-07-13T00:00:00.000Z",
      validUntil: "2026-07-13T00:00:30.000Z",
    },
    meta: { requestId: "req_eligibility" },
  };
}

describe("Package revision reader", () => {
  it("returns the generated body with the actual immutable headers", async () => {
    const revision = await publicRevision();
    const response = Response.json(
      { data: revision, meta: { requestId: "req_1" } },
      { headers: { "Cache-Control": immutableCache, ETag: `"${revision.contentHash}"` } },
    );
    const getPublicPointPackageRevision = vi.fn(async () => response);

    const result = await createPackageRevisionReader({ getPublicPointPackageRevision }).get(
      "ppr_1",
    );

    expect(getPublicPointPackageRevision).toHaveBeenCalledWith("ppr_1");
    expect(result).toEqual(httpResult(revision));
  });

  it("does not fall back when Points returns 404 or fails", async () => {
    const notFound = createPackageRevisionReader({
      getPublicPointPackageRevision: async () => new Response(null, { status: 404 }),
    });
    await expect(notFound.get("missing")).rejects.toMatchObject({
      code: "POINT_PACKAGE_REVISION_NOT_FOUND",
    });

    const unavailable = createPackageRevisionReader({
      getPublicPointPackageRevision: async () => {
        throw new Error("network failed");
      },
    });
    await expect(unavailable.get("ppr_1")).rejects.toMatchObject({
      code: "POINTS_DEPENDENCY_UNAVAILABLE",
    });
  });
});

describe("validateAuctionImport", () => {
  it("returns a verified preview but never exposes the eligibility receipt", async () => {
    const revision = await publicRevision();
    const get = vi.fn(async () => httpResult(revision));
    const checkEligibility = vi.fn(async (request) => {
      const response = eligibilityResponse(request.auctionCommandId, request.auctionCommandHash);
      response.data.items[0]!.contentHash = revision.contentHash;
      return response;
    });

    const preview = await validateAuctionImport(
      { bytes: csv(), idempotencyKey: "preview-key-1" },
      { checkEligibility, packageRevisionReader: { get } },
    );

    expect(get).toHaveBeenCalledWith("ppr_1");
    expect(checkEligibility).toHaveBeenCalledWith(
      expect.objectContaining({
        auctionCommandId: expect.stringMatching(/^acmd_/),
        auctionCommandHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        items: [
          expect.objectContaining({
            auctionItemId: "row-1",
            contentHash: revision.contentHash,
          }),
        ],
      }),
      "preview-key-1",
    );
    expect(preview).toMatchObject({
      fileHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      auctionCommandId: expect.stringMatching(/^acmd_/),
      auctionCommandHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      rows: [
        expect.objectContaining({
          clientRowId: "row-1",
          eligible: true,
          packageEligibilityVersion: 7,
          packageSnapshot: expect.objectContaining({ contentHash: revision.contentHash }),
        }),
      ],
    });
    expect(JSON.stringify(preview)).not.toContain("paer_1");
    expect(JSON.stringify(preview)).not.toContain("validUntil");
  });

  it("rejects a package mismatch, an inactive revision and invalid immutable headers", async () => {
    const active = await publicRevision();
    const checkEligibility = vi.fn();
    const validate = (result: PointPackageRevisionHttpResult) =>
      validateAuctionImport(
        { bytes: csv(), idempotencyKey: "preview-key-1" },
        { checkEligibility, packageRevisionReader: { get: async () => result } },
      );

    await expect(
      validate(httpResult(await publicRevision({ pointPackageId: "pkg_other" }))),
    ).rejects.toMatchObject({ code: "POINT_PACKAGE_MISMATCH" });
    await expect(
      validate(httpResult(await publicRevision({ status: "INACTIVE" }))),
    ).rejects.toMatchObject({ code: "POINT_PACKAGE_REVISION_INACTIVE" });
    await expect(
      validate({ ...httpResult(active), etag: `W/"${active.contentHash}"` }),
    ).rejects.toMatchObject({ code: "POINT_PACKAGE_INTEGRITY_INVALID" });
    expect(checkEligibility).not.toHaveBeenCalled();
  });

  it("collects CSV errors before calling Points", async () => {
    const get = vi.fn();
    const checkEligibility = vi.fn();

    await expect(
      validateAuctionImport(
        { bytes: csv({ pointPackageId: "" }), idempotencyKey: "preview-key-1" },
        { checkEligibility, packageRevisionReader: { get } },
      ),
    ).rejects.toMatchObject({
      code: "AUCTION_IMPORT_VALIDATION_FAILED",
      errors: [expect.objectContaining({ field: "pointPackageId", row: 2 })],
    } satisfies Partial<AuctionImportValidationError>);
    expect(get).not.toHaveBeenCalled();
    expect(checkEligibility).not.toHaveBeenCalled();
  });
});
