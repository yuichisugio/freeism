import type { Context, Hono } from "hono";

import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import { createPackageRevisionReader } from "../../auction/import/package-revision-reader";
import {
  validateAuctionImport,
  type AuctionImportPreview,
  type ValidateAuctionImportInput,
} from "../../auction/import/validate-auction-import";
import { PointsApiClient } from "../../points/points-api-client";
import { PointsOAuthClient } from "../../points/points-oauth-client";
import type { BackendContext, Bindings } from "../context";
import { requireBindings } from "../context";
import { csvBodyLimitMiddleware } from "../middleware/csv-body-limit-middleware";
import { problemDetails } from "../problem-details";

export type ValidateAuctionImportService = (
  input: ValidateAuctionImportInput,
) => Promise<AuctionImportPreview>;

function service(env: Bindings): ValidateAuctionImportService {
  const oauth = new PointsOAuthClient(env.POINTS_SERVICE, {
    audience: env.POINTS_AUDIENCE,
    issuer: env.POINTS_ISSUER,
    m2mClientId: env.POINTS_M2M_CLIENT_ID,
    m2mClientSecret: env.POINTS_M2M_CLIENT_SECRET,
    settlementClientId: env.POINTS_SETTLEMENT_CLIENT_ID,
    settlementClientSecret: env.POINTS_SETTLEMENT_CLIENT_SECRET,
    userClientId: env.POINTS_USER_CLIENT_ID,
    userClientSecret: env.POINTS_USER_CLIENT_SECRET,
  });
  const api = new PointsApiClient(env.POINTS_SERVICE, (scopes) => oauth.getM2MAccessToken(scopes));
  const packageRevisionReader = createPackageRevisionReader(api);
  return (input) =>
    validateAuctionImport(input, {
      checkEligibility: (request, idempotencyKey) =>
        api.checkPointPackageAuctionEligibility(request, idempotencyKey),
      packageRevisionReader,
    });
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
      const bytes = new Uint8Array(await context.req.arrayBuffer());
      const preview = await (injectedService ?? service(requireBindings(context.env)))({
        bytes,
        idempotencyKey,
      });
      return context.json(
        { data: preview, meta: { requestId: `req_${crypto.randomUUID()}` } },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      const candidate = error as { code?: unknown; errors?: unknown };
      const code = typeof candidate.code === "string" ? candidate.code : "";
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
}
