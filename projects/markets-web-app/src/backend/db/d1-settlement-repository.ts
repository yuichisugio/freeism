import type { BidPosition } from "../auction/domain/auction-types";
import type { SettlementPlan } from "../settlement/create-settlement-plan";
import type {
  BeginRoundInput,
  LoadedSettlementPlan,
  ReservationRoundState,
  SettlementReservationRepository,
  WinnerFailureInput,
  WinnerReceiptInput,
} from "../settlement/reserve-settlement-round";
import { resumeAuctionCloseFromCutoff } from "./d1-settlement-plan-repository";

interface PlanRow {
  auctionId: string;
  cutoffHash: string | null;
  planHash: string;
  planJson: string;
  sagaState: string;
  settlementRevision: number;
}

interface PositionRow extends BidPosition {
  id: string;
  pointsConnectionId: string | null;
}

interface WinnerRow {
  allocationQuantity: number;
  attemptCount: number;
  expiresAt: string | null;
  marketsUserId: string;
  pointReservationId: string | null;
  pointsConnectionId: string;
  priceTickCount: number;
  priceTicks: number;
  reservationKey: string;
  status: ReservationRoundState["winners"][number]["status"];
  vectorHash: string | null;
}

export class D1SettlementReservationRepository implements SettlementReservationRepository {
  constructor(private readonly db: D1Database) {}

  async loadPlan(
    settlementId: string,
    settlementRevision: number,
    planHash: string,
  ): Promise<LoadedSettlementPlan> {
    const row = await this.db
      .prepare(
        `SELECT s.auction_id AS auctionId, s.settlement_revision AS settlementRevision,
                s.saga_state AS sagaState, p.plan_hash AS planHash, p.plan_json AS planJson,
                c.ranking_input_hash AS cutoffHash
         FROM settlements s
         JOIN settlement_plans p ON p.id = s.current_plan_id
         LEFT JOIN auction_close_cutoffs c ON c.auction_id = s.auction_id
         WHERE s.id = ?`,
      )
      .bind(settlementId)
      .first<PlanRow>();
    if (
      !row ||
      row.settlementRevision !== settlementRevision ||
      row.planHash !== planHash ||
      !["PLANNED", "RESERVING", "RESERVED"].includes(row.sagaState)
    ) {
      throw new Error("SETTLEMENT_PLAN_MISMATCH");
    }
    const plan = JSON.parse(row.planJson) as SettlementPlan;
    const requestedUsers =
      plan.kind === "BUY_NOW"
        ? [plan.buyerMarketsUserId]
        : plan.eligibleBidIds.length === 0
          ? []
          : undefined;
    const positions =
      plan.kind === "END_OF_AUCTION"
        ? await this.db
            .prepare(
              `SELECT bp.id, bp.bidder_markets_user_id AS marketsUserId,
                      bp.quantity, bp.price_tick_count AS priceTickCount,
                      bp.reached_sequence AS reachedSequence,
                      pc.id AS pointsConnectionId
               FROM bid_positions bp
               LEFT JOIN points_connection pc
                 ON pc.markets_user_id = bp.bidder_markets_user_id AND pc.status = 'ACTIVE'
               WHERE bp.auction_id = ? AND bp.status = 'ACTIVE' AND bp.updated_at <= ?
               ORDER BY bp.reached_sequence, bp.id`,
            )
            .bind(plan.auctionId, plan.cutoffAt)
            .all<PositionRow>()
        : { results: [] as PositionRow[] };
    const connections = await this.db
      .prepare(
        `SELECT id AS pointsConnectionId, markets_user_id AS marketsUserId
         FROM points_connection WHERE status = 'ACTIVE'
           AND markets_user_id IN (
             SELECT bidder_markets_user_id FROM bid_positions WHERE auction_id = ?
             UNION SELECT buyer_markets_user_id FROM buy_now_holds WHERE auction_id = ?
           )`,
      )
      .bind(plan.auctionId, plan.auctionId)
      .all<{ marketsUserId: string; pointsConnectionId: string }>();
    const excluded = await this.db
      .prepare(
        `SELECT markets_user_id AS marketsUserId FROM settlement_exclusions
         WHERE settlement_id = ? ORDER BY markets_user_id`,
      )
      .bind(settlementId)
      .all<{ marketsUserId: string }>();
    const connectionByUser = Object.fromEntries(
      connections.results.map((item) => [item.marketsUserId, item.pointsConnectionId]),
    );
    for (const userId of requestedUsers ?? []) {
      if (!connectionByUser[userId]) throw new Error("REAUTH_REQUIRED");
    }
    return {
      auctionId: row.auctionId,
      connectionByUser,
      cutoffHash: row.cutoffHash ?? planHash,
      excludedUserIds: excluded.results.map((item) => item.marketsUserId),
      plan,
      planHash,
      positions: positions.results.filter(
        (position) =>
          plan.kind !== "END_OF_AUCTION" || plan.eligibleBidIds.includes(position.id),
      ),
      settlementId,
    };
  }

