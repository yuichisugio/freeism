import type { Hono } from "hono";

import { createMarketsAuth } from "../../auth/create-auth";
import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";

export function registerAuthRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  app.on(["GET", "POST"], "/api/auth/*", (context) =>
    createMarketsAuth(requireBindings(context.env)).handler(context.req.raw),
  );
  app.get("/api/session", async (context) => {
    const actor = await requireMarketsSession(context, getSession);
    if (!actor) {
      return context.json(
        {
          code: "AUTHENTICATION_REQUIRED",
          status: 401,
          title: "Authentication required",
          type: "about:blank",
        },
        401,
        { "Cache-Control": "private, no-store", "Content-Type": "application/problem+json" },
      );
    }
    return context.json({ data: actor, meta: { requestId: `req_${crypto.randomUUID()}` } }, 200, {
      "Cache-Control": "private, no-store",
    });
  });
}
