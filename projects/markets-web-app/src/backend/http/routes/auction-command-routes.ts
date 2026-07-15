import type { Context, Hono } from "hono";

import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import {
  AuctionCommandError,
  type HttpAuctionCommand,
} from "../../auction/execute-auction-command";
import type { BackendContext } from "../context";
import { problemDetails, type ProblemStatus } from "../problem-details";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AuctionCommandError("MALFORMED_REQUEST");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  throw new AuctionCommandError("MALFORMED_REQUEST");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mapError(context: Context<BackendContext>, error: unknown) {
  const code =
    error instanceof AuctionCommandError
      ? error.code
      : ((error as { code?: unknown }).code ?? (error instanceof Error ? error.message : ""));
  const statuses: Record<string, ProblemStatus> = {
    AUCTION_NOT_FOUND: 404,
    AUCTION_NOT_OPEN: 409,
    AUCTION_VERSION_CONFLICT: 409,
    AUTO_BID_MAX_DECREASED: 422,
    AUTO_BID_MAX_EXCEEDED: 422,
    AUTO_BID_PRICE_DECREASED: 422,
    BUY_NOW_QUANTITY_UNAVAILABLE: 409,
    BUY_NOW_UNAVAILABLE: 409,
    IDEMPOTENCY_KEY_REUSED: 409,
    INVALID_PRICE_TICK: 422,
    INVALID_QUANTITY: 422,
    POINTS_LINK_REQUIRED: 403,
    SELLER_CANNOT_BID: 403,
  };
  if (typeof code === "string" && statuses[code]) {
    return problemDetails(context, statuses[code], code, code);
  }
  return problemDetails(context, 500, "AUCTION_COMMAND_FAILED", "Auction command failed");
}

async function execute(
  context: Context<BackendContext>,
  getSession: GetSession,
  body: Record<string, unknown>,
  command: HttpAuctionCommand,
) {
  const idempotencyKey = context.req.header("Idempotency-Key")?.trim();
  if (!idempotencyKey) {
    return problemDetails(context, 400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key required");
  }
  if (idempotencyKey.length > 200) {
    return problemDetails(context, 400, "MALFORMED_REQUEST", "Idempotency-Key is too long");
  }
  const actor = await requireMarketsSession(context, getSession);
  if (!actor) {
    return problemDetails(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  const commandId = typeof body.commandId === "string" ? body.commandId.trim() : "";
  const expectedAuctionVersion = body.expectedAuctionVersion;
  if (
    !commandId ||
    commandId.length > 200 ||
    !Number.isSafeInteger(expectedAuctionVersion) ||
    Number(expectedAuctionVersion) <= 0
  ) {
    return problemDetails(context, 400, "MALFORMED_REQUEST", "Invalid auction command");
  }
  const payloadHash = await sha256Hex(canonicalJson(body));
  const auctionId = context.req.param("auctionId");
  if (!auctionId) return problemDetails(context, 404, "AUCTION_NOT_FOUND", "Auction not found");
  try {
    const result = await context.env.AUCTION_ROOMS.getByName(auctionId).executeCommand({
      actor,
      auctionId,
      command,
      commandId,
      expectedAuctionVersion: Number(expectedAuctionVersion),
      idempotencyKey,
      payloadHash,
      serverNow: new Date().toISOString(),
    });
    return context.json({ data: result }, result.kind === "BUY_NOW_PENDING" ? 202 : 200, {
      "Cache-Control": "private, no-store",
    });
  } catch (error) {
    return mapError(context, error);
  }
}

export function registerAuctionCommandRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  app.post("/api/auctions/:auctionId/bids", async (context) => {
    let body: Record<string, unknown>;
    try {
      body = await context.req.json<Record<string, unknown>>();
    } catch {
      return problemDetails(context, 400, "MALFORMED_REQUEST", "Malformed JSON request");
    }
    return execute(context, getSession, body, {
      autoBidMaxTickCount:
        body.autoBidMaxTickCount === undefined ? undefined : Number(body.autoBidMaxTickCount),
      kind: "PLACE_BID",
      priceTickCount: Number(body.priceTickCount),
      quantity: Number(body.quantity),
    });
  });

  app.delete("/api/auctions/:auctionId/auto-bid", async (context) => {
    let body: Record<string, unknown>;
    try {
      body = await context.req.json<Record<string, unknown>>();
    } catch {
      return problemDetails(context, 400, "MALFORMED_REQUEST", "Malformed JSON request");
    }
    return execute(context, getSession, body, { kind: "CANCEL_AUTO_BID" });
  });

  app.post("/api/auctions/:auctionId/buy-now", async (context) => {
    let body: Record<string, unknown>;
    try {
      body = await context.req.json<Record<string, unknown>>();
    } catch {
      return problemDetails(context, 400, "MALFORMED_REQUEST", "Malformed JSON request");
    }
    return execute(context, getSession, body, {
      kind: "BUY_NOW",
      quantity: Number(body.quantity),
    });
  });
}
