import type { Context, Hono } from "hono";

import { requireMarketsAdmin } from "../../auth/require-markets-admin";
import type { GetSession } from "../../auth/require-markets-session";
import {
  activatePointsProvider,
  createPointsProvider,
  listPointsProviderViews,
  stopPointsProvider,
} from "../../points/manage-points-providers";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { createIdempotencyMiddleware } from "../middleware/idempotency-middleware";
import {
  jsonMutationBodyLimit,
  requestSecurityMiddleware,
} from "../middleware/request-security-middleware";

function problem(
  context: Context<BackendContext>,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500,
  code: string,
) {
  return context.json({ code, status, title: code, type: "about:blank" }, status, {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/problem+json",
  });
}

function mapError(context: Context<BackendContext>, error: unknown) {
  const code = error instanceof Error ? error.message : "POINTS_PROVIDER_REQUEST_FAILED";
  if (code === "MARKETS_ADMIN_REQUIRED") return problem(context, 403, code);
  if (code === "FRESH_GOOGLE_AUTH_REQUIRED") return problem(context, 401, code);
  if (code === "POINTS_PROVIDER_NOT_FOUND") return problem(context, 404, code);
  if (
    code === "POINTS_PROVIDER_ORIGIN_DUPLICATED" ||
    code === "POINTS_PROVIDER_NOT_PENDING" ||
    code === "POINTS_PROVIDER_NOT_ACTIVE"
  )
    return problem(context, 409, code);
  if (
    code === "POINTS_PROVIDER_CLIENT_VERIFICATION_FAILED" ||
    (code.startsWith("POINTS_PROVIDER_") && code.endsWith("_INVALID"))
  ) {
    return problem(context, 422, code);
  }
  if (code === "IDEMPOTENCY_KEY_REQUIRED") return problem(context, 400, code);
  return problem(context, 500, "POINTS_PROVIDER_REQUEST_FAILED");
}

async function requireFreshAdmin(context: Context<BackendContext>, getSession: GetSession) {
  const idempotencyKey = context.req.header("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  }
  const admin = await requireMarketsAdmin(context, getSession);
  if (!admin) return null;
  const sessionId = context.get("authSession").session.id;
  if (!sessionId) throw new Error("FRESH_GOOGLE_AUTH_REQUIRED");
  const row = await requireBindings(context.env)
    .DB.prepare(`SELECT created_at AS createdAt FROM session WHERE id = ? AND user_id = ?`)
    .bind(sessionId, admin.authUserId)
    .first<{ createdAt: number }>();
  if (!row || Date.now() - row.createdAt > 900_000 || row.createdAt > Date.now()) {
    throw new Error("FRESH_GOOGLE_AUTH_REQUIRED");
  }
  return admin;
}

async function readBody(context: Context<BackendContext>) {
  const body: unknown = await context.req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("POINTS_PROVIDER_REQUEST_INVALID");
  }
  return body as Record<string, unknown>;
}

/** 提供先の管理と、利用者へ表示するACTIVE一覧。 */
export function registerPointsProviderRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  app.get("/api/points-providers", async (context) => {
    return context.json({
      data: await listPointsProviderViews(requireBindings(context.env), true),
    });
  });

  app.get("/api/admin/points-connections", async (context) => {
    try {
      const admin = await requireMarketsAdmin(context, getSession);
      if (!admin) return problem(context, 401, "AUTHENTICATION_REQUIRED");
      return context.json({ data: await listPointsProviderViews(requireBindings(context.env)) });
    } catch (error) {
      return mapError(context, error);
    }
  });

  const mutation = (operation: string, targetParam?: string) =>
    [
      jsonMutationBodyLimit,
      requestSecurityMiddleware,
      createIdempotencyMiddleware(getSession, operation, targetParam),
    ] as const;

  app.post(
    "/api/admin/points-connections",
    ...mutation("points-provider-create"),
    async (context) => {
      try {
        const admin = await requireFreshAdmin(context, getSession);
        if (!admin) return problem(context, 401, "AUTHENTICATION_REQUIRED");
        const body = await readBody(context);
        const requestId = `req_${crypto.randomUUID()}`;
        const data = await createPointsProvider(requireBindings(context.env), {
          origin: body.origin,
          displayName: body.displayName,
          reason: body.reason,
          actorMarketsUserId: admin.marketsUserId,
          requestId,
        });
        return context.json({ data, meta: { requestId } }, 201);
      } catch (error) {
        return mapError(context, error);
      }
    },
  );

  app.post(
    "/api/admin/points-connections/:providerId/activate",
    ...mutation("points-provider-activate", "providerId"),
    async (context) => {
      try {
        const admin = await requireFreshAdmin(context, getSession);
        if (!admin) return problem(context, 401, "AUTHENTICATION_REQUIRED");
        const body = await readBody(context);
        const requestId = `req_${crypto.randomUUID()}`;
        const data = await activatePointsProvider(requireBindings(context.env), {
          providerId: context.req.param("providerId"),
          clientId: body.clientId,
          reason: body.reason,
          actorMarketsUserId: admin.marketsUserId,
          requestId,
        });
        return context.json({ data, meta: { requestId } }, 200);
      } catch (error) {
        return mapError(context, error);
      }
    },
  );

  app.post(
    "/api/admin/points-connections/:providerId/stop",
    ...mutation("points-provider-stop", "providerId"),
    async (context) => {
      try {
        const admin = await requireFreshAdmin(context, getSession);
        if (!admin) return problem(context, 401, "AUTHENTICATION_REQUIRED");
        const body = await readBody(context);
        const requestId = `req_${crypto.randomUUID()}`;
        const data = await stopPointsProvider(requireBindings(context.env), {
          providerId: context.req.param("providerId"),
          reason: body.reason,
          actorMarketsUserId: admin.marketsUserId,
          requestId,
        });
        return context.json({ data, meta: { requestId } }, 200);
      } catch (error) {
        return mapError(context, error);
      }
    },
  );
}
