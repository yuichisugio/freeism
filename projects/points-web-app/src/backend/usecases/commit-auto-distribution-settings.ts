import { parseAndValidateCsv } from "../csv/csv-input";
import { defineCsvSchema, textColumn } from "../csv/csv-schema";
import { canonicalJson, sha256Hex, type CsvValidationError } from "../csv/csv-validation-result";
import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";
import { scaledAmountCodec } from "../domain/money/scaled-amount";
import { findCsvCommitReplay } from "../infrastructure/db/d1-point-transaction-repository";

interface SettingCsvRow extends Record<string, string> {
  expectedRevision: string;
  pointPackageId: string;
  retentionAmount: string;
  retentionPercent: string;
  retentionType: string;
  status: string;
}

const schema = defineCsvSchema<SettingCsvRow>({
  importType: "AUTO_DISTRIBUTION_SETTING",
  columns: [
    textColumn("expectedRevision", { maxCodePoints: 16 }),
    textColumn("status", { maxCodePoints: 8 }),
    textColumn("pointPackageId", { maxCodePoints: 128 }),
    textColumn("retentionType", { maxCodePoints: 16 }),
    textColumn("retentionPercent", { maxCodePoints: 16 }),
    textColumn("retentionAmount", { maxCodePoints: 128 }),
  ],
  maxRows: 1,
});

function error(column: string, code: string): CsvValidationError {
  return { code, column, row: 2 };
}

function parseRevision(value: string): number | null {
  if (value === "") return null;
  if (!/^[1-9][0-9]*$/.test(value)) return Number.NaN;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function percentToPpm(value: string): number {
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,3}))?$/.exec(value);
  if (!match) throw new Error("AUTO_DISTRIBUTION_PERCENT_INVALID");
  const ppm = Number(match[1]) * 10_000 + Number((match[2] ?? "").padEnd(3, "0")) * 10;
  if (!Number.isSafeInteger(ppm) || ppm < 10 || ppm > 1_000_000)
    throw new Error("AUTO_DISTRIBUTION_PERCENT_INVALID");
  return ppm;
}

export async function validateAutoDistributionSettingCsv(
  db: D1Database,
  bytes: Uint8Array,
  pointsUserId: string,
) {
  const parsed = await parseAndValidateCsv(bytes, schema);
  const errors = [...parsed.errors];
  const input = parsed.rows[0];
  const rows: Array<Record<string, unknown>> = [];
  if (input) {
    const head = await db
      .prepare(
        `SELECT current_revision AS currentRevision FROM auto_distribution_setting
         WHERE points_user_id = ?`,
      )
      .bind(pointsUserId)
      .first<{ currentRevision: number }>();
    const expectedRevision = parseRevision(input.expectedRevision);
    if (
      Number.isNaN(expectedRevision) ||
      (head === null) !== (expectedRevision === null) ||
      (head && head.currentRevision !== expectedRevision)
    ) {
      errors.push(error("expectedRevision", "REVISION_CONFLICT"));
    }
    if (input.status === "OFF") {
      if (
        input.pointPackageId ||
        input.retentionType ||
        input.retentionPercent ||
        input.retentionAmount
      ) {
        errors.push(error("status", "AUTO_DISTRIBUTION_OFF_VALUE_PRESENT"));
      }
      rows.push({
        expectedRevision,
        pointPackageRevisionId: null,
        retentionAmountScaled: null,
        retentionRatePpm: null,
        retentionType: null,
        revision: (expectedRevision ?? 0) + 1,
        status: "OFF",
      });
    } else if (input.status === "ON") {
      const packageRevision = await db
        .prepare(
          `SELECT package.current_revision_id AS revisionId
           FROM profile_point_package profile_package
           JOIN point_package package ON package.id = profile_package.point_package_id
           JOIN point_package_revision revision ON revision.id = package.current_revision_id
           WHERE profile_package.points_user_id = ? AND package.id = ?
             AND package.lifecycle_status = 'ACTIVE' AND revision.status = 'ACTIVE'`,
        )
        .bind(pointsUserId, input.pointPackageId)
        .first<{ revisionId: string }>();
      if (!packageRevision)
        errors.push(error("pointPackageId", "AUTO_DISTRIBUTION_PACKAGE_NOT_ACTIVE"));
      let retentionRatePpm: number | null = null;
      let retentionAmountScaled: number | null = null;
      if (input.retentionType === "PERCENT") {
        if (input.retentionAmount !== "")
          errors.push(error("retentionAmount", "AUTO_DISTRIBUTION_RETENTION_INVALID"));
        try {
          retentionRatePpm = percentToPpm(input.retentionPercent);
        } catch {
          errors.push(error("retentionPercent", "AUTO_DISTRIBUTION_PERCENT_INVALID"));
        }
      } else if (input.retentionType === "FIXED") {
        if (input.retentionPercent !== "")
          errors.push(error("retentionPercent", "AUTO_DISTRIBUTION_RETENTION_INVALID"));
        try {
          retentionAmountScaled = scaledAmountCodec.parse(input.retentionAmount);
          if (retentionAmountScaled < 0) throw new Error();
        } catch {
          errors.push(error("retentionAmount", "AUTO_DISTRIBUTION_AMOUNT_INVALID"));
        }
      } else {
        errors.push(error("retentionType", "AUTO_DISTRIBUTION_RETENTION_INVALID"));
      }
      rows.push({
        expectedRevision,
        pointPackageRevisionId: packageRevision?.revisionId ?? null,
        retentionAmountScaled,
        retentionRatePpm,
        retentionType: input.retentionType,
        revision: (expectedRevision ?? 0) + 1,
        status: "ON",
      });
    } else {
      errors.push(error("status", "AUTO_DISTRIBUTION_STATUS_INVALID"));
    }
  }
  const validationRows = errors.length === 0 ? rows : [];
  return {
    errors,
    fileHash: parsed.fileHash,
    rows: validationRows,
    validationHash: await sha256Hex(
      canonicalJson({ errors, fileHash: parsed.fileHash, rows: validationRows }),
    ),
  };
}

