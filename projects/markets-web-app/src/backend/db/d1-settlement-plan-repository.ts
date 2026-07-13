import {
  createSettlementPlan,
  type EligibleSettlementBid,
} from "../settlement/create-settlement-plan";
import type { SettlementWorkflowParams } from "../settlement/outbox-dispatcher";

const ALGORITHM_VERSION = "uniform-price-v1";

export interface CloseAuctionInput {
  auctionId: string;
  expectedAuctionVersion: number;
  expectedRevisionId: string;
  serverNow: string;
}

export type CloseAuctionResult =
  | { kind: "NOT_DUE_OR_STALE" }
  | { cutoffId: string; kind: "WAITING_FOR_BUY_NOW" }
  | {
      kind: "PLANNED";
      outboxId: string;
      params: SettlementWorkflowParams;
      settlementId: string;
    };

interface CloseSnapshot {
  auctionId: string;
  auctionRevisionId: string;
  availableQuantity: number;
  endsAt: string;
  maxBidSeq: number;
  packageTick: number;
  pointPackageRevisionId: string;
  quantity: number;
  status: string;
  unfinishedHoldCount: number;
  version: number;
}

interface ExistingCloseRow {
  cutoffAuctionId: string | null;
  outboxId: string | null;
  planHash: string | null;
  settlementId: string | null;
  settlementRevision: number | null;
  workflowAttempt: number | null;
}

async function loadSnapshot(db: D1Database, input: CloseAuctionInput) {
  const snapshot = await db
    .prepare(
      `SELECT a.id AS auctionId, a.current_revision_id AS auctionRevisionId,
              a.status, a.version, r.ends_at AS endsAt, r.quantity, r.package_tick AS packageTick,
              p.point_package_revision_id AS pointPackageRevisionId,
              COALESCE((SELECT MAX(bid_seq) FROM bid_events
                WHERE auction_id = a.id AND created_at <= ?), 0) AS maxBidSeq,
              (SELECT COUNT(*) FROM buy_now_holds
                WHERE auction_id = a.id AND status IN ('PENDING', 'CAPTURED_PENDING_FINALIZE'))
                AS unfinishedHoldCount,
              r.quantity - COALESCE((SELECT SUM(quantity) FROM buy_now_holds
                WHERE auction_id = a.id
                  AND status IN ('PENDING', 'CAPTURED_PENDING_FINALIZE', 'SETTLED')), 0)
                AS availableQuantity
       FROM auctions a
       JOIN auction_revisions r ON r.id = a.current_revision_id
       JOIN point_package_snapshots p ON p.id = r.point_package_snapshot_id
       WHERE a.id = ?`,
    )
    .bind(input.serverNow, input.auctionId)
    .first<CloseSnapshot>();
  if (
    !snapshot ||
    snapshot.status !== "OPEN" ||
    snapshot.version !== input.expectedAuctionVersion ||
    snapshot.auctionRevisionId !== input.expectedRevisionId ||
    Date.parse(snapshot.endsAt) > Date.parse(input.serverNow)
  ) {
    return null;
  }
  return snapshot;
}

async function loadEligibleBids(
  db: D1Database,
  auctionId: string,
  cutoffAt: string,
): Promise<EligibleSettlementBid[]> {
  const rows = await db
    .prepare(
      `SELECT id AS bidPositionId, bidder_markets_user_id AS marketsUserId,
              quantity, price_tick_count AS priceTickCount, reached_sequence AS reachedSequence
       FROM bid_positions
       WHERE auction_id = ? AND status = 'ACTIVE' AND updated_at <= ?
       ORDER BY reached_sequence, id`,
    )
    .bind(auctionId, cutoffAt)
    .all<EligibleSettlementBid>();
  return rows.results;
}

async function loadExistingClose(
  db: D1Database,
  input: CloseAuctionInput,
): Promise<CloseAuctionResult> {
  const row = await db
    .prepare(
      `SELECT c.auction_id AS cutoffAuctionId, s.id AS settlementId,
              s.settlement_revision AS settlementRevision,
              s.workflow_attempt AS workflowAttempt, p.plan_hash AS planHash,
              o.id AS outboxId
       FROM auction_close_cutoffs c
       LEFT JOIN settlements s
         ON s.auction_id = c.auction_id AND s.kind = 'END_OF_AUCTION'
          AND s.source_key = 'end:' || c.auction_revision_id || ':' || c.cutoff_at
       LEFT JOIN settlement_plans p ON p.id = s.current_plan_id
       LEFT JOIN settlement_outbox o
         ON o.settlement_id = s.id AND o.settlement_revision = s.settlement_revision
          AND o.workflow_attempt = s.workflow_attempt
       WHERE c.auction_id = ? AND c.auction_revision_id = ? AND c.cutoff_at = ?`,
    )
    .bind(input.auctionId, input.expectedRevisionId, input.serverNow)
    .first<ExistingCloseRow>();
  if (!row?.cutoffAuctionId) return { kind: "NOT_DUE_OR_STALE" };
  if (
    row.settlementId &&
    row.outboxId &&
    row.planHash &&
    row.settlementRevision !== null &&
    row.workflowAttempt !== null
  ) {
    return {
      kind: "PLANNED",
      outboxId: row.outboxId,
      settlementId: row.settlementId,
      params: {
        auctionId: input.auctionId,
        settlementId: row.settlementId,
        settlementRevision: row.settlementRevision,
        workflowAttempt: row.workflowAttempt,
        planHash: row.planHash,
      },
    };
  }
  return { cutoffId: input.auctionId, kind: "WAITING_FOR_BUY_NOW" };
}

