import type { Context, Hono } from "hono";

import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import { dispatchAuctionSchedule } from "../../auction/auction-alarm-outbox-dispatcher";
import {
  cancelAuction,
  type CancelAuctionInput,
  type CancellationReceipt,
} from "../../auction/management/cancel-auction";
import {
  updateAuctionBeforeStart,
  type UpdateAuctionBeforeStartInput,
} from "../../auction/management/update-auction-before-start";
import { createPackageRevisionReader } from "../../auction/import/package-revision-reader";
import {
  verifyAuctionPackageRevision,
  type AuctionImportPreviewRow,
} from "../../auction/import/validate-auction-import";
import { D1AuctionRepository, type StoredAuctionResult } from "../../db/d1-auction-repository";
import { PointsApiClient } from "../../points/points-api-client";
import { PointsOAuthClient } from "../../points/points-oauth-client";
import type { BackendContext, Bindings, MarketsActor } from "../context";
import { requireBindings } from "../context";
import { problemDetails, type ProblemStatus } from "../problem-details";

export interface AuctionManagementServices {
  update(input: UpdateAuctionBeforeStartInput): Promise<StoredAuctionResult>;
  cancel(input: CancelAuctionInput): Promise<CancellationReceipt>;
}

function services(env: Bindings): AuctionManagementServices {
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
  const reader = createPackageRevisionReader(api);
  const repository = new D1AuctionRepository(env.DB);
  return {
    update: (input) =>
      updateAuctionBeforeStart(input, {
        repository,
        now: () => new Date(),
        refreshPackage: async (row) =>
          verifyAuctionPackageRevision(row, await reader.get(row.pointPackageRevisionId)),
        checkEligibility: (request, idempotencyKey) =>
          api.checkPointPackageAuctionEligibility(request, idempotencyKey),
        scheduleAuction: (auctionId, revisionId, startsAt) =>
          dispatchAuctionSchedule(env.AUCTION_ROOMS, auctionId, revisionId, startsAt),
        environment: env.APP_ENV,
      }),
    cancel: (input) =>
      cancelAuction(input, {
        repository,
        now: () => new Date(),
        environment: env.APP_ENV,
      }),
  };
}

function errorResponse(context: Context<BackendContext>, error: unknown) {
  const code = (error as { code?: unknown }).code;
  const statusByCode: Record<string, ProblemStatus> = {
    AUCTION_NOT_FOUND: 404,
    AUCTION_FORBIDDEN: 403,
    AUCTION_VERSION_CONFLICT: 409,
    AUCTION_ALREADY_STARTED: 409,
    AUCTION_NOT_EDITABLE: 409,
    AUCTION_NOT_CANCELLABLE: 409,
    AUCTION_CANCELLATION_BLOCKED: 409,
    IDEMPOTENCY_KEY_REUSED: 409,
    IDEMPOTENCY_IN_PROGRESS: 409,
  };
  if (typeof code === "string" && statusByCode[code]) {
    return problemDetails(context, statusByCode[code], code, code);
  }
  if (typeof code === "string") return problemDetails(context, 422, code, code);
  return problemDetails(context, 502, "DEPENDENCY_UNAVAILABLE", "Points dependency unavailable");
}

async function actorAndKey(
  context: Context<BackendContext>,
  getSession: GetSession,
): Promise<{ actor: MarketsActor; idempotencyKey: string } | Response> {
  const contentType = context.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return problemDetails(
      context,
      415,
      "CONTENT_TYPE_UNSUPPORTED",
      "Content-Type must be application/json",
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
  return { actor, idempotencyKey };
}

export function registerAuctionManagementRoutes(
  app: Hono<BackendContext>,
  getSession: GetSession,
  injectedServices?: AuctionManagementServices,
) {
  app.patch("/api/auctions/:auctionId", async (context) => {
    const auth = await actorAndKey(context, getSession);
    if (auth instanceof Response) return auth;
    try {
      const body = await context.req.json<{
        expectedAuctionVersion?: number;
        row?: AuctionImportPreviewRow;
      }>();
      if (!Number.isSafeInteger(body.expectedAuctionVersion) || !body.row) {
        return problemDetails(context, 400, "MALFORMED_REQUEST", "complete auction input required");
      }
      const result = await (injectedServices ?? services(requireBindings(context.env))).update({
        actor: auth.actor,
        auctionId: context.req.param("auctionId"),
        expectedAuctionVersion: body.expectedAuctionVersion!,
        idempotencyKey: auth.idempotencyKey,
        row: body.row,
        sellerIdentitySnapshot: auth.actor,
      });
      return context.json({ data: result }, 200, { "Cache-Control": "private, no-store" });
    } catch (error) {
      return errorResponse(context, error);
    }
  });

  app.post("/api/auctions/:auctionId/cancellations", async (context) => {
    const auth = await actorAndKey(context, getSession);
    if (auth instanceof Response) return auth;
    try {
      const body = await context.req.json<{ expectedAuctionVersion?: number; reason?: string }>();
      if (!Number.isSafeInteger(body.expectedAuctionVersion)) {
        return problemDetails(context, 400, "MALFORMED_REQUEST", "expectedAuctionVersion required");
      }
      const result = await (injectedServices ?? services(requireBindings(context.env))).cancel({
        actor: auth.actor,
        auctionId: context.req.param("auctionId"),
        expectedAuctionVersion: body.expectedAuctionVersion!,
        idempotencyKey: auth.idempotencyKey,
        reason: body.reason,
      });
      return context.json({ data: result }, 200, { "Cache-Control": "private, no-store" });
    } catch (error) {
      return errorResponse(context, error);
    }
  });
}
