import {
  chunkCanonicalJsonRows,
  prepareJsonEachStatements,
  runCsvAtomicBatch,
} from "../../csv/d1-json-chunks";

export type TransactionType = "TRANSFER" | "EXCHANGE";

export interface PersistedTransactionItem {
  exchangeRateRevisionId: string | null;
  id: string;
  minimumUnitRemainderScaled: number | null;
  rateDivisionRemainder: number | null;
  recipientPointsUserId: string | null;
  roundingRule: "FLOOR" | null;
  rowNumber: number;
  senderPointsUserId: string;
  sourceAmountScaled: number;
  sourceEvaluationCriterionId: string;
  sourceEvaluationCriterionRevisionId: string;
  targetAmountScaled: number | null;
  targetEvaluationCriterionId: string | null;
  targetEvaluationCriterionRevisionId: string | null;
  transactionType: TransactionType;
}

export interface PersistedExchangeRateRevision {
  denominator: number | null;
  expectedRevision: number | null;
  id: string;
  numerator: number | null;
  revision: number;
  sourceEvaluationCriterionId: string;
  sourceEvaluationCriterionRevisionId: string;
  status: "ACTIVE" | "DISABLED";
  targetEvaluationCriterionId: string;
  targetEvaluationCriterionRevisionId: string;
}

