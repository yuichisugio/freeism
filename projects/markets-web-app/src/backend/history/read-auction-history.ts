export interface AuctionListQuery {
  cursor?: string;
  limit: number;
  query?: string;
  sellerMarketsUserId?: string;
  status?: string;
}

interface AuctionRow {
  auctionId: string;
  buyNowPriceTickCount: number | null;
  createdAt: string;
  description: string;
  endsAt: string;
  externalUrl: string;
  packageTick: number;
  pointPackageId: string;
  pointPackageName: string;
  pointPackageRevisionId: string;
  quantity: number;
  sellerIdentitySnapshot: string;
  startsAt: string;
  status: string;
  title: string;
  version: number;
}

interface BidEventRow {
  bidSeq: number;
  bidderMarketsUserId: string;
  createdAt: string;
  eventType: string;
  priceTickCount: number;
  quantity: number;
}

interface AllocationRow {
  buyerMarketsUserId: string;
  proofId: string | null;
  quantity: number;
  settledAt: string;
  uniformPriceTickCount: number;
}

const PUBLIC_STATUSES = new Set([
  "SCHEDULED",
  "OPEN",
  "CLOSING",
  "SETTLING",
  "SETTLED",
  "SETTLEMENT_RETRYABLE",
  "SETTLEMENT_MANUAL_ACTION_REQUIRED",
]);
const OWN_STATUSES = new Set([...PUBLIC_STATUSES, "DRAFT", "CANCELLED"]);

function publicIdentity(snapshot: string) {
  try {
    const value = JSON.parse(snapshot) as Record<string, unknown>;
    return {
      ...(typeof value.displayName === "string" ? { displayName: value.displayName } : {}),
      ...(typeof value.marketsUserId === "string" ? { marketsUserId: value.marketsUserId } : {}),
    };
  } catch {
    return {};
  }
}

function publicAuction(row: AuctionRow) {
  return {
    auctionId: row.auctionId,
    buyNowPriceTickCount: row.buyNowPriceTickCount,
    description: row.description,
    endsAt: row.endsAt,
    externalUrl: row.externalUrl,
    packageTick: row.packageTick,
    pointPackageId: row.pointPackageId,
    pointPackageName: row.pointPackageName,
    pointPackageRevisionId: row.pointPackageRevisionId,
    quantity: row.quantity,
    seller: publicIdentity(row.sellerIdentitySnapshot),
    startsAt: row.startsAt,
    status: row.status,
    title: row.title,
    version: row.version,
  };
}

function encodeCursor(row: Pick<AuctionRow, "auctionId" | "createdAt">) {
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
    throw new Error("AUCTION_CURSOR_INVALID");
  }
}

const AUCTION_SELECT = `SELECT a.id AS auctionId, a.status, a.version, a.created_at AS createdAt,
       r.title, r.description, r.external_url AS externalUrl, r.quantity,
       r.starts_at AS startsAt, r.ends_at AS endsAt, r.package_tick AS packageTick,
       r.buy_now_price_tick_count AS buyNowPriceTickCount,
       r.seller_identity_snapshot AS sellerIdentitySnapshot,
       p.point_package_id AS pointPackageId,
       p.point_package_revision_id AS pointPackageRevisionId, p.name AS pointPackageName
FROM auctions a
JOIN auction_revisions r ON r.id = a.current_revision_id
JOIN point_package_snapshots p ON p.id = r.point_package_snapshot_id`;

export async function listPublicAuctions(db: D1Database, input: AuctionListQuery) {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 50) {
    throw new Error("AUCTION_LIMIT_INVALID");
  }
  const allowedStatuses = input.sellerMarketsUserId ? OWN_STATUSES : PUBLIC_STATUSES;
  if (input.status && !allowedStatuses.has(input.status)) throw new Error("AUCTION_STATUS_INVALID");
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;
  const clauses = input.sellerMarketsUserId
    ? ["a.seller_markets_user_id = ?"]
    : ["a.status NOT IN ('DRAFT', 'CANCELLED')"];
  const bindings: unknown[] = [];
  if (input.sellerMarketsUserId) bindings.push(input.sellerMarketsUserId);
  if (input.status) {
    clauses.push("a.status = ?");
    bindings.push(input.status);
  }
  const query = input.query?.trim();
  if (query) {
    clauses.push(`(a.id = ? OR p.point_package_id = ? OR instr(lower(r.title), ?) > 0
      OR instr(lower(r.description), ?) > 0 OR instr(lower(p.name), ?) > 0)`);
    const normalized = query.toLocaleLowerCase("und");
    bindings.push(query, query, normalized, normalized, normalized);
  }
  if (cursor) {
    clauses.push("(a.created_at < ? OR (a.created_at = ? AND a.id < ?))");
    bindings.push(cursor[0], cursor[0], cursor[1]);
  }
  bindings.push(input.limit + 1);
  const rows = await db
    .prepare(
      `${AUCTION_SELECT}
       WHERE ${clauses.join(" AND ")}
       ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    )
    .bind(...bindings)
    .all<AuctionRow>();
  const hasMore = rows.results.length > input.limit;
  const page = rows.results.slice(0, input.limit);
  return {
    cursor: hasMore ? encodeCursor(page.at(-1)!) : null,
    data: page.map(publicAuction),
    hasMore,
  };
}

export async function readPublicAuction(
  db: D1Database,
  auctionId: string,
  sellerMarketsUserId?: string,
) {
  const visibility = sellerMarketsUserId
    ? "a.seller_markets_user_id = ?"
    : "a.status NOT IN ('DRAFT', 'CANCELLED')";
  const row = await db
    .prepare(`${AUCTION_SELECT} WHERE a.id = ? AND ${visibility} LIMIT 1`)
    .bind(...(sellerMarketsUserId ? [auctionId, sellerMarketsUserId] : [auctionId]))
    .first<AuctionRow>();
  if (!row) throw new Error("AUCTION_NOT_FOUND");
  const [events, allocations] = await Promise.all([
    db
      .prepare(
        `SELECT bid_seq AS bidSeq, bidder_markets_user_id AS bidderMarketsUserId,
                event_type AS eventType, quantity, price_tick_count AS priceTickCount,
                created_at AS createdAt
         FROM bid_events WHERE auction_id = ? ORDER BY bid_seq DESC LIMIT 100`,
      )
      .bind(auctionId)
      .all<BidEventRow>(),
    db
      .prepare(
        `SELECT sa.buyer_markets_user_id AS buyerMarketsUserId, sa.quantity,
                sa.uniform_price_tick_count AS uniformPriceTickCount,
                sa.settled_at AS settledAt, p.id AS proofId
         FROM settlement_allocations sa
         LEFT JOIN proofs p ON p.allocation_id = sa.id
         WHERE sa.auction_id = ? ORDER BY sa.allocation_ordinal`,
      )
      .bind(auctionId)
      .all<AllocationRow>(),
  ]);
  return {
    ...publicAuction(row),
    allocations: allocations.results,
    events: events.results,
  };
}
