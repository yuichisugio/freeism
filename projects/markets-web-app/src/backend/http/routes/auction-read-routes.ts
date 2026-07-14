import type { Context, Hono } from "hono";

import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import { listPublicAuctions, readPublicAuction } from "../../history/read-auction-history";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { problemDetails } from "../problem-details";

const PUBLIC_CACHE = "public, max-age=30, stale-while-revalidate=30";
const PRIVATE_CACHE = "private, no-store";

export function registerAuctionReadRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  async function list(context: Context<BackendContext>, isPublic: boolean) {
    try {
      const actor = isPublic ? null : await requireMarketsSession(context, getSession);
      if (!isPublic && !actor) {
        return problemDetails(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      }
      const result = await listPublicAuctions(requireBindings(context.env).DB, {
        cursor: context.req.query("cursor"),
        limit: context.req.query("limit") === undefined ? 20 : Number(context.req.query("limit")),
        query: context.req.query("query"),
        sellerMarketsUserId: actor?.marketsUserId,
        status: context.req.query("status"),
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
        { "Cache-Control": isPublic ? PUBLIC_CACHE : PRIVATE_CACHE },
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "AUCTION_READ_FAILED";
      if (
        ["AUCTION_CURSOR_INVALID", "AUCTION_LIMIT_INVALID", "AUCTION_STATUS_INVALID"].includes(code)
      ) {
        return problemDetails(context, 400, code, "Auction query invalid");
      }
      throw error;
    }
  }

  async function detail(context: Context<BackendContext>, isPublic: boolean) {
    const auctionId = context.req.param("auctionId");
    if (!auctionId) return problemDetails(context, 404, "AUCTION_NOT_FOUND", "Auction not found");
    try {
      const actor = isPublic ? null : await requireMarketsSession(context, getSession);
      if (!isPublic && !actor) {
        return problemDetails(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      }
      const db = requireBindings(context.env).DB;
      if (actor) await readPublicAuction(db, auctionId, actor.marketsUserId);
      await context.env.AUCTION_ROOMS.getByName(auctionId).advanceDueTransitions(
        new Date().toISOString(),
      );
      const data = await readPublicAuction(db, auctionId, actor?.marketsUserId);
      return context.json({ data }, 200, {
        "Cache-Control": isPublic ? PUBLIC_CACHE : PRIVATE_CACHE,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "AUCTION_NOT_FOUND") {
        return problemDetails(context, 404, "AUCTION_NOT_FOUND", "Auction not found");
      }
      throw error;
    }
  }

  app.get("/api/v1/auctions", (context) => list(context, true));
  app.get("/api/v1/auctions/:auctionId", (context) => detail(context, true));
  app.get("/api/auctions", (context) => list(context, false));
  app.get("/api/auctions/:auctionId", (context) => detail(context, false));
}
