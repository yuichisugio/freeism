import type {
  CaptureRound,
  CapturedSettlementReceipt,
  SettlementCaptureRepository,
} from "../settlement/capture-all-winners";

interface RoundRow {
  auctionId: string;
  kind: CaptureRound["kind"];
  roundId: string;
  roundOrdinal: number;
  state: CaptureRound["state"];
}

interface WinnerRow {
  allocationQuantity: number;
  componentVectorJson: string | null;
  marketsUserId: string;
  pointReservationId: string | null;
  priceTickCount: number;
  priceTicks: number;
  reservationKey: string;
  status: CaptureRound["winners"][number]["status"];
  vectorHash: string | null;
}

export class D1SettlementCaptureRepository implements SettlementCaptureRepository {
  constructor(private readonly db: D1Database) {}

  async loadCaptureRound(input: {
    planHash: string;
    roundOrdinal: number;
    settlementId: string;
    settlementRevision: number;
  }): Promise<CaptureRound> {
    const round = await this.db
      .prepare(
        `SELECT r.id AS roundId, r.round_ordinal AS roundOrdinal, r.state,
                s.auction_id AS auctionId, s.kind
         FROM settlement_rounds r
         JOIN settlements s ON s.id = r.settlement_id
         JOIN settlement_plans p ON p.id = s.current_plan_id
         WHERE r.settlement_id = ? AND r.round_ordinal = ? AND r.plan_hash = ?
           AND s.settlement_revision = ? AND p.plan_hash = ?
           AND s.saga_state IN ('RESERVED', 'CAPTURED')`,
      )
      .bind(
        input.settlementId,
        input.roundOrdinal,
        input.planHash,
        input.settlementRevision,
        input.planHash,
      )
      .first<RoundRow>();
    if (!round) throw new Error("SETTLEMENT_CAPTURE_ROUND_NOT_FOUND");
    const winners = await this.db
      .prepare(
        `SELECT markets_user_id AS marketsUserId,
                allocation_quantity AS allocationQuantity,
                price_tick_count AS priceTickCount, price_ticks AS priceTicks,
                reservation_key AS reservationKey, status,
                point_reservation_id AS pointReservationId, vector_hash AS vectorHash,
                component_vector_json AS componentVectorJson
         FROM settlement_round_winners WHERE settlement_round_id = ?
         ORDER BY point_reservation_id, markets_user_id`,
      )
      .bind(round.roundId)
      .all<WinnerRow>();
    return {
      ...round,
      state: round.state === "CAPTURED" ? "CAPTURED" : "RESERVED",
      winners: winners.results.map((winner) => {
        if (!winner.pointReservationId || !winner.vectorHash) {
          throw new Error("SETTLEMENT_CAPTURE_WINNER_INCOMPLETE");
        }
        return {
          ...winner,
          pointReservationId: winner.pointReservationId,
          vectorHash: winner.vectorHash,
        };
      }),
    };
  }

