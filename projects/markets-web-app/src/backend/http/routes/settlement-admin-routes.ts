import type { Context, Hono } from "hono";

import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import { createPointsOAuthState } from "../../points/oauth-state";
import { PointsOAuthClient } from "../../points/points-oauth-client";
import {
  assertNoSettlementRetryReturnTargetInput,
  completeSettlementRetryCallback,
  consumeSettlementRetryAuthorization,
  createSettlementRetryAuthorization,
  getSettlementRetryAuthorizationForCallback,
  normalizeSettlementRetryReason,
  readSafeSettlementStatus,
  settlementRetryReturnPath,
  validateSettlementRetryAssertionClaims,
  verifySettlementRetryAssertion,
} from "../../settlement/admin-retry-authorization";
import { dispatchSettlementOutbox } from "../../settlement/outbox-dispatcher";
import type { BackendContext, Bindings } from "../context";
import { requireBindings } from "../context";

function oauth(env: Bindings) {
  return new PointsOAuthClient(env.POINTS_SERVICE, {
    audience: env.POINTS_AUDIENCE,
    issuer: env.POINTS_ISSUER,
    m2mClientId: env.POINTS_M2M_CLIENT_ID,
    m2mClientSecret: env.POINTS_M2M_CLIENT_SECRET,
    settlementClientId: env.POINTS_SETTLEMENT_CLIENT_ID,
    settlementClientSecret: env.POINTS_SETTLEMENT_CLIENT_SECRET,
    userClientId: env.POINTS_USER_CLIENT_ID,
    userClientSecret: env.POINTS_USER_CLIENT_SECRET,
  });
}

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
  const sessionId = authSession?.session.id;
  if (!actor || !sessionId) return null;
  return { actor, authUserId: authSession.user.id, sessionId };
}

function mapError(context: Context<BackendContext>, error: unknown) {
  const code = error instanceof Error ? error.message : "SETTLEMENT_RETRY_FAILED";
  if (code === "SETTLEMENT_NOT_FOUND") return problem(context, 404, code);
  if (code === "SETTLEMENT_RETRY_RATE_LIMITED") return problem(context, 429, code);
  if (code.includes("AUTHENTICATION") || code.includes("SESSION"))
    return problem(context, 401, code);
  if (
    code.includes("REPLAYED") ||
    code.includes("NOT_ALLOWED") ||
    code.includes("TARGET_CHANGED")
  ) {
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

  app.post("/api/settlements/:settlementId/retry-authorizations", async (context) => {
    const auth = await authenticated(context, getSession);
    if (!auth) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    try {
      assertNoSettlementRetryReturnTargetInput(new URL(context.req.url).searchParams);
      const body = await context.req.json<{ reason?: unknown }>();
      if (typeof body.reason !== "string") throw new Error("SETTLEMENT_RETRY_REASON_INVALID");
      const env = requireBindings(context.env);
      const settlementId = context.req.param("settlementId");
      const target = await env.DB.prepare(
        `SELECT s.auction_id AS auctionId FROM settlements s
         JOIN auctions a ON a.id = s.auction_id
         WHERE s.id = ? AND a.seller_markets_user_id = ?
           AND s.saga_state = 'MANUAL_ACTION_REQUIRED'`,
      )
        .bind(settlementId, auth.actor.marketsUserId)
        .first<{ auctionId: string }>();
      if (!target) throw new Error("SETTLEMENT_RETRY_NOT_ALLOWED");
      const reason = await normalizeSettlementRetryReason(body.reason);
      const callbackUri = `${env.APP_ORIGIN}/api/settlements/retry-callback`;
      const state = await createPointsOAuthState({ callbackUri, sessionId: auth.sessionId });
      const authorization = await createSettlementRetryAuthorization(env.DB, {
        auctionId: target.auctionId,
        authUserId: auth.authUserId,
        callbackUri,
        expiresAt: state.expiresAt.getTime(),
        marketsUserId: auth.actor.marketsUserId,
        nonce: state.nonce,
        pkceVerifier: state.pkceVerifier,
        rawState: state.state,
        reasonHash: reason.reasonHash,
        sessionId: auth.sessionId,
        settlementId,
      });
      return context.json(
        {
          data: {
            authorizationId: authorization.id,
            authorizationUrl: oauth(env).settlementAuthorizationUrl({
              callbackUri,
              nonce: state.nonce,
              pkceChallenge: state.pkceChallenge,
              resource: env.APP_ORIGIN,
              state: state.state,
            }),
          },
        },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.get("/api/settlements/retry-callback", async (context) => {
    const auth = await authenticated(context, getSession);
    if (!auth) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    try {
      assertNoSettlementRetryReturnTargetInput(new URL(context.req.url).searchParams);
      const code = context.req.query("code");
      const rawState = context.req.query("state");
      if (!code || !rawState) throw new Error("ADMIN_ASSERTION_CALLBACK_INVALID");
      const env = requireBindings(context.env);
      const authorization = await getSettlementRetryAuthorizationForCallback(env.DB, {
        marketsUserId: auth.actor.marketsUserId,
        rawState,
        sessionId: auth.sessionId,
      });
      const assertion = await oauth(env).exchangeSettlementAuthorizationCode({
        callbackUri: authorization.callbackUri,
        code,
        pkceVerifier: authorization.pkceVerifier,
        resource: env.APP_ORIGIN,
      });
      const claims = await verifySettlementRetryAssertion(
        env.POINTS_SERVICE,
        env.POINTS_ISSUER,
        assertion,
      );
      validateSettlementRetryAssertionClaims(
        claims,
        {
          auctionId: authorization.auctionId,
          audience: env.APP_ORIGIN,
          clientId: env.POINTS_SETTLEMENT_CLIENT_ID,
          issuer: env.POINTS_ISSUER,
          nowSeconds: Math.floor(Date.now() / 1000),
          reasonHash: authorization.reasonHash,
          settlementId: authorization.settlementId,
        },
        true,
      );
      await completeSettlementRetryCallback(env.DB, {
        claims,
        marketsUserId: auth.actor.marketsUserId,
        rawState,
        sessionId: auth.sessionId,
        verifiedAt: Date.now(),
      });
      return context.redirect(
        new URL(settlementRetryReturnPath(authorization.settlementId), env.APP_ORIGIN).toString(),
        303,
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/settlements/:settlementId/retry", async (context) => {
    const auth = await authenticated(context, getSession);
    if (!auth) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    try {
      const body = await context.req.json<{ pendingId?: string }>();
      if (!body.pendingId) throw new Error("ADMIN_ASSERTION_NOT_FOUND");
      const env = requireBindings(context.env);
      const accepted = await consumeSettlementRetryAuthorization(env.DB, {
        authorizationId: body.pendingId,
        marketsUserId: auth.actor.marketsUserId,
        now: Date.now(),
        sessionId: auth.sessionId,
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
