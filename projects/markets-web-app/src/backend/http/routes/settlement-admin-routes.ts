import type { Context, Hono } from "hono";

import { requireMarketsAdmin } from "../../auth/require-markets-admin";
import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import {
  normalizeSettlementRetryReason,
  readSafeSettlementStatus,
  retrySettlement,
} from "../../settlement/admin-retry-authorization";
import { dispatchSettlementOutbox } from "../../settlement/outbox-dispatcher";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";

function problem(
  context: Context<BackendContext>,
  status: 400 | 401 | 403 | 404 | 409 | 429,
  code: string,
) {
  return context.json(
    { code, status, title: "Settlement retry rejected", type: "about:blank" },
    status,
    { "Cache-Control": "private, no-store", "Content-Type": "application/problem+json" },
  );
}

async function authenticated(context: Context<BackendContext>, getSession: GetSession) {
  const actor = await requireMarketsSession(context, getSession);
  const authSession = actor ? context.get("authSession") : null;
  if (!actor || !authSession) return null;
  return { actor, authUserId: authSession.user.id };
}

function mapError(context: Context<BackendContext>, error: unknown) {
  const code = error instanceof Error ? error.message : "SETTLEMENT_RETRY_FAILED";
  if (code === "SETTLEMENT_NOT_FOUND") return problem(context, 404, code);
  if (code === "SETTLEMENT_RETRY_RATE_LIMITED") return problem(context, 429, code);
  if (code === "MARKETS_ADMIN_REQUIRED") return problem(context, 403, code);
  if (code === "REAUTH_REQUIRED" || code === "AUTHENTICATION_REQUIRED") {
    return problem(context, 401, code);
  }
  if (code === "SETTLEMENT_RETRY_NOT_ALLOWED" || code === "IDEMPOTENCY_KEY_REUSED") {
    return problem(context, 409, code);
  }
  return problem(context, 400, code);
}

export function registerSettlementAdminRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  app.get("/api/settlements/:settlementId", async (context) => {
    const auth = await authenticated(context, getSession);
    if (!auth) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    try {
      const data = await readSafeSettlementStatus(requireBindings(context.env).DB, {
        marketsUserId: auth.actor.marketsUserId,
        settlementId: context.req.param("settlementId"),
      });
      return context.json({ data, meta: { requestId: `req_${crypto.randomUUID()}` } }, 200, {
        "Cache-Control": "private, no-store",
      });
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/settlements/:settlementId/retry", async (context) => {
    try {
      const admin = await requireMarketsAdmin(context, getSession);
      if (!admin) return problem(context, 401, "AUTHENTICATION_REQUIRED");
      const idempotencyKey = context.req.header("Idempotency-Key")?.trim();
      if (!idempotencyKey || idempotencyKey.length > 200) {
        throw new Error("IDEMPOTENCY_KEY_REQUIRED");
      }
      const body = await context.req.json<{ reason?: unknown }>();
      if (typeof body.reason !== "string") throw new Error("SETTLEMENT_RETRY_REASON_INVALID");
      const env = requireBindings(context.env);
      const reason = await normalizeSettlementRetryReason(body.reason);
      const accepted = await retrySettlement(env.DB, {
        idempotencyKey,
        marketsUserId: admin.marketsUserId,
        now: Date.now(),
        reasonHash: reason.reasonHash,
        settlementId: context.req.param("settlementId"),
      });
      context.executionCtx.waitUntil(
        dispatchSettlementOutbox(env.DB, env.AUCTION_SETTLEMENT, accepted.outboxId).then(
          () => undefined,
        ),
      );
      return context.json({ data: accepted }, 202, { "Cache-Control": "private, no-store" });
    } catch (error) {
      return mapError(context, error);
    }
  });
}
