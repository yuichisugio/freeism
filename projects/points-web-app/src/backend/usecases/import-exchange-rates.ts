import { parseAndValidateCsv } from "../csv/csv-input";
import { defineCsvSchema, textColumn } from "../csv/csv-schema";
import { canonicalJson, sha256Hex, type CsvValidationError } from "../csv/csv-validation-result";
import { normalizeExchangeRate } from "../domain/transactions/exchange-rate";
import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";
import {
  commitExchangeRateRevisions,
  findCsvCommitReplay,
  type PersistedExchangeRateRevision,
} from "../infrastructure/db/d1-point-transaction-repository";

interface ExchangeRateCsvFields {
  denominator: string;
  expectedRevision: string;
  numerator: string;
  sourceEvaluationCriterionId: string;
  status: string;
  targetEvaluationCriterionId: string;
}

type ExchangeRateCsvRow = ExchangeRateCsvFields & Record<string, string>;

interface CriterionReference {
  id: string;
  revisionId: string;
  status: string;
}

interface RateHead {
  currentRevision: number;
  sourceEvaluationCriterionId: string;
  targetEvaluationCriterionId: string;
}

export interface ValidatedExchangeRateRow extends PersistedExchangeRateRevision {
  rowNumber: number;
}

const required = (name: string, maxCodePoints: number) => ({
  ...textColumn(name, { maxCodePoints }),
  validate: (value: string) => (value.length === 0 ? ["CSV_REQUIRED"] : []),
});

const exchangeRateCsvSchema = defineCsvSchema<ExchangeRateCsvRow>({
  businessKey: (row) =>
    `${row.sourceEvaluationCriterionId}\u0000${row.targetEvaluationCriterionId}`,
  columns: [
    required("sourceEvaluationCriterionId", 128),
    required("targetEvaluationCriterionId", 128),
    textColumn("expectedRevision", { maxCodePoints: 16 }),
    required("status", 16),
    textColumn("numerator", { maxCodePoints: 32 }),
    textColumn("denominator", { maxCodePoints: 32 }),
  ],
  importType: "EXCHANGE_RATE",
  maxRows: 1_000,
});

function csvError(row: number, column: string, code: string): CsvValidationError {
  return { code, column, row };
}

function parsePositiveInteger(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error("EXCHANGE_RATE_INVALID");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("EXCHANGE_RATE_INVALID");
  return parsed;
}

async function findCriteria(db: D1Database, ids: string[]) {
  if (ids.length === 0) return new Map<string, CriterionReference>();
  const rows = await db
    .prepare(
      `SELECT criterion.id, criterion.current_revision_id AS revisionId, revision.status
       FROM evaluation_criterion criterion
       JOIN evaluation_criterion_revision revision ON revision.id = criterion.current_revision_id
       JOIN json_each(?) input ON input.value = criterion.id`,
    )
    .bind(canonicalJson([...new Set(ids)]))
    .all<CriterionReference>();
  return new Map(rows.results.map((row) => [row.id, row]));
}

async function findHeads(db: D1Database, rows: ExchangeRateCsvRow[]) {
  if (rows.length === 0) return new Map<string, RateHead>();
  const keys = rows.map((row) => ({
    source: row.sourceEvaluationCriterionId,
    target: row.targetEvaluationCriterionId,
  }));
  const result = await db
    .prepare(
      `SELECT rate.source_evaluation_criterion_id AS sourceEvaluationCriterionId,
              rate.target_evaluation_criterion_id AS targetEvaluationCriterionId,
              rate.current_revision AS currentRevision
       FROM exchange_rate rate JOIN json_each(?) input
         ON json_extract(input.value, '$.source') = rate.source_evaluation_criterion_id
        AND json_extract(input.value, '$.target') = rate.target_evaluation_criterion_id`,
    )
    .bind(canonicalJson(keys))
    .all<RateHead>();
  return new Map(
    result.results.map((row) => [
      `${row.sourceEvaluationCriterionId}\u0000${row.targetEvaluationCriterionId}`,
      row,
    ]),
  );
}

