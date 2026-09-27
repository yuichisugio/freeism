import type { Context, Hono } from "hono";

import { createMarketsAuth } from "../../auth/create-auth";
import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import { PointsOAuthClient, PointsOAuthTokenEndpointError } from "../../points/points-oauth-client";
import {
  createRefreshLeaseRepository,
  withUserAccessToken,
} from "../../points/refresh-lease-repository";
import { createBetterAuthPointsTokenStore } from "../../points/points-token-store";
import {
  normalizeSettlementRetryReason,
  readSafeSettlementStatus,
  retrySettlement,
} from "../../settlement/admin-retry-authorization";
import { dispatchSettlementOutbox } from "../../settlement/outbox-dispatcher";
import type { BackendContext, Bindings } from "../context";
import { requireBindings } from "../context";

function oauth(env: Bindings) {
  return new PointsOAuthClient(env.POINTS_SERVICE, {
    audience: env.POINTS_AUDIENCE,
    issuer: env.POINTS_ISSUER,
    clientId: env.POINTS_CLIENT_ID,
    privateKeyJwk: env.POINTS_CLIENT_PRIVATE_KEY_JWK,
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
  if (!actor || !authSession) return null;
  return { actor, authUserId: authSession.user.id };
}

function mapError(context: Context<BackendContext>, error: unknown) {
  const code = error instanceof Error ? error.message : "SETTLEMENT_RETRY_FAILED";
  if (code === "SETTLEMENT_NOT_FOUND") return problem(context, 404, code);
  if (code === "SETTLEMENT_RETRY_RATE_LIMITED") return problem(context, 429, code);
  if (code === "POINTS_ADMIN_REQUIRED") return problem(context, 403, code);
  if (code === "REAUTH_REQUIRED" || code === "AUTHENTICATION_REQUIRED") {
    return problem(context, 401, code);
  }
  if (code === "SETTLEMENT_RETRY_NOT_ALLOWED" || code === "IDEMPOTENCY_KEY_REUSED") {
    return problem(context, 409, code);
  }
  return problem(context, 400, code);
}

async function requirePointsAdmin(env: Bindings, authUserId: string, marketsUserId: string) {
  const connection = await env.DB.prepare(
    `SELECT id, auth_user_id AS authUserId, points_issuer AS pointsIssuer,
            points_subject AS pointsSubject, user_client_id AS userClientId
     FROM points_connection WHERE markets_user_id = ? AND status = 'ACTIVE'
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(marketsUserId)
    .first<{
      authUserId: string;
      id: string;
      pointsIssuer: string;
      pointsSubject: string;
      userClientId: string;
    }>();
  if (!connection || connection.authUserId !== authUserId) throw new Error("REAUTH_REQUIRED");
  const pointsOauth = oauth(env);
  const repository = createRefreshLeaseRepository(
    env.DB,
    createBetterAuthPointsTokenStore(createMarketsAuth(env)),
  );
  const response = await withUserAccessToken(
    repository,
    connection.id,
    async (accessToken) => {
      try {
        const identity = await pointsOauth.introspectUserAccessToken(accessToken, [
          "points.connection.read",
        ]);
        if (
          identity.issuer !== connection.pointsIssuer ||
          identity.subject !== connection.pointsSubject ||
          identity.clientId !== connection.userClientId
        ) {
          return new Response(null, { status: 401 });
        }
      } catch (error) {
        if (
          error instanceof Error &&
          ["POINTS_USER_INTROSPECTION_INVALID", "POINTS_SCOPE_MISMATCH"].includes(error.message)
        ) {
          return new Response(null, { status: 401 });
        }
        throw error;
      }
      return env.POINTS_SERVICE.fetch(
        new Request("https://points.service/api/v1/me/admin-membership", {
          headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
        }),
      );
    },
    async (refreshToken) => {
      try {
        return await pointsOauth.refreshUserToken(refreshToken, ["points.connection.read"]);
      } catch (error) {
        if (
          (error instanceof PointsOAuthTokenEndpointError && error.oauthError === "invalid_grant") ||
          (error instanceof Error &&
            [
              "POINTS_REFRESH_TOKEN_MISSING",
              "POINTS_USER_INTROSPECTION_INVALID",
              "POINTS_SCOPE_MISMATCH",
            ].includes(error.message))
        ) {
          throw new Error("REAUTH_REQUIRED");
        }
        throw error;
      }
    },
  );
  if (response.status === 401) throw new Error("REAUTH_REQUIRED");
  if (!response.ok) throw new Error("POINTS_ADMIN_CHECK_FAILED");
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("data" in body) ||
    typeof body.data !== "object" ||
    body.data === null ||
    !("isAdmin" in body.data) ||
    typeof body.data.isAdmin !== "boolean"
  ) {
    throw new Error("POINTS_ADMIN_CHECK_FAILED");
  }
  if (!body.data.isAdmin) throw new Error("POINTS_ADMIN_REQUIRED");
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
    const auth = await authenticated(context, getSession);
    if (!auth) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    try {
      const idempotencyKey = context.req.header("Idempotency-Key")?.trim();
      if (!idempotencyKey || idempotencyKey.length > 200) {
        throw new Error("IDEMPOTENCY_KEY_REQUIRED");
      }
      const body = await context.req.json<{ reason?: unknown }>();
      if (typeof body.reason !== "string") throw new Error("SETTLEMENT_RETRY_REASON_INVALID");
      const env = requireBindings(context.env);
      const reason = await normalizeSettlementRetryReason(body.reason);
      await requirePointsAdmin(env, auth.authUserId, auth.actor.marketsUserId);
      const accepted = await retrySettlement(env.DB, {
        idempotencyKey,
        marketsUserId: auth.actor.marketsUserId,
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