  async recordCaptureReceipt(input: {
    now: string;
    receipt: CapturedSettlementReceipt;
    roundId: string;
  }): Promise<CapturedSettlementReceipt> {
    const existing = await this.db
      .prepare(
        `SELECT capture_receipt_id AS captureReceiptId, settlement_id AS settlementId,
                auction_id AS auctionId, plan_hash AS planHash, captured_at AS capturedAt,
                content_hash AS contentHash, reservations_json AS reservationsJson
         FROM settlement_capture_receipts WHERE settlement_id = ?`,
      )
      .bind(input.receipt.settlementId)
      .first<Omit<CapturedSettlementReceipt, "reservations"> & { reservationsJson: string }>();
    if (existing) {
      if (
        existing.captureReceiptId !== input.receipt.captureReceiptId ||
        existing.contentHash !== input.receipt.contentHash ||
        existing.planHash !== input.receipt.planHash
      ) {
        throw new Error("SETTLEMENT_CAPTURE_RECEIPT_CONFLICT");
      }
      return {
        ...existing,
        reservations: JSON.parse(
          existing.reservationsJson,
        ) as CapturedSettlementReceipt["reservations"],
      };
    }

    const expected = await this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM settlement_round_winners
         WHERE settlement_round_id = ? AND status = 'ACTIVE'`,
      )
      .bind(input.roundId)
      .first<number>("count");
    if (expected !== input.receipt.reservations.length) {
      throw new Error("SETTLEMENT_CAPTURE_WINNER_COUNT_MISMATCH");
    }
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO settlement_capture_receipts
           (capture_receipt_id, settlement_id, settlement_round_id, auction_id,
            plan_hash, captured_at, content_hash, reservations_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.receipt.captureReceiptId,
          input.receipt.settlementId,
          input.roundId,
          input.receipt.auctionId,
          input.receipt.planHash,
          input.receipt.capturedAt,
          input.receipt.contentHash,
          JSON.stringify(input.receipt.reservations),
          input.now,
        ),
      this.db
        .prepare(
          `UPDATE settlement_round_winners SET status = 'CAPTURED', updated_at = ?
           WHERE settlement_round_id = ? AND status = 'ACTIVE'`,
        )
        .bind(input.now, input.roundId),
      this.db
        .prepare(
          `UPDATE settlements SET saga_state = 'CAPTURED', updated_at = ?
           WHERE id = ? AND saga_state = 'RESERVED'`,
        )
        .bind(input.now, input.receipt.settlementId),
      this.db
        .prepare(
          `UPDATE buy_now_holds SET status = 'CAPTURED_PENDING_FINALIZE', updated_at = ?
           WHERE status = 'PENDING' AND id = (
             SELECT json_extract(p.plan_json, '$.buyNowHoldId')
             FROM settlements s JOIN settlement_plans p ON p.id = s.current_plan_id
             WHERE s.id = ? AND s.kind = 'BUY_NOW')`,
        )
        .bind(input.now, input.receipt.settlementId),
    ]);
    return input.receipt;
  }

  async recordCaptureInsufficiency(input: {
    insufficientUserIds: readonly string[];
    now: string;
    releases: readonly {
      marketsUserId: string;
      pointReservationId: string;
      receipt: { contentHash: string; receiptId: string; releasedAt: string };
    }[];
    roundId: string;
    settlementId: string;
  }): Promise<void> {
    const auctionId = await this.db
      .prepare(
        `SELECT s.auction_id FROM settlements s JOIN settlement_rounds r ON r.settlement_id = s.id
         WHERE r.id = ? AND s.id = ?`,
      )
      .bind(input.roundId, input.settlementId)
      .first<string>("auction_id");
    if (!auctionId) throw new Error("SETTLEMENT_CAPTURE_ROUND_NOT_FOUND");
    const statements: D1PreparedStatement[] = [];
    for (const released of input.releases) {
      statements.push(
        this.db
          .prepare(
            `UPDATE settlement_round_winners
             SET status = 'RELEASED', release_receipt_id = ?, release_content_hash = ?,
                 released_at = ?, updated_at = ?
             WHERE settlement_round_id = ? AND markets_user_id = ?
               AND point_reservation_id = ? AND status = 'ACTIVE'`,
          )
          .bind(
            released.receipt.receiptId,
            released.receipt.contentHash,
            released.receipt.releasedAt,
            input.now,
            input.roundId,
            released.marketsUserId,
            released.pointReservationId,
          ),
      );
    }
    for (const marketsUserId of input.insufficientUserIds) {
      const blacklistId = `abl_${auctionId}_${marketsUserId}`;
      statements.push(
        this.db
          .prepare(
            `INSERT OR IGNORE INTO auction_blacklist_events
             (id, auction_id, markets_user_id, reason_code, created_at)
             VALUES (?, ?, ?, 'INSUFFICIENT_BALANCE', ?)`,
          )
          .bind(blacklistId, auctionId, marketsUserId, input.now),
        this.db
          .prepare(
            `INSERT OR IGNORE INTO settlement_exclusions
             (settlement_id, markets_user_id, first_round_ordinal, reason,
              blacklist_event_id, created_at)
             SELECT ?, ?, round_ordinal, 'INSUFFICIENT_BALANCE', ?, ?
             FROM settlement_rounds WHERE id = ?`,
          )
          .bind(input.settlementId, marketsUserId, blacklistId, input.now, input.roundId),
      );
    }
    statements.push(
      this.db
        .prepare(`UPDATE settlement_rounds SET state = 'RELEASED', updated_at = ? WHERE id = ?`)
        .bind(input.now, input.roundId),
      this.db
        .prepare(
          `UPDATE settlements SET saga_state = 'RESERVING', updated_at = ?
           WHERE id = ? AND saga_state = 'RESERVED'`,
        )
        .bind(input.now, input.settlementId),
    );
    await this.db.batch(statements);
  }

  async markCaptureManualAction(input: {
    now: string;
    reason: string;
    roundId: string;
    settlementId: string;
  }): Promise<void> {
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE settlement_rounds SET state = 'FAILED', updated_at = ?
           WHERE id = ? AND state = 'RESERVED'`,
        )
        .bind(input.now, input.roundId),
      this.db
        .prepare(
          `UPDATE settlements SET saga_state = 'MANUAL_ACTION_REQUIRED', updated_at = ?
           WHERE id = ? AND saga_state NOT IN ('CAPTURED', 'SETTLED')`,
        )
        .bind(input.now, input.settlementId),
    ]);
  }
}
