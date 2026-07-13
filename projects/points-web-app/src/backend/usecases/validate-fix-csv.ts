import { parseAndValidateCsv } from "../csv/csv-input";
import { defineCsvSchema, textColumn } from "../csv/csv-schema";
import { canonicalJson, sha256Hex, type CsvValidationError } from "../csv/csv-validation-result";
import { scaledAmountCodec } from "../domain/money/scaled-amount";
import { normalizeIdentityUrl } from "../domain/ownership/normalize-identity-url";
import {
  normalizeGitHubProfileUrl,
  resolveGitHubProfileRecipients,
} from "../identity/github-profile-recipient-resolver";
import { observeGitHubApiBudget, reserveGitHubApiBudget } from "../identity/github-api-budget";

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
  amountScaled: number;
  evaluationCriterionRevisionId: string;
  minimumUnitScaled: number;
  normalizedRecipientProfileUrl: string;
  recipientAccountId: string | null;
  recipientProviderId: "github" | null;
  recipientPointsUserId: string | null;
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

async function findRegisteredRecipients(
  db: D1Database,
  accountIds: readonly string[],
): Promise<Map<string, string>> {
  if (accountIds.length === 0) return new Map();
  const rows = await db
    .prepare(
      `SELECT account.account_id AS accountId, points_user.id AS pointsUserId
       FROM account
       JOIN points_user ON points_user.auth_user_id = account.user_id
       JOIN json_each(?) input ON input.value = account.account_id
       WHERE account.provider_id = 'github'`,
    )
    .bind(canonicalJson([...new Set(accountIds)]))
    .all<{ accountId: string; pointsUserId: string }>();
  return new Map(rows.results.map((row) => [row.accountId, row.pointsUserId]));
}

async function findWebOwnershipRecipients(
  db: D1Database,
  rows: ReadonlyArray<{ evaluationAt: string; normalizedRecipientProfileUrl: string }>,
): Promise<Map<string, string>> {
  if (rows.length === 0) return new Map();
  const inputs = rows.map((row) => ({
    evaluationAt: row.evaluationAt,
    key: `${row.normalizedRecipientProfileUrl}\u0000${row.evaluationAt}`,
    normalizedUrl: row.normalizedRecipientProfileUrl,
  }));
  const result = await db
    .prepare(
      `SELECT json_extract(input.value, '$.key') AS lookupKey,
              epoch.owner_points_user_id AS pointsUserId
       FROM json_each(?) input
       JOIN identity_ownership ownership
         ON ownership.identity_type = 'WEB_URL'
        AND ownership.normalized_identity_key = json_extract(input.value, '$.normalizedUrl')
       JOIN ownership_epoch epoch ON epoch.identity_ownership_id = ownership.id
       WHERE (epoch.ended_at IS NOT NULL OR ownership.status = 'ACTIVE')
         AND (CASE length(json_extract(input.value, '$.evaluationAt'))
           WHEN 7 THEN unixepoch(json_extract(input.value, '$.evaluationAt') || '-01T00:00:00Z') * 1000
           WHEN 10 THEN unixepoch(json_extract(input.value, '$.evaluationAt') || 'T00:00:00Z') * 1000
           ELSE unixepoch(json_extract(input.value, '$.evaluationAt')) * 1000
         END) >= epoch.effective_at
         AND (epoch.ended_at IS NULL OR (CASE length(json_extract(input.value, '$.evaluationAt'))
           WHEN 7 THEN unixepoch(json_extract(input.value, '$.evaluationAt') || '-01T00:00:00Z') * 1000
           WHEN 10 THEN unixepoch(json_extract(input.value, '$.evaluationAt') || 'T00:00:00Z') * 1000
           ELSE unixepoch(json_extract(input.value, '$.evaluationAt')) * 1000
         END) < epoch.ended_at
       ORDER BY lookupKey, epoch.effective_at`,
    )
    .bind(canonicalJson(inputs))
    .all<{ lookupKey: string; pointsUserId: string }>();
  return new Map(result.results.map((row) => [row.lookupKey, row.pointsUserId]));
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

export function normalizeGenericWebProfileUrl(value: string): string {
  try {
    return normalizeIdentityUrl(value);
  } catch {
    throw new Error("RECIPIENT_PROFILE_URL_INVALID");
  }
}

function normalizeRecipientProfileUrl(value: string): { normalized: string; github: boolean } {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() === "github.com") {
      return { normalized: normalizeGitHubProfileUrl(value), github: true };
    }
  } catch {
    throw new Error("RECIPIENT_PROFILE_URL_INVALID");
  }
  return { normalized: normalizeGenericWebProfileUrl(value), github: false };
}

