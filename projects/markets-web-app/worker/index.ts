import { Hono } from "hono";

import { marketsBackendApp } from "../src/backend/app";
import { requireBindings } from "../src/backend/http/context";
import { PointsApiClient } from "../src/backend/points/points-api-client";
import { PointsOAuthClient } from "../src/backend/points/points-oauth-client";
import { finalizeSettlement } from "../src/backend/settlement/finalize-settlement";
import { dispatchPendingSettlementOutboxes } from "../src/backend/settlement/outbox-dispatcher";
import { reconcilePendingSettlements } from "../src/backend/settlement/reconcile-settlements";
import { withSecurityHeaders } from "./security-headers";
import { isSpaNavigationRequest } from "./spa-fallback";

export { AuctionRoom } from "../src/backend/auction/auction-room";
export { AuctionSettlementWorkflow } from "../src/backend/settlement/auction-settlement-workflow";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (context, next) => {
  await next();
  context.res = withSecurityHeaders(
    context.res,
    context.env,
    context.res.headers.get("Cache-Control") ?? "no-store",
  );
});

app.route("/", marketsBackendApp);

app.get("/api/health", (context) =>
  withSecurityHeaders(
    context.json({ service: "auction-worker", status: "ok" }),
    context.env,
    "no-store",
  ),
);

app.notFound(async (context) => {
  const request = context.req.raw;
  if (isSpaNavigationRequest(request)) {
    const shellUrl = new URL("/", request.url);
    const shellResponse = await context.env.ASSETS.fetch(
      new Request(shellUrl, { headers: request.headers, method: "GET" }),
    );
    const response = withSecurityHeaders(shellResponse, context.env);
    if (request.method === "HEAD") {
      return new Response(null, response);
    }
    return response;
  }

  const problem = context.json(
    {
      code: "ROUTE_NOT_FOUND",
      status: 404,
      title: "Not Found",
      type: "about:blank",
    },
    404,
    { "Content-Type": "application/problem+json" },
  );
  return withSecurityHeaders(problem, context.env, "no-store");
});

export function fetchMarketsApi(request: Request, env: Env) {
  return app.fetch(request, env);
}

export async function runScheduledSettlementMaintenance(env: Env) {
  const bindings = requireBindings(env);
  const oauth = new PointsOAuthClient(bindings.POINTS_SERVICE, {
    audience: bindings.POINTS_AUDIENCE,
    issuer: bindings.POINTS_ISSUER,
    m2mClientId: bindings.POINTS_M2M_CLIENT_ID,
    m2mClientSecret: bindings.POINTS_M2M_CLIENT_SECRET,
    settlementClientId: bindings.POINTS_SETTLEMENT_CLIENT_ID,
    settlementClientSecret: bindings.POINTS_SETTLEMENT_CLIENT_SECRET,
    userClientId: bindings.POINTS_USER_CLIENT_ID,
    userClientSecret: bindings.POINTS_USER_CLIENT_SECRET,
  });
  const points = new PointsApiClient(bindings.POINTS_SERVICE, (scopes) =>
    oauth.getM2MAccessToken(scopes),
  );
  await reconcilePendingSettlements({
    db: bindings.DB,
    async finalizeCaptured(settlementId) {
      const row = await bindings.DB.prepare(
        `SELECT c.capture_receipt_id AS captureReceiptId, p.plan_hash AS planHash
         FROM settlement_capture_receipts c
         JOIN settlements s ON s.id = c.settlement_id
         JOIN settlement_plans p ON p.id = s.current_plan_id
         WHERE c.settlement_id = ?`,
      )
        .bind(settlementId)
        .first<{ captureReceiptId: string; planHash: string }>();
      if (!row) throw new Error("SETTLEMENT_CAPTURE_RECEIPT_MISSING");
      return finalizeSettlement(
        { db: bindings.DB, now: () => new Date() },
        { ...row, settlementId },
      );
    },
    async getStatuses(reservationKeys) {
      const response = await points.getPointReservationStatus({
        lookupBy: "RESERVATION_KEY",
        reservationKeys: [...reservationKeys],
      });
      return response.data.items.map((item) => ({
        reservationKey: item.reservationKey,
        status: item.status,
      }));
    },
    async hasCaptureReceipt(settlementId) {
      return (
        (await bindings.DB.prepare(
          "SELECT 1 AS found FROM settlement_capture_receipts WHERE settlement_id = ?",
        )
          .bind(settlementId)
          .first<number>("found")) === 1
      );
    },
    now: () => new Date(),
    async releaseBeforeCapture(settlementId, statuses) {
      for (const item of statuses) {
        if (item.status !== "ACTIVE") continue;
        const stored = await bindings.DB.prepare(
          `SELECT w.point_reservation_id AS pointReservationId, p.plan_hash AS planHash
           FROM settlement_round_winners w
           JOIN settlement_rounds r ON r.id = w.settlement_round_id
           JOIN settlements s ON s.id = r.settlement_id
           JOIN settlement_plans p ON p.id = s.current_plan_id
           WHERE r.settlement_id = ? AND w.reservation_key = ?`,
        )
          .bind(settlementId, item.reservationKey)
          .first<{
            planHash: string;
            pointReservationId: string;
          }>();
        if (!stored) throw new Error("SETTLEMENT_RESERVATION_NOT_FOUND");
        await points.releasePointReservation(
          {
            planHash: stored.planHash,
            pointReservationId: stored.pointReservationId,
            reason: "scheduled settlement reconciliation",
          },
          `reconcile:${settlementId}:${item.reservationKey}`,
        );
      }
    },
  });
  await dispatchPendingSettlementOutboxes(bindings.DB, bindings.AUCTION_SETTLEMENT);
}

export default {
  fetch(request, env, _context) {
    return fetchMarketsApi(request, env);
  },
  scheduled(_controller, env, context) {
    context.waitUntil(runScheduledSettlementMaintenance(env));
  },
} satisfies ExportedHandler<Env>;
