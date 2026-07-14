import { parseAndValidateCsv } from "../csv/csv-input";
import { defineCsvSchema, textColumn } from "../csv/csv-schema";
import { canonicalJson, sha256Hex, type CsvValidationError } from "../csv/csv-validation-result";
import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";
import { scaledAmountCodec } from "../domain/money/scaled-amount";
import { calculateExchangeAmounts } from "../domain/transactions/exchange-rate";
import {
  commitPointTransaction,
  findCsvCommitReplay,
  type PersistedTransactionItem,
} from "../infrastructure/db/d1-point-transaction-repository";

interface ExchangeCsvFields {
  sourceAmount: string;
  sourceEvaluationCriterionId: string;
  targetAmount: string;
  targetEvaluationCriterionId: string;
}

type ExchangeCsvRow = ExchangeCsvFields & Record<string, string>;

interface ExchangeCriterion {
  exchangeEnabled: number;
  id: string;
  minimumUnitScaled: number;
  revisionId: string;
  status: string;
}

interface CurrentRate {
  denominator: number;
  id: string;
  numerator: number;
  sourceEvaluationCriterionId: string;
  status: string;
  targetEvaluationCriterionId: string;
}

const required = (name: string, maxCodePoints: number) => ({
  ...textColumn(name, { maxCodePoints }),
  validate: (value: string) => (value.length === 0 ? ["CSV_REQUIRED"] : []),
});

const exchangeCsvSchema = defineCsvSchema<ExchangeCsvRow>({
  columns: [
    required("sourceEvaluationCriterionId", 128),
    textColumn("sourceAmount", { maxCodePoints: 128 }),
    required("targetEvaluationCriterionId", 128),
    textColumn("targetAmount", { maxCodePoints: 128 }),
  ],
  importType: "EXCHANGE",
  maxRows: 1_000,
});

function csvError(row: number, column: string, code: string): CsvValidationError {
  return { code, column, row };
}

async function findCriteria(db: D1Database, ids: string[]) {
  if (ids.length === 0) return new Map<string, ExchangeCriterion>();
  const rows = await db
    .prepare(
      `SELECT criterion.id, criterion.current_revision_id AS revisionId,
              revision.minimum_unit_scaled AS minimumUnitScaled,
              revision.status, revision.exchange_enabled AS exchangeEnabled
       FROM evaluation_criterion criterion
       JOIN evaluation_criterion_revision revision ON revision.id = criterion.current_revision_id
       JOIN json_each(?) input ON input.value = criterion.id`,
    )
    .bind(canonicalJson([...new Set(ids)]))
    .all<ExchangeCriterion>();
  return new Map(rows.results.map((row) => [row.id, row]));
}

async function findRates(db: D1Database, rows: ExchangeCsvRow[]) {
  if (rows.length === 0) return new Map<string, CurrentRate>();
  const pairs = rows.map((row) => ({
    source: row.sourceEvaluationCriterionId,
    target: row.targetEvaluationCriterionId,
  }));
  const result = await db
    .prepare(
      `SELECT revision.id, revision.source_evaluation_criterion_id AS sourceEvaluationCriterionId,
              revision.target_evaluation_criterion_id AS targetEvaluationCriterionId,
              revision.status, revision.numerator, revision.denominator
       FROM exchange_rate head
       JOIN exchange_rate_revision revision ON revision.id = head.current_revision_id
       JOIN json_each(?) input
         ON json_extract(input.value, '$.source') = head.source_evaluation_criterion_id
        AND json_extract(input.value, '$.target') = head.target_evaluation_criterion_id`,
    )
    .bind(canonicalJson(pairs))
    .all<CurrentRate>();
  return new Map(
    result.results.map((row) => [
      `${row.sourceEvaluationCriterionId}\u0000${row.targetEvaluationCriterionId}`,
      row,
    ]),
  );
}

function parseOptionalAmount(value: string): number | undefined {
  if (value === "") return undefined;
  const parsed = scaledAmountCodec.parse(value);
  if (parsed <= 0) throw new Error("EXCHANGE_AMOUNT_INVALID");
  return parsed;
}

