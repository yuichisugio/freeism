import type { Context, Hono } from "hono";

import { parseAndValidateCsv } from "../../csv/csv-input";
import { defineCsvSchema, textColumn } from "../../csv/csv-schema";
import { canonicalJson, sha256Hex, type CsvValidationError } from "../../csv/csv-validation-result";
import {
  InvalidEvaluationCriterionError,
  normalizeEvaluationCriterionName,
  validateEvaluationCriterionRevision,
  type EvaluationCriterionRevisionInput,
} from "../../domain/evaluation/evaluation-criterion";
import {
  createPointPackageRevision,
  InvalidPointPackageError,
  normalizePointPackageName,
} from "../../domain/evaluation/point-package";
import { hashCanonicalPayload } from "../../domain/idempotency/idempotency-result";
import {
  findCurrentEvaluationCriteria,
  findEvaluationCriterionHead,
  findPointPackageHead,
} from "../../infrastructure/db/d1-evaluation-repository";
import {
  EvaluationCriterionNameConflictError,
  EvaluationCriterionRevisionConflictError,
  importEvaluationCriteria,
  type EvaluationCriterionImportItem,
} from "../../usecases/import-evaluation-criteria";
import {
  importPointPackages,
  PointPackageNameConflictError,
  PointPackageRevisionConflictError,
  type PointPackageImportItem,
} from "../../usecases/import-point-packages";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { adminMiddleware } from "../middleware/admin-middleware";
import { csvBodyLimitMiddleware } from "../middleware/csv-body-limit-middleware";
import { googleFreshMiddleware } from "../middleware/google-fresh-middleware";
import { idempotencyKeyMiddleware } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

type CriterionRow = Record<string, string> & {
  balanceVisibleByDefault: string;
  buyNowEnabled: string;
  description: string;
  evaluationCriterionId: string;
  exchangeEnabled: string;
  expectedRevision: string;
  minimumUnit: string;
  name: string;
  relatedUrl: string;
  status: string;
  transferEnabled: string;
};

type PackageRow = Record<string, string> & {
  componentWeight: string;
  description: string;
  displayOrder: string;
  evaluationCriterionId: string;
  expectedRevision: string;
  name: string;
  pointPackageId: string;
  relatedUrl: string;
  status: string;
};

const criterionSchema = defineCsvSchema<CriterionRow>({
  columns: [
    textColumn("evaluationCriterionId", { maxCodePoints: 128 }),
    textColumn("expectedRevision", { maxCodePoints: 16 }),
    textColumn("status", { maxCodePoints: 16 }),
    textColumn("name", { maxCodePoints: 30 }),
    textColumn("description", { maxCodePoints: 200 }),
    textColumn("minimumUnit", { maxCodePoints: 32 }),
    textColumn("transferEnabled", { maxCodePoints: 5 }),
    textColumn("exchangeEnabled", { maxCodePoints: 5 }),
    textColumn("balanceVisibleByDefault", { maxCodePoints: 5 }),
    textColumn("buyNowEnabled", { maxCodePoints: 5 }),
    textColumn("relatedUrl", { maxCodePoints: 2_048 }),
  ],
  importType: "EVALUATION_CRITERION",
  maxRows: 1_000,
});

const packageSchema = defineCsvSchema<PackageRow>({
  columns: [
    textColumn("pointPackageId", { maxCodePoints: 128 }),
    textColumn("expectedRevision", { maxCodePoints: 16 }),
    textColumn("status", { maxCodePoints: 16 }),
    textColumn("name", { maxCodePoints: 60 }),
    textColumn("description", { maxCodePoints: 500 }),
    textColumn("relatedUrl", { maxCodePoints: 2_048 }),
    textColumn("evaluationCriterionId", { maxCodePoints: 128 }),
    textColumn("componentWeight", { maxCodePoints: 32 }),
    textColumn("displayOrder", { maxCodePoints: 16 }),
  ],
  importType: "POINT_PACKAGE",
  maxRows: 1_000,
});

function csvError(code: string, row: number, column: string | null = null): CsvValidationError {
  return { code, column, row };
}

function parseRevision(value: string, row: number, errors: CsvValidationError[]) {
  if (value === "") return null;
  const revision = Number(value);
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(revision)) {
    errors.push(csvError("REVISION_INVALID", row, "expectedRevision"));
    return null;
  }
  return revision;
}

function parseBoolean(value: string, row: number, column: string, errors: CsvValidationError[]) {
  if (value === "true") return true;
  if (value === "false") return false;
  errors.push(csvError("CSV_BOOLEAN_INVALID", row, column));
  return false;
}

