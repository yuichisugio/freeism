import type { Context, Hono } from "hono";

import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import { dispatchAuctionSchedule } from "../../auction/auction-alarm-outbox-dispatcher";
import {
  commitAuctionImport,
  type CommitAuctionImportInput,
} from "../../auction/import/commit-auction-import";
import { createPackageRevisionReader } from "../../auction/import/package-revision-reader";
import {
  validateAuctionImport,
  verifyAuctionPackageRevision,
  type AuctionImportPreview,
  type ValidateAuctionImportInput,
} from "../../auction/import/validate-auction-import";
import { D1AuctionRepository } from "../../db/d1-auction-repository";
import { openPointsProvider } from "../../points/points-provider-context";
import type { BackendContext, Bindings } from "../context";
import { requireBindings } from "../context";
import { csvBodyLimitMiddleware } from "../middleware/csv-body-limit-middleware";
import { problemDetails } from "../problem-details";

export type ValidateAuctionImportService = (
  input: ValidateAuctionImportInput,
) => Promise<AuctionImportPreview>;

export type CommitAuctionImportService = (
  input: CommitAuctionImportInput,
) => ReturnType<typeof commitAuctionImport>;

function service(env: Bindings): ValidateAuctionImportService {
  return async (input) => {
    const { api } = await openPointsProvider(env, input.providerId);
    return validateAuctionImport(input, {
      checkEligibility: (request, idempotencyKey) =>
        api.checkPointPackageAuctionEligibility(request, idempotencyKey),
      packageRevisionReader: createPackageRevisionReader(api),
    });
  };
}

function commitService(env: Bindings): CommitAuctionImportService {
  const repository = new D1AuctionRepository(env.DB);
  return async (input) => {
    const { api, provider } = await openPointsProvider(env, input.providerId);
    const reader = createPackageRevisionReader(api);
    return commitAuctionImport(input, {
      repository,
      pointsIssuer: provider.issuer,
      now: () => new Date(),
      refreshPackage: async (row) =>
        verifyAuctionPackageRevision(row, await reader.get(row.pointPackageRevisionId)),
      checkEligibility: (request, idempotencyKey) =>
        api.checkPointPackageAuctionEligibility(request, idempotencyKey),
      scheduleAuction: (auctionId, revisionId, startsAt) =>
        dispatchAuctionSchedule(env.AUCTION_ROOMS, auctionId, revisionId, startsAt),
      environment: env.APP_ENV,
    });
  };
}

function validationProblem(context: Context<BackendContext>, code: string, errors: unknown) {
  return context.json(
    {
      code: "VALIDATION_FAILED",
      errors: Array.isArray(errors) ? errors : [],
      requestId: `req_${crypto.randomUUID()}`,
      status: 422,
      title: code,
      type: "https://markets.freeism.app/problems/validation-failed",
    },
    422,
    { "Cache-Control": "private, no-store", "Content-Type": "application/problem+json" },
  );
}

