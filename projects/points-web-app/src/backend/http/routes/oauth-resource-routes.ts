import type { Context, Hono } from "hono";
import type { z } from "zod";

import { pointsOAuthScopes } from "../../auth/points-oauth-provider";
import {
  introspectResourceRequest,
  type PointsOAuthPrincipal,
} from "../../auth/resource-token-introspection";
import { canonicalJson, sha256Hex } from "../../csv/csv-validation-result";
import {
  auctionEligibilityRequestSchema,
  balanceCheckRequestSchema,
  captureSettlementRequestSchema,
  createLinkAttemptRequestSchema,
  createReservationRequestSchema,
  deactivateConnectionRequestSchema,
  finalizeLinkAttemptRequestSchema,
  releaseReservationRequestSchema,
  reservationStatusRequestSchema,
} from "../points-api-schemas";
import { createPointsLinkAttempt } from "../../usecases/create-points-link-attempt";
import { checkPointBalance } from "../../usecases/check-point-balance";
import {
  checkPointPackageAuctionEligibility,
  PointPackageAuctionEligibilityError,
  PointPackageAuctionEligibilityIdempotencyConflictError,
} from "../../usecases/check-point-package-auction-eligibility";
import {
  captureSettlement,
  CaptureInsufficientBalanceError,
} from "../../usecases/capture-settlement";
import { createPointReservation } from "../../usecases/create-point-reservation";
import { deactivatePointsConnection } from "../../usecases/deactivate-points-connection";
import { finalizePointsLinkAttempt } from "../../usecases/finalize-points-link-attempt";
import {
  readPointsConnection,
  resolveActivePointsConnection,
} from "../../usecases/read-points-connection";
import { readReservationStatus } from "../../usecases/read-reservation-status";
import { releasePointReservation } from "../../usecases/release-point-reservation";
import type { BackendContext, Bindings } from "../context";
import { requireBindings } from "../context";
import { problem } from "../problem";

export type AuthorizePointsResource = (
  request: Request,
  env: Bindings,
  kind: "USER" | "M2M",
  scopes: readonly string[],
) => Promise<PointsOAuthPrincipal>;

const defaultAuthorize: AuthorizePointsResource = (request, env, kind, scopes) =>
  introspectResourceRequest(
    request,
    {
      allowedScopes: kind === "USER" ? pointsOAuthScopes.USER : pointsOAuthScopes.M2M,
      audience: `${env.APP_ORIGIN}/api/v1`,
      clientId:
        kind === "USER" ? env.MARKETS_USER_OAUTH_CLIENT_ID : env.MARKETS_M2M_OAUTH_CLIENT_ID,
      clientSecret:
        kind === "USER"
          ? env.MARKETS_USER_OAUTH_CLIENT_SECRET
          : env.MARKETS_M2M_OAUTH_CLIENT_SECRET,
      introspectionUrl: `${env.APP_ORIGIN}/api/auth/oauth2/introspect`,
      issuer: `${env.APP_ORIGIN}/api/auth`,
      kind,
    },
    scopes,
  );

