import { sha256 } from "../points/oauth-state";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

export async function normalizeSettlementRetryReason(reason: string) {
  const normalizedReason = reason.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!normalizedReason || normalizedReason.length > 500) {
    throw new Error("SETTLEMENT_RETRY_REASON_INVALID");
  }
  return {
    normalizedReason,
    reasonHash: (await sha256(normalizedReason)) as `sha256:${string}`,
  };
}

interface RetryEventRow {
  auctionId: string;
  outboxId: string;
  reasonHash: string;
  settlementId: string;
  workflowAttempt: number;
}

export async function retrySettlement(
  db: D1Database,
  input: {
    idempotencyKey: string;
    marketsUserId: string;
    now: number;
    reasonHash: string;
    settlementId: string;
  },
) {
  if (!HASH_PATTERN.test(input.reasonHash)) throw new Error("SETTLEMENT_RETRY_REASON_INVALID");
  const previous = await db
    .prepare(
      `SELECT auction_id AS auctionId, settlement_id AS settlementId,
              reason_hash AS reasonHash, outbox_id AS outboxId,
              workflow_attempt AS workflowAttempt
       FROM settlement_retry_rate_events
       WHERE markets_user_id = ? AND idempotency_key = ?`,
    )
    .bind(input.marketsUserId, input.idempotencyKey)
    .first<RetryEventRow>();
  if (previous) {
    if (previous.settlementId !== input.settlementId || previous.reasonHash !== input.reasonHash) {
      throw new Error("IDEMPOTENCY_KEY_REUSED");
    }
    return { outboxId: previous.outboxId, status: "ACCEPTED" as const, workflowAttempt: previous.workflowAttempt };
  }

  const row = await db
    .prepare(
      `SELECT s.auction_id AS auctionId, s.kind,
              s.saga_state AS sagaState, s.settlement_revision AS settlementRevision,
              s.workflow_attempt AS workflowAttempt, p.plan_hash AS planHash,
              (SELECT h.status FROM buy_now_holds h
               WHERE h.id = json_extract(p.plan_json, '$.buyNowHoldId')) AS buyNowHoldStatus
       FROM settlements s
       JOIN auctions a ON a.id = s.auction_id
       JOIN settlement_plans p ON p.id = s.current_plan_id
       WHERE s.id = ? AND a.seller_markets_user_id = ?`,
    )
    .bind(input.settlementId, input.marketsUserId)
    .first<{
      auctionId: string;
      buyNowHoldStatus: string | null;
      kind: "BUY_NOW" | "END_OF_AUCTION";
      planHash: string;
      sagaState: string;
      settlementRevision: number;
      workflowAttempt: number;
    }>();
  if (!row) throw new Error("SETTLEMENT_NOT_FOUND");
  if (row.sagaState !== "MANUAL_ACTION_REQUIRED") throw new Error("SETTLEMENT_RETRY_NOT_ALLOWED");
  if (row.kind === "BUY_NOW" && row.buyNowHoldStatus !== "PENDING") {
    throw new Error("SETTLEMENT_RETRY_NOT_ALLOWED");
  }
  const rate = await db
    .prepare(
      `SELECT count(*) AS count FROM settlement_retry_rate_events
       WHERE markets_user_id = ? AND auction_id = ? AND created_at >= ?`,
    )
    .bind(input.marketsUserId, row.auctionId, new Date(input.now - 3_600_000).toISOString())
    .first<{ count: number }>();
  if ((rate?.count ?? 0) >= 5) throw new Error("SETTLEMENT_RETRY_RATE_LIMITED");

  const nextAttempt = row.workflowAttempt + 1;
  const outboxId = `retry:${input.settlementId}:${nextAttempt}`;
  const timestamp = new Date(input.now).toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO settlement_retry_rate_events
         (id, markets_user_id, auction_id, settlement_id, idempotency_key,
          reason_hash, outbox_id, workflow_attempt, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `rate_${crypto.randomUUID()}`,
        input.marketsUserId,
        row.auctionId,
        input.settlementId,
        input.idempotencyKey,
        input.reasonHash,
        outboxId,
        nextAttempt,
        timestamp,
      ),
    db
      .prepare(
        `UPDATE settlements SET workflow_attempt = ?, saga_state = 'PLANNED', updated_at = ?
         WHERE id = ? AND workflow_attempt = ? AND saga_state = 'MANUAL_ACTION_REQUIRED'`,
      )
      .bind(nextAttempt, timestamp, input.settlementId, row.workflowAttempt),
    db
      .prepare(
        `INSERT INTO settlement_outbox
         (id, settlement_id, settlement_revision, workflow_attempt, plan_hash, status, created_at)
         VALUES (?, ?, ?, ?,
           (SELECT ? FROM settlements
            WHERE id = ? AND saga_state = 'PLANNED'
              AND workflow_attempt = ? AND updated_at = ?),
           'PENDING', ?)`,
      )
      .bind(
        outboxId,
        input.settlementId,
        row.settlementRevision,
        nextAttempt,
        row.planHash,
        input.settlementId,
        nextAttempt,
        timestamp,
        timestamp,
      ),
  ]);
  return { outboxId, status: "ACCEPTED" as const, workflowAttempt: nextAttempt };
}

