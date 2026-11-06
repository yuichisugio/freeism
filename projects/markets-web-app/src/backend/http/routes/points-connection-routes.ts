import type { Context, Hono } from "hono";

import { createMarketsAuth } from "../../auth/create-auth";
import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import {
  assertNoPointsReturnTargetInput,
  POINTS_CONNECTION_RETURN_PATH,
} from "../../points/oauth-state";
import {
  createPointsConnectionService,
  PointsConnectionRepository,
  type PointsConnectionService,
} from "../../points/points-link-saga";
import { openPointsProvider } from "../../points/points-provider-context";
import { sha256 } from "../../points/oauth-state";
import { createBetterAuthPointsTokenStore } from "../../points/points-token-store";
import {
  createPointsUnlinkAuthorizationService,
  type PointsUnlinkAuthorizationService,
} from "../../points/points-unlink-authorization";
import type { BackendContext, Bindings } from "../context";
import { requireBindings } from "../context";

async function services(env: Bindings, providerId: string, allowStopped = false) {
  const { provider, oauth, api } = await openPointsProvider(env, providerId, { allowStopped });
  const tokenStore = createBetterAuthPointsTokenStore(createMarketsAuth(env));
  return {
    connection: createPointsConnectionService({
      providerId,
      api,
      callbackUri: `${env.APP_ORIGIN}/api/points-connection/callback`,
      db: env.DB,
      m2mClientId: provider.clientId!,
      oauth,
      pointsIssuer: provider.issuer,
      tokenStore,
      userClientId: provider.clientId!,
    }),
    unlink: createPointsUnlinkAuthorizationService({
      providerId,
      api,
      callbackUri: `${env.APP_ORIGIN}/api/points-connection/unlink/callback`,
      db: env.DB,
      oauth,
      pointsIssuer: provider.issuer,
      tokenStore,
      userClientId: provider.clientId!,
    }),
  };
}

async function providerForState(
  env: Bindings,
  table: "points_oauth_state" | "points_unlink_authorization",
  state: string,
) {
  const row = await env.DB.prepare(
    `SELECT provider_id AS providerId FROM ${table} WHERE state_hash = ?`,
  )
    .bind(await sha256(state))
    .first<{ providerId: string }>();
  if (!row) throw new Error("POINTS_OAUTH_STATE_INVALID");
  return row.providerId;
}

async function providerForPending(
  env: Bindings,
  table: "points_connection" | "points_unlink_authorization",
  pendingId: string,
) {
  const row = await env.DB.prepare(`SELECT provider_id AS providerId FROM ${table} WHERE id = ?`)
    .bind(pendingId)
    .first<{ providerId: string }>();
  if (!row) throw new Error("POINTS_CONNECTION_CONFIRMATION_INVALID");
  return row.providerId;
}

function problem(context: Context<BackendContext>, status: 400 | 401 | 409, code: string) {
  return context.json(
    { code, status, title: "Points connection request rejected", type: "about:blank" },
    status,
    { "Cache-Control": "private, no-store", "Content-Type": "application/problem+json" },
  );
}

async function actorAndSession(context: Context<BackendContext>, getSession: GetSession) {
  const actor = await requireMarketsSession(context, getSession);
  const authSession = actor ? context.get("authSession") : null;
  const sessionId = authSession?.session.id;
  if (!actor || !sessionId) return null;
  return { actor, authUserId: authSession.user.id, sessionId };
}

function mapError(context: Context<BackendContext>, error: unknown) {
  const code = error instanceof Error ? error.message : "POINTS_CONNECTION_FAILED";
  if (code === "POINTS_CONNECTION_CONFLICT") return problem(context, 409, code);
  return problem(context, 400, code);
}

