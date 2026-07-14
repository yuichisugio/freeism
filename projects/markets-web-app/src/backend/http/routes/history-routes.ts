import type { Context, Hono } from "hono";

import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import { readUserHistory, type UserHistoryKind } from "../../history/read-user-history";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problemDetails } from "../problem-details";

const PUBLIC_CACHE = "public, max-age=30, stale-while-revalidate=30";
const PRIVATE_CACHE = "private, no-store";

function cursorResponse(result: Awaited<ReturnType<typeof readUserHistory>>) {
  return {
    data: result.data,
    meta: {
      cursor: result.cursor,
      hasMore: result.hasMore,
      requestId: `req_${crypto.randomUUID()}`,
    },
  };
}

export function registerHistoryRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  async function readPrivate(
    context: Context<BackendContext>,
    kind: Exclude<UserHistoryKind, "PUBLIC">,
  ) {
    const actor = await requireMarketsSession(context, getSession);
    if (!actor) {
      return problemDetails(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }
    try {
      const result = await readUserHistory(requireBindings(context.env).DB, {
        cursor: context.req.query("cursor"),
        kind,
        limit: context.req.query("limit") === undefined ? 20 : Number(context.req.query("limit")),
        marketsUserId: actor.marketsUserId,
      });
      return context.json(cursorResponse(result), 200, { "Cache-Control": PRIVATE_CACHE });
    } catch (error) {
      const code = error instanceof Error ? error.message : "USER_HISTORY_READ_FAILED";
      if (code === "USER_HISTORY_CURSOR_INVALID" || code === "USER_HISTORY_LIMIT_INVALID") {
        return problemDetails(context, 400, code, "History query invalid");
      }
      throw error;
    }
  }

  app.get("/api/me/auctions/created", (context) => readPrivate(context, "CREATED"));
  app.get("/api/me/auctions/bids", (context) => readPrivate(context, "BIDS"));
  app.get("/api/me/auctions/won", (context) => readPrivate(context, "WON"));

  app.get("/api/v1/users/:marketsUserId/history", async (context) => {
    try {
      const result = await readUserHistory(requireBindings(context.env).DB, {
        cursor: context.req.query("cursor"),
        kind: "PUBLIC",
        limit: context.req.query("limit") === undefined ? 20 : Number(context.req.query("limit")),
        marketsUserId: context.req.param("marketsUserId"),
      });
      return context.json(cursorResponse(result), 200, { "Cache-Control": PUBLIC_CACHE });
    } catch (error) {
      const code = error instanceof Error ? error.message : "USER_HISTORY_READ_FAILED";
      if (code === "MARKETS_USER_NOT_FOUND") {
        return problemDetails(context, 404, code, "Markets user not found");
      }
      if (code === "USER_HISTORY_CURSOR_INVALID" || code === "USER_HISTORY_LIMIT_INVALID") {
        return problemDetails(context, 400, code, "History query invalid");
      }
      throw error;
    }
  });
}
