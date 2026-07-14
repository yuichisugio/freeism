export interface WebSocketLease {
  auctionId: string;
  auctionSlot: number;
  connectionId: string;
  marketsUserId: string;
  userSlot: number;
}

export class D1WebSocketLeaseRepository {
  constructor(private readonly db: D1Database) {}

  async acquire(
    marketsUserId: string,
    auctionId: string,
    connectionId: string,
  ): Promise<WebSocketLease | null> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const rows = await this.db
        .prepare(
          `SELECT user_slot AS userSlot, auction_slot AS auctionSlot, auction_id AS auctionId
           FROM websocket_slot_leases WHERE markets_user_id = ?`,
        )
        .bind(marketsUserId)
        .all<{ auctionId: string; auctionSlot: number; userSlot: number }>();
      const usedUserSlots = new Set(rows.results.map((row) => row.userSlot));
      const usedAuctionSlots = new Set(
        rows.results.filter((row) => row.auctionId === auctionId).map((row) => row.auctionSlot),
      );
      const userSlot = Array.from({ length: 20 }, (_, index) => index + 1).find(
        (slot) => !usedUserSlots.has(slot),
      );
      const auctionSlot = Array.from({ length: 3 }, (_, index) => index + 1).find(
        (slot) => !usedAuctionSlots.has(slot),
      );
      if (userSlot === undefined || auctionSlot === undefined) return null;
      try {
        await this.db
          .prepare(
            `INSERT INTO websocket_slot_leases
               (id, markets_user_id, auction_id, user_slot, auction_slot, lease_expires_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            connectionId,
            marketsUserId,
            auctionId,
            userSlot,
            auctionSlot,
            new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          )
          .run();
        return { auctionId, auctionSlot, connectionId, marketsUserId, userSlot };
      } catch (error) {
        if (!String(error).toLowerCase().includes("unique")) throw error;
      }
    }
    return null;
  }

  async release(connectionId: string, marketsUserId?: string): Promise<void> {
    const sql = marketsUserId
      ? "DELETE FROM websocket_slot_leases WHERE id = ? AND markets_user_id = ?"
      : "DELETE FROM websocket_slot_leases WHERE id = ?";
    const statement = this.db.prepare(sql);
    await (
      marketsUserId ? statement.bind(connectionId, marketsUserId) : statement.bind(connectionId)
    ).run();
  }
}