export async function findCsvCommitReplay(
  db: D1Database,
  actorPointsUserId: string,
  operation: string,
  idempotencyKey: string,
  payloadHash: string,
): Promise<{ body: unknown; status: number } | null> {
  const row = await db
    .prepare(
      `SELECT payload_hash AS payloadHash, status, response_body AS responseBody
       FROM idempotency_results
       WHERE actor_points_user_id = ? AND operation = ? AND idempotency_key = ?`,
    )
    .bind(actorPointsUserId, operation, idempotencyKey)
    .first<{ payloadHash: string; responseBody: string | unknown; status: number }>();
  if (!row) return null;
  if (row.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
  return {
    body: typeof row.responseBody === "string" ? JSON.parse(row.responseBody) : row.responseBody,
    status: row.status,
  };
}

function jsonStatements(db: D1Database, sql: string, rows: readonly unknown[]) {
  return rows.length === 0 ? [] : prepareJsonEachStatements(db, sql, chunkCanonicalJsonRows(rows));
}

export async function commitExchangeRateRevisions(
  db: D1Database,
  input: {
    actorPointsUserId: string;
    fileHash: string;
    idempotencyKey: string;
    now: Date;
    payloadHash: string;
    reason: string;
    requestId: string;
    rows: PersistedExchangeRateRevision[];
    validationHash: string;
  },
) {
  const responseBody = {
    data: {
      revisions: input.rows.map((row) => ({
        exchangeRateRevisionId: row.id,
        revision: row.revision,
        sourceEvaluationCriterionId: row.sourceEvaluationCriterionId,
        status: row.status,
        targetEvaluationCriterionId: row.targetEvaluationCriterionId,
      })),
    },
    meta: { requestId: input.requestId },
  };
  const now = input.now.getTime();
  const rows = input.rows.map((row) => ({
    ...row,
    actorPointsUserId: input.actorPointsUserId,
    now,
    reason: input.reason,
  }));
  const statements = [
    ...jsonStatements(
      db,
      `INSERT OR IGNORE INTO exchange_rate
         (source_evaluation_criterion_id, target_evaluation_criterion_id,
          current_revision_id, current_revision, created_at)
       SELECT json_extract(value, '$.sourceEvaluationCriterionId'),
              json_extract(value, '$.targetEvaluationCriterionId'),
              json_extract(value, '$.id'), json_extract(value, '$.revision'),
              json_extract(value, '$.now')
       FROM json_each(?) WHERE json_type(value, '$.expectedRevision') = 'null'`,
      rows,
    ),
    ...jsonStatements(
      db,
      `INSERT INTO exchange_rate_revision
         (id, source_evaluation_criterion_id, target_evaluation_criterion_id,
          source_evaluation_criterion_revision_id, target_evaluation_criterion_revision_id,
          revision, status, numerator, denominator, actor_points_user_id, reason, created_at)
       SELECT json_extract(value, '$.id'),
              json_extract(value, '$.sourceEvaluationCriterionId'),
              json_extract(value, '$.targetEvaluationCriterionId'),
              json_extract(value, '$.sourceEvaluationCriterionRevisionId'),
              json_extract(value, '$.targetEvaluationCriterionRevisionId'),
              json_extract(value, '$.revision'), json_extract(value, '$.status'),
              json_extract(value, '$.numerator'), json_extract(value, '$.denominator'),
              json_extract(value, '$.actorPointsUserId'), json_extract(value, '$.reason'),
              json_extract(value, '$.now') FROM json_each(?)`,
      rows,
    ),
    ...jsonStatements(
      db,
      `UPDATE exchange_rate SET
         current_revision_id = json_extract(input.value, '$.id'),
         current_revision = json_extract(input.value, '$.revision')
       FROM json_each(?) input
       WHERE exchange_rate.source_evaluation_criterion_id =
               json_extract(input.value, '$.sourceEvaluationCriterionId')
         AND exchange_rate.target_evaluation_criterion_id =
               json_extract(input.value, '$.targetEvaluationCriterionId')
         AND exchange_rate.current_revision = json_extract(input.value, '$.expectedRevision')
         AND json_type(input.value, '$.expectedRevision') <> 'null'`,
      rows,
    ),
    db
      .prepare(
        `INSERT INTO idempotency_results
           (id, actor_points_user_id, operation, idempotency_key, payload_hash,
            status, response_body, created_at)
         VALUES (?, ?, 'EXCHANGE_RATE_CSV_COMMIT', ?, ?, 201, ?, ?)`,
      )
      .bind(
        `idem_${crypto.randomUUID()}`,
        input.actorPointsUserId,
        input.idempotencyKey,
        input.payloadHash,
        JSON.stringify(responseBody),
        now,
      ),
    db
      .prepare(
        `INSERT INTO audit_event
           (id, actor_points_user_id, action, target, reason, request_id, result, created_at)
         VALUES (?, ?, 'EXCHANGE_RATE_CSV_COMMIT', 'exchange-rates', ?, ?, 'SUCCESS', ?)`,
      )
      .bind(
        `audit_${crypto.randomUUID()}`,
        input.actorPointsUserId,
        input.reason,
        input.requestId,
        now,
      ),
  ];
  await runCsvAtomicBatch(db, statements);
  return responseBody;
}

export async function commitPointTransaction(
  db: D1Database,
  input: {
    actorPointsUserId: string;
    batchId: string;
    fileHash: string;
    idempotencyKey: string;
    items: PersistedTransactionItem[];
    now: Date;
    payloadHash: string;
    requestId: string;
    transactionType: TransactionType;
    validationHash: string;
  },
) {
  const operation = `${input.transactionType}_CSV_COMMIT`;
  const now = input.now.getTime();
  const responseBody = {
    data: { pointTransactionBatchId: input.batchId, itemCount: input.items.length },
    meta: { requestId: input.requestId },
  };
  const items = input.items.map((item) => ({ ...item, batchId: input.batchId, now }));
  const statements = [
    db
      .prepare(
        `INSERT INTO point_transaction_batch
           (id, transaction_type, actor_points_user_id, status, expected_item_count,
            file_hash, validation_hash, idempotency_key, created_at)
         VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.batchId,
        input.transactionType,
        input.actorPointsUserId,
        items.length,
        input.fileHash,
        input.validationHash,
        input.idempotencyKey,
        now,
      ),
    ...jsonStatements(
      db,
      `INSERT INTO point_transaction_item
         (id, batch_id, row_number, transaction_type, sender_points_user_id,
          recipient_points_user_id, source_evaluation_criterion_id,
          source_evaluation_criterion_revision_id, source_amount_scaled,
          target_evaluation_criterion_id, target_evaluation_criterion_revision_id,
          target_amount_scaled, exchange_rate_revision_id, rounding_rule,
          rate_division_remainder, minimum_unit_remainder_scaled, created_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.batchId'),
              json_extract(value, '$.rowNumber'), json_extract(value, '$.transactionType'),
              json_extract(value, '$.senderPointsUserId'),
              json_extract(value, '$.recipientPointsUserId'),
              json_extract(value, '$.sourceEvaluationCriterionId'),
              json_extract(value, '$.sourceEvaluationCriterionRevisionId'),
              json_extract(value, '$.sourceAmountScaled'),
              json_extract(value, '$.targetEvaluationCriterionId'),
              json_extract(value, '$.targetEvaluationCriterionRevisionId'),
              json_extract(value, '$.targetAmountScaled'),
              json_extract(value, '$.exchangeRateRevisionId'),
              json_extract(value, '$.roundingRule'),
              json_extract(value, '$.rateDivisionRemainder'),
              json_extract(value, '$.minimumUnitRemainderScaled'),
              json_extract(value, '$.now') FROM json_each(?)`,
      items,
    ),
    db
      .prepare(
        "UPDATE point_transaction_batch SET status = 'VALIDATED' WHERE id = ? AND status = 'PENDING'",
      )
      .bind(input.batchId),
    ...jsonStatements(
      db,
      `INSERT INTO point_ledger_entry
         (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
          delta_amount_scaled, affects_evaluation_total, source_type,
          source_transaction_item_id, created_at)
       SELECT 'ledger_debit_' || json_extract(value, '$.id'),
              json_extract(value, '$.senderPointsUserId'),
              json_extract(value, '$.sourceEvaluationCriterionId'),
              json_extract(value, '$.sourceEvaluationCriterionRevisionId'),
              -json_extract(value, '$.sourceAmountScaled'), 0,
              CASE json_extract(value, '$.transactionType')
                WHEN 'TRANSFER' THEN 'TRANSFER_DEBIT' ELSE 'EXCHANGE_BURN' END,
              json_extract(value, '$.id'), json_extract(value, '$.now')
       FROM json_each(?)`,
      items,
    ),
    ...jsonStatements(
      db,
      `INSERT INTO point_ledger_entry
         (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
          delta_amount_scaled, affects_evaluation_total, source_type,
          source_transaction_item_id, created_at)
       SELECT 'ledger_credit_' || json_extract(value, '$.id'),
              CASE json_extract(value, '$.transactionType')
                WHEN 'TRANSFER' THEN json_extract(value, '$.recipientPointsUserId')
                ELSE json_extract(value, '$.senderPointsUserId') END,
              CASE json_extract(value, '$.transactionType')
                WHEN 'TRANSFER' THEN json_extract(value, '$.sourceEvaluationCriterionId')
                ELSE json_extract(value, '$.targetEvaluationCriterionId') END,
              CASE json_extract(value, '$.transactionType')
                WHEN 'TRANSFER' THEN json_extract(value, '$.sourceEvaluationCriterionRevisionId')
                ELSE json_extract(value, '$.targetEvaluationCriterionRevisionId') END,
              CASE json_extract(value, '$.transactionType')
                WHEN 'TRANSFER' THEN json_extract(value, '$.sourceAmountScaled')
                ELSE json_extract(value, '$.targetAmountScaled') END,
              0, CASE json_extract(value, '$.transactionType')
                WHEN 'TRANSFER' THEN 'TRANSFER_CREDIT' ELSE 'EXCHANGE_MINT' END,
              json_extract(value, '$.id'), json_extract(value, '$.now')
       FROM json_each(?)`,
      items,
    ),
    db
      .prepare(
        "UPDATE point_transaction_batch SET status = 'COMMITTED' WHERE id = ? AND status = 'VALIDATED'",
      )
      .bind(input.batchId),
    db
      .prepare(
        `INSERT INTO idempotency_results
           (id, actor_points_user_id, operation, idempotency_key, payload_hash,
            status, response_body, created_at)
         VALUES (?, ?, ?, ?, ?, 201, ?, ?)`,
      )
      .bind(
        `idem_${crypto.randomUUID()}`,
        input.actorPointsUserId,
        operation,
        input.idempotencyKey,
        input.payloadHash,
        JSON.stringify(responseBody),
        now,
      ),
    db
      .prepare(
        `INSERT INTO audit_event
           (id, actor_points_user_id, action, target, reason, request_id, result, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, 'SUCCESS', ?)`,
      )
      .bind(
        `audit_${crypto.randomUUID()}`,
        input.actorPointsUserId,
        operation,
        input.batchId,
        input.requestId,
        now,
      ),
  ];
  await runCsvAtomicBatch(db, statements);
  return responseBody;
}
