import { parseAndValidateCsv } from "../csv/csv-input";
import { defineCsvSchema, textColumn } from "../csv/csv-schema";
import { canonicalJson, sha256Hex, type CsvValidationError } from "../csv/csv-validation-result";
import {
  chunkCanonicalJsonRows,
  prepareJsonEachStatements,
  runCsvAtomicBatch,
} from "../csv/d1-json-chunks";
import {
  calculateSubstitutionAmount,
  normalizeSimilarityFactor,
  parseEvaluationMonth,
} from "../domain/distribution/substitution";
import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";
import { findCsvCommitReplay } from "../infrastructure/db/d1-point-transaction-repository";

const METHOD_HEADER =
  "sourceEvaluationCriterionId,targetEvaluationCriterionId,expectedRevision,status,similarityNumerator,similarityDenominator,exchangeRateRevisionId";
const EXECUTION_HEADER =
  "sourceEvaluationCriterionId,targetEvaluationCriterionId,evaluationMonth,methodRevisionId,expectedResultRevision";

const required = (name: string, maxCodePoints = 128) => ({
  ...textColumn(name, { maxCodePoints }),
  validate: (value: string) => (value.length === 0 ? ["CSV_REQUIRED"] : []),
});

interface MethodCsvRow extends Record<string, string> {
  exchangeRateRevisionId: string;
  expectedRevision: string;
  similarityDenominator: string;
  similarityNumerator: string;
  sourceEvaluationCriterionId: string;
  status: string;
  targetEvaluationCriterionId: string;
}

interface ExecutionCsvRow extends Record<string, string> {
  evaluationMonth: string;
  expectedResultRevision: string;
  methodRevisionId: string;
  sourceEvaluationCriterionId: string;
  targetEvaluationCriterionId: string;
}

const methodSchema = defineCsvSchema<MethodCsvRow>({
  importType: "SUBSTITUTION_METHOD",
  columns: [
    required("sourceEvaluationCriterionId"),
    required("targetEvaluationCriterionId"),
    textColumn("expectedRevision", { maxCodePoints: 16 }),
    required("status", 16),
    textColumn("similarityNumerator", { maxCodePoints: 32 }),
    textColumn("similarityDenominator", { maxCodePoints: 32 }),
    textColumn("exchangeRateRevisionId", { maxCodePoints: 128 }),
  ],
  businessKey: (row) =>
    `${row.sourceEvaluationCriterionId}\u0000${row.targetEvaluationCriterionId}`,
  maxRows: 1_000,
});

const executionSchema = defineCsvSchema<ExecutionCsvRow>({
  importType: "SUBSTITUTION_EXECUTION",
  columns: [
    required("sourceEvaluationCriterionId"),
    required("targetEvaluationCriterionId"),
    required("evaluationMonth", 7),
    required("methodRevisionId"),
    textColumn("expectedResultRevision", { maxCodePoints: 16 }),
  ],
  businessKey: (row) =>
    `${row.sourceEvaluationCriterionId}\u0000${row.targetEvaluationCriterionId}\u0000${row.evaluationMonth}`,
  maxRows: 1_000,
});

function csvHeader(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
}

function rowError(row: number, column: string, code: string): CsvValidationError {
  return { code, column, row };
}

