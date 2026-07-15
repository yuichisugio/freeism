import { parseAndValidateCsv } from "../csv/csv-input";
import { defineCsvSchema, textColumn } from "../csv/csv-schema";
import { canonicalJson, sha256Hex, type CsvValidationError } from "../csv/csv-validation-result";
import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";
import { scaledAmountCodec } from "../domain/money/scaled-amount";
import {
  commitPointTransaction,
  findCsvCommitReplay,
  type PersistedTransactionItem,
} from "../infrastructure/db/d1-point-transaction-repository";

interface TransferCsvFields {
  amount: string;
  evaluationCriterionId: string;
  recipientPointsUserId: string;
}

type TransferCsvRow = TransferCsvFields & Record<string, string>;

interface TransferCriterion {
  id: string;
  minimumUnitScaled: number;
  revisionId: string;
  status: string;
  transferEnabled: number;
}

const required = (name: string, maxCodePoints: number) => ({
  ...textColumn(name, { maxCodePoints }),
  validate: (value: string) => (value.length === 0 ? ["CSV_REQUIRED"] : []),
});

const transferCsvSchema = defineCsvSchema<TransferCsvRow>({
  columns: [
    required("evaluationCriterionId", 128),
    required("amount", 128),
    required("recipientPointsUserId", 128),
  ],
  importType: "TRANSFER",
  maxRows: 1_000,
});

function csvError(row: number, column: string, code: string): CsvValidationError {
  return { code, column, row };
}

async function findCriteria(db: D1Database, ids: string[]) {
  if (ids.length === 0) return new Map<string, TransferCriterion>();
  const rows = await db
    .prepare(
      `SELECT criterion.id, criterion.current_revision_id AS revisionId,
              revision.minimum_unit_scaled AS minimumUnitScaled,
              revision.status, revision.transfer_enabled AS transferEnabled
       FROM evaluation_criterion criterion
       JOIN evaluation_criterion_revision revision ON revision.id = criterion.current_revision_id
       JOIN json_each(?) input ON input.value = criterion.id`,
    )
    .bind(canonicalJson([...new Set(ids)]))
    .all<TransferCriterion>();
  return new Map(rows.results.map((row) => [row.id, row]));
}

async function findRecipients(db: D1Database, ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const rows = await db
    .prepare(
      "SELECT points_user.id FROM points_user JOIN json_each(?) input ON input.value = points_user.id",
    )
    .bind(canonicalJson([...new Set(ids)]))
    .all<{ id: string }>();
  return new Set(rows.results.map((row) => row.id));
}

export async function validateTransferCsv(
  db: D1Database,
  bytes: Uint8Array | ArrayBuffer,
  senderPointsUserId: string,
) {
  const parsed = await parseAndValidateCsv(bytes, transferCsvSchema);
  const errors = [...parsed.errors];
  const criteria = await findCriteria(
    db,
    parsed.rows.map((row) => row.evaluationCriterionId),
  );
  const recipients = await findRecipients(
    db,
    parsed.rows.map((row) => row.recipientPointsUserId),
  );
  const rows: PersistedTransactionItem[] = [];
  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const criterion = criteria.get(row.evaluationCriterionId);
    if (!criterion || criterion.status !== "ACTIVE" || criterion.transferEnabled !== 1) {
      errors.push(csvError(rowNumber, "evaluationCriterionId", "TRANSFER_NOT_ALLOWED"));
    }
    if (!recipients.has(row.recipientPointsUserId)) {
      errors.push(csvError(rowNumber, "recipientPointsUserId", "RECIPIENT_NOT_FOUND"));
    } else if (row.recipientPointsUserId === senderPointsUserId) {
      errors.push(csvError(rowNumber, "recipientPointsUserId", "SELF_TRANSFER_NOT_ALLOWED"));
    }
    let amountScaled: number | null = null;
    try {
      amountScaled = scaledAmountCodec.parse(row.amount);
      if (amountScaled <= 0) throw new Error("TRANSFER_AMOUNT_INVALID");
      if (criterion) scaledAmountCodec.assertMultiple(amountScaled, criterion.minimumUnitScaled);
    } catch (error) {
      errors.push(
        csvError(
          rowNumber,
          "amount",
          error instanceof RangeError
            ? "TRANSFER_AMOUNT_MINIMUM_UNIT_MISMATCH"
            : "TRANSFER_AMOUNT_INVALID",
        ),
      );
    }
    if (
      criterion &&
      criterion.status === "ACTIVE" &&
      criterion.transferEnabled === 1 &&
      recipients.has(row.recipientPointsUserId) &&
      row.recipientPointsUserId !== senderPointsUserId &&
      amountScaled !== null &&
      amountScaled > 0
    ) {
      rows.push({
        exchangeRateRevisionId: null,
        id: `txitem_${crypto.randomUUID()}`,
        minimumUnitRemainderScaled: null,
        rateDivisionRemainder: null,
        recipientPointsUserId: row.recipientPointsUserId,
        roundingRule: null,
        rowNumber,
        senderPointsUserId,
        sourceAmountScaled: amountScaled,
        sourceEvaluationCriterionId: criterion.id,
        sourceEvaluationCriterionRevisionId: criterion.revisionId,
        targetAmountScaled: null,
        targetEvaluationCriterionId: null,
        targetEvaluationCriterionRevisionId: null,
        transactionType: "TRANSFER",
      });
    }
  });
  const validationRows = rows.map(({ id: _, ...row }) => row);
  const validationHash = await sha256Hex(
    canonicalJson({ errors, fileHash: parsed.fileHash, rows: validationRows }),
  );
  return { errors, fileHash: parsed.fileHash, rows, validationHash };
}

export async function commitTransfers(
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
    "TRANSFER_CSV_COMMIT",
    input.idempotencyKey,
    payloadHash,
  );
  if (replay) return { responseBody: replay.body, status: replay.status };
  const validated = await validateTransferCsv(db, bytes, input.actorPointsUserId);
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
      transactionType: "TRANSFER",
      validationHash: validated.validationHash,
    });
    return { responseBody, status: 201 };
  } catch (error) {
    const concurrentReplay = await findCsvCommitReplay(
      db,
      input.actorPointsUserId,
      "TRANSFER_CSV_COMMIT",
      input.idempotencyKey,
      payloadHash,
    );
    if (concurrentReplay) {
      return { responseBody: concurrentReplay.body, status: concurrentReplay.status };
    }
    throw error;
  }
}