export function registerPointsConnectionRoutes(
  app: Hono<BackendContext>,
  getSession: GetSession,
  injectedConnection?: PointsConnectionService,
  injectedUnlink?: PointsUnlinkAuthorizationService,
) {
  app.get("/api/points-connection", async (context) => {
    const authenticated = await actorAndSession(context, getSession);
    if (!authenticated) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    const { results } = await requireBindings(context.env)
      .DB.prepare(
        `SELECT p.id AS providerId, p.display_name AS displayName, p.status,
              c.id AS connectionId, c.status AS connectionStatus, c.expires_at AS connectionExpiresAt,
              u.id AS unlinkPendingId, u.expires_at AS unlinkExpiresAt
       FROM points_provider p
       LEFT JOIN points_connection c ON c.id = (
         SELECT id FROM points_connection WHERE markets_user_id = ? AND provider_id = p.id
           AND status IN ('PENDING_CONFIRMATION', 'ACTIVE', 'REAUTH_REQUIRED')
         ORDER BY created_at DESC LIMIT 1)
       LEFT JOIN points_unlink_authorization u ON u.id = (
         SELECT id FROM points_unlink_authorization WHERE points_connection_id = c.id
           AND status = 'PENDING' AND expires_at > ? ORDER BY created_at DESC LIMIT 1)
       WHERE p.status IN ('ACTIVE', 'STOPPED') ORDER BY p.display_name, p.id`,
      )
      .bind(authenticated.actor.marketsUserId, Date.now())
      .all<{
        providerId: string;
        displayName: string;
        status: "ACTIVE" | "STOPPED";
        connectionId: string | null;
        connectionStatus: "PENDING_CONFIRMATION" | "ACTIVE" | "REAUTH_REQUIRED" | null;
        connectionExpiresAt: number | null;
        unlinkPendingId: string | null;
        unlinkExpiresAt: number | null;
      }>();
    return context.json(
      {
        data: results.map((row) => ({
          providerId: row.providerId,
          displayName: row.displayName,
          status: row.status,
          connection: row.connectionId
            ? {
                id: row.connectionId,
                status: row.connectionStatus,
                ...(row.unlinkPendingId
                  ? {
                      pendingAction: {
                        kind: "UNLINK",
                        pendingId: row.unlinkPendingId,
                        expiresAt: row.unlinkExpiresAt,
                      },
                    }
                  : row.connectionStatus === "PENDING_CONFIRMATION" &&
                      row.connectionExpiresAt &&
                      row.connectionExpiresAt > Date.now()
                    ? {
                        pendingAction: {
                          kind: "LINK",
                          pendingId: row.connectionId,
                          expiresAt: row.connectionExpiresAt,
                        },
                      }
                    : {}),
              }
            : null,
        })),
      },
      200,
      { "Cache-Control": "private, no-store" },
    );
  });

  app.post("/api/points-connection/start", async (context) => {
    const authenticated = await actorAndSession(context, getSession);
    if (!authenticated) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    try {
      assertNoPointsReturnTargetInput(new URL(context.req.url).searchParams);
      const body = await context.req.json<{ providerId?: string }>();
      if (!body.providerId) throw new Error("POINTS_PROVIDER_REQUIRED");
      const env = requireBindings(context.env);
      await new PointsConnectionRepository(env.DB).restoreExpiredReauth(
        authenticated.actor.marketsUserId,
        body.providerId,
      );
      const existing = await env.DB.prepare(
        "SELECT id FROM points_connection WHERE markets_user_id = ? AND provider_id = ? AND status = 'REAUTH_REQUIRED'",
      )
        .bind(authenticated.actor.marketsUserId, body.providerId)
        .first();
      if (!existing) {
        const provider = await env.DB.prepare("SELECT status FROM points_provider WHERE id = ?")
          .bind(body.providerId)
          .first<{ status: string }>();
        if (provider?.status !== "ACTIVE") throw new Error("POINTS_PROVIDER_NOT_ACTIVE");
      }
      const service =
        injectedConnection ??
        (await services(requireBindings(context.env), body.providerId, true)).connection;
      const result = await service.start(
        authenticated.actor,
        authenticated.authUserId,
        authenticated.sessionId,
      );
      return context.json({ data: result }, 200, { "Cache-Control": "private, no-store" });
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.get("/api/points-connection/callback", async (context) => {
    const authenticated = await actorAndSession(context, getSession);
    if (!authenticated) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    const code = context.req.query("code");
    const state = context.req.query("state");
    if (!code || !state) return problem(context, 400, "POINTS_OAUTH_CALLBACK_INVALID");
    try {
      const service =
        injectedConnection ??
        (
          await services(
            requireBindings(context.env),
            await providerForState(requireBindings(context.env), "points_oauth_state", state),
            true,
          )
        ).connection;
      await service.completeCallback(
        authenticated.actor,
        authenticated.authUserId,
        authenticated.sessionId,
        { code, issuer: context.req.query("iss"), state },
      );
      return context.redirect(
        new URL(POINTS_CONNECTION_RETURN_PATH, requireBindings(context.env).APP_ORIGIN).toString(),
        303,
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/points-connection/confirm", async (context) => {
    const authenticated = await actorAndSession(context, getSession);
    if (!authenticated) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    try {
      const body = await context.req.json<{ pendingId?: string }>();
      if (!body.pendingId) throw new Error("POINTS_CONNECTION_CONFIRMATION_INVALID");
      const service =
        injectedConnection ??
        (
          await services(
            requireBindings(context.env),
            await providerForPending(
              requireBindings(context.env),
              "points_connection",
              body.pendingId,
            ),
            true,
          )
        ).connection;
      const result = await service.confirm(
        authenticated.actor,
        authenticated.sessionId,
        body.pendingId,
      );
      return context.json({ data: result }, 200, { "Cache-Control": "private, no-store" });
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/points-connection/unlink/start", async (context) => {
    const authenticated = await actorAndSession(context, getSession);
    if (!authenticated) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    try {
      assertNoPointsReturnTargetInput(new URL(context.req.url).searchParams);
      const body = await context.req.json<{ providerId?: string; reason?: string }>();
      if (!body.providerId) throw new Error("POINTS_PROVIDER_REQUIRED");
      const service =
        injectedUnlink ??
        (await services(requireBindings(context.env), body.providerId, true)).unlink;
      const result = await service.start(
        authenticated.actor,
        authenticated.authUserId,
        authenticated.sessionId,
        body.reason ?? "",
      );
      return context.json({ data: result }, 200, { "Cache-Control": "private, no-store" });
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.get("/api/points-connection/unlink/callback", async (context) => {
    const authenticated = await actorAndSession(context, getSession);
    if (!authenticated) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    const code = context.req.query("code");
    const state = context.req.query("state");
    if (!code || !state) return problem(context, 400, "POINTS_UNLINK_CALLBACK_INVALID");
    try {
      const service =
        injectedUnlink ??
        (
          await services(
            requireBindings(context.env),
            await providerForState(
              requireBindings(context.env),
              "points_unlink_authorization",
              state,
            ),
            true,
          )
        ).unlink;
      await service.completeCallback(
        authenticated.actor,
        authenticated.authUserId,
        authenticated.sessionId,
        { code, issuer: context.req.query("iss"), state },
      );
      return context.redirect(
        new URL(POINTS_CONNECTION_RETURN_PATH, requireBindings(context.env).APP_ORIGIN).toString(),
        303,
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/points-connection/unlink/confirm", async (context) => {
    const authenticated = await actorAndSession(context, getSession);
    if (!authenticated) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    try {
      const body = await context.req.json<{ pendingId?: string }>();
      if (!body.pendingId) throw new Error("POINTS_UNLINK_CONFIRMATION_INVALID");
      const service =
        injectedUnlink ??
        (
          await services(
            requireBindings(context.env),
            await providerForPending(
              requireBindings(context.env),
              "points_unlink_authorization",
              body.pendingId,
            ),
            true,
          )
        ).unlink;
      const result = await service.confirm(
        authenticated.actor,
        authenticated.sessionId,
        body.pendingId,
      );
      return context.json({ data: result }, 200, { "Cache-Control": "private, no-store" });
    } catch (error) {
      return mapError(context, error);
    }
  });
}
