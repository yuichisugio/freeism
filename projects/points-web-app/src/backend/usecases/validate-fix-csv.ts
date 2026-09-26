import { parseAndValidateCsv } from "../csv/csv-input";
import { defineCsvSchema, textColumn } from "../csv/csv-schema";
import { canonicalJson, sha256Hex, type CsvValidationError } from "../csv/csv-validation-result";
import { scaledAmountCodec } from "../domain/money/scaled-amount";
import {
  AccountsRecipientResolutionError,
  recipientBusinessKey,
  type AccountsRecipientResolution,
  type CreateAccountsRecipientResolver,
  type RecipientIdentifier,
  type RecipientIdentifierType,
} from "../identity/accounts-recipient-resolver";

/**
 * FIX CSV を検査し、受領者を接続先 Accounts で照合する。
 * 照合結果と Points 内の連携を `validationHash` に含め、commit で再照合して変化を検出する。
 * @see ../../../docs/v0.2/details-ja/points-domain.md
 * @see ../../../docs/v0.2/details-ja/unclaimed-fix-and-ownership.md
 * @see ./validate-fix-csv.test.ts
 * @see ../../../test/worker/fix-ledger.worker.test.ts
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

interface FixCsvFields {
  fixResultId: string;
  expectedRevision: string;
  recipientProfileUrl: string;
  recipientAccountsUserId: string;
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

/**
 * Accounts から照合結果を得られなかった理由。
 * ファイル全体を0件反映にし、利用者が再実行できるように理由を返す。
 */
export interface FixRecipientResolutionFailure {
  code: "ACCOUNTS_UNAVAILABLE" | "ACCOUNTS_CLIENT_UNAUTHORIZED";
  retryAfter: string | null;
}

/**
 * FIX CSV の検査結果。
 * - `INVALID`: 行の検査に失敗した
 * - `UNRESOLVED`: Accounts で照合できず、受領者を決められなかった
 * - `VALID`: 確定できる
 */
export type ValidatedFixCsv =
  | { status: "INVALID"; errors: CsvValidationError[]; fileHash: string }
  | {
      status: "UNRESOLVED";
      failure: FixRecipientResolutionFailure;
      fileHash: string;
      rowCount: number;
    }
  | {
      status: "VALID";
      accountsConnectionId: string;
      accountsOrigin: string;
      fileHash: string;
      rows: ValidatedFixCsvRow[];
      validationHash: string;
    };

// --------------------------------------------------
// CSV の列
// --------------------------------------------------

const required = (name: string, maxCodePoints: number) => ({
  ...textColumn(name, { maxCodePoints }),
  validate: (value: string) => (value.length === 0 ? ["CSV_REQUIRED"] : []),
});

export const fixCsvSchema = defineCsvSchema<FixCsvRow>({
  importType: "FIX",
  columns: [
    textColumn("fixResultId", { maxCodePoints: 128 }),
    textColumn("expectedRevision", { maxCodePoints: 16 }),
    textColumn("recipientProfileUrl", { maxCodePoints: 512 }),
    textColumn("recipientAccountsUserId", { maxCodePoints: 256 }),
    required("evaluationCriterionId", 128),
    required("amount", 128),
    required("evaluationAt", 32),
    textColumn("managementId", { maxCodePoints: 128 }),
    textColumn("memo", { maxCodePoints: 200 }),
  ],
  maxRows: 1_000,
});

/** 識別子の種類ごとの CSV 列名。 */
const recipientIdentifierColumns = {
  url: "recipientProfileUrl",
  accounts_user: "recipientAccountsUserId",
} as const satisfies Record<RecipientIdentifierType, keyof FixCsvFields>;

/**
 * CSV 行の受領者識別子を読む。
 * `recipientProfileUrl` と `recipientAccountsUserId` のちょうど一方を必須とする。
 * @returns 識別子、または行エラーの code
 */
export function readRecipientIdentifier(
  row: Pick<FixCsvFields, "recipientAccountsUserId" | "recipientProfileUrl">,
): RecipientIdentifier | "RECIPIENT_IDENTIFIER_AMBIGUOUS" | "RECIPIENT_IDENTIFIER_REQUIRED" {
  const { recipientAccountsUserId, recipientProfileUrl } = row;
  if (recipientProfileUrl !== "" && recipientAccountsUserId !== "") {
    return "RECIPIENT_IDENTIFIER_AMBIGUOUS";
  }
  if (recipientProfileUrl !== "") return { type: "url", value: recipientProfileUrl };
  if (recipientAccountsUserId !== "") {
    return { type: "accounts_user", value: recipientAccountsUserId };
  }
  return "RECIPIENT_IDENTIFIER_REQUIRED";
}

// --------------------------------------------------
// 参照先の読み込み
// --------------------------------------------------

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

/**
 * 照合で得た Accounts ユーザーのうち、Points に連携済みのものを Points ユーザーへ対応付ける。
 * 連携の無い Accounts ユーザーには受領者を決めない。
 */
