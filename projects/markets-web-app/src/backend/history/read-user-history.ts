export type UserHistoryKind = "BIDS" | "CREATED" | "PUBLIC" | "WON";

interface HistoryRow {
  auctionId: string;
  description: string;
  endsAt: string;
  historyAt: string;
  historyType: "BID" | "CREATED" | "WON";
  pointPackageId: string;
  pointPackageName: string;
  quantity: number;
  startsAt: string;
  status: string;
  title: string;
}

function encodeCursor(row: Pick<HistoryRow, "auctionId" | "historyAt" | "historyType">) {
  return btoa(JSON.stringify([row.historyAt, row.auctionId, row.historyType]))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeCursor(value: string): [string, string, string] {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 3 ||
      decoded.some((part) => typeof part !== "string")
    ) {
      throw new Error();
    }
    return decoded as [string, string, string];
  } catch {
    throw new Error("USER_HISTORY_CURSOR_INVALID");
  }
}

const CARD_SELECT = `a.id AS auctionId, a.status, r.title, r.description, r.quantity,
  r.starts_at AS startsAt, r.ends_at AS endsAt,
  p.point_package_id AS pointPackageId, p.name AS pointPackageName`;
const CARD_JOINS = `JOIN auction_revisions r ON r.id = a.current_revision_id
  JOIN point_package_snapshots p ON p.id = r.point_package_snapshot_id`;

function historySource(kind: UserHistoryKind) {
  const created = `SELECT ${CARD_SELECT}, a.created_at AS historyAt, 'CREATED' AS historyType
    FROM auctions a ${CARD_JOINS}
    WHERE a.seller_markets_user_id = ?`;
  const bids = `SELECT ${CARD_SELECT}, MAX(be.created_at) AS historyAt, 'BID' AS historyType
    FROM bid_events be JOIN auctions a ON a.id = be.auction_id ${CARD_JOINS}
    WHERE be.bidder_markets_user_id = ? GROUP BY a.id`;
  const won = `SELECT ${CARD_SELECT}, MAX(sa.settled_at) AS historyAt, 'WON' AS historyType
    FROM settlement_allocations sa JOIN auctions a ON a.id = sa.auction_id ${CARD_JOINS}
    WHERE sa.buyer_markets_user_id = ? GROUP BY a.id`;
  if (kind === "CREATED") return { bindings: 1, sql: created };
  if (kind === "BIDS") return { bindings: 1, sql: bids };
  if (kind === "WON") return { bindings: 1, sql: won };
  return {
    bindings: 2,
    sql: `${created} AND a.status NOT IN ('DRAFT', 'CANCELLED') UNION ALL ${won}`,
  };
}

export async function readUserHistory(
  db: D1Database,
  input: { cursor?: string; kind: UserHistoryKind; limit: number; marketsUserId: string },
) {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 50) {
    throw new Error("USER_HISTORY_LIMIT_INVALID");
  }
  const exists = await db
    .prepare("SELECT 1 AS found FROM markets_user WHERE id = ? LIMIT 1")
    .bind(input.marketsUserId)
    .first<number>("found");
  if (exists !== 1) throw new Error("MARKETS_USER_NOT_FOUND");
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;
  const source = historySource(input.kind);
  const bindings = Array.from({ length: source.bindings }, () => input.marketsUserId) as unknown[];
  const cursorWhere = cursor
    ? "WHERE historyAt < ? OR (historyAt = ? AND (auctionId < ? OR (auctionId = ? AND historyType < ?)))"
    : "";
  if (cursor) bindings.push(cursor[0], cursor[0], cursor[1], cursor[1], cursor[2]);
  bindings.push(input.limit + 1);
  const rows = await db
    .prepare(
      `SELECT * FROM (${source.sql}) history
       ${cursorWhere}
       ORDER BY historyAt DESC, auctionId DESC, historyType DESC LIMIT ?`,
    )
    .bind(...bindings)
    .all<HistoryRow>();
  const hasMore = rows.results.length > input.limit;
  const data = rows.results.slice(0, input.limit);
  return { cursor: hasMore ? encodeCursor(data.at(-1)!) : null, data, hasMore };
}