export async function validateExchangeCsv(
  db: D1Database,
  bytes: Uint8Array | ArrayBuffer,
  actorPointsUserId: string,
) {
  const parsed = await parseAndValidateCsv(bytes, exchangeCsvSchema);
  const errors = [...parsed.errors];
  const criteria = await findCriteria(
    db,
    parsed.rows.flatMap((row) => [
      row.sourceEvaluationCriterionId,
      row.targetEvaluationCriterionId,
    ]),
  );
  const rates = await findRates(db, parsed.rows);
  const rows: PersistedTransactionItem[] = [];
  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const source = criteria.get(row.sourceEvaluationCriterionId);
    const target = criteria.get(row.targetEvaluationCriterionId);
    const rate = rates.get(
      `${row.sourceEvaluationCriterionId}\u0000${row.targetEvaluationCriterionId}`,
    );
    if (!source || source.status !== "ACTIVE" || source.exchangeEnabled !== 1) {
      errors.push(csvError(rowNumber, "sourceEvaluationCriterionId", "EXCHANGE_NOT_ALLOWED"));
    }
    if (!target || target.status !== "ACTIVE" || target.exchangeEnabled !== 1) {
      errors.push(csvError(rowNumber, "targetEvaluationCriterionId", "EXCHANGE_NOT_ALLOWED"));
    }
    if (row.sourceEvaluationCriterionId === row.targetEvaluationCriterionId) {
      errors.push(csvError(rowNumber, "targetEvaluationCriterionId", "EXCHANGE_SAME_AXIS"));
    }
    if (!rate || rate.status !== "ACTIVE") {
      errors.push(csvError(rowNumber, "targetEvaluationCriterionId", "EXCHANGE_RATE_NOT_ACTIVE"));
    }
    try {
      const sourceAmountScaled = parseOptionalAmount(row.sourceAmount);
      const targetAmountScaled = parseOptionalAmount(row.targetAmount);
      if (!sourceAmountScaled && !targetAmountScaled) throw new Error("EXCHANGE_AMOUNT_REQUIRED");
      if (source && sourceAmountScaled) {
        scaledAmountCodec.assertMultiple(sourceAmountScaled, source.minimumUnitScaled);
      }
      if (target && targetAmountScaled) {
        scaledAmountCodec.assertMultiple(targetAmountScaled, target.minimumUnitScaled);
      }
      if (source && target && rate && rate.status === "ACTIVE") {
        const calculated = calculateExchangeAmounts({
          denominator: rate.denominator,
          numerator: rate.numerator,
          sourceAmountScaled,
          sourceMinimumUnitScaled: source.minimumUnitScaled,
          targetAmountScaled,
          targetMinimumUnitScaled: target.minimumUnitScaled,
        });
        rows.push({
          exchangeRateRevisionId: rate.id,
          id: `txitem_${crypto.randomUUID()}`,
          minimumUnitRemainderScaled: calculated.minimumUnitRemainderScaled,
          rateDivisionRemainder: calculated.rateDivisionRemainder,
          recipientPointsUserId: null,
          roundingRule: calculated.roundingRule,
          rowNumber,
          senderPointsUserId: actorPointsUserId,
          sourceAmountScaled: calculated.sourceAmountScaled,
          sourceEvaluationCriterionId: source.id,
          sourceEvaluationCriterionRevisionId: source.revisionId,
          targetAmountScaled: calculated.targetAmountScaled,
          targetEvaluationCriterionId: target.id,
          targetEvaluationCriterionRevisionId: target.revisionId,
          transactionType: "EXCHANGE",
        });
      }
    } catch (error) {
      errors.push(
        csvError(
          rowNumber,
          row.sourceAmount === "" ? "targetAmount" : "sourceAmount",
          error instanceof Error ? error.message : "EXCHANGE_AMOUNT_INVALID",
        ),
      );
    }
  });
  const validationRows = rows.map(({ id: _, ...row }) => row);
  const validationHash = await sha256Hex(
    canonicalJson({ errors, fileHash: parsed.fileHash, rows: validationRows }),
  );
  return { errors, fileHash: parsed.fileHash, rows, validationHash };
}

export async function commitExchanges(
  db: D1Database,
  bytes: Uint8Array,
  input: {
    actorPointsUserId: string;
    expectedValidationHash: string;
    idempotencyKey: string;
    now?: Date;
  },
) {
  const payloadHash = await hashCanonicalPayload({
    fileHash: await sha256Hex(bytes),
    validationHash: input.expectedValidationHash,
  });
  const replay = await findCsvCommitReplay(
    db,
    input.actorPointsUserId,
    "EXCHANGE_CSV_COMMIT",
    input.idempotencyKey,
    payloadHash,
  );
  if (replay) return { responseBody: replay.body, status: replay.status };
  const validated = await validateExchangeCsv(db, bytes, input.actorPointsUserId);
  if (validated.validationHash !== input.expectedValidationHash) {
    throw new Error("VALIDATION_CHANGED");
  }
  if (validated.errors.length > 0) {
    throw Object.assign(new Error("CSV_VALIDATION_FAILED"), { errors: validated.errors });
  }
  try {
    const responseBody = await commitPointTransaction(db, {
      actorPointsUserId: input.actorPointsUserId,
      batchId: `txbatch_${crypto.randomUUID()}`,
      fileHash: validated.fileHash,
      idempotencyKey: input.idempotencyKey,
      items: validated.rows,
      now: input.now ?? new Date(),
      payloadHash,
      requestId: `req_${crypto.randomUUID()}`,
      transactionType: "EXCHANGE",
      validationHash: validated.validationHash,
    });
    return { responseBody, status: 201 };
  } catch (error) {
    const concurrentReplay = await findCsvCommitReplay(
      db,
      input.actorPointsUserId,
      "EXCHANGE_CSV_COMMIT",
      input.idempotencyKey,
      payloadHash,
    );
    if (concurrentReplay) {
      return { responseBody: concurrentReplay.body, status: concurrentReplay.status };
    }
    throw error;
  }
}
