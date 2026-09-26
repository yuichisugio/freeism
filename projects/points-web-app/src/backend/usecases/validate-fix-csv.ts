import { parseAndValidateCsv } from "../csv/csv-input";
import { defineCsvSchema, textColumn } from "../csv/csv-schema";
import { canonicalJson, sha256Hex, type CsvValidationError } from "../csv/csv-validation-result";
import { scaledAmountCodec } from "../domain/money/scaled-amount";
import {
  recipientBusinessKey,
  recipientIdentifierKey,
  type AccountsRecipientResolver,
  type RecipientIdentifier,
  type RecipientIdentifierType,
} from "../identity/accounts-recipient-resolver";

interface FixCsvFields {
  fixResultId: string;
  expectedRevision: string;
  recipientProfileUrl: string;
  evaluationCriterionId: string;
  amount: string;
  evaluationAt: string;
  managementId: string;
  memo: string;
}

export type FixCsvRow = FixCsvFields & Record<string, string>;

export interface ValidatedFixCsvRow extends FixCsvFields {
  accountsOrigin: string;
  amountScaled: number;
  evaluationCriterionRevisionId: string;
  minimumUnitScaled: number;
  recipientIdentifierType: RecipientIdentifierType;
  recipientIdentifierValue: string;
  recipientPointsUserId: string | null;
  resolvedAccountsUserId: string | null;
}

export interface ValidatedFixCsv {
  errors: CsvValidationError[];
  fileHash: string;
  rows: ValidatedFixCsvRow[];
  validationHash: string;
}

const required = (name: string, maxCodePoints: number) => ({
  ...textColumn(name, { maxCodePoints }),
  validate: (value: string) => (value.length === 0 ? ["CSV_REQUIRED"] : []),
});

export const fixCsvSchema = defineCsvSchema<FixCsvRow>({
  importType: "FIX",
  columns: [
    textColumn("fixResultId", { maxCodePoints: 128 }),
    textColumn("expectedRevision", { maxCodePoints: 16 }),
    required("recipientProfileUrl", 512),
    required("evaluationCriterionId", 128),
    required("amount", 128),
    required("evaluationAt", 32),
    textColumn("managementId", { maxCodePoints: 128 }),
    textColumn("memo", { maxCodePoints: 200 }),
  ],
  maxRows: 1_000,
});

interface CriterionRef {
  id: string;
  minimumUnitScaled: number;
  revisionId: string;
}

async function findCriteria(
  db: D1Database,
  ids: readonly string[],
): Promise<Map<string, CriterionRef>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .prepare(
      `SELECT criterion.id, revision.id AS revisionId,
              revision.minimum_unit_scaled AS minimumUnitScaled
       FROM evaluation_criterion criterion
       JOIN evaluation_criterion_revision revision ON revision.id = criterion.current_revision_id
       JOIN json_each(?) input ON input.value = criterion.id`,
    )
    .bind(canonicalJson([...new Set(ids)]))
    .all<CriterionRef>();
  return new Map(rows.results.map((row) => [row.id, row]));
}

/** 照合で得た Accounts ユーザーのうち、Points に連携済みのものを Points ユーザーへ対応付ける。 */
async function findLinkedRecipients(
  db: D1Database,
  accountsOrigin: string,
  accountsUserIds: readonly string[],
): Promise<Map<string, string>> {
  if (accountsUserIds.length === 0) return new Map();
  const rows = await db
    .prepare(
      `SELECT link.accounts_user_id AS accountsUserId, link.points_user_id AS pointsUserId
       FROM accounts_links link
       JOIN json_each(?) input ON input.value = link.accounts_user_id
       WHERE link.accounts_origin = ?`,
    )
    .bind(canonicalJson([...new Set(accountsUserIds)]), accountsOrigin)
    .all<{ accountsUserId: string; pointsUserId: string }>();
  return new Map(rows.results.map((row) => [row.accountsUserId, row.pointsUserId]));
}

async function findFixHeads(db: D1Database, ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, number>();
  const rows = await db
    .prepare(
      `SELECT result.id, result.current_revision AS currentRevision
       FROM fix_result result JOIN json_each(?) input ON input.value = result.id`,
    )
    .bind(canonicalJson([...new Set(ids)]))
    .all<{ currentRevision: number; id: string }>();
  return new Map(rows.results.map((row) => [row.id, row.currentRevision]));
}

/** 検査エラーだけを持つ結果を作る。 */
async function rejectedFixCsv(
  errors: CsvValidationError[],
  fileHash: string,
): Promise<ValidatedFixCsv> {
  return {
    errors,
    fileHash,
    rows: [],
    validationHash: await sha256Hex(canonicalJson({ errors, fileHash })),
  };
}

function rowError(row: number, column: string, code: string): CsvValidationError {
  return { code, column, row };
}

function validEvaluationAt(value: string): boolean {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return true;
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const dateOnly = new Date(Date.UTC(year!, month! - 1, day!));
  if (dateOnly.toISOString().slice(0, 10) !== value.slice(0, 10)) return false;
  return Number.isFinite(Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value));
}

/** CSV 行の受領者識別子。現在の CSV は URL 列だけを持つ。 */
function recipientIdentifierOf(row: FixCsvRow): RecipientIdentifier {
  return { type: "url", value: row.recipientProfileUrl };
}

/**
 * FIX CSV を検査し、受領者を Accounts で照合する。
 * 照合結果と Points 内の連携を `validationHash` に含め、commit で再照合して変化を検出する。
 * @see ../../../docs/v0.2/details-ja/unclaimed-fix-and-ownership.md
 */
