import type { Context, Hono } from "hono";

import { createMarketsAuth } from "../../auth/create-auth";
import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import {
  assertNoPointsReturnTargetInput,
  POINTS_CONNECTION_RETURN_PATH,
} from "../../points/oauth-state";
import { PointsApiClient } from "../../points/points-api-client";
import {
  createPointsConnectionService,
  type PointsConnectionService,
} from "../../points/points-link-saga";
import { PointsOAuthClient } from "../../points/points-oauth-client";
import { createBetterAuthPointsTokenStore } from "../../points/points-token-store";
import {
  createPointsUnlinkAuthorizationService,
  type PointsUnlinkAuthorizationService,
} from "../../points/points-unlink-authorization";
import type { BackendContext, Bindings } from "../context";
import { requireBindings } from "../context";

function services(env: Bindings) {
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
  const tokenStore = createBetterAuthPointsTokenStore(createMarketsAuth(env));
  return {
    connection: createPointsConnectionService({
      api,
      callbackUri: `${env.APP_ORIGIN}/api/points-connection/callback`,
      db: env.DB,
      m2mClientId: env.POINTS_M2M_CLIENT_ID,
      oauth,
      pointsIssuer: env.POINTS_ISSUER,
      tokenStore,
      userClientId: env.POINTS_USER_CLIENT_ID,
    }),
    unlink: createPointsUnlinkAuthorizationService({
      api,
      callbackUri: `${env.APP_ORIGIN}/api/points-connection/unlink/callback`,
      db: env.DB,
      oauth,
      pointsIssuer: env.POINTS_ISSUER,
      tokenStore,
      userClientId: env.POINTS_USER_CLIENT_ID,
    }),
  };
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
  app.post("/api/points-connection/start", async (context) => {
    const authenticated = await actorAndSession(context, getSession);
    if (!authenticated) return problem(context, 401, "AUTHENTICATION_REQUIRED");
    try {
      assertNoPointsReturnTargetInput(new URL(context.req.url).searchParams);
      const service = injectedConnection ?? services(requireBindings(context.env)).connection;
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
      const service = injectedConnection ?? services(requireBindings(context.env)).connection;
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
      const service = injectedConnection ?? services(requireBindings(context.env)).connection;
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
      const body = await context.req.json<{ reason?: string }>();
      const service = injectedUnlink ?? services(requireBindings(context.env)).unlink;
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
      const service = injectedUnlink ?? services(requireBindings(context.env)).unlink;
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
      const service = injectedUnlink ?? services(requireBindings(context.env)).unlink;
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
