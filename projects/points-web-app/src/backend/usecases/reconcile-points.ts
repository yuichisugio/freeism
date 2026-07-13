import {
  createPointsReconciliationReport,
  type AccountReconciliationMismatch,
  type ActiveReservationTotal,
  type ClaimReconciliationMismatch,
  type PointsReconciliationReport,
} from "../domain/reconciliation/reconciliation-report";
import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";

interface ClaimSummaryRow {
  claimedCount: number;
  unclaimedCount: number;
}

export async function reconcilePoints(
  db: D1Database,
  now = new Date(),
): Promise<PointsReconciliationReport> {
  const [accounts, reservations, claims, claimSummary] = await Promise.all([
    db
      .prepare(
        `WITH ledger_totals AS (
           SELECT points_user_id, evaluation_criterion_id,
                  sum(delta_amount_scaled) AS expected_balance,
                  sum(CASE WHEN affects_evaluation_total = 1 THEN delta_amount_scaled ELSE 0 END)
                    AS expected_evaluation_total
           FROM point_ledger_entry
           GROUP BY points_user_id, evaluation_criterion_id
         ), account_keys AS (
           SELECT points_user_id, evaluation_criterion_id FROM ledger_totals
           UNION
           SELECT points_user_id, evaluation_criterion_id FROM point_account
         )
         SELECT account_keys.points_user_id AS pointsUserId,
                account_keys.evaluation_criterion_id AS evaluationCriterionId,
                coalesce(ledger_totals.expected_balance, 0) AS expectedBalance,
                coalesce(ledger_totals.expected_evaluation_total, 0) AS expectedEvaluationTotal,
                point_account.balance AS actualBalance,
                point_account.evaluation_total AS actualEvaluationTotal
         FROM account_keys
         LEFT JOIN ledger_totals
           ON ledger_totals.points_user_id = account_keys.points_user_id
          AND ledger_totals.evaluation_criterion_id = account_keys.evaluation_criterion_id
         LEFT JOIN point_account
           ON point_account.points_user_id = account_keys.points_user_id
          AND point_account.evaluation_criterion_id = account_keys.evaluation_criterion_id
         WHERE point_account.points_user_id IS NULL
            OR point_account.balance != coalesce(ledger_totals.expected_balance, 0)
            OR point_account.evaluation_total !=
               coalesce(ledger_totals.expected_evaluation_total, 0)
         ORDER BY account_keys.points_user_id, account_keys.evaluation_criterion_id`,
      )
      .all<AccountReconciliationMismatch>(),
    db
      .prepare(
        `SELECT reservation.points_user_id AS pointsUserId,
                component.evaluation_criterion_id AS evaluationCriterionId,
                sum(component.amount_scaled) AS amountScaled,
                count(DISTINCT reservation.id) AS reservationCount
         FROM point_reservation reservation
         JOIN point_reservation_state state ON state.point_reservation_id = reservation.id
         JOIN point_reservation_component component
           ON component.point_reservation_id = reservation.id
         WHERE state.status = 'ACTIVE'
         GROUP BY reservation.points_user_id, component.evaluation_criterion_id
         ORDER BY reservation.points_user_id, component.evaluation_criterion_id`,
      )
      .all<ActiveReservationTotal>(),
    db
      .prepare(
        `SELECT unclaimed.id AS unclaimedFixEntryId,
                CASE WHEN claim_item.unclaimed_fix_entry_id IS NULL THEN 0 ELSE 1 END AS claimed,
                CASE WHEN ledger.source_unclaimed_fix_entry_id IS NULL THEN 0 ELSE 1 END AS ledgered
         FROM unclaimed_fix_entry unclaimed
         LEFT JOIN fix_claim_item claim_item
           ON claim_item.unclaimed_fix_entry_id = unclaimed.id
         LEFT JOIN point_ledger_entry ledger
           ON ledger.source_unclaimed_fix_entry_id = unclaimed.id
         WHERE (claim_item.unclaimed_fix_entry_id IS NULL)
            != (ledger.source_unclaimed_fix_entry_id IS NULL)
         ORDER BY unclaimed.id`,
      )
      .all<{ claimed: number; ledgered: number; unclaimedFixEntryId: string }>(),
    db
      .prepare(
        `SELECT count(CASE WHEN claim_item.unclaimed_fix_entry_id IS NOT NULL THEN 1 END)
                  AS claimedCount,
                count(CASE WHEN claim_item.unclaimed_fix_entry_id IS NULL THEN 1 END)
                  AS unclaimedCount
         FROM unclaimed_fix_entry unclaimed
         LEFT JOIN fix_claim_item claim_item
           ON claim_item.unclaimed_fix_entry_id = unclaimed.id`,
      )
      .first<ClaimSummaryRow>(),
  ]);

  return createPointsReconciliationReport({
    accountMismatches: accounts.results,
    activeReservationTotals: reservations.results,
    checkedAt: now.toISOString(),
    claimMismatches: claims.results.map<ClaimReconciliationMismatch>((row) => ({
      claimed: row.claimed === 1,
      ledgered: row.ledgered === 1,
      unclaimedFixEntryId: row.unclaimedFixEntryId,
    })),
    claimSummary: claimSummary ?? { claimedCount: 0, unclaimedCount: 0 },
  });
}