  async beginOrResumeRound(input: BeginRoundInput): Promise<ReservationRoundState> {
    const roundId = `sround_${input.settlementId}_${input.roundOrdinal}`;
    const firstAttemptAt = input.now;
    const retryDeadlineAt = new Date(Date.parse(input.now) + 5 * 60_000).toISOString();
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT OR IGNORE INTO settlement_rounds
           (id, settlement_id, round_ordinal, plan_hash, cutoff_hash, state,
            excluded_user_ids_json, first_attempt_at, retry_deadline_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'RESERVING', ?, ?, ?, ?, ?)`,
        )
        .bind(
          roundId,
          input.settlementId,
          input.roundOrdinal,
          input.planHash,
          input.cutoffHash,
          JSON.stringify([...input.excludedUserIds].sort()),
          firstAttemptAt,
          retryDeadlineAt,
          input.now,
          input.now,
        ),
      this.db
        .prepare(
          `UPDATE settlements SET saga_state = 'RESERVING', updated_at = ?
           WHERE id = ? AND saga_state = 'PLANNED'`,
        )
        .bind(input.now, input.settlementId),
    ];
    for (const winner of input.winners) {
      statements.push(
        this.db
          .prepare(
            `INSERT OR IGNORE INTO settlement_round_winners
             (id, settlement_round_id, markets_user_id, points_connection_id,
              allocation_quantity, price_tick_count, price_ticks, reservation_key,
              status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
          )
          .bind(
            `srw_${crypto.randomUUID()}`,
            roundId,
            winner.marketsUserId,
            winner.pointsConnectionId,
            winner.allocationQuantity,
            winner.priceTickCount,
            winner.priceTicks,
            winner.reservationKey,
            input.now,
            input.now,
          ),
      );
    }
    await this.db.batch(statements);
    const round = await this.db
      .prepare(
        `SELECT id, round_ordinal AS roundOrdinal, state, first_attempt_at AS firstAttemptAt,
                retry_deadline_at AS retryDeadlineAt
         FROM settlement_rounds WHERE settlement_id = ? AND round_ordinal = ?`,
      )
      .bind(input.settlementId, input.roundOrdinal)
      .first<Omit<ReservationRoundState, "winners">>();
    if (!round) throw new Error("SETTLEMENT_ROUND_NOT_CREATED");
    const winners = await this.db
      .prepare(
        `SELECT markets_user_id AS marketsUserId, points_connection_id AS pointsConnectionId,
                allocation_quantity AS allocationQuantity, price_tick_count AS priceTickCount,
                price_ticks AS priceTicks, reservation_key AS reservationKey,
                attempt_count AS attemptCount, status, point_reservation_id AS pointReservationId,
                vector_hash AS vectorHash, expires_at AS expiresAt
         FROM settlement_round_winners WHERE settlement_round_id = ?
         ORDER BY markets_user_id`,
      )
      .bind(round.id)
      .all<WinnerRow>();
    return { ...round, winners: winners.results };
  }

  async recordWinnerAttempt(roundId: string, marketsUserId: string, now: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE settlement_round_winners
         SET attempt_count = attempt_count + 1, updated_at = ?
         WHERE settlement_round_id = ? AND markets_user_id = ? AND status IN ('PENDING', 'UNKNOWN')`,
      )
      .bind(now, roundId, marketsUserId)
      .run();
  }

  async recordWinnerReceipt(input: WinnerReceiptInput): Promise<void> {
    await this.db
      .prepare(
        `UPDATE settlement_round_winners
         SET status = 'ACTIVE', point_reservation_id = ?, vector_hash = ?, expires_at = ?,
             points_request_id = ?, updated_at = ?
         WHERE settlement_round_id = ? AND markets_user_id = ? AND status IN ('PENDING', 'UNKNOWN')`,
      )
      .bind(
        input.pointReservationId,
        input.vectorHash,
        input.expiresAt,
        input.requestId ?? null,
        input.now,
        input.roundId,
        input.marketsUserId,
      )
      .run();
  }

  async recordWinnerFailure(input: WinnerFailureInput): Promise<void> {
    await this.db
      .prepare(
        `UPDATE settlement_round_winners
         SET status = ?, failure_class = ?, failure_code = ?, failure_hash = ?,
             points_request_id = ?, updated_at = ?
         WHERE settlement_round_id = ? AND markets_user_id = ? AND status IN ('PENDING', 'UNKNOWN')`,
      )
      .bind(
        input.failureClass === "TEMPORARY" ? "UNKNOWN" : "REJECTED",
        input.failureClass,
        input.failureCode,
        input.failureHash,
        input.requestId ?? null,
        input.now,
        input.roundId,
        input.marketsUserId,
      )
      .run();
  }

  async recordRelease(input: {
    contentHash: string;
    marketsUserId: string;
    now: string;
    receiptId: string;
    releasedAt: string;
    roundId: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `UPDATE settlement_round_winners
         SET status = 'RELEASED', release_receipt_id = ?, release_content_hash = ?,
             released_at = ?, updated_at = ?
         WHERE settlement_round_id = ? AND markets_user_id = ? AND status = 'ACTIVE'`,
      )
      .bind(
        input.receiptId,
        input.contentHash,
        input.releasedAt,
        input.now,
        input.roundId,
        input.marketsUserId,
      )
      .run();
  }

  async completeReleaseAndExclude(input: {
    auctionId: string;
    exclusions: readonly { failureClass: "INSUFFICIENT" | "REAUTH_REQUIRED"; marketsUserId: string }[];
    now: string;
    roundId: string;
    roundOrdinal: number;
    settlementId: string;
  }): Promise<void> {
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare("UPDATE settlement_rounds SET state = 'RELEASED', updated_at = ? WHERE id = ?")
        .bind(input.now, input.roundId),
    ];
    for (const exclusion of input.exclusions) {
      const blacklistId =
        exclusion.failureClass === "INSUFFICIENT"
          ? `abl_${input.auctionId}_${exclusion.marketsUserId}`
          : null;
      if (blacklistId) {
        statements.push(
          this.db
            .prepare(
              `INSERT OR IGNORE INTO auction_blacklist_events
               (id, auction_id, markets_user_id, reason_code, created_at)
               VALUES (?, ?, ?, 'INSUFFICIENT_BALANCE', ?)`,
            )
            .bind(blacklistId, input.auctionId, exclusion.marketsUserId, input.now),
        );
      }
      statements.push(
        this.db
          .prepare(
            `INSERT OR IGNORE INTO settlement_exclusions
             (settlement_id, markets_user_id, first_round_ordinal, reason,
              blacklist_event_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            input.settlementId,
            exclusion.marketsUserId,
            input.roundOrdinal,
            exclusion.failureClass === "INSUFFICIENT"
              ? "INSUFFICIENT_BALANCE"
              : "REAUTH_REQUIRED",
            blacklistId,
            input.now,
          ),
      );
    }
    await this.db.batch(statements);
  }

  async markReserved(roundId: string, settlementId: string, now: string): Promise<void> {
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE settlement_rounds SET state = 'RESERVED', updated_at = ?
           WHERE id = ? AND NOT EXISTS (
             SELECT 1 FROM settlement_round_winners
             WHERE settlement_round_id = ? AND status != 'ACTIVE')`,
        )
        .bind(now, roundId, roundId),
      this.db
        .prepare(
          `UPDATE settlements SET saga_state = 'RESERVED', updated_at = ?
           WHERE id = ? AND EXISTS (
             SELECT 1 FROM settlement_rounds WHERE id = ? AND state = 'RESERVED')`,
        )
        .bind(now, settlementId, roundId),
    ]);
  }

  async markManualAction(settlementId: string, roundId: string, now: string): Promise<void> {
    await this.db.batch([
      this.db
        .prepare("UPDATE settlement_rounds SET state = 'FAILED', updated_at = ? WHERE id = ?")
        .bind(now, roundId),
      this.db
        .prepare(
          `UPDATE settlements SET saga_state = 'MANUAL_ACTION_REQUIRED', updated_at = ?
           WHERE id = ? AND saga_state != 'SETTLED'`,
        )
        .bind(now, settlementId),
    ]);
  }
}

export class D1BuyNowRestorer {
  constructor(private readonly db: D1Database) {}

  async restoreBuyNowHold(input: {
    evidenceType: "RESERVATION_REJECTED" | "ALL_RESERVATIONS_NON_CAPTURABLE";
    failureHash: string;
    holdId: string;
    settlementId: string;
  }): Promise<{ receiptId: string }> {
    const now = new Date().toISOString();
    const row = await this.db
      .prepare(
        `SELECT h.auction_id AS auctionId, h.status
         FROM buy_now_holds h JOIN settlements s ON s.auction_id = h.auction_id
         WHERE h.id = ? AND s.id = ? AND s.kind = 'BUY_NOW'`,
      )
      .bind(input.holdId, input.settlementId)
      .first<{ auctionId: string; status: string }>();
    if (!row) throw new Error("BUY_NOW_HOLD_NOT_FOUND");
    if (row.status !== "FAILED_RESTORED") {
      const result = await this.db
        .prepare(
          `UPDATE buy_now_holds SET status = 'FAILED_RESTORED', updated_at = ?
           WHERE id = ? AND status = 'PENDING'`,
        )
        .bind(now, input.holdId)
        .run();
      if (result.meta.changes !== 1) throw new Error("BUY_NOW_RESTORE_CONFLICT");
      await resumeAuctionCloseFromCutoff(this.db, { auctionId: row.auctionId, serverNow: now });
    }
    return { receiptId: `restore_${input.holdId}_${input.failureHash.slice(0, 16)}` };
  }
}