async function readJson<T>(
  context: Context<BackendContext>,
  schema: z.ZodType<T>,
  limit = 64 * 1024,
) {
  const bytes = new Uint8Array(await context.req.arrayBuffer());
  if (bytes.byteLength > limit) throw new Error("REQUEST_BODY_TOO_LARGE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("MALFORMED_REQUEST");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new Error("VALIDATION_FAILED");
  return result.data;
}

function idempotencyKey(context: Context<BackendContext>) {
  const value = context.req.header("Idempotency-Key")?.trim();
  if (!value) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  return value;
}

function requestId(context: Context<BackendContext>) {
  return context.req.header("X-Request-Id")?.trim() || `req_${crypto.randomUUID()}`;
}

function mapError(context: Context<BackendContext>, error: unknown) {
  context.header("Cache-Control", "private, no-store");
  if (error instanceof PointPackageAuctionEligibilityError) {
    return context.json(
      {
        code: error.body.code,
        errors: error.body.errors,
        requestId: requestId(context),
        status: 409,
        title: "Point package is not eligible",
        type: "https://points.freeism.app/problems/point-package-auction-ineligible",
      },
      409,
      { "Content-Type": "application/problem+json" },
    );
  }
  if (error instanceof PointPackageAuctionEligibilityIdempotencyConflictError) {
    return problem(context, 409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key reused");
  }
  if (error instanceof CaptureInsufficientBalanceError) {
    return context.json(
      {
        code: "INSUFFICIENT_BALANCE" as const,
        insufficientReservationIds: error.insufficientReservationIds,
        requestId: requestId(context),
        status: 409 as const,
        title: "Insufficient balance",
        type: "https://points.freeism.app/problems/insufficient-balance",
      },
      409,
      { "Content-Type": "application/problem+json" },
    );
  }
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  if (code === "REQUEST_BODY_TOO_LARGE")
    return problem(context, 413, code, "Request body too large");
  if (code === "INVALID_ACCESS_TOKEN") return problem(context, 401, code, "Invalid access token");
  if (code === "POINTS_CONNECTION_NOT_ACTIVE") {
    return problem(context, 401, "INVALID_ACCESS_TOKEN", "Invalid access token");
  }
  if (code === "POINT_RESERVATION_STATUS_INVALID") {
    return problem(context, 422, "VALIDATION_FAILED", "Invalid reservation status request");
  }
  if (code === "POINTS_CONNECTION_NOT_FOUND" || code === "LINK_ATTEMPT_NOT_FOUND") {
    return problem(context, 404, "RESOURCE_NOT_FOUND", "Resource not found");
  }
  if (code === "RESOURCE_NOT_FOUND" || code === "POINT_PACKAGE_REVISION_NOT_FOUND") {
    return problem(context, 404, "RESOURCE_NOT_FOUND", "Resource not found");
  }
  if (code === "CAPTURE_STATE_CHANGED") {
    return problem(context, 409, "POINT_RESERVATION_NOT_ACTIVE", "Reservation state changed");
  }
  if (code === "RESERVATION_STATE_INVALID") {
    return problem(context, 409, "POINT_RESERVATION_NOT_ACTIVE", "Reservation is not active");
  }
  if (code === "ACTIVE_RESERVATION_EXISTS") {
    return problem(context, 409, code, "Active reservation exists");
  }
  if (code === "IDEMPOTENCY_KEY_REUSED") {
    return problem(context, 409, code, "Idempotency key reused");
  }
  if (code.includes("FINALIZED") || code.includes("MISMATCH") || code.includes("EXPIRED")) {
    return problem(context, 409, code, "OAuth link state conflict");
  }
  return problem(context, 422, code, "Invalid OAuth link request");
}

export function registerOAuthResourceRoutes(
  app: Hono<BackendContext>,
  authorize: AuthorizePointsResource = defaultAuthorize,
) {
  app.post("/api/v1/oauth/link-attempts", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "M2M", [
        "points.connection.link-attempt.create",
      ]);
      if (principal.kind !== "M2M") throw new Error("INVALID_ACCESS_TOKEN");
      const body = await readJson(context, createLinkAttemptRequestSchema);
      const payloadHash = `sha256:${await sha256Hex(
        canonicalJson({ body, clientId: principal.clientId }),
      )}`;
      const attempt = await createPointsLinkAttempt(env.DB, {
        expiresAt: new Date(body.expiresAt),
        idempotencyKey: idempotencyKey(context),
        marketsUserId: body.marketsUserId,
        m2mClientId: principal.clientId,
        payloadHash,
        requestedScopes: body.requestedScopes,
        stateHash: body.stateHash,
        userClientId: env.MARKETS_USER_OAUTH_CLIENT_ID,
      });
      return context.json(
        {
          data: {
            expiresAt: attempt.expiresAt.toISOString(),
            linkAttemptId: attempt.linkAttemptId,
          },
          meta: { requestId: requestId(context) },
        },
        201,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/v1/oauth/link-attempts/:linkAttemptId/finalizations", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "M2M", [
        "points.connection.link-attempt.finalize",
      ]);
      if (principal.kind !== "M2M") throw new Error("INVALID_ACCESS_TOKEN");
      const body = await readJson(context, finalizeLinkAttemptRequestSchema);
      const finalized = await finalizePointsLinkAttempt(env.DB, {
        attemptPayloadHash: body.attemptPayloadHash,
        idempotencyKey: idempotencyKey(context),
        issuer: body.outcome === "CONFIRM" ? body.pointsIssuer : undefined,
        linkAttemptId: context.req.param("linkAttemptId"),
        marketsPointsConnectionId: body.marketsPointsConnectionId,
        m2mClientId: principal.clientId,
        outcome: body.outcome,
        pointsSubject: body.outcome === "CONFIRM" ? body.pointsSubject : undefined,
        userClientId: body.outcome === "CONFIRM" ? body.userClientId : undefined,
      });
      const finalizedAt =
        finalized.status === "CANCELLED" ? finalized.finalizedAt : finalized.linkedAt;
      return context.json(
        {
          data: {
            finalizedAt: finalizedAt.toISOString(),
            grantStatus: finalized.status === "CANCELLED" ? "CANCELLED" : "ACTIVE",
            linkAttemptFinalizationReceiptId: `plf_${context.req.param("linkAttemptId")}`,
            linkAttemptId: context.req.param("linkAttemptId"),
            marketsPointsConnectionId: finalized.marketsPointsConnectionId,
            outcome: finalized.status === "CANCELLED" ? "CANCEL" : "CONFIRM",
          },
          meta: { requestId: requestId(context) },
        },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.get("/api/v1/me/connection", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "USER", ["points.connection.read"]);
      if (principal.kind !== "USER") throw new Error("INVALID_ACCESS_TOKEN");
      const connection = await readPointsConnection(env.DB, {
        issuer: principal.issuer,
        pointsSubject: principal.subject,
        userClientId: principal.clientId,
      });
      return context.json(
        {
          data: { ...connection, linkedAt: connection.linkedAt.toISOString() },
          meta: { requestId: requestId(context) },
        },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/v1/point-package-auction-eligibility-checks", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "M2M", [
        "points.packages.auction-eligibility",
      ]);
      if (principal.kind !== "M2M") throw new Error("INVALID_ACCESS_TOKEN");
      const body = await readJson(context, auctionEligibilityRequestSchema, 1024 * 1024);
      const result = await checkPointPackageAuctionEligibility(env.DB, {
        ...body,
        idempotencyKey: idempotencyKey(context),
        marketsClientId: principal.clientId,
      });
      const { serverNowIsEligible: _, ...data } = result.body.data;
      return context.json({ data, meta: { requestId: requestId(context) } }, 201, {
        "Cache-Control": "private, no-store",
      });
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/v1/me/balance-checks", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "USER", ["points.balance.read"]);
      if (principal.kind !== "USER") throw new Error("INVALID_ACCESS_TOKEN");
      const connection = await resolveActivePointsConnection(env.DB, {
        issuer: principal.issuer,
        pointsSubject: principal.subject,
        userClientId: principal.clientId,
      });
      const body = await readJson(context, balanceCheckRequestSchema);
      const balance = await checkPointBalance(env.DB, {
        ...body,
        pointsUserId: connection.pointsUserId,
      });
      return context.json(
        {
          data: { ...balance, checkedAt: balance.checkedAt.toISOString() },
          meta: { requestId: requestId(context) },
        },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/v1/me/connection-deactivations", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "USER", ["points.connection.unlink"]);
      if (principal.kind !== "USER") throw new Error("INVALID_ACCESS_TOKEN");
      const body = await readJson(context, deactivateConnectionRequestSchema);
      const key = idempotencyKey(context);
      const responseRequestId = requestId(context);
      if (body.deactivationKey !== key) throw new Error("IDEMPOTENCY_KEY_REUSED");
      const deactivated = await deactivatePointsConnection(env.DB, {
        idempotencyKey: key,
        issuer: principal.issuer,
        pointsConnectionId: body.pointsConnectionId,
        pointsSubject: principal.subject,
        reason: body.reason,
        requestId: responseRequestId,
        userClientId: principal.clientId,
      });
      return context.json(
        {
          data: { ...deactivated, deactivatedAt: deactivated.deactivatedAt.toISOString() },
          meta: { requestId: responseRequestId },
        },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/v1/me/point-reservations", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "USER", [
        "points.reservations.create",
      ]);
      if (principal.kind !== "USER") throw new Error("INVALID_ACCESS_TOKEN");
      const connection = await resolveActivePointsConnection(env.DB, {
        issuer: principal.issuer,
        pointsSubject: principal.subject,
        userClientId: principal.clientId,
      });
      const body = await readJson(context, createReservationRequestSchema);
      if (body.leaseSeconds !== 900 || body.marketsUserId !== connection.marketsUserId) {
        throw new Error("VALIDATION_FAILED");
      }
      const reservation = await createPointReservation(env.DB, {
        ...body,
        idempotencyKey: idempotencyKey(context),
        marketsClientId: connection.m2mClientId,
        pointsConnectionId: connection.pointsConnectionId,
        pointsUserId: connection.pointsUserId,
      });
      return context.json(
        {
          data: {
            ...reservation,
            components: reservation.components.map((component) => ({
              ...component,
              amountScaled: String(component.amountScaled),
            })),
            createdAt: reservation.createdAt.toISOString(),
            expiresAt: reservation.expiresAt.toISOString(),
          },
          meta: { requestId: requestId(context) },
        },
        201,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/v1/point-reservations/status", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "M2M", [
        "points.reservations.status",
      ]);
      if (principal.kind !== "M2M") throw new Error("INVALID_ACCESS_TOKEN");
      const body = await readJson(context, reservationStatusRequestSchema, 1024 * 1024);
      const reservations = await readReservationStatus(env.DB, {
        marketsClientId: principal.clientId,
        ...(body.lookupBy === "POINT_RESERVATION_ID"
          ? { pointReservationIds: body.pointReservationIds }
          : { reservationKeys: body.reservationKeys }),
      });
      return context.json(
        {
          data: {
            items: reservations.map((reservation) => ({
              ...reservation,
              createdAt: reservation.createdAt.toISOString(),
              expiresAt: reservation.expiresAt.toISOString(),
              terminalAt: reservation.terminalAt?.toISOString() ?? null,
            })),
          },
          meta: { requestId: requestId(context) },
        },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/v1/settlements/:settlementId/capture", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "M2M", [
        "points.reservations.capture",
      ]);
      if (principal.kind !== "M2M") throw new Error("INVALID_ACCESS_TOKEN");
      const body = await readJson(context, captureSettlementRequestSchema, 1024 * 1024);
      const captured = await captureSettlement(env.DB, {
        ...body,
        idempotencyKey: idempotencyKey(context),
        marketsClientId: principal.clientId,
        settlementId: context.req.param("settlementId"),
      });
      return context.json(
        {
          data: { ...captured, capturedAt: captured.capturedAt.toISOString() },
          meta: { requestId: requestId(context) },
        },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/v1/point-reservations/release", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "M2M", [
        "points.reservations.release",
      ]);
      if (principal.kind !== "M2M") throw new Error("INVALID_ACCESS_TOKEN");
      const body = await readJson(context, releaseReservationRequestSchema, 1024 * 1024);
      const released = await releasePointReservation(env.DB, {
        ...body,
        idempotencyKey: idempotencyKey(context),
        marketsClientId: principal.clientId,
      });
      return context.json(
        {
          data: { ...released, releasedAt: released.releasedAt.toISOString() },
          meta: { requestId: requestId(context) },
        },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });
}