const RECONCILIATION_OPERATION = "POINTS_RECONCILIATION";

interface ReconciliationResponseBody {
  data: PointsReconciliationReport;
  meta: { requestId: string };
}

export class ReconciliationRunError extends Error {
  constructor(readonly code: "IDEMPOTENCY_IN_PROGRESS" | "IDEMPOTENCY_KEY_REUSED") {
    super(code);
  }
}

async function findReconciliationRun(
  db: D1Database,
  actorPointsUserId: string,
  idempotencyKey: string,
) {
  return db
    .prepare(
      `SELECT payload_hash AS payloadHash, status, response_body AS responseBody
       FROM idempotency_results
       WHERE actor_points_user_id = ? AND operation = ? AND idempotency_key = ?`,
    )
    .bind(actorPointsUserId, RECONCILIATION_OPERATION, idempotencyKey)
    .first<{
      payloadHash: string;
      responseBody: ReconciliationResponseBody | string;
      status: number;
    }>();
}

export async function runPointsReconciliation(
  db: D1Database,
  input: {
    actorPointsUserId: string;
    idempotencyKey: string;
    reason: string;
    requestId: string;
  },
): Promise<{ body: ReconciliationResponseBody; status: 200 }> {
  const reason = input.reason.trim();
  const payloadHash = await hashCanonicalPayload({ reason });
  const reservation = await db
    .prepare(
      `INSERT OR IGNORE INTO idempotency_results
         (id, actor_points_user_id, operation, idempotency_key, payload_hash,
          status, response_body)
       VALUES (?, ?, ?, ?, ?, 102, '{"pending":true}')`,
    )
    .bind(
      `idemr_${crypto.randomUUID()}`,
      input.actorPointsUserId,
      RECONCILIATION_OPERATION,
      input.idempotencyKey,
      payloadHash,
    )
    .run();
  const ownsReservation = (reservation.meta.changes ?? 0) === 1;
  if (!ownsReservation) {
    const replay = await findReconciliationRun(db, input.actorPointsUserId, input.idempotencyKey);
    if (!replay || replay.payloadHash !== payloadHash) {
      throw new ReconciliationRunError("IDEMPOTENCY_KEY_REUSED");
    }
    if (replay.status === 102) {
      throw new ReconciliationRunError("IDEMPOTENCY_IN_PROGRESS");
    }
    const body =
      typeof replay.responseBody === "string"
        ? (JSON.parse(replay.responseBody) as ReconciliationResponseBody)
        : replay.responseBody;
    return { body, status: 200 };
  }

  try {
    const report = await reconcilePoints(db);
    const body: ReconciliationResponseBody = {
      data: report,
      meta: { requestId: input.requestId },
    };
    await db.batch([
      db
        .prepare(
          `INSERT INTO audit_event
             (id, actor_points_user_id, action, target, reason, request_id, result, created_at)
           VALUES (?, ?, ?, 'points', ?, ?, ?, ?)`,
        )
        .bind(
          `audit_${crypto.randomUUID()}`,
          input.actorPointsUserId,
          RECONCILIATION_OPERATION,
          reason,
          input.requestId,
          report.consistent ? "MATCH" : "MISMATCH",
          Date.now(),
        ),
      db
        .prepare(
          `UPDATE idempotency_results SET status = 200, response_body = ?
           WHERE actor_points_user_id = ? AND operation = ? AND idempotency_key = ?
             AND payload_hash = ? AND status = 102`,
        )
        .bind(
          JSON.stringify(body),
          input.actorPointsUserId,
          RECONCILIATION_OPERATION,
          input.idempotencyKey,
          payloadHash,
        ),
    ]);
    return { body, status: 200 };
  } catch (error) {
    await db
      .prepare(
        `DELETE FROM idempotency_results
         WHERE actor_points_user_id = ? AND operation = ? AND idempotency_key = ?
           AND payload_hash = ? AND status = 102`,
      )
      .bind(input.actorPointsUserId, RECONCILIATION_OPERATION, input.idempotencyKey, payloadHash)
      .run();
    throw error;
  }
}