export async function validateFixCsv(
  db: D1Database,
  bytes: Uint8Array | ArrayBuffer,
  options: { resolveRecipients: AccountsRecipientResolver },
): Promise<ValidatedFixCsv> {
  const parsed = await parseAndValidateCsv(bytes, fixCsvSchema);
  const errors = [...parsed.errors];
  const criteria = await findCriteria(
    db,
    parsed.rows.map((row) => row.evaluationCriterionId),
  );
  const heads = await findFixHeads(db, parsed.rows.map((row) => row.fixResultId).filter(Boolean));

  parsed.rows.forEach((row, index) => {
    const csvRow = index + 2;
    const criterion = criteria.get(row.evaluationCriterionId);
    if (!criterion)
      errors.push(rowError(csvRow, "evaluationCriterionId", "EVALUATION_CRITERION_NOT_FOUND"));
    if (!validEvaluationAt(row.evaluationAt)) {
      errors.push(rowError(csvRow, "evaluationAt", "EVALUATION_AT_INVALID"));
    }
    if ((row.fixResultId === "") !== (row.expectedRevision === "")) {
      errors.push(rowError(csvRow, "expectedRevision", "FIX_REVISION_REFERENCE_INVALID"));
    } else if (row.fixResultId !== "") {
      const expected = Number(row.expectedRevision);
      if (
        !Number.isSafeInteger(expected) ||
        expected < 1 ||
        heads.get(row.fixResultId) !== expected
      ) {
        errors.push(rowError(csvRow, "expectedRevision", "REVISION_CONFLICT"));
      }
    }
    try {
      const amount = scaledAmountCodec.parse(row.amount);
      if (criterion) scaledAmountCodec.assertMultiple(amount, criterion.minimumUnitScaled);
    } catch (error) {
      errors.push(
        rowError(
          csvRow,
          "amount",
          error instanceof RangeError ? "AMOUNT_SAFE_INTEGER_EXCEEDED" : "AMOUNT_INVALID",
        ),
      );
    }
  });

  if (errors.length > 0) {
    return rejectedFixCsv(errors, parsed.fileHash);
  }

  const identifiers = [
    ...new Map(
      parsed.rows.map((row) => {
        const identifier = recipientIdentifierOf(row);
        return [recipientIdentifierKey(identifier), identifier] as const;
      }),
    ).values(),
  ];
  const resolution =
    identifiers.length === 0
      ? { accountsOrigin: "", results: [] }
      : await options.resolveRecipients(identifiers);
  const resolved = new Map(
    identifiers.map((identifier, index) => [
      recipientIdentifierKey(identifier),
      resolution.results[index]!,
    ]),
  );
  const linkedRecipients = await findLinkedRecipients(
    db,
    resolution.accountsOrigin,
    resolution.results.flatMap((result) =>
      result.status === "matched" ? [result.accountsUserId] : [],
    ),
  );
  parsed.rows.forEach((row, index) => {
    if (
      resolved.get(recipientIdentifierKey(recipientIdentifierOf(row)))?.status === "invalid_input"
    )
      errors.push(rowError(index + 2, "recipientProfileUrl", "RECIPIENT_IDENTIFIER_INVALID"));
  });
  if (errors.length > 0) {
    return rejectedFixCsv(errors, parsed.fileHash);
  }
  const rows = parsed.rows.map((row) => {
    const identifier = recipientIdentifierOf(row);
    const result = resolved.get(recipientIdentifierKey(identifier))!;
    const resolvedAccountsUserId = result.status === "matched" ? result.accountsUserId : null;
    const criterion = criteria.get(row.evaluationCriterionId)!;
    return {
      ...row,
      accountsOrigin: resolution.accountsOrigin,
      amountScaled: scaledAmountCodec.parse(row.amount),
      evaluationCriterionRevisionId: criterion.revisionId,
      minimumUnitScaled: criterion.minimumUnitScaled,
      recipientIdentifierType: identifier.type,
      recipientIdentifierValue: identifier.value,
      recipientPointsUserId: resolvedAccountsUserId
        ? (linkedRecipients.get(resolvedAccountsUserId) ?? null)
        : null,
      resolvedAccountsUserId,
    };
  });
  const correctionKeys = rows.map((row) =>
    row.fixResultId === ""
      ? null
      : [
          row.fixResultId,
          recipientBusinessKey(
            { type: row.recipientIdentifierType, value: row.recipientIdentifierValue },
            row.accountsOrigin,
          ),
          row.evaluationCriterionId,
        ].join("\u0000"),
  );
  const correctionKeyCounts = new Map<string, number>();
  for (const key of correctionKeys) {
    if (key !== null) correctionKeyCounts.set(key, (correctionKeyCounts.get(key) ?? 0) + 1);
  }
  correctionKeys.forEach((key, index) => {
    if (key !== null && (correctionKeyCounts.get(key) ?? 0) > 1) {
      errors.push(rowError(index + 2, "recipientProfileUrl", "CSV_DUPLICATE_BUSINESS_KEY"));
    }
  });
  if (errors.length > 0) {
    return rejectedFixCsv(errors, parsed.fileHash);
  }
  const validationHash = await sha256Hex(
    canonicalJson({
      fileHash: parsed.fileHash,
      rows: rows.map(({ minimumUnitScaled, ...row }) => ({ ...row, minimumUnitScaled })),
    }),
  );
  return { errors, fileHash: parsed.fileHash, rows, validationHash };
}