function parsePositiveSafeInteger(
  value: string,
  row: number,
  column: string,
  options: { allowZero?: boolean } = {},
) {
  const validPattern = options.allowZero ? /^(0|[1-9][0-9]*)$/ : /^[1-9][0-9]*$/;
  const parsed = Number(value);
  return validPattern.test(value) && Number.isSafeInteger(parsed)
    ? parsed
    : csvError("CSV_SAFE_INTEGER_INVALID", row, column);
}

function groupKey(id: string, name: string, kind: string) {
  return id === "" ? `${kind}:new:${name.normalize("NFKC")}` : `${kind}:id:${id}`;
}

function sameFields(
  left: Record<string, string>,
  right: Record<string, string>,
  excluded: string[],
) {
  return Object.keys(left).every((key) => excluded.includes(key) || left[key] === right[key]);
}

async function validateCriteriaCsv(db: D1Database, bytes: Uint8Array) {
  const parsed = await parseAndValidateCsv(bytes, criterionSchema);
  const errors = [...parsed.errors];
  const groups = new Map<string, { first: CriterionRow; row: number; urls: string[] }>();
  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const key = groupKey(row.evaluationCriterionId, row.name, "criterion");
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { first: row, row: rowNumber, urls: row.relatedUrl ? [row.relatedUrl] : [] });
    } else {
      if (!sameFields(group.first, row, ["relatedUrl"])) {
        errors.push(csvError("CSV_GROUP_MISMATCH", rowNumber));
      }
      if (row.relatedUrl) group.urls.push(row.relatedUrl);
    }
  });
  if (groups.size > 20) {
    errors.push(csvError("CSV_TOO_MANY_ITEMS", [...groups.values()][20]?.row ?? 22));
  }

  const items: EvaluationCriterionImportItem[] = [];
  const names = new Set<string>();
  for (const [index, group] of [...groups.values()].entries()) {
    const row = group.first;
    const item: EvaluationCriterionRevisionInput = {
      balanceVisibleByDefault: parseBoolean(
        row.balanceVisibleByDefault,
        group.row,
        "balanceVisibleByDefault",
        errors,
      ),
      buyNowEnabled: parseBoolean(row.buyNowEnabled, group.row, "buyNowEnabled", errors),
      description: row.description,
      evaluationCriterionId:
        row.evaluationCriterionId || `criterion_${parsed.fileHash.slice(0, 20)}_${index}`,
      exchangeEnabled: parseBoolean(row.exchangeEnabled, group.row, "exchangeEnabled", errors),
      expectedRevision: parseRevision(row.expectedRevision, group.row, errors),
      minimumUnit: row.minimumUnit,
      name: row.name,
      relatedUrls: group.urls,
      status: row.status as EvaluationCriterionRevisionInput["status"],
      transferEnabled: parseBoolean(row.transferEnabled, group.row, "transferEnabled", errors),
    };
    try {
      validateEvaluationCriterionRevision(item);
    } catch {
      errors.push(csvError("INVALID_EVALUATION_CRITERION", group.row));
    }
    const normalizedName = normalizeEvaluationCriterionName(item.name);
    if (names.has(normalizedName))
      errors.push(csvError("EVALUATION_CRITERION_NAME_CONFLICT", group.row, "name"));
    names.add(normalizedName);
    const head = await findEvaluationCriterionHead(db, item.evaluationCriterionId);
    if (
      (head === null && item.expectedRevision !== null) ||
      (head !== null && item.expectedRevision !== head.currentRevision)
    ) {
      errors.push(csvError("REVISION_CONFLICT", group.row, "expectedRevision"));
    }
    items.push(item);
  }
  const validationHash = await sha256Hex(
    canonicalJson({
      errors,
      fileHash: parsed.fileHash,
      importType: "EVALUATION_CRITERION",
      rows: items,
    }),
  );
  return { errors, fileHash: parsed.fileHash, rows: items, validationHash };
}