export async function validateExchangeRateCsv(db: D1Database, bytes: Uint8Array | ArrayBuffer) {
  const parsed = await parseAndValidateCsv(bytes, exchangeRateCsvSchema);
  const errors = [...parsed.errors];
  const criteria = await findCriteria(
    db,
    parsed.rows.flatMap((row) => [
      row.sourceEvaluationCriterionId,
      row.targetEvaluationCriterionId,
    ]),
  );
  const heads = await findHeads(db, parsed.rows);
  const rows: ValidatedExchangeRateRow[] = [];

  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const source = criteria.get(row.sourceEvaluationCriterionId);
    const target = criteria.get(row.targetEvaluationCriterionId);
    if (!source || source.status !== "ACTIVE") {
      errors.push(
        csvError(rowNumber, "sourceEvaluationCriterionId", "EVALUATION_CRITERION_NOT_ACTIVE"),
      );
    }
    if (!target || target.status !== "ACTIVE") {
      errors.push(
        csvError(rowNumber, "targetEvaluationCriterionId", "EVALUATION_CRITERION_NOT_ACTIVE"),
      );
    }
    if (row.sourceEvaluationCriterionId === row.targetEvaluationCriterionId) {
      errors.push(csvError(rowNumber, "targetEvaluationCriterionId", "EXCHANGE_RATE_SAME_AXIS"));
    }
    const key = `${row.sourceEvaluationCriterionId}\u0000${row.targetEvaluationCriterionId}`;
    const head = heads.get(key);
    let expectedRevision: number | null = null;
    let expectedRevisionValid = true;
    if (row.expectedRevision !== "") {
      if (!/^[1-9][0-9]*$/.test(row.expectedRevision)) {
        expectedRevisionValid = false;
        errors.push(csvError(rowNumber, "expectedRevision", "REVISION_CONFLICT"));
      } else {
        expectedRevision = Number(row.expectedRevision);
        if (!Number.isSafeInteger(expectedRevision)) expectedRevisionValid = false;
      }
    }
    if (
      !expectedRevisionValid ||
      (head === undefined && expectedRevision !== null) ||
      (head !== undefined && expectedRevision !== head.currentRevision)
    ) {
      errors.push(csvError(rowNumber, "expectedRevision", "REVISION_CONFLICT"));
    }
    let status: "ACTIVE" | "DISABLED" | null = null;
    let numerator: number | null = null;
    let denominator: number | null = null;
    if (row.status === "ACTIVE") {
      status = "ACTIVE";
      try {
        const normalized = normalizeExchangeRate(
          parsePositiveInteger(row.numerator),
          parsePositiveInteger(row.denominator),
        );
        numerator = normalized.numerator;
        denominator = normalized.denominator;
      } catch {
        errors.push(csvError(rowNumber, "numerator", "EXCHANGE_RATE_INVALID"));
      }
    } else if (row.status === "DISABLED") {
      status = "DISABLED";
      if (row.numerator !== "" || row.denominator !== "") {
        errors.push(csvError(rowNumber, "numerator", "EXCHANGE_RATE_DISABLED_VALUE_PRESENT"));
      }
    } else {
      errors.push(csvError(rowNumber, "status", "EXCHANGE_RATE_STATUS_INVALID"));
    }
    if (source && target && status && expectedRevisionValid) {
      const revision = (head?.currentRevision ?? 0) + 1;
      rows.push({
        denominator,
        expectedRevision,
        id: `exrate_${crypto.randomUUID()}`,
        numerator,
        revision,
        rowNumber,
        sourceEvaluationCriterionId: source.id,
        sourceEvaluationCriterionRevisionId: source.revisionId,
        status,
        targetEvaluationCriterionId: target.id,
        targetEvaluationCriterionRevisionId: target.revisionId,
      });
    }
  });
  const validationRows = rows.map(({ id: _, ...row }) => row);
  const validationHash = await sha256Hex(
    canonicalJson({ errors, fileHash: parsed.fileHash, rows: validationRows }),
  );
  return { errors, fileHash: parsed.fileHash, rows, validationHash };
}

export async function commitExchangeRateCsv(
  db: D1Database,
  bytes: Uint8Array,
  input: {
    actorPointsUserId: string;
    expectedValidationHash: string;
    idempotencyKey: string;
    now?: Date;
    reason: string;
  },
) {
  const payloadHash = await hashCanonicalPayload({
    fileHash: await sha256Hex(bytes),
    reason: input.reason,
    validationHash: input.expectedValidationHash,
  });
  const replay = await findCsvCommitReplay(
    db,
    input.actorPointsUserId,
    "EXCHANGE_RATE_CSV_COMMIT",
    input.idempotencyKey,
    payloadHash,
  );
  if (replay) return { responseBody: replay.body, status: replay.status };
  const validated = await validateExchangeRateCsv(db, bytes);
  if (validated.validationHash !== input.expectedValidationHash) {
    throw new Error("VALIDATION_CHANGED");
  }
  if (validated.errors.length > 0) {
    throw Object.assign(new Error("CSV_VALIDATION_FAILED"), { errors: validated.errors });
  }
  try {
    const responseBody = await commitExchangeRateRevisions(db, {
      actorPointsUserId: input.actorPointsUserId,
      fileHash: validated.fileHash,
      idempotencyKey: input.idempotencyKey,
      now: input.now ?? new Date(),
      payloadHash,
      reason: input.reason,
      requestId: `req_${crypto.randomUUID()}`,
      rows: validated.rows,
      validationHash: validated.validationHash,
    });
    return { responseBody, status: 201 };
  } catch (error) {
    const concurrentReplay = await findCsvCommitReplay(
      db,
      input.actorPointsUserId,
      "EXCHANGE_RATE_CSV_COMMIT",
      input.idempotencyKey,
      payloadHash,
    );
    if (concurrentReplay) {
      return { responseBody: concurrentReplay.body, status: concurrentReplay.status };
    }
    throw error;
  }
}