export async function validateFixCsv(
  db: D1Database,
  bytes: Uint8Array | ArrayBuffer,
  options: {
    githubClientId: string;
    githubClientSecret: string;
    githubFetch?: typeof fetch;
    now?: Date;
  },
): Promise<ValidatedFixCsv> {
  const parsed = await parseAndValidateCsv(bytes, fixCsvSchema);
  const errors = [...parsed.errors];
  const criteria = await findCriteria(
    db,
    parsed.rows.map((row) => row.evaluationCriterionId),
  );
  const heads = await findFixHeads(db, parsed.rows.map((row) => row.fixResultId).filter(Boolean));
  const normalizedUrls = new Map<string, string>();
  const githubUrls = new Set<string>();

  parsed.rows.forEach((row, index) => {
    const csvRow = index + 2;
    try {
      const normalized = normalizeRecipientProfileUrl(row.recipientProfileUrl);
      normalizedUrls.set(row.recipientProfileUrl, normalized.normalized);
      if (normalized.github) githubUrls.add(normalized.normalized);
    } catch {
      errors.push(rowError(csvRow, "recipientProfileUrl", "RECIPIENT_PROFILE_URL_INVALID"));
    }
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
    return {
      errors,
      fileHash: parsed.fileHash,
      rows: [],
      validationHash: await sha256Hex(canonicalJson({ errors, fileHash: parsed.fileHash })),
    };
  }

  const distinctUrls = [...githubUrls];
  await reserveGitHubApiBudget(db, distinctUrls.length, options.now);
  const resolved = await resolveGitHubProfileRecipients(distinctUrls, {
    clientId: options.githubClientId,
    clientSecret: options.githubClientSecret,
    fetcher: options.githubFetch,
    onRateLimitObservation: (observation) => observeGitHubApiBudget(db, observation, options.now),
  });
  const recipients = await findRegisteredRecipients(
    db,
    [...resolved.values()].map((value) => value.accountId),
  );
  const provisionalRows = parsed.rows.map((row) => {
    const normalizedRecipientProfileUrl = normalizedUrls.get(row.recipientProfileUrl)!;
    const recipient = resolved.get(normalizedRecipientProfileUrl);
    const criterion = criteria.get(row.evaluationCriterionId)!;
    return {
      ...row,
      amountScaled: scaledAmountCodec.parse(row.amount),
      evaluationCriterionRevisionId: criterion.revisionId,
      minimumUnitScaled: criterion.minimumUnitScaled,
      normalizedRecipientProfileUrl,
      recipientAccountId: recipient?.accountId ?? null,
      recipientPointsUserId: recipient ? (recipients.get(recipient.accountId) ?? null) : null,
      recipientProviderId: recipient ? ("github" as const) : null,
    };
  });
  const webRecipients = await findWebOwnershipRecipients(
    db,
    provisionalRows.filter((row) => row.recipientProviderId === null),
  );
  const rows = provisionalRows.map((row) => ({
    ...row,
    recipientPointsUserId:
      row.recipientPointsUserId ??
      webRecipients.get(`${row.normalizedRecipientProfileUrl}\u0000${row.evaluationAt}`) ??
      null,
  }));
  const correctionKeys = rows.map((row) =>
    row.fixResultId === ""
      ? null
      : [
          row.fixResultId,
          row.recipientAccountId
            ? `github:${row.recipientAccountId}`
            : `web:${row.normalizedRecipientProfileUrl}`,
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
    return {
      errors,
      fileHash: parsed.fileHash,
      rows: [],
      validationHash: await sha256Hex(canonicalJson({ errors, fileHash: parsed.fileHash })),
    };
  }
  const validationHash = await sha256Hex(
    canonicalJson({
      fileHash: parsed.fileHash,
      rows: rows.map(({ minimumUnitScaled, ...row }) => ({ ...row, minimumUnitScaled })),
    }),
  );
  return { errors, fileHash: parsed.fileHash, rows, validationHash };
}