async function validatePackagesCsv(db: D1Database, bytes: Uint8Array) {
  const parsed = await parseAndValidateCsv(bytes, packageSchema);
  const errors = [...parsed.errors];
  const groups = new Map<string, { first: PackageRow; row: number; components: PackageRow[] }>();
  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const key = groupKey(row.pointPackageId, row.name, "package");
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { components: [row], first: row, row: rowNumber });
    } else {
      if (
        !sameFields(group.first, row, ["evaluationCriterionId", "componentWeight", "displayOrder"])
      ) {
        errors.push(csvError("CSV_GROUP_MISMATCH", rowNumber));
      }
      group.components.push(row);
    }
  });
  if (groups.size > 20) {
    errors.push(csvError("CSV_TOO_MANY_ITEMS", [...groups.values()][20]?.row ?? 22));
  }

  const items: PointPackageImportItem[] = [];
  const names = new Set<string>();
  for (const [index, group] of [...groups.values()].entries()) {
    const row = group.first;
    const components: PointPackageImportItem["components"] = [];
    group.components.forEach((component, componentIndex) => {
      const physicalRow = group.row + componentIndex;
      const weight = parsePositiveSafeInteger(
        component.componentWeight,
        physicalRow,
        "componentWeight",
      );
      const displayOrder = parsePositiveSafeInteger(
        component.displayOrder,
        physicalRow,
        "displayOrder",
        { allowZero: true },
      );
      if (typeof weight !== "number") errors.push(weight);
      if (typeof displayOrder !== "number") errors.push(displayOrder);
      components.push({
        displayOrder: typeof displayOrder === "number" ? displayOrder : -1,
        evaluationCriterionId: component.evaluationCriterionId,
        weight: typeof weight === "number" ? weight : 0,
      });
    });
    const item: PointPackageImportItem = {
      components,
      description: row.description || null,
      expectedRevision: parseRevision(row.expectedRevision, group.row, errors),
      name: row.name,
      pointPackageId: row.pointPackageId || `package_${parsed.fileHash.slice(0, 20)}_${index}`,
      relatedUrl: row.relatedUrl || null,
      status: row.status as PointPackageImportItem["status"],
    };
    const normalizedName = normalizePointPackageName(item.name);
    if (names.has(normalizedName))
      errors.push(csvError("POINT_PACKAGE_NAME_CONFLICT", group.row, "name"));
    names.add(normalizedName);
    const head = await findPointPackageHead(db, item.pointPackageId);
    if (
      (head === null && item.expectedRevision !== null) ||
      (head !== null && item.expectedRevision !== head.currentRevision)
    ) {
      errors.push(csvError("REVISION_CONFLICT", group.row, "expectedRevision"));
    }
    const criteria = await findCurrentEvaluationCriteria(
      db,
      components.map(({ evaluationCriterionId }) => evaluationCriterionId),
    );
    try {
      await createPointPackageRevision({
        components: components.map((component) => {
          const criterion = criteria.get(component.evaluationCriterionId);
          if (!criterion) throw new InvalidPointPackageError();
          return {
            ...component,
            buyNowEnabled: criterion.buyNowEnabled === 1,
            evaluationCriterionName: criterion.name,
            evaluationCriterionRevisionId: criterion.revisionId,
            minimumUnitScaled: criterion.minimumUnitScaled,
          };
        }),
        description: item.description,
        name: item.name,
        pointPackageId: item.pointPackageId,
        pointPackageRevisionId: `preview_${item.pointPackageId}_${(head?.currentRevision ?? 0) + 1}`,
        relatedUrl: item.relatedUrl,
        status: item.status,
      });
    } catch {
      errors.push(csvError("INVALID_POINT_PACKAGE", group.row));
    }
    items.push(item);
  }
  const validationHash = await sha256Hex(
    canonicalJson({ errors, fileHash: parsed.fileHash, importType: "POINT_PACKAGE", rows: items }),
  );
  return { errors, fileHash: parsed.fileHash, rows: items, validationHash };
}

function requireCsv(context: Context<BackendContext>) {
  const type = context.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  return type === "text/csv"
    ? null
    : problem(context, 415, "CSV_CONTENT_TYPE_REQUIRED", "Content-Type text/csv required");
}

function csvProblem(context: Context<BackendContext>, errors: unknown[]) {
  return context.json(
    {
      code: "CSV_VALIDATION_FAILED",
      errors,
      requestId: `req_${crypto.randomUUID()}`,
      status: 422,
      title: "CSV validation failed",
      type: "https://points.freeism.app/problems/csv-validation-failed",
    },
    422,
    { "Content-Type": "application/problem+json" },
  );
}

function validationResponse(
  context: Context<BackendContext>,
  result: { errors: unknown[]; fileHash: string; rows: unknown[]; validationHash: string },
) {
  if (result.errors.length > 0) return csvProblem(context, result.errors);
  return context.json({
    data: {
      fileHash: result.fileHash,
      rowCount: result.rows.length,
      validationHash: result.validationHash,
    },
    meta: { requestId: `req_${crypto.randomUUID()}` },
  });
}

async function findReplay(
  db: D1Database,
  actorPointsUserId: string,
  operation: string,
  idempotencyKey: string,
  payloadHash: string,
) {
  const row = await db
    .prepare(
      `SELECT payload_hash AS payloadHash, response_body AS responseBody, status
       FROM idempotency_results
       WHERE actor_points_user_id = ? AND operation = ? AND idempotency_key = ?`,
    )
    .bind(actorPointsUserId, operation, idempotencyKey)
    .first<{ payloadHash: string; responseBody: string | object; status: number }>();
  if (!row) return null;
  if (row.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
  return {
    body: typeof row.responseBody === "string" ? JSON.parse(row.responseBody) : row.responseBody,
    status: row.status,
  };
}

async function saveReplay(
  db: D1Database,
  input: {
    action: string;
    actorPointsUserId: string;
    body: object;
    idempotencyKey: string;
    operation: string;
    payloadHash: string;
    requestId: string;
    reason: string;
    status: number;
    target: string;
  },
) {
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO idempotency_results
         (id, actor_points_user_id, operation, idempotency_key, payload_hash,
          status, response_body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `idem_${crypto.randomUUID()}`,
        input.actorPointsUserId,
        input.operation,
        input.idempotencyKey,
        input.payloadHash,
        input.status,
        canonicalJson(input.body),
        now,
      ),
    db
      .prepare(
        `INSERT INTO audit_event
           (id, actor_points_user_id, action, target, reason, request_id, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?)`,
      )
      .bind(
        `audit_${crypto.randomUUID()}`,
        input.actorPointsUserId,
        input.action,
        input.target,
        input.reason,
        input.requestId,
        now,
      ),
  ]);
}

