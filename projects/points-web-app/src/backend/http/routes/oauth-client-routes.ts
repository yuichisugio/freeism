import type { Context, Hono } from "hono";
import * as v from "valibot";

import { oauthClientSchema } from "../../../shared/schemas/oauth-client-schema";
import { createPointsAuth } from "../../auth/create-auth";
import {
  deleteOAuthClient,
  listOAuthClients,
  OAuthClientManagementError,
  readOAuthClient,
  registerOAuthClient,
  updateOAuthClient,
} from "../../usecases/oauth-client-management";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

/** Accounts v0.1 と同じ開発者向け OAuth クライアント管理 API。 */
export function registerOAuthClientRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const session = createSessionMiddleware(getSession);

  app.get("/api/oauth-clients", session, async (context) => {
    const clients = await listOAuthClients(createDeps(context));
    return context.json({ data: { clients } }, 200, { "Cache-Control": "private, no-store" });
  });

  app.post("/api/oauth-clients", session, async (context) => {
    const input = await parseInput(context);
    if (input instanceof Response) return input;
    try {
      const client = await registerOAuthClient(createDeps(context), input);
      return context.json({ data: client }, 201, { "Cache-Control": "private, no-store" });
    } catch (error) {
      return handleManagementError(context, error);
    }
  });

  app.get("/api/oauth-clients/:clientId", session, async (context) => {
    try {
      const client = await readOAuthClient(createDeps(context), context.req.param("clientId"));
      return context.json({ data: client }, 200, { "Cache-Control": "private, no-store" });
    } catch (error) {
      return handleManagementError(context, error);
    }
  });

  app.put("/api/oauth-clients/:clientId", session, async (context) => {
    const input = await parseInput(context);
    if (input instanceof Response) return input;
    try {
      const client = await updateOAuthClient(
        createDeps(context),
        context.req.param("clientId"),
        input,
      );
      return context.json({ data: client }, 200, { "Cache-Control": "private, no-store" });
    } catch (error) {
      return handleManagementError(context, error);
    }
  });

  app.delete("/api/oauth-clients/:clientId", session, async (context) => {
    try {
      await deleteOAuthClient(createDeps(context), context.req.param("clientId"));
      return context.json({ data: { ok: true } }, 200, { "Cache-Control": "private, no-store" });
    } catch (error) {
      return handleManagementError(context, error);
    }
  });
}

function createDeps(context: Context<BackendContext>) {
  const bindings = requireBindings(context.env);
  return {
    auth: createPointsAuth(bindings),
    database: bindings.DB,
    headers: context.req.raw.headers,
    userId: context.get("authSession").user.id,
  };
}

async function parseInput(context: Context<BackendContext>) {
  let raw: unknown;
  try {
    raw = await context.req.json();
  } catch {
    return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
  }
  const parsed = v.safeParse(oauthClientSchema, raw);
  if (!parsed.success) {
    return problem(context, 400, "INVALID_VALUE", "Invalid OAuth client fields");
  }
  return parsed.output;
}

function handleManagementError(context: Context<BackendContext>, error: unknown): Response {
  if (!(error instanceof OAuthClientManagementError)) throw error;
  const status =
    error.code === "CLIENT_NOT_FOUND"
      ? 404
      : error.code === "CLIENT_LIMIT_REACHED"
        ? 409
        : error.code === "CLIENT_KEY_SAVE_FAILED"
          ? 500
          : 400;
  return problem(context, status, error.code, error.message);
}
