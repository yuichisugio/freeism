export type WatchlistOperation = "ADD" | "REMOVE";

export async function updateWatchlist(
  db: D1Database,
  input: {
    auctionId: string;
    environment: string;
    marketsUserId: string;
    operation: WatchlistOperation;
    requestId: string;
  },
) {
  const visible = await db
    .prepare(
      `SELECT 1 AS found FROM auctions
       WHERE id = ? AND status NOT IN ('DRAFT', 'CANCELLED') LIMIT 1`,
    )
    .bind(input.auctionId)
    .first<number>("found");
  if (visible !== 1) throw new Error("AUCTION_NOT_FOUND");

  const statement =
    input.operation === "ADD"
      ? db
          .prepare(
            `INSERT OR IGNORE INTO watchlist_entries (id, markets_user_id, auction_id)
             VALUES (?, ?, ?)`,
          )
          .bind(`watch_${crypto.randomUUID()}`, input.marketsUserId, input.auctionId)
      : db
          .prepare("DELETE FROM watchlist_entries WHERE markets_user_id = ? AND auction_id = ?")
          .bind(input.marketsUserId, input.auctionId);
  const result = await statement.run();
  if (result.meta.changes === 1) {
    await db
      .prepare(
        `INSERT INTO audit_events
         (id, actor_markets_user_id, event_code, target_type, target_id,
          after_json, request_id, environment, result)
         VALUES (?, ?, ?, 'WATCHLIST_ENTRY', ?, ?, ?, ?, 'SUCCESS')`,
      )
      .bind(
        `audit_${crypto.randomUUID()}`,
        input.marketsUserId,
        input.operation === "ADD" ? "WATCHLIST_ADDED" : "WATCHLIST_REMOVED",
        input.auctionId,
        JSON.stringify({ watching: input.operation === "ADD" }),
        input.requestId,
        input.environment,
      )
      .run();
  }
  return { auctionId: input.auctionId, watching: input.operation === "ADD" };
}

interface WatchlistRow {
  auctionId: string;
  createdAt: string;
  endsAt: string;
  status: string;
  title: string;
}

function encodeCursor(row: Pick<WatchlistRow, "auctionId" | "createdAt">) {
  return btoa(JSON.stringify([row.createdAt, row.auctionId]))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeCursor(value: string): [string, string] {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 2 ||
      typeof decoded[0] !== "string" ||
      typeof decoded[1] !== "string"
    ) {
      throw new Error();
    }
    return [decoded[0], decoded[1]];
  } catch {
    throw new Error("WATCHLIST_CURSOR_INVALID");
  }
}

export async function readWatchlist(
  db: D1Database,
  input: { cursor?: string; limit: number; marketsUserId: string },
) {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 50) {
    throw new Error("WATCHLIST_LIMIT_INVALID");
  }
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;
  const statement = cursor
    ? db
        .prepare(
          `SELECT w.auction_id AS auctionId, w.created_at AS createdAt,
                  a.status, r.title, r.ends_at AS endsAt
           FROM watchlist_entries w
           JOIN auctions a ON a.id = w.auction_id
           JOIN auction_revisions r ON r.id = a.current_revision_id
           WHERE w.markets_user_id = ?
             AND (w.created_at < ? OR (w.created_at = ? AND w.auction_id < ?))
           ORDER BY w.created_at DESC, w.auction_id DESC LIMIT ?`,
        )
        .bind(input.marketsUserId, cursor[0], cursor[0], cursor[1], input.limit + 1)
    : db
        .prepare(
          `SELECT w.auction_id AS auctionId, w.created_at AS createdAt,
                  a.status, r.title, r.ends_at AS endsAt
           FROM watchlist_entries w
           JOIN auctions a ON a.id = w.auction_id
           JOIN auction_revisions r ON r.id = a.current_revision_id
           WHERE w.markets_user_id = ?
           ORDER BY w.created_at DESC, w.auction_id DESC LIMIT ?`,
        )
        .bind(input.marketsUserId, input.limit + 1);
  const rows = await statement.all<WatchlistRow>();
  const hasMore = rows.results.length > input.limit;
  const data = rows.results.slice(0, input.limit);
  return { cursor: hasMore ? encodeCursor(data.at(-1)!) : null, data, hasMore };
}