function mapCommitError(context: Context<BackendContext>, error: unknown): Response {
  if (
    error instanceof EvaluationCriterionRevisionConflictError ||
    error instanceof PointPackageRevisionConflictError
  ) {
    return problem(context, 409, "REVISION_CONFLICT", "Revision conflict");
  }
  if (
    error instanceof EvaluationCriterionNameConflictError ||
    error instanceof PointPackageNameConflictError ||
    error instanceof InvalidEvaluationCriterionError ||
    error instanceof InvalidPointPackageError
  ) {
    return problem(context, 422, error.message, "CSV import is invalid");
  }
  if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED") {
    return problem(context, 409, error.message, "Idempotency key reused");
  }
  throw error;
}

export function registerEvaluationImportRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const session = createSessionMiddleware(getSession);
  for (const resource of ["evaluation-criteria", "point-packages"] as const) {
    const validate = resource === "evaluation-criteria" ? validateCriteriaCsv : validatePackagesCsv;
    app.post(
      `/api/admin/${resource}/csv/validate`,
      session,
      adminMiddleware,
      csvBodyLimitMiddleware,
      async (context) => {
        const invalid = requireCsv(context);
        if (invalid) return invalid;
        return validationResponse(
          context,
          await validate(
            requireBindings(context.env).DB,
            new Uint8Array(await context.req.arrayBuffer()),
          ),
        );
      },
    );
    app.post(
      `/api/admin/${resource}/csv/commit`,
      session,
      adminMiddleware,
      googleFreshMiddleware,
      idempotencyKeyMiddleware,
      csvBodyLimitMiddleware,
      async (context) => {
        const invalid = requireCsv(context);
        if (invalid) return invalid;
        const expectedValidationHash = context.req.header("X-Validation-Hash")?.trim();
        const reason = context.req.header("X-Reason")?.trim();
        if (!expectedValidationHash) {
          return problem(context, 422, "VALIDATION_HASH_REQUIRED", "Validation hash required");
        }
        if (!reason) return problem(context, 422, "ADMIN_REASON_REQUIRED", "Admin reason required");
        const db = requireBindings(context.env).DB;
        const bytes = new Uint8Array(await context.req.arrayBuffer());
        const actorPointsUserId = context.get("pointsUser").id;
        const idempotencyKey = context.req.header("Idempotency-Key")!;
        const operation =
          resource === "evaluation-criteria"
            ? "EVALUATION_CRITERION_CSV_COMMIT"
            : "POINT_PACKAGE_CSV_COMMIT";
        try {
          const payloadHash = await hashCanonicalPayload({
            fileHash: await sha256Hex(bytes),
            reason,
            validationHash: expectedValidationHash,
          });
          const replay = await findReplay(
            db,
            actorPointsUserId,
            operation,
            idempotencyKey,
            payloadHash,
          );
          if (replay) return context.json(replay.body as object, replay.status as 201);
          const validated = await validate(db, bytes);
          if (validated.validationHash !== expectedValidationHash) {
            return problem(context, 409, "VALIDATION_CHANGED", "Validation changed");
          }
          if (validated.errors.length > 0) return csvProblem(context, validated.errors);
          const imported =
            resource === "evaluation-criteria"
              ? await importEvaluationCriteria(db, {
                  actorPointsUserId,
                  items: validated.rows as EvaluationCriterionImportItem[],
                  reason,
                })
              : await importPointPackages(db, {
                  actorPointsUserId,
                  items: validated.rows as PointPackageImportItem[],
                  reason,
                });
          const requestId = `req_${crypto.randomUUID()}`;
          const body = {
            data: { items: imported },
            meta: { requestId },
          };
          await saveReplay(db, {
            action: operation,
            actorPointsUserId,
            body,
            idempotencyKey,
            operation,
            payloadHash,
            reason,
            requestId,
            status: 201,
            target: resource,
          });
          return context.json(body, 201);
        } catch (error) {
          return mapCommitError(context, error);
        }
      },
    );
  }
}