export async function readSafeSettlementStatus(
  db: D1Database,
  input: {
    marketsUserId: string;
    settlementId: string;
  },
) {
  const row = await db
    .prepare(
      `SELECT s.id AS settlementId, s.kind, s.saga_state AS sagaState, s.updated_at AS updatedAt,
              a.seller_markets_user_id AS sellerMarketsUserId,
              (SELECT h.status FROM buy_now_holds h
               JOIN settlement_plans p2 ON p2.id = s.current_plan_id
               WHERE h.id = json_extract(p2.plan_json, '$.buyNowHoldId')) AS buyNowHoldStatus
     FROM settlements s JOIN auctions a ON a.id = s.auction_id
     WHERE s.id = ? AND (
       a.seller_markets_user_id = ?
       OR EXISTS (
         SELECT 1 FROM settlement_rounds r
         JOIN settlement_round_winners w ON w.settlement_round_id = r.id
         WHERE r.settlement_id = s.id AND w.markets_user_id = ?
       )
       OR EXISTS (
         SELECT 1 FROM settlement_allocations sa
         WHERE sa.settlement_id = s.id AND sa.buyer_markets_user_id = ?
       )
       OR EXISTS (
         SELECT 1 FROM settlement_plans bp
         JOIN buy_now_holds bh ON bh.id = json_extract(bp.plan_json, '$.buyNowHoldId')
         WHERE bp.id = s.current_plan_id AND bh.auction_id = s.auction_id
           AND bh.buyer_markets_user_id = ?
       )
     )`,
    )
    .bind(
      input.settlementId,
      input.marketsUserId,
      input.marketsUserId,
      input.marketsUserId,
      input.marketsUserId,
    )
    .first<{
      buyNowHoldStatus: string | null;
      kind: "END_OF_AUCTION" | "BUY_NOW";
      sagaState: string;
      sellerMarketsUserId: string;
      settlementId: string;
      updatedAt: string;
    }>();
  if (!row) throw new Error("SETTLEMENT_NOT_FOUND");
  const state =
    row.kind === "BUY_NOW" && row.buyNowHoldStatus === "FAILED_RESTORED"
      ? "FAILED_RESTORED"
      : row.sagaState === "SETTLED"
        ? "SETTLED"
        : row.sagaState === "MANUAL_ACTION_REQUIRED"
          ? "ACTION_REQUIRED"
          : row.sagaState === "CAPTURED" || row.sagaState === "FINALIZING"
            ? "FINALIZING"
            : row.sagaState === "PLANNED"
              ? "PENDING"
              : "PROCESSING";
  const progress =
    state === "FAILED_RESTORED"
      ? "Restored"
      : state === "SETTLED"
        ? "Settled"
        : state === "ACTION_REQUIRED"
          ? "Manual action required"
          : state === "FINALIZING"
            ? "Finalizing"
            : state === "PENDING"
              ? "Pending"
              : "Processing";
  return {
    kind: row.kind,
    manualActionAllowed: state === "ACTION_REQUIRED" && row.sellerMarketsUserId === input.marketsUserId,
    progress,
    settlementId: row.settlementId,
    state,
    updatedAt: row.updatedAt,
  };
}