export async function closeAuctionAndPlan(
  db: D1Database,
  input: CloseAuctionInput,
): Promise<CloseAuctionResult> {
  if (
    !Number.isSafeInteger(input.expectedAuctionVersion) ||
    input.expectedAuctionVersion < 1 ||
    !Number.isFinite(Date.parse(input.serverNow))
  ) {
    return { kind: "NOT_DUE_OR_STALE" };
  }
  const snapshot = await loadSnapshot(db, input);
  if (!snapshot) return loadExistingClose(db, input);

  const eligibleBids = await loadEligibleBids(db, input.auctionId, input.serverNow);
  const planned = await createSettlementPlan({
    algorithmVersion: ALGORITHM_VERSION,
    auctionId: input.auctionId,
    auctionRevisionId: input.expectedRevisionId,
    cutoffAt: input.serverNow,
    eligibleBids,
    kind: "END_OF_AUCTION",
    maxBidSeq: snapshot.maxBidSeq,
    packageTick: snapshot.packageTick,
    pointPackageRevisionId: snapshot.pointPackageRevisionId,
    // BUY_NOW の未完了 hold が全数量を押さえていても、close cutoff 自体は確定する。
    // この場合の plan は ranking input の正規化にだけ使い、DB には保存しない。
    quantity: snapshot.unfinishedHoldCount === 0 ? snapshot.availableQuantity : snapshot.quantity,
  });
  if (planned.plan.kind !== "END_OF_AUCTION") {
    throw new Error("END_OF_AUCTION_PLAN_REQUIRED");
  }
  const settlementId = `stl_${crypto.randomUUID()}`;
  const planId = `spl_${crypto.randomUUID()}`;
  const outboxId = `outbox_${crypto.randomUUID()}`;
  const sourceKey = `end:${input.expectedRevisionId}:${input.serverNow}`;

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE auctions SET status = 'CLOSING', version = version + 1, updated_at = ?
         WHERE id = ? AND current_revision_id = ? AND status = 'OPEN' AND version = ?
           AND EXISTS (SELECT 1 FROM auction_revisions
             WHERE id = ? AND auction_id = ? AND ends_at <= ?)`,
      )
      .bind(
        input.serverNow,
        input.auctionId,
        input.expectedRevisionId,
        input.expectedAuctionVersion,
        input.expectedRevisionId,
        input.auctionId,
        input.serverNow,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO auction_close_cutoffs
         (auction_id, auction_revision_id, closed_auction_version, cutoff_at, max_bid_seq,
          eligible_bid_ids_json, ranking_input_hash, available_quantity,
          point_package_revision_id, package_tick, algorithm_version, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM auctions
           WHERE id = ? AND current_revision_id = ? AND status = 'CLOSING'
             AND version = ? AND updated_at = ?)`,
      )
      .bind(
        input.auctionId,
        input.expectedRevisionId,
        input.expectedAuctionVersion + 1,
        input.serverNow,
        snapshot.maxBidSeq,
        JSON.stringify(planned.plan.eligibleBidIds),
        planned.plan.rankingInputHash,
        snapshot.availableQuantity,
        snapshot.pointPackageRevisionId,
        snapshot.packageTick,
        ALGORITHM_VERSION,
        input.serverNow,
        input.auctionId,
        input.expectedRevisionId,
        input.expectedAuctionVersion + 1,
        input.serverNow,
      ),
  ];

  if (snapshot.unfinishedHoldCount === 0) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO settlements
           (id, auction_id, kind, source_key, settlement_revision, workflow_attempt,
            saga_state, current_plan_id, created_at, updated_at)
           SELECT ?, ?, 'END_OF_AUCTION', ?, 1, 0, 'PLANNED', ?, ?, ?
           WHERE EXISTS (SELECT 1 FROM auctions
             WHERE id = ? AND current_revision_id = ? AND status = 'CLOSING'
               AND version = ? AND updated_at = ?)`,
        )
        .bind(
          settlementId,
          input.auctionId,
          sourceKey,
          planId,
          input.serverNow,
          input.serverNow,
          input.auctionId,
          input.expectedRevisionId,
          input.expectedAuctionVersion + 1,
          input.serverNow,
        ),
      db
        .prepare(
          `INSERT INTO settlement_plans
           (id, settlement_id, settlement_revision, plan_json, plan_hash,
            algorithm_version, created_at)
           SELECT ?, ?, 1, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM settlements WHERE id = ?)`,
        )
        .bind(
          planId,
          settlementId,
          planned.planJson,
          planned.planHash,
          ALGORITHM_VERSION,
          input.serverNow,
          settlementId,
        ),
      db
        .prepare(
          `INSERT INTO settlement_outbox
           (id, settlement_id, settlement_revision, workflow_attempt, plan_hash,
            status, delivery_attempt_count, created_at)
           SELECT ?, ?, 1, 0, ?, 'PENDING', 0, ?
           WHERE EXISTS (SELECT 1 FROM settlement_plans WHERE id = ?)`,
        )
        .bind(outboxId, settlementId, planned.planHash, input.serverNow, planId),
    );
  }

  await db.batch(statements);
  return loadExistingClose(db, input);
}