async function findLinkedRecipients(
  db: D1Database,
  resolution: AccountsRecipientResolution,
): Promise<Map<string, string>> {
  const accountsUserIds = resolution.results.flatMap((result) =>
    result.status === "matched" ? [result.accountsUserId] : [],
  );
  if (accountsUserIds.length === 0) return new Map();
  const rows = await db
    .prepare(
      `SELECT link.accounts_user_id AS accountsUserId, link.points_user_id AS pointsUserId
       FROM accounts_links link
       JOIN json_each(?) input ON input.value = link.accounts_user_id
       WHERE link.accounts_origin = ?`,
    )
    .bind(canonicalJson([...new Set(accountsUserIds)]), resolution.accountsOrigin)
    .all<{ accountsUserId: string; pointsUserId: string }>();
  return new Map(rows.results.map((row) => [row.accountsUserId, row.pointsUserId]));
}

// --------------------------------------------------
// 行の検査
// --------------------------------------------------

function rowError(row: number, column: string | null, code: string): CsvValidationError {
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

/**
 * Accounts への照合より前に確認できる行エラーを返す。
 */
async function findRowErrors(
  db: D1Database,
  rows: readonly FixCsvRow[],
  criteria: Map<string, CriterionRef>,
): Promise<CsvValidationError[]> {
  const heads = await findFixHeads(db, rows.map((row) => row.fixResultId).filter(Boolean));
  return rows.flatMap((row, index) => {
    const csvRow = index + 2;
    const errors: CsvValidationError[] = [];
    const identifier = readRecipientIdentifier(row);
    if (typeof identifier === "string") errors.push(rowError(csvRow, null, identifier));
    const criterion = criteria.get(row.evaluationCriterionId);
    if (!criterion) {
      errors.push(rowError(csvRow, "evaluationCriterionId", "EVALUATION_CRITERION_NOT_FOUND"));
    }
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
    return errors;
  });
}

/**
 * 修正行のうち、同じ FIX result・対象者・評価軸が重複する行のエラーを返す。
 */
function findDuplicateCorrectionErrors(rows: readonly ValidatedFixCsvRow[]): CsvValidationError[] {
  const keys = rows.map((row) =>
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
  const counts = new Map<string, number>();
  for (const key of keys) if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  return keys.flatMap((key, index) =>
    key !== null && counts.get(key)! > 1
      ? [
          rowError(
            index + 2,
            recipientIdentifierColumns[rows[index]!.recipientIdentifierType],
            "CSV_DUPLICATE_BUSINESS_KEY",
          ),
        ]
      : [],
  );
}

// --------------------------------------------------
// 検査
// --------------------------------------------------

/**
 * FIX CSV を検査し、受領者を接続先 Accounts で照合する。
 * - 行エラーがあれば Accounts へ問い合わせない。
 * - Accounts で照合できなかった場合は `UNRESOLVED` を返し、受領者を決めない。
 * - `matched` でも Points 内に連携が無ければ受領者を決めない（未受領になる）。
 */
export async function validateFixCsv(
  db: D1Database,
  bytes: Uint8Array | ArrayBuffer,
  options: { accountsConnectionId: string; createResolver: CreateAccountsRecipientResolver },
): Promise<ValidatedFixCsv> {
  const parsed = await parseAndValidateCsv(bytes, fixCsvSchema);
  const { fileHash } = parsed;
  const criteria = await findCriteria(
    db,
    parsed.rows.map((row) => row.evaluationCriterionId),
  );
  const rowErrors = [...parsed.errors, ...(await findRowErrors(db, parsed.rows, criteria))];
  if (rowErrors.length > 0) return { status: "INVALID", errors: rowErrors, fileHash };

  const identifiers = parsed.rows.map((row) => readRecipientIdentifier(row) as RecipientIdentifier);
  let resolution: AccountsRecipientResolution;
  try {
    resolution = await options.createResolver(options.accountsConnectionId)(identifiers);
  } catch (error) {
    if (
      error instanceof AccountsRecipientResolutionError &&
      (error.code === "ACCOUNTS_UNAVAILABLE" || error.code === "ACCOUNTS_CLIENT_UNAUTHORIZED")
    ) {
      return {
        status: "UNRESOLVED",
        failure: { code: error.code, retryAfter: error.retryAfter },
        fileHash,
        rowCount: parsed.rows.length,
      };
    }
    throw error;
  }

  const invalidInputErrors = resolution.results.flatMap((result, index) =>
    result.status === "invalid_input"
      ? [
          rowError(
            index + 2,
            recipientIdentifierColumns[identifiers[index]!.type],
            "RECIPIENT_IDENTIFIER_INVALID",
          ),
        ]
      : [],
  );
  if (invalidInputErrors.length > 0) {
    return { status: "INVALID", errors: invalidInputErrors, fileHash };
  }

  const linkedRecipients = await findLinkedRecipients(db, resolution);
  const rows = parsed.rows.map((row, index): ValidatedFixCsvRow => {
    const identifier = identifiers[index]!;
    const result = resolution.results[index]!;
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
      recipientPointsUserId:
        resolvedAccountsUserId === null
          ? null
          : (linkedRecipients.get(resolvedAccountsUserId) ?? null),
      resolvedAccountsUserId,
    };
  });
  const duplicateErrors = findDuplicateCorrectionErrors(rows);
  if (duplicateErrors.length > 0) return { status: "INVALID", errors: duplicateErrors, fileHash };

  const { accountsConnectionId } = options;
  const validationHash = await sha256Hex(canonicalJson({ accountsConnectionId, fileHash, rows }));
  return {
    status: "VALID",
    accountsConnectionId,
    accountsOrigin: resolution.accountsOrigin,
    fileHash,
    rows,
    validationHash,
  };
}