export async function commitAutoDistributionSettingCsv(
  db: D1Database,
  bytes: Uint8Array,
  input: {
    expectedValidationHash: string;
    idempotencyKey: string;
    now?: Date;
    pointsUserId: string;
  },
) {
  const payloadHash = await hashCanonicalPayload({
    fileHash: await sha256Hex(bytes),
    validationHash: input.expectedValidationHash,
  });
  const operation = "AUTO_DISTRIBUTION_CSV_COMMIT";
  const replay = await findCsvCommitReplay(
    db,
    input.pointsUserId,
    operation,
    input.idempotencyKey,
    payloadHash,
  );
  if (replay) return { responseBody: replay.body, status: replay.status };
  const validated = await validateAutoDistributionSettingCsv(db, bytes, input.pointsUserId);
  if (validated.errors.length > 0)
    throw Object.assign(new Error("CSV_VALIDATION_FAILED"), { errors: validated.errors });
  if (validated.validationHash !== input.expectedValidationHash)
    throw new Error("VALIDATION_CHANGED");
  const row = validated.rows[0]!;
  const now = (input.now ?? new Date()).getTime();
  const revisionId = `autodistsettingrev_${crypto.randomUUID()}`;
  const responseBody = {
    data: { revision: row.revision, settingRevisionId: revisionId, status: row.status },
    meta: { requestId: `req_${crypto.randomUUID()}` },
  };
  const statements = [
    ...(row.expectedRevision === null
      ? [
          db
            .prepare(
              `INSERT INTO auto_distribution_setting
                 (points_user_id, current_revision_id, current_revision, created_at)
               VALUES (?, ?, ?, ?)`,
            )
            .bind(input.pointsUserId, revisionId, row.revision, now),
        ]
      : []),
    db
      .prepare(
        `INSERT INTO auto_distribution_setting_revision
           (id, points_user_id, revision, status, point_package_revision_id,
            retention_type, retention_rate_ppm, retention_amount_scaled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        revisionId,
        input.pointsUserId,
        row.revision,
        row.status,
        row.pointPackageRevisionId,
        row.retentionType,
        row.retentionRatePpm,
        row.retentionAmountScaled,
        now,
      ),
    ...(row.expectedRevision === null
      ? []
      : [
          db
            .prepare(
              `UPDATE auto_distribution_setting SET current_revision_id = ?, current_revision = ?
               WHERE points_user_id = ? AND current_revision = ?`,
            )
            .bind(revisionId, row.revision, input.pointsUserId, row.expectedRevision),
        ]),
    db
      .prepare(
        `INSERT INTO idempotency_results
           (id, actor_points_user_id, operation, idempotency_key, payload_hash,
            status, response_body, created_at)
         VALUES (?, ?, ?, ?, ?, 201, ?, ?)`,
      )
      .bind(
        `idem_${crypto.randomUUID()}`,
        input.pointsUserId,
        operation,
        input.idempotencyKey,
        payloadHash,
        JSON.stringify(responseBody),
        now,
      ),
  ];
  try {
    await db.batch(statements);
  } catch (cause) {
    const concurrent = await findCsvCommitReplay(
      db,
      input.pointsUserId,
      operation,
      input.idempotencyKey,
      payloadHash,
    );
    if (concurrent) return { responseBody: concurrent.body, status: concurrent.status };
    throw cause;
  }
  return { responseBody, status: 201 };
}
