export type AuctionTransitionStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "OPEN"
  | "CLOSING"
  | "SETTLING"
  | "SETTLED"
  | "CANCELLED"
  | "SETTLEMENT_RETRYABLE"
  | "SETTLEMENT_MANUAL_ACTION_REQUIRED";

export interface AuctionTransitionSnapshot {
  auctionId: string;
  currentRevisionId: string;
  endsAt: string;
  lastBidSeq: number;
  revisionNumber: number;
  startsAt: string;
  status: AuctionTransitionStatus;
  version: number;
}

export class D1AuctionTransitionRepository {
  constructor(private readonly db: D1Database) {}

  async findCurrent(auctionId: string): Promise<AuctionTransitionSnapshot | null> {
    return this.db
      .prepare(
        `SELECT a.id AS auctionId, a.current_revision_id AS currentRevisionId,
                a.status, a.version, r.revision_number AS revisionNumber,
                r.starts_at AS startsAt, r.ends_at AS endsAt,
                COALESCE((SELECT MAX(bid_seq) FROM bid_events WHERE auction_id = a.id), 0) AS lastBidSeq
         FROM auctions a
         JOIN auction_revisions r ON r.id = a.current_revision_id
         WHERE a.id = ?`,
      )
      .bind(auctionId)
      .first<AuctionTransitionSnapshot>();
  }

  async isPubliclyVisible(auctionId: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT status FROM auctions WHERE id = ?")
      .bind(auctionId)
      .first<{ status: AuctionTransitionStatus }>();
    return row !== null && row.status !== "DRAFT" && row.status !== "CANCELLED";
  }

  async compareAndSetStatus(
    snapshot: AuctionTransitionSnapshot,
    nextStatus: "OPEN" | "CLOSING",
    serverNow: string,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        `UPDATE auctions
         SET status = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND current_revision_id = ? AND status = ? AND version = ?`,
      )
      .bind(
        nextStatus,
        serverNow,
        snapshot.auctionId,
        snapshot.currentRevisionId,
        snapshot.status,
        snapshot.version,
      )
      .run();
    return result.meta.changes === 1;
  }
}
