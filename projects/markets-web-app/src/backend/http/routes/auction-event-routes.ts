import type { Hono } from "hono";

import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import { D1AuctionTransitionRepository } from "../../db/d1-auction-transition-repository";
import { D1WebSocketLeaseRepository } from "../../db/d1-websocket-lease-repository";
import type { BackendContext } from "../context";
import { problemDetails } from "../problem-details";

const SAFE_QUERY_KEYS = new Set(["lastAuctionVersion", "lastBidSeq"]);

function parseCursor(value: string | undefined) {
  if (value === undefined) return 0;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function registerAuctionEventRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  app.get("/api/auctions/:auctionId/events", async (context) => {
    const url = new URL(context.req.url);
    if ([...url.searchParams.keys()].some((key) => !SAFE_QUERY_KEYS.has(key))) {
      return problemDetails(context, 400, "WEBSOCKET_QUERY_REJECTED", "WebSocket query rejected");
    }
    const lastAuctionVersion = parseCursor(context.req.query("lastAuctionVersion"));
    const lastBidSeq = parseCursor(context.req.query("lastBidSeq"));
    if (lastAuctionVersion === null || lastBidSeq === null) {
      return problemDetails(context, 400, "WEBSOCKET_CURSOR_INVALID", "WebSocket cursor invalid");
    }
    if (context.req.header("Origin") !== context.env.APP_ORIGIN) {
      return problemDetails(context, 403, "REQUEST_ORIGIN_REJECTED", "Request origin rejected");
    }
    if (context.req.header("Sec-Fetch-Site")?.toLowerCase() === "cross-site") {
      return problemDetails(
        context,
        403,
        "CROSS_SITE_REQUEST_REJECTED",
        "Cross-site request rejected",
      );
    }
    if (context.req.header("Upgrade")?.toLowerCase() !== "websocket") {
      return problemDetails(
        context,
        400,
        "WEBSOCKET_UPGRADE_REQUIRED",
        "WebSocket upgrade required",
      );
    }

    const actor = await requireMarketsSession(context, getSession);
    if (!actor) {
      return problemDetails(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }
    const auctionId = context.req.param("auctionId");
    const transitions = new D1AuctionTransitionRepository(context.env.DB);
    if (!(await transitions.isPubliclyVisible(auctionId))) {
      return problemDetails(context, 404, "AUCTION_NOT_FOUND", "Auction not found");
    }

    const connectionId = `ws_${crypto.randomUUID()}`;
    const leases = new D1WebSocketLeaseRepository(context.env.DB);
    const lease = await leases.acquire(actor.marketsUserId, auctionId, connectionId);
    if (!lease) {
      return problemDetails(context, 429, "WEBSOCKET_CONNECTION_LIMIT", "Connection limit reached");
    }

    try {
      const stub = context.env.AUCTION_ROOMS.getByName(auctionId);
      const response = await stub.fetch("https://auction-room.internal/connect", {
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "X-Auction-Id": auctionId,
          "X-Connection-Id": connectionId,
          "X-Last-Auction-Version": String(lastAuctionVersion),
          "X-Last-Bid-Seq": String(lastBidSeq),
          "X-Markets-User-Id": actor.marketsUserId,
        },
      });
      if (response.status !== 101) await leases.release(connectionId, actor.marketsUserId);
      return response;
    } catch (error) {
      await leases.release(connectionId, actor.marketsUserId);
      throw error;
    }
  });
}
