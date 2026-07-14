import type { Context, Hono } from "hono";

import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import { readWatchlist, updateWatchlist } from "../../history/update-watchlist";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problemDetails } from "../problem-details";

const PRIVATE_CACHE = "private, no-store";

export function registerWatchlistRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  app.get("/api/watchlist", async (context) => {
    const actor = await requireMarketsSession(context, getSession);
    if (!actor) {
      return problemDetails(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }
    try {
      const result = await readWatchlist(requireBindings(context.env).DB, {
        cursor: context.req.query("cursor"),
        limit: context.req.query("limit") === undefined ? 20 : Number(context.req.query("limit")),
        marketsUserId: actor.marketsUserId,
      });
      return context.json(
        {
          data: result.data,
          meta: {
            cursor: result.cursor,
            hasMore: result.hasMore,
            requestId: `req_${crypto.randomUUID()}`,
          },
        },
        200,
        { "Cache-Control": PRIVATE_CACHE },
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "WATCHLIST_READ_FAILED";
      if (code === "WATCHLIST_CURSOR_INVALID" || code === "WATCHLIST_LIMIT_INVALID") {
        return problemDetails(context, 400, code, "Watchlist query invalid");
      }
      throw error;
    }
  });

  async function mutate(context: Context<BackendContext>, operation: "ADD" | "REMOVE") {
    const actor = await requireMarketsSession(context, getSession);
    if (!actor) {
      return problemDetails(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }
    try {
      const env = requireBindings(context.env);
      const auctionId = context.req.param("auctionId");
      if (!auctionId) {
        return problemDetails(context, 404, "AUCTION_NOT_FOUND", "Auction not found");
      }
      const data = await updateWatchlist(env.DB, {
        auctionId,
        environment: env.APP_ENV,
        marketsUserId: actor.marketsUserId,
        operation,
        requestId: `req_${crypto.randomUUID()}`,
      });
      return context.json({ data }, 200, { "Cache-Control": PRIVATE_CACHE });
    } catch (error) {
      if (error instanceof Error && error.message === "AUCTION_NOT_FOUND") {
        return problemDetails(context, 404, "AUCTION_NOT_FOUND", "Auction not found");
      }
      throw error;
    }
  }

  app.put("/api/watchlist/:auctionId", (context) => mutate(context, "ADD"));
  app.delete("/api/watchlist/:auctionId", (context) => mutate(context, "REMOVE"));
}