export function registerAuctionImportRoutes(
  app: Hono<BackendContext>,
  getSession: GetSession,
  injectedService?: ValidateAuctionImportService,
  injectedCommitService?: CommitAuctionImportService,
) {
  app.post("/api/auctions/import/validate", csvBodyLimitMiddleware, async (context) => {
    const contentType = context.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "text/csv") {
      return problemDetails(
        context,
        415,
        "CONTENT_TYPE_UNSUPPORTED",
        "Content-Type must be text/csv",
      );
    }
    const origin = context.req.header("Origin");
    if (origin && origin !== context.env.APP_ORIGIN) {
      return problemDetails(context, 403, "REQUEST_ORIGIN_REJECTED", "Request origin rejected");
    }
    if (context.req.header("Sec-Fetch-Site")?.toLowerCase() === "cross-site") {
      return problemDetails(
        context,
        403,
        "CROSS_SITE_REQUEST_REJECTED",
        "Cross-site request rejected",
      );
    }
    const idempotencyKey = context.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return problemDetails(context, 400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key required");
    }
    if (idempotencyKey.length > 200) {
      return problemDetails(context, 400, "MALFORMED_REQUEST", "Idempotency-Key is too long");
    }
    const actor = await requireMarketsSession(context, getSession);
    if (!actor) {
      return problemDetails(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }

    try {
      const providerId = context.req.header("X-Points-Provider-Id")?.trim();
      if (!providerId)
        return problemDetails(context, 400, "POINTS_PROVIDER_REQUIRED", "providerId required");
      const bytes = new Uint8Array(await context.req.arrayBuffer());
      const preview = await (injectedService ?? service(requireBindings(context.env)))({
        bytes,
        idempotencyKey,
        providerId,
      });
      return context.json(
        { data: preview, meta: { requestId: `req_${crypto.randomUUID()}` } },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      const candidate = error as { code?: unknown; errors?: unknown };
      const code =
        typeof candidate.code === "string"
          ? candidate.code
          : error instanceof Error
            ? error.message
            : "";
      if (code === "POINTS_PROVIDER_NOT_FOUND") return problemDetails(context, 404, code, code);
      if (code === "POINTS_PROVIDER_NOT_ACTIVE") return problemDetails(context, 409, code, code);
      if (code === "IDEMPOTENCY_KEY_REUSED") {
        return problemDetails(
          context,
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "Idempotency-Key reused with another payload",
        );
      }
      if (
        code === "AUCTION_IMPORT_VALIDATION_FAILED" ||
        code === "POINT_PACKAGE_MISMATCH" ||
        code === "POINT_PACKAGE_REVISION_MISMATCH" ||
        code === "POINT_PACKAGE_REVISION_NOT_FOUND" ||
        code === "POINT_PACKAGE_REVISION_INACTIVE" ||
        code === "POINT_PACKAGE_INTEGRITY_INVALID" ||
        code === "POINT_PACKAGE_AUCTION_INELIGIBLE"
      ) {
        return validationProblem(context, code, candidate.errors);
      }
      return problemDetails(
        context,
        502,
        "DEPENDENCY_UNAVAILABLE",
        "Points dependency unavailable",
      );
    }
  });

  app.post("/api/auctions/import/commit", csvBodyLimitMiddleware, async (context) => {
    const origin = context.req.header("Origin");
    if (origin && origin !== context.env.APP_ORIGIN) {
      return problemDetails(context, 403, "REQUEST_ORIGIN_REJECTED", "Request origin rejected");
    }
    if (context.req.header("Sec-Fetch-Site")?.toLowerCase() === "cross-site") {
      return problemDetails(
        context,
        403,
        "CROSS_SITE_REQUEST_REJECTED",
        "Cross-site request rejected",
      );
    }
    if (context.req.header("Content-Type")?.split(";", 1)[0]?.trim() !== "application/json") {
      return problemDetails(
        context,
        415,
        "CONTENT_TYPE_UNSUPPORTED",
        "Content-Type must be application/json",
      );
    }
    const idempotencyKey = context.req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return problemDetails(context, 400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key required");
    }
    if (idempotencyKey.length > 200) {
      return problemDetails(context, 400, "MALFORMED_REQUEST", "Idempotency-Key is too long");
    }
    const actor = await requireMarketsSession(context, getSession);
    if (!actor) {
      return problemDetails(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }
    try {
      const body = await context.req.json<{
        providerId?: string;
        preview?: AuctionImportPreview;
      }>();
      if (!body.preview || !body.providerId)
        return problemDetails(context, 400, "MALFORMED_REQUEST", "providerId and preview required");
      if (body.providerId !== body.preview.providerId)
        return problemDetails(context, 422, "POINTS_PROVIDER_MISMATCH", "providerId mismatch");
      const result = await (injectedCommitService ?? commitService(requireBindings(context.env)))({
        actor,
        providerId: body.providerId,
        idempotencyKey,
        preview: body.preview,
        sellerIdentitySnapshot: actor,
      });
      return context.json(
        { data: result, meta: { requestId: `req_${crypto.randomUUID()}` } },
        200,
        {
          "Cache-Control": "private, no-store",
        },
      );
    } catch (error) {
      const code =
        (error as { code?: unknown }).code ?? (error instanceof Error ? error.message : undefined);
      if (code === "POINTS_PROVIDER_NOT_FOUND") return problemDetails(context, 404, code, code);
      if (code === "POINTS_PROVIDER_NOT_ACTIVE") return problemDetails(context, 409, code, code);
      if (code === "IDEMPOTENCY_KEY_REUSED" || code === "IDEMPOTENCY_IN_PROGRESS") {
        return problemDetails(context, 409, String(code), String(code));
      }
      if (typeof code === "string") return validationProblem(context, code, []);
      return problemDetails(
        context,
        502,
        "DEPENDENCY_UNAVAILABLE",
        "Points dependency unavailable",
      );
    }
  });
}