function safePositive(value: string): number | null {
  if (!/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

type Criterion = { id: string; revisionId: string; minimumUnitScaled: number; status: string };
type MethodHead = { currentRevision: number };
type ExchangeRate = {
  denominator: number;
  id: string;
  numerator: number;
  sourceId: string;
  status: string;
  targetId: string;
};

const pairKey = (sourceId: string, targetId: string) => `${sourceId}\u0000${targetId}`;

async function criteriaById(db: D1Database, ids: string[]) {
  if (ids.length === 0) return new Map<string, Criterion>();
  const rows = await db
    .prepare(
      `SELECT criterion.id, criterion.current_revision_id AS revisionId,
              revision.minimum_unit_scaled AS minimumUnitScaled, revision.status
       FROM evaluation_criterion criterion
       JOIN evaluation_criterion_revision revision ON revision.id = criterion.current_revision_id
       JOIN json_each(?) input ON input.value = criterion.id`,
    )
    .bind(canonicalJson([...new Set(ids)]))
    .all<Criterion>();
  return new Map(rows.results.map((row) => [row.id, row]));
}

export async function validateSubstitutionCsv(db: D1Database, bytes: Uint8Array) {
  const header = csvHeader(bytes);
  if (header === METHOD_HEADER) return validateMethodCsv(db, bytes);
  if (header === EXECUTION_HEADER) return validateExecutionCsv(db, bytes);
  return {
    errors: [rowError(1, "header", "CSV_HEADER_MISMATCH")],
    fileHash: await sha256Hex(bytes),
    kind: "UNKNOWN" as const,
    rows: [],
    validationHash: await sha256Hex(canonicalJson({ header })),
  };
}

async function validateMethodCsv(db: D1Database, bytes: Uint8Array) {
  const parsed = await parseAndValidateCsv(bytes, methodSchema);
  const errors = [...parsed.errors];
  const criteria = await criteriaById(
    db,
    parsed.rows.flatMap((row) => [
      row.sourceEvaluationCriterionId,
      row.targetEvaluationCriterionId,
    ]),
  );
  const rows: Array<Record<string, unknown>> = [];
  const referenceInput = parsed.rows.map((row) => ({
    exchangeRateRevisionId: row.exchangeRateRevisionId,
    sourceEvaluationCriterionId: row.sourceEvaluationCriterionId,
    targetEvaluationCriterionId: row.targetEvaluationCriterionId,
  }));
  const [headRows, rateRows] = await Promise.all([
    referenceInput.length === 0
      ? Promise.resolve({
          results: [] as Array<MethodHead & { sourceId: string; targetId: string }>,
        })
      : db
          .prepare(
            `SELECT head.current_revision AS currentRevision,
                    head.source_evaluation_criterion_id AS sourceId,
                    head.target_evaluation_criterion_id AS targetId
             FROM substitution_method head
             JOIN json_each(?) input
               ON head.source_evaluation_criterion_id =
                    json_extract(input.value, '$.sourceEvaluationCriterionId')
              AND head.target_evaluation_criterion_id =
                    json_extract(input.value, '$.targetEvaluationCriterionId')`,
          )
          .bind(canonicalJson(referenceInput))
          .all<MethodHead & { sourceId: string; targetId: string }>(),
    referenceInput.length === 0
      ? Promise.resolve({ results: [] as ExchangeRate[] })
      : db
          .prepare(
            `SELECT DISTINCT rate.id, rate.source_evaluation_criterion_id AS sourceId,
                    rate.target_evaluation_criterion_id AS targetId, rate.status,
                    rate.numerator, rate.denominator
             FROM exchange_rate_revision rate
             JOIN json_each(?) input
               ON rate.id = json_extract(input.value, '$.exchangeRateRevisionId')`,
          )
          .bind(canonicalJson(referenceInput))
          .all<ExchangeRate>(),
  ]);
  const heads = new Map(
    headRows.results.map((head) => [pairKey(head.sourceId, head.targetId), head]),
  );
  const rates = new Map(rateRows.results.map((rate) => [rate.id, rate]));
  for (const [index, row] of parsed.rows.entries()) {
    const csvRow = index + 2;
    const source = criteria.get(row.sourceEvaluationCriterionId);
    const target = criteria.get(row.targetEvaluationCriterionId);
    if (!source || source.status !== "ACTIVE")
      errors.push(
        rowError(csvRow, "sourceEvaluationCriterionId", "EVALUATION_CRITERION_NOT_ACTIVE"),
      );
    if (!target || target.status !== "ACTIVE")
      errors.push(
        rowError(csvRow, "targetEvaluationCriterionId", "EVALUATION_CRITERION_NOT_ACTIVE"),
      );
    if (row.sourceEvaluationCriterionId === row.targetEvaluationCriterionId)
      errors.push(rowError(csvRow, "targetEvaluationCriterionId", "SUBSTITUTION_SAME_AXIS"));
    const head = heads.get(
      pairKey(row.sourceEvaluationCriterionId, row.targetEvaluationCriterionId),
    );
    const expectedRevision =
      row.expectedRevision === "" ? null : safePositive(row.expectedRevision);
    const expectedRevisionValid = row.expectedRevision === "" || expectedRevision !== null;
    if (
      !expectedRevisionValid ||
      (head === undefined) !== (expectedRevision === null) ||
      (head && head.currentRevision !== expectedRevision)
    )
      errors.push(rowError(csvRow, "expectedRevision", "REVISION_CONFLICT"));
    if (row.status === "ACTIVE") {
      const numerator = safePositive(row.similarityNumerator);
      const denominator = safePositive(row.similarityDenominator);
      let similarity: { numerator: number; denominator: number } | null = null;
      try {
        if (numerator === null || denominator === null) throw new Error();
        similarity = normalizeSimilarityFactor(numerator, denominator);
      } catch {
        errors.push(rowError(csvRow, "similarityNumerator", "SUBSTITUTION_SIMILARITY_INVALID"));
      }
      const rate = rates.get(row.exchangeRateRevisionId);
      if (
        !rate ||
        rate.status !== "ACTIVE" ||
        rate.sourceId !== row.sourceEvaluationCriterionId ||
        rate.targetId !== row.targetEvaluationCriterionId
      ) {
        errors.push(rowError(csvRow, "exchangeRateRevisionId", "EXCHANGE_RATE_NOT_ACTIVE"));
      }
      rows.push({
        ...row,
        exchangeDenominator: rate?.denominator ?? null,
        exchangeNumerator: rate?.numerator ?? null,
        expectedRevision,
        revision: (expectedRevision ?? 0) + 1,
        similarityDenominator: similarity?.denominator ?? null,
        similarityNumerator: similarity?.numerator ?? null,
        sourceEvaluationCriterionRevisionId: source?.revisionId ?? null,
        targetEvaluationCriterionRevisionId: target?.revisionId ?? null,
      });
    } else if (row.status === "DISABLED") {
      if (row.similarityNumerator || row.similarityDenominator || row.exchangeRateRevisionId)
        errors.push(rowError(csvRow, "status", "SUBSTITUTION_DISABLED_VALUE_PRESENT"));
      rows.push({
        ...row,
        exchangeRateRevisionId: null,
        expectedRevision,
        revision: (expectedRevision ?? 0) + 1,
        similarityDenominator: null,
        similarityNumerator: null,
        sourceEvaluationCriterionRevisionId: source?.revisionId ?? null,
        targetEvaluationCriterionRevisionId: target?.revisionId ?? null,
      });
    } else {
      errors.push(rowError(csvRow, "status", "SUBSTITUTION_STATUS_INVALID"));
    }
  }
  const validationRows = errors.length === 0 ? rows : [];
  return {
    errors,
    fileHash: parsed.fileHash,
    kind: "METHOD" as const,
    rows: validationRows,
    validationHash: await sha256Hex(
      canonicalJson({ errors, fileHash: parsed.fileHash, rows: validationRows }),
    ),
  };
}

type SourceFixRow = {
  amountScaled: number;
  entryId: string;
  evaluationMonth: string;
  fixResultId: string;
  fixRevisionId: string;
  pointsUserId: string | null;
  sourceEvaluationCriterionId: string;
};

async function currentSourceTotalsByPair(
  db: D1Database,
  inputs: Array<{ evaluationMonth: string; sourceEvaluationCriterionId: string }>,
) {
  const uniqueInputs = [
    ...new Map(
      inputs.map((input) => [
        pairKey(input.sourceEvaluationCriterionId, input.evaluationMonth),
        input,
      ]),
    ).values(),
  ];
  if (uniqueInputs.length === 0)
    return new Map<string, { rows: SourceFixRow[]; totals: Map<string, number> }>();
  const rows = await db
    .prepare(
      `WITH input AS (
         SELECT json_extract(value, '$.sourceEvaluationCriterionId') AS sourceId,
                json_extract(value, '$.evaluationMonth') AS evaluationMonth
         FROM json_each(?)
       )
       SELECT input.sourceId AS sourceEvaluationCriterionId,
              input.evaluationMonth, entry.id AS entryId, revision.id AS fixRevisionId,
              revision.fix_result_id AS fixResultId,
              COALESCE(entry.points_user_id, (
                SELECT claim.points_user_id
                FROM unclaimed_fix_entry unclaimed
                JOIN fix_claim_item item ON item.unclaimed_fix_entry_id = unclaimed.id
                JOIN fix_claim claim ON claim.id = item.fix_claim_id
                JOIN fix_revision claimed_revision ON claimed_revision.id = unclaimed.source_fix_revision_id
                WHERE claimed_revision.fix_result_id = revision.fix_result_id
                  AND unclaimed.evaluation_criterion_id = entry.evaluation_criterion_id
                  AND ((unclaimed.recipient_provider_id = 'github'
                        AND entry.recipient_provider_id = 'github'
                        AND unclaimed.recipient_account_id = entry.recipient_account_id)
                    OR (unclaimed.recipient_provider_id IS NULL
                        AND entry.recipient_provider_id IS NULL
                        AND unclaimed.recipient_profile_url = entry.recipient_profile_url))
                ORDER BY claim.claimed_at LIMIT 1
              )) AS pointsUserId,
              entry.amount_scaled AS amountScaled
       FROM fix_result result
       JOIN fix_revision revision ON revision.id = result.current_revision_id
       JOIN fix_revision_entry entry ON entry.fix_revision_id = revision.id
       JOIN input ON input.sourceId = entry.evaluation_criterion_id
         AND input.evaluationMonth = substr(entry.evaluation_at, 1, 7)
       ORDER BY input.sourceId, input.evaluationMonth, entry.id`,
    )
    .bind(canonicalJson(uniqueInputs))
    .all<SourceFixRow>();
  const result = new Map<string, { rows: SourceFixRow[]; totals: Map<string, number> }>();
  for (const row of rows.results) {
    const key = pairKey(row.sourceEvaluationCriterionId, row.evaluationMonth);
    const group = result.get(key) ?? { rows: [], totals: new Map<string, number>() };
    group.rows.push(row);
    result.set(key, group);
    if (!row.pointsUserId) continue;
    const next = (group.totals.get(row.pointsUserId) ?? 0) + row.amountScaled;
    if (!Number.isSafeInteger(next)) throw new Error("SAFE_INTEGER_OVERFLOW");
    group.totals.set(row.pointsUserId, next);
  }
  for (const input of uniqueInputs) {
    const key = pairKey(input.sourceEvaluationCriterionId, input.evaluationMonth);
    if (!result.has(key)) result.set(key, { rows: [], totals: new Map() });
  }
  return result;
}

async function validateExecutionCsv(db: D1Database, bytes: Uint8Array) {
  const parsed = await parseAndValidateCsv(bytes, executionSchema);
  const errors = [...parsed.errors];
  const rows: Array<Record<string, unknown>> = [];
  const lookupInput = parsed.rows.map((row) => ({
    evaluationMonth: row.evaluationMonth,
    methodRevisionId: row.methodRevisionId,
    sourceEvaluationCriterionId: row.sourceEvaluationCriterionId,
    targetEvaluationCriterionId: row.targetEvaluationCriterionId,
  }));
  const [methodRows, headRows, sourceByPair] = await Promise.all([
    lookupInput.length === 0
      ? Promise.resolve({ results: [] as Array<Record<string, string | number>> })
      : db
          .prepare(
            `SELECT DISTINCT revision.*, rate.numerator AS exchangeNumerator,
                    rate.denominator AS exchangeDenominator,
                    target.minimum_unit_scaled AS targetMinimumUnitScaled,
                    head.current_revision_id AS currentMethodRevisionId
             FROM substitution_method_revision revision
             JOIN substitution_method head
               ON head.source_evaluation_criterion_id = revision.source_evaluation_criterion_id
              AND head.target_evaluation_criterion_id = revision.target_evaluation_criterion_id
             LEFT JOIN exchange_rate_revision rate ON rate.id = revision.exchange_rate_revision_id
             LEFT JOIN evaluation_criterion_revision target
               ON target.id = revision.target_evaluation_criterion_revision_id
             JOIN json_each(?) input
               ON revision.id = json_extract(input.value, '$.methodRevisionId')`,
          )
          .bind(canonicalJson(lookupInput))
          .all<Record<string, string | number>>(),
    lookupInput.length === 0
      ? Promise.resolve({
          results: [] as Array<{
            currentRevision: number;
            currentRevisionId: string;
            evaluationMonth: string;
            id: string;
            sourceId: string;
            targetId: string;
          }>,
        })
      : db
          .prepare(
            `SELECT DISTINCT result.id, result.current_revision AS currentRevision,
                    result.current_revision_id AS currentRevisionId,
                    result.source_evaluation_criterion_id AS sourceId,
                    result.target_evaluation_criterion_id AS targetId,
                    result.evaluation_month AS evaluationMonth
             FROM substitution_result result
             JOIN json_each(?) input
               ON result.source_evaluation_criterion_id =
                    json_extract(input.value, '$.sourceEvaluationCriterionId')
              AND result.target_evaluation_criterion_id =
                    json_extract(input.value, '$.targetEvaluationCriterionId')
              AND result.evaluation_month = json_extract(input.value, '$.evaluationMonth')`,
          )
          .bind(canonicalJson(lookupInput))
          .all<{
            currentRevision: number;
            currentRevisionId: string;
            evaluationMonth: string;
            id: string;
            sourceId: string;
            targetId: string;
          }>(),
    currentSourceTotalsByPair(
      db,
      lookupInput.map(({ evaluationMonth, sourceEvaluationCriterionId }) => ({
        evaluationMonth,
        sourceEvaluationCriterionId,
      })),
    ),
  ]);
  const methods = new Map(methodRows.results.map((method) => [String(method.id), method]));
  const heads = new Map(
    headRows.results.map((head) => [
      `${pairKey(head.sourceId, head.targetId)}\u0000${head.evaluationMonth}`,
      head,
    ]),
  );
  const revisionIds = [...new Set(headRows.results.map((head) => head.currentRevisionId))];
  const previousRows =
    revisionIds.length === 0
      ? {
          results: [] as Array<{
            pointsUserId: string;
            revisionId: string;
            roundedAmountScaled: number;
          }>,
        }
      : await db
          .prepare(
            `SELECT item.substitution_result_revision_id AS revisionId,
                    item.points_user_id AS pointsUserId,
                    item.rounded_amount_scaled AS roundedAmountScaled
             FROM substitution_result_item item
             JOIN json_each(?) input
               ON item.substitution_result_revision_id = input.value
             ORDER BY item.substitution_result_revision_id, item.points_user_id`,
          )
          .bind(canonicalJson(revisionIds))
          .all<{ pointsUserId: string; revisionId: string; roundedAmountScaled: number }>();
  const previousByRevision = new Map<
    string,
    Array<{ pointsUserId: string; roundedAmountScaled: number }>
  >();
  for (const item of previousRows.results) {
    const group = previousByRevision.get(item.revisionId) ?? [];
    group.push({ pointsUserId: item.pointsUserId, roundedAmountScaled: item.roundedAmountScaled });
    previousByRevision.set(item.revisionId, group);
  }
  for (const [index, row] of parsed.rows.entries()) {
    const csvRow = index + 2;
    let interval: ReturnType<typeof parseEvaluationMonth> | null = null;
    try {
      interval = parseEvaluationMonth(row.evaluationMonth);
    } catch {
      errors.push(rowError(csvRow, "evaluationMonth", "EVALUATION_MONTH_INVALID"));
    }
    const method = methods.get(row.methodRevisionId);
    if (
      !method ||
      method.status !== "ACTIVE" ||
      method.currentMethodRevisionId !== row.methodRevisionId ||
      method.source_evaluation_criterion_id !== row.sourceEvaluationCriterionId ||
      method.target_evaluation_criterion_id !== row.targetEvaluationCriterionId
    ) {
      errors.push(rowError(csvRow, "methodRevisionId", "SUBSTITUTION_METHOD_NOT_ACTIVE"));
      continue;
    }
    const head = heads.get(
      `${pairKey(row.sourceEvaluationCriterionId, row.targetEvaluationCriterionId)}\u0000${row.evaluationMonth}`,
    );
    const expected =
      row.expectedResultRevision === "" ? null : safePositive(row.expectedResultRevision);
    const expectedValid = row.expectedResultRevision === "" || expected !== null;
    if (
      !expectedValid ||
      (head === undefined) !== (expected === null) ||
      (head && head.currentRevision !== expected)
    ) {
      errors.push(rowError(csvRow, "expectedResultRevision", "REVISION_CONFLICT"));
      continue;
    }
    const source = sourceByPair.get(pairKey(row.sourceEvaluationCriterionId, row.evaluationMonth))!;
    const previousItems = {
      results: head ? (previousByRevision.get(head.currentRevisionId) ?? []) : [],
    };
    const userIds = new Set([
      ...source.totals.keys(),
      ...previousItems.results.map((item) => item.pointsUserId),
    ]);
    const items = [...userIds].sort().map((pointsUserId) => {
      const sourceTotalScaled = source.totals.get(pointsUserId) ?? 0;
      const roundedAmountScaled = calculateSubstitutionAmount({
        exchangeDenominator: Number(method.exchangeDenominator),
        exchangeNumerator: Number(method.exchangeNumerator),
        similarityDenominator: Number(method.similarity_denominator),
        similarityNumerator: Number(method.similarity_numerator),
        sourceTotalScaled,
        targetMinimumUnitScaled: Number(method.targetMinimumUnitScaled),
      });
      return {
        pointsUserId,
        roundedAmountScaled,
        sourceTotalScaled,
        theoreticalDenominator: (
          BigInt(Number(method.similarity_denominator)) * BigInt(Number(method.exchangeDenominator))
        ).toString(),
        theoreticalNumerator: (
          BigInt(sourceTotalScaled) *
          BigInt(Number(method.similarity_numerator)) *
          BigInt(Number(method.exchangeNumerator))
        ).toString(),
      };
    });
    rows.push({
      ...row,
      exchangeRateRevisionId: method.exchange_rate_revision_id,
      expectedResultRevision: expected,
      interval,
      items,
      previousItems: previousItems.results,
      resultId: head?.id ?? null,
      revision: (expected ?? 0) + 1,
      sourceEvaluationCriterionRevisionId: method.source_evaluation_criterion_revision_id,
      sourceFixSetHash: await sha256Hex(canonicalJson(source.rows)),
      targetEvaluationCriterionRevisionId: method.target_evaluation_criterion_revision_id,
    });
  }
  const validationRows = errors.length === 0 ? rows : [];
  return {
    errors,
    fileHash: parsed.fileHash,
    kind: "EXECUTION" as const,
    rows: validationRows,
    validationHash: await sha256Hex(
      canonicalJson({ errors, fileHash: parsed.fileHash, rows: validationRows }),
    ),
  };
}

function jsonStatements(db: D1Database, sql: string, values: readonly unknown[]) {
  return values.length === 0
    ? []
    : prepareJsonEachStatements(db, sql, chunkCanonicalJsonRows(values));
}

export async function commitSubstitutionCsv(
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
    "SUBSTITUTION_CSV_COMMIT",
    input.idempotencyKey,
    payloadHash,
  );
  if (replay) return { responseBody: replay.body, status: replay.status };
  const validated = await validateSubstitutionCsv(db, bytes);
  if (validated.errors.length > 0)
    throw Object.assign(new Error("CSV_VALIDATION_FAILED"), { errors: validated.errors });
  if (validated.validationHash !== input.expectedValidationHash)
    throw new Error("VALIDATION_CHANGED");
  const now = (input.now ?? new Date()).getTime();
  const requestId = `req_${crypto.randomUUID()}`;
  const domain: D1PreparedStatement[] = [];
  const ledgerRows: unknown[] = [];
  const results: unknown[] = [];
  if (validated.kind === "METHOD") {
    const rows: Array<Record<string, unknown> & { id: string; revision: number }> =
      validated.rows.map((row) => ({
        ...row,
        actorPointsUserId: input.actorPointsUserId,
        createdAt: now,
        id: `submethodrev_${crypto.randomUUID()}`,
        reason: input.reason,
        revision: Number(row.revision),
      }));
    domain.push(
      ...jsonStatements(
        db,
        `INSERT OR IGNORE INTO substitution_method
           (source_evaluation_criterion_id, target_evaluation_criterion_id,
            current_revision_id, current_revision, created_at)
         SELECT json_extract(value, '$.sourceEvaluationCriterionId'),
                json_extract(value, '$.targetEvaluationCriterionId'),
                json_extract(value, '$.id'), json_extract(value, '$.revision'),
                json_extract(value, '$.createdAt') FROM json_each(?)
         WHERE json_type(value, '$.expectedRevision') = 'null'`,
        rows,
      ),
      ...jsonStatements(
        db,
        `INSERT INTO substitution_method_revision
           (id, source_evaluation_criterion_id, target_evaluation_criterion_id,
            source_evaluation_criterion_revision_id, target_evaluation_criterion_revision_id,
            revision, status, similarity_numerator, similarity_denominator,
            exchange_rate_revision_id, actor_points_user_id, reason, created_at)
         SELECT json_extract(value, '$.id'), json_extract(value, '$.sourceEvaluationCriterionId'),
                json_extract(value, '$.targetEvaluationCriterionId'),
                json_extract(value, '$.sourceEvaluationCriterionRevisionId'),
                json_extract(value, '$.targetEvaluationCriterionRevisionId'),
                json_extract(value, '$.revision'), json_extract(value, '$.status'),
                json_extract(value, '$.similarityNumerator'),
                json_extract(value, '$.similarityDenominator'),
                json_extract(value, '$.exchangeRateRevisionId'),
                json_extract(value, '$.actorPointsUserId'), json_extract(value, '$.reason'),
                json_extract(value, '$.createdAt') FROM json_each(?)`,
        rows,
      ),
      ...jsonStatements(
        db,
        `UPDATE substitution_method SET current_revision_id = json_extract(input.value, '$.id'),
              current_revision = json_extract(input.value, '$.revision')
         FROM json_each(?) input
         WHERE substitution_method.source_evaluation_criterion_id =
                 json_extract(input.value, '$.sourceEvaluationCriterionId')
           AND substitution_method.target_evaluation_criterion_id =
                 json_extract(input.value, '$.targetEvaluationCriterionId')
           AND substitution_method.current_revision = json_extract(input.value, '$.expectedRevision')
           AND json_type(input.value, '$.expectedRevision') <> 'null'`,
        rows,
      ),
    );
    results.push(...rows.map((row) => ({ methodRevisionId: row.id, revision: row.revision })));
  } else if (validated.kind === "EXECUTION") {
    const heads: unknown[] = [];
    const revisions: unknown[] = [];
    const items: unknown[] = [];
    for (const row of validated.rows) {
      const typed = row as Record<string, any>;
      const resultId = typed.resultId ?? `subresult_${crypto.randomUUID()}`;
      const revisionId = `subresultrev_${crypto.randomUUID()}`;
      heads.push({
        createdAt: typed.resultId ? null : now,
        expectedRevision: typed.expectedResultRevision,
        resultId,
        revision: typed.revision,
        revisionId,
        sourceEvaluationCriterionId: typed.sourceEvaluationCriterionId,
        targetEvaluationCriterionId: typed.targetEvaluationCriterionId,
        evaluationMonth: typed.evaluationMonth,
      });
      const revision = {
        ...typed,
        actorPointsUserId: input.actorPointsUserId,
        createdAt: now,
        executionCutoff: now,
        monthEndExclusive: Date.parse(typed.interval.endExclusive),
        monthStartInclusive: Date.parse(typed.interval.startInclusive),
        reason: input.reason,
        resultId,
        revisionId,
      };
      revisions.push(revision);
      const previous = new Map(
        typed.previousItems.map((item: any) => [item.pointsUserId, item.roundedAmountScaled]),
      );
      for (const item of typed.items) {
        const delta = item.roundedAmountScaled - Number(previous.get(item.pointsUserId) ?? 0);
        items.push({
          ...item,
          expectedDeltaAmountScaled: delta,
          id: `subitem_${crypto.randomUUID()}`,
          revisionId,
        });
        if (delta === 0) continue;
        ledgerRows.push({
          createdAt: now,
          deltaAmountScaled: delta,
          evaluationCriterionId: typed.targetEvaluationCriterionId,
          evaluationCriterionRevisionId: typed.targetEvaluationCriterionRevisionId,
          id: `ledger_${crypto.randomUUID()}`,
          pointsUserId: item.pointsUserId,
          revisionId,
        });
      }
      results.push({ resultId, resultRevisionId: revisionId, revision: typed.revision });
    }
    domain.push(
      ...jsonStatements(
        db,
        `INSERT INTO substitution_result
           (id, source_evaluation_criterion_id, target_evaluation_criterion_id,
            evaluation_month, current_revision_id, current_revision, created_at)
         SELECT json_extract(value, '$.resultId'),
                json_extract(value, '$.sourceEvaluationCriterionId'),
                json_extract(value, '$.targetEvaluationCriterionId'),
                json_extract(value, '$.evaluationMonth'), json_extract(value, '$.revisionId'),
                json_extract(value, '$.revision'), json_extract(value, '$.createdAt')
         FROM json_each(?) WHERE json_type(value, '$.createdAt') <> 'null'`,
        heads,
      ),
      ...jsonStatements(
        db,
        `INSERT INTO substitution_result_revision
           (id, substitution_result_id, revision, substitution_method_revision_id,
            source_evaluation_criterion_revision_id, target_evaluation_criterion_revision_id,
            exchange_rate_revision_id, evaluation_month, month_start_inclusive,
            month_end_exclusive, execution_cutoff, source_fix_set_hash,
            actor_points_user_id, reason, created_at)
         SELECT json_extract(value, '$.revisionId'), json_extract(value, '$.resultId'),
                json_extract(value, '$.revision'), json_extract(value, '$.methodRevisionId'),
                json_extract(value, '$.sourceEvaluationCriterionRevisionId'),
                json_extract(value, '$.targetEvaluationCriterionRevisionId'),
                json_extract(value, '$.exchangeRateRevisionId'),
                json_extract(value, '$.evaluationMonth'),
                json_extract(value, '$.monthStartInclusive'),
                json_extract(value, '$.monthEndExclusive'), json_extract(value, '$.executionCutoff'),
                json_extract(value, '$.sourceFixSetHash'),
                json_extract(value, '$.actorPointsUserId'), json_extract(value, '$.reason'),
                json_extract(value, '$.createdAt') FROM json_each(?)`,
        revisions,
      ),
      ...jsonStatements(
        db,
        `INSERT INTO substitution_result_item
           (id, substitution_result_revision_id, points_user_id, source_total_scaled,
            theoretical_numerator, theoretical_denominator, rounded_amount_scaled,
            expected_delta_amount_scaled)
         SELECT json_extract(value, '$.id'), json_extract(value, '$.revisionId'),
                json_extract(value, '$.pointsUserId'), json_extract(value, '$.sourceTotalScaled'),
                json_extract(value, '$.theoreticalNumerator'),
                json_extract(value, '$.theoreticalDenominator'),
                json_extract(value, '$.roundedAmountScaled'),
                json_extract(value, '$.expectedDeltaAmountScaled') FROM json_each(?)`,
        items,
      ),
      ...jsonStatements(
        db,
        `UPDATE substitution_result SET current_revision_id = json_extract(input.value, '$.revisionId'),
              current_revision = json_extract(input.value, '$.revision')
         FROM json_each(?) input
         WHERE substitution_result.id = json_extract(input.value, '$.resultId')
           AND substitution_result.current_revision = json_extract(input.value, '$.expectedRevision')
           AND json_type(input.value, '$.expectedRevision') <> 'null'`,
        heads,
      ),
    );
  }
  const responseBody = { data: { kind: validated.kind, results }, meta: { requestId } };
  const statements = [
    ...domain,
    ...jsonStatements(
      db,
      `INSERT INTO point_ledger_entry
         (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
          delta_amount_scaled, affects_evaluation_total, source_type,
          source_substitution_result_revision_id, created_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.pointsUserId'),
              json_extract(value, '$.evaluationCriterionId'),
              json_extract(value, '$.evaluationCriterionRevisionId'),
              json_extract(value, '$.deltaAmountScaled'), 1, 'SUBSTITUTION_FIX',
              json_extract(value, '$.revisionId'), json_extract(value, '$.createdAt')
       FROM json_each(?)`,
      ledgerRows,
    ),
    db
      .prepare(
        `INSERT INTO idempotency_results
           (id, actor_points_user_id, operation, idempotency_key, payload_hash,
            status, response_body, created_at)
         VALUES (?, ?, 'SUBSTITUTION_CSV_COMMIT', ?, ?, 201, ?, ?)`,
      )
      .bind(
        `idem_${crypto.randomUUID()}`,
        input.actorPointsUserId,
        input.idempotencyKey,
        payloadHash,
        JSON.stringify(responseBody),
        now,
      ),
    db
      .prepare(
        `INSERT INTO audit_event
           (id, actor_points_user_id, action, target, reason, request_id, result, created_at)
         VALUES (?, ?, 'SUBSTITUTION_CSV_COMMIT', 'substitution', ?, ?, 'SUCCESS', ?)`,
      )
      .bind(`audit_${crypto.randomUUID()}`, input.actorPointsUserId, input.reason, requestId, now),
  ];
  try {
    await runCsvAtomicBatch(db, statements);
  } catch (error) {
    const concurrent = await findCsvCommitReplay(
      db,
      input.actorPointsUserId,
      "SUBSTITUTION_CSV_COMMIT",
      input.idempotencyKey,
      payloadHash,
    );
    if (concurrent) return { responseBody: concurrent.body, status: concurrent.status };
    throw error;
  }
  return { responseBody, status: 201 };
}
