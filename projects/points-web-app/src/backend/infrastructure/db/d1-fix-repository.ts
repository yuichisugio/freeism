import {
  chunkCanonicalJsonRows,
  composeCsvAtomicBatch,
  prepareJsonEachStatements,
  runCsvAtomicBatch,
} from "../../csv/d1-json-chunks";
import { computeFixRevisionDeltas, type FixRevisionValue } from "../../domain/fix/fix-revision";
import { hashCanonicalPayload } from "../../domain/idempotency/idempotency-result";
import type { ValidatedFixCsvRow } from "../../usecases/validate-fix-csv";
import {
  emptyAutoDistributionPlan,
  preparePositiveFixDistribution,
} from "../../usecases/distribute-positive-fix";

interface PreviousEntry extends FixRevisionValue {
  evaluationAt: string;
  evaluationCriterionRevisionId: string;
  recipientAccountId: string | null;
  recipientProfileUrl: string;
  recipientProviderId: string | null;
}

async function findPreviousEntries(db: D1Database, resultIds: readonly string[]) {
  if (resultIds.length === 0) return new Map<string, PreviousEntry[]>();
  const rows = await db
    .prepare(
      `SELECT result.id AS fixResultId,
              CASE WHEN entry.recipient_provider_id = 'github'
                THEN 'github:' || entry.recipient_account_id
                ELSE 'web:' || entry.recipient_profile_url END AS recipientKey,
              entry.recipient_profile_url AS recipientProfileUrl,
              entry.points_user_id AS pointsUserId,
              entry.recipient_provider_id AS recipientProviderId,
              entry.recipient_account_id AS recipientAccountId,
              entry.evaluation_criterion_id AS evaluationCriterionId,
              entry.evaluation_criterion_revision_id AS evaluationCriterionRevisionId,
              entry.amount_scaled AS amountScaled, entry.evaluation_at AS evaluationAt
       FROM fix_result result
       JOIN fix_revision_entry entry ON entry.fix_revision_id = result.current_revision_id
       JOIN json_each(?) input ON input.value = result.id`,
    )
    .bind(JSON.stringify([...new Set(resultIds)]))
    .all<PreviousEntry & { fixResultId: string }>();
  const claimedRows = await db
    .prepare(
      `SELECT revision.fix_result_id AS fixResultId,
              CASE WHEN unclaimed.recipient_provider_id = 'github'
                THEN 'github:' || unclaimed.recipient_account_id
                ELSE 'web:' || unclaimed.recipient_profile_url END AS recipientKey,
              unclaimed.evaluation_criterion_id AS evaluationCriterionId,
              claim.points_user_id AS pointsUserId
       FROM fix_revision revision
       JOIN unclaimed_fix_entry unclaimed ON unclaimed.source_fix_revision_id = revision.id
       JOIN fix_claim_item item ON item.unclaimed_fix_entry_id = unclaimed.id
       JOIN fix_claim claim ON claim.id = item.fix_claim_id
       JOIN json_each(?) input ON input.value = revision.fix_result_id
       ORDER BY revision.revision, claim.claimed_at`,
    )
    .bind(JSON.stringify([...new Set(resultIds)]))
    .all<{
      evaluationCriterionId: string;
      fixResultId: string;
      pointsUserId: string;
      recipientKey: string;
    }>();
  const claimedRecipients = new Map<string, string>();
  for (const row of claimedRows.results) {
    const key = `${row.fixResultId}\u0000${row.recipientKey}\u0000${row.evaluationCriterionId}`;
    if (!claimedRecipients.has(key)) claimedRecipients.set(key, row.pointsUserId);
  }
  const grouped = new Map<string, PreviousEntry[]>();
  for (const row of rows.results) {
    row.pointsUserId =
      claimedRecipients.get(
        `${row.fixResultId}\u0000${row.recipientKey}\u0000${row.evaluationCriterionId}`,
      ) ?? row.pointsUserId;
    const group = grouped.get(row.fixResultId) ?? [];
    group.push(row);
    grouped.set(row.fixResultId, group);
  }
  return grouped;
}

export interface CommitFixInput {
  actorPointsUserId: string;
  auditEventId: string;
  fileHash: string;
  idempotencyKey: string;
  now: Date;
  reason: string;
  requestId: string;
  rows: ValidatedFixCsvRow[];
  validationHash: string;
}

export interface CommittedFixResult {
  fixResultId: string;
  fixRevisionId: string;
  revision: number;
}

export async function findFixCommitReplay(
  db: D1Database,
  actorPointsUserId: string,
  idempotencyKey: string,
  payloadHash: string,
): Promise<{ body: unknown; status: number } | null> {
  const row = await db
    .prepare(
      `SELECT payload_hash AS payloadHash, status, response_body AS responseBody
       FROM idempotency_results
       WHERE actor_points_user_id = ? AND operation = 'FIX_CSV_COMMIT' AND idempotency_key = ?`,
    )
    .bind(actorPointsUserId, idempotencyKey)
    .first<{ payloadHash: string; responseBody: string | unknown; status: number }>();
  if (!row) return null;
  if (row.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
  return {
    body: typeof row.responseBody === "string" ? JSON.parse(row.responseBody) : row.responseBody,
    status: row.status,
  };
}

export async function commitFixRows(
  db: D1Database,
  input: CommitFixInput,
): Promise<{ payloadHash: string; responseBody: unknown; results: CommittedFixResult[] }> {
  const payloadHash = await hashCanonicalPayload({
    fileHash: input.fileHash,
    reason: input.reason,
    validationHash: input.validationHash,
  });
  const previous = await findPreviousEntries(
    db,
    input.rows.map((row) => row.fixResultId).filter(Boolean),
  );
  const grouped = new Map<string, ValidatedFixCsvRow[]>();
  input.rows.forEach((row, index) => {
    const key = row.fixResultId || `__new_${index}`;
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  });

  const heads: unknown[] = [];
  const revisions: unknown[] = [];
  const entries: unknown[] = [];
  const ledger = new Map<
    string,
    {
      createdAt: number;
      deltaAmountScaled: number;
      evaluationCriterionId: string;
      evaluationCriterionRevisionId: string;
      fixRevisionId: string;
      id: string;
      pointsUserId: string;
    }
  >();
  const unclaimed: unknown[] = [];
  const results: CommittedFixResult[] = [];
  const autoDistribution = emptyAutoDistributionPlan();

  for (const [key, rows] of grouped) {
    const first = rows[0]!;
    const isNew = key.startsWith("__new_");
    const fixResultId = isNew ? `fix_${crypto.randomUUID()}` : first.fixResultId;
    const revision = isNew ? 1 : Number(first.expectedRevision) + 1;
    const fixRevisionId = `fixrev_${crypto.randomUUID()}`;
    if (isNew) heads.push({ createdAt: input.now.getTime(), fixResultId, fixRevisionId, revision });
    const oldValues = previous.get(fixResultId) ?? [];
    const originalRecipients = new Map(
      oldValues
        .filter((value): value is PreviousEntry & { pointsUserId: string } =>
          Boolean(value.pointsUserId),
        )
        .map((value) => [
          `${value.recipientKey}\u0000${value.evaluationCriterionId}`,
          value.pointsUserId,
        ]),
    );
    const resolvedRows = rows.map((row) => {
      const recipientKey = row.recipientAccountId
        ? `github:${row.recipientAccountId}`
        : `web:${row.normalizedRecipientProfileUrl}`;
      return {
        ...row,
        recipientPointsUserId:
          originalRecipients.get(`${recipientKey}\u0000${row.evaluationCriterionId}`) ??
          row.recipientPointsUserId,
      };
    });
    revisions.push({
      actorPointsUserId: input.actorPointsUserId,
      contentHash: await hashCanonicalPayload(resolvedRows),
      createdAt: input.now.getTime(),
      fileHash: input.fileHash,
      fixResultId,
      fixRevisionId,
      reason: input.reason,
      revision,
      validationHash: input.validationHash,
    });
    const nextValues: FixRevisionValue[] = resolvedRows.map((row) => ({
      amountScaled: row.amountScaled,
      evaluationCriterionId: row.evaluationCriterionId,
      pointsUserId: row.recipientPointsUserId,
      recipientKey: row.recipientAccountId
        ? `github:${row.recipientAccountId}`
        : `web:${row.normalizedRecipientProfileUrl}`,
    }));
    resolvedRows.forEach((row) =>
      entries.push({
        ...row,
        createdAt: input.now.getTime(),
        fixRevisionEntryId: `fixentry_${crypto.randomUUID()}`,
        fixRevisionId,
        identityResolvedAt: row.recipientProviderId ? input.now.getTime() : null,
      }),
    );
    const oldByKey = new Map(
      oldValues.map((value) => [
        `${value.recipientKey}\u0000${value.evaluationCriterionId}`,
        value,
      ]),
    );
    const nextByKey = new Map<string, ValidatedFixCsvRow>(
      resolvedRows.map((row) => {
        const recipientKey = row.recipientAccountId
          ? `github:${row.recipientAccountId}`
          : `web:${row.normalizedRecipientProfileUrl}`;
        return [`${recipientKey}\u0000${row.evaluationCriterionId}`, row] as const;
      }),
    );
    for (const businessKey of new Set([...oldByKey.keys(), ...nextByKey.keys()])) {
      const next = nextByKey.get(businessKey);
      const old = oldByKey.get(businessKey);
      const detail = next ?? old;
      const pointsUserId = next?.recipientPointsUserId ?? old?.pointsUserId;
      if (!detail || !pointsUserId) continue;
      const plan = await preparePositiveFixDistribution(db, {
        amountScaled: next?.amountScaled ?? 0,
        createdAt: input.now.getTime(),
        evaluationAt: detail.evaluationAt,
        evaluationCriterionId: detail.evaluationCriterionId,
        evaluationCriterionRevisionId: detail.evaluationCriterionRevisionId,
        fixResultId,
        fixRevisionId,
        minimumUnitScaled: next?.minimumUnitScaled ?? 1,
        pointsUserId,
        recipientKey:
          "recipientKey" in detail
            ? detail.recipientKey
            : detail.recipientAccountId
              ? `github:${detail.recipientAccountId}`
              : `web:${detail.normalizedRecipientProfileUrl}`,
      });
      autoDistribution.ledger.push(...plan.ledger);
      autoDistribution.revisions.push(...plan.revisions);
      autoDistribution.snapshots.push(...plan.snapshots);
      autoDistribution.targets.push(...plan.targets);
    }
    for (const delta of computeFixRevisionDeltas(oldValues, nextValues)) {
      const detail =
        nextByKey.get(`${delta.recipientKey}\u0000${delta.evaluationCriterionId}`) ??
        oldByKey.get(`${delta.recipientKey}\u0000${delta.evaluationCriterionId}`)!;
      const common = {
        createdAt: input.now.getTime(),
        deltaAmountScaled: delta.deltaAmountScaled,
        evaluationAt: detail.evaluationAt,
        evaluationCriterionId: delta.evaluationCriterionId,
        evaluationCriterionRevisionId: detail.evaluationCriterionRevisionId,
        fixRevisionId,
      };
      if (delta.pointsUserId) {
        const ledgerKey = `${fixRevisionId}\u0000${delta.pointsUserId}\u0000${delta.evaluationCriterionId}`;
        const existing = ledger.get(ledgerKey);
        const deltaAmountScaled = (existing?.deltaAmountScaled ?? 0) + delta.deltaAmountScaled;
        if (!Number.isSafeInteger(deltaAmountScaled)) throw new Error("SAFE_INTEGER_OVERFLOW");
        ledger.set(ledgerKey, {
          ...common,
          deltaAmountScaled,
          id: existing?.id ?? `ledger_${crypto.randomUUID()}`,
          pointsUserId: delta.pointsUserId,
        });
      } else {
        const source = detail as PreviousEntry | ValidatedFixCsvRow;
        unclaimed.push({
          ...common,
          id: `unclaimed_${crypto.randomUUID()}`,
          recipientAccountId: "recipientAccountId" in source ? source.recipientAccountId : null,
          recipientProfileUrl:
            "normalizedRecipientProfileUrl" in source
              ? source.normalizedRecipientProfileUrl
              : source.recipientProfileUrl,
          recipientProviderId: "recipientProviderId" in source ? source.recipientProviderId : null,
        });
      }
    }
    if (!isNew) {
      heads.push({ expectedRevision: revision - 1, fixResultId, fixRevisionId, revision });
    }
    results.push({ fixResultId, fixRevisionId, revision });
  }

  if (
    autoDistribution.ledger.filter((entry) => entry.sourceType === "AUTO_DISTRIBUTION_CREDIT")
      .length > 1_000
  ) {
    throw new Error("AUTO_DISTRIBUTION_TARGET_LIMIT_EXCEEDED");
  }

  const responseBody = { data: { results }, meta: { requestId: input.requestId } };
  const jsonStatements = (sql: string, values: readonly unknown[]) =>
    values.length === 0 ? [] : prepareJsonEachStatements(db, sql, chunkCanonicalJsonRows(values));
  const domainWrites = [
    ...jsonStatements(
      `INSERT INTO fix_result (id, current_revision_id, current_revision, created_at)
       SELECT json_extract(value, '$.fixResultId'), json_extract(value, '$.fixRevisionId'),
              json_extract(value, '$.revision'), json_extract(value, '$.createdAt')
       FROM json_each(?) WHERE json_type(value, '$.createdAt') IS NOT NULL`,
      heads.filter((head) => "createdAt" in (head as object)),
    ),
    ...jsonStatements(
      `INSERT INTO fix_revision
         (id, fix_result_id, revision, file_hash, validation_hash, content_hash,
          actor_points_user_id, reason, created_at)
       SELECT json_extract(value, '$.fixRevisionId'), json_extract(value, '$.fixResultId'),
              json_extract(value, '$.revision'), json_extract(value, '$.fileHash'),
              json_extract(value, '$.validationHash'), json_extract(value, '$.contentHash'),
              json_extract(value, '$.actorPointsUserId'), json_extract(value, '$.reason'),
              json_extract(value, '$.createdAt') FROM json_each(?)`,
      revisions,
    ),
    ...jsonStatements(
      `INSERT INTO fix_revision_entry
         (id, fix_revision_id, recipient_provider_id, recipient_account_id,
          recipient_profile_url, identity_resolved_at, points_user_id,
          evaluation_criterion_id, evaluation_criterion_revision_id, amount_scaled,
          evaluation_at, management_id, memo, created_at)
       SELECT json_extract(value, '$.fixRevisionEntryId'), json_extract(value, '$.fixRevisionId'),
              json_extract(value, '$.recipientProviderId'), json_extract(value, '$.recipientAccountId'),
              json_extract(value, '$.normalizedRecipientProfileUrl'),
              json_extract(value, '$.identityResolvedAt'), json_extract(value, '$.recipientPointsUserId'),
              json_extract(value, '$.evaluationCriterionId'),
              json_extract(value, '$.evaluationCriterionRevisionId'), json_extract(value, '$.amountScaled'),
              json_extract(value, '$.evaluationAt'), NULLIF(json_extract(value, '$.managementId'), ''),
              NULLIF(json_extract(value, '$.memo'), ''), json_extract(value, '$.createdAt')
       FROM json_each(?)`,
      entries,
    ),
    ...jsonStatements(
      `UPDATE fix_result SET
         current_revision_id = json_extract(value, '$.fixRevisionId'),
         current_revision = json_extract(value, '$.revision')
       FROM json_each(?) input
       WHERE fix_result.id = json_extract(input.value, '$.fixResultId')
         AND fix_result.current_revision = json_extract(input.value, '$.expectedRevision')`,
      heads.filter((head) => "expectedRevision" in (head as object)),
    ),
    ...jsonStatements(
      `INSERT INTO auto_distribution_snapshot
         (id, source_business_key_hash, source_fix_result_id, source_recipient_key,
          initial_source_fix_revision_id, source_points_user_id, evaluation_criterion_id,
          evaluation_criterion_revision_id, setting_revision_id, point_package_revision_id,
          minimum_unit_scaled, weight_cutoff_exclusive, outcome, created_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.sourceBusinessKeyHash'),
              json_extract(value, '$.sourceFixResultId'), json_extract(value, '$.sourceRecipientKey'),
              json_extract(value, '$.initialSourceFixRevisionId'),
              json_extract(value, '$.sourcePointsUserId'),
              json_extract(value, '$.evaluationCriterionId'),
              json_extract(value, '$.evaluationCriterionRevisionId'),
              json_extract(value, '$.settingRevisionId'),
              json_extract(value, '$.pointPackageRevisionId'),
              json_extract(value, '$.minimumUnitScaled'),
              json_extract(value, '$.weightCutoffExclusive'), json_extract(value, '$.outcome'),
              json_extract(value, '$.createdAt') FROM json_each(?)`,
      autoDistribution.snapshots,
    ),
    ...jsonStatements(
      `INSERT INTO auto_distribution_snapshot_target
         (id, snapshot_id, points_user_id, score, component_snapshot, tie_order)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.snapshotId'),
              json_extract(value, '$.pointsUserId'), json_extract(value, '$.score'),
              json(json_extract(value, '$.componentSnapshot')), json_extract(value, '$.tieOrder')
       FROM json_each(?)`,
      autoDistribution.targets,
    ),
    ...jsonStatements(
      `INSERT INTO auto_distribution_revision
         (id, snapshot_id, source_fix_revision_id, source_amount_scaled,
          retained_amount_scaled, distribution_amount_scaled, source_debit_delta_scaled,
          allocation_snapshot, credit_delta_snapshot, created_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.snapshotId'),
              json_extract(value, '$.sourceFixRevisionId'),
              json_extract(value, '$.sourceAmountScaled'),
              json_extract(value, '$.retainedAmountScaled'),
              json_extract(value, '$.distributionAmountScaled'),
              json_extract(value, '$.sourceDebitDeltaScaled'),
              json(json_extract(value, '$.allocationSnapshot')),
              json(json_extract(value, '$.creditDeltaSnapshot')),
              json_extract(value, '$.createdAt')
       FROM json_each(?)`,
      autoDistribution.revisions,
    ),
  ];
  const ledgerWrites = [
    ...jsonStatements(
      `INSERT INTO point_ledger_entry
         (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
          delta_amount_scaled, affects_evaluation_total, source_type, source_fix_revision_id, created_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.pointsUserId'),
              json_extract(value, '$.evaluationCriterionId'),
              json_extract(value, '$.evaluationCriterionRevisionId'),
              json_extract(value, '$.deltaAmountScaled'), 1, 'FIX',
              json_extract(value, '$.fixRevisionId'), json_extract(value, '$.createdAt')
       FROM json_each(?)`,
      [...ledger.values()].filter((entry) => entry.deltaAmountScaled !== 0),
    ),
    ...jsonStatements(
      `INSERT INTO unclaimed_fix_entry
         (id, source_fix_revision_id, recipient_provider_id, recipient_account_id,
          recipient_profile_url, evaluation_criterion_id, evaluation_criterion_revision_id,
          delta_amount_scaled, evaluation_at, created_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.fixRevisionId'),
              json_extract(value, '$.recipientProviderId'), json_extract(value, '$.recipientAccountId'),
              json_extract(value, '$.recipientProfileUrl'), json_extract(value, '$.evaluationCriterionId'),
              json_extract(value, '$.evaluationCriterionRevisionId'),
              json_extract(value, '$.deltaAmountScaled'), json_extract(value, '$.evaluationAt'),
              json_extract(value, '$.createdAt') FROM json_each(?)`,
      unclaimed,
    ),
    ...jsonStatements(
      `INSERT INTO point_ledger_entry
         (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
          delta_amount_scaled, affects_evaluation_total, source_type,
          source_auto_distribution_revision_id, created_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.pointsUserId'),
              json_extract(value, '$.evaluationCriterionId'),
              json_extract(value, '$.evaluationCriterionRevisionId'),
              json_extract(value, '$.deltaAmountScaled'), 0, json_extract(value, '$.sourceType'),
              json_extract(value, '$.revisionId'), json_extract(value, '$.createdAt')
       FROM json_each(?)`,
      autoDistribution.ledger,
    ),
  ];
  const sealWrites = jsonStatements(
    `INSERT INTO fix_revision_seal (fix_revision_id, sealed_at)
     SELECT json_extract(value, '$.fixRevisionId'), json_extract(value, '$.createdAt')
     FROM json_each(?)`,
    revisions,
  );
  const idempotency = db
    .prepare(
      `INSERT INTO idempotency_results
         (id, actor_points_user_id, operation, idempotency_key, payload_hash, status, response_body, created_at)
       VALUES (?, ?, 'FIX_CSV_COMMIT', ?, ?, 201, ?, ?)`,
    )
    .bind(
      `idem_${crypto.randomUUID()}`,
      input.actorPointsUserId,
      input.idempotencyKey,
      payloadHash,
      JSON.stringify(responseBody),
      input.now.getTime(),
    );
  const audit = db
    .prepare(
      `INSERT INTO audit_event
         (id, actor_points_user_id, action, target, reason, request_id, result, created_at)
       VALUES (?, ?, 'FIX_CSV_COMMIT', 'FIX', ?, ?, 'SUCCESS', ?)`,
    )
    .bind(
      input.auditEventId,
      input.actorPointsUserId,
      input.reason,
      input.requestId,
      input.now.getTime(),
    );
  await runCsvAtomicBatch(
    db,
    composeCsvAtomicBatch({
      audit: [...sealWrites, audit],
      domainWrites,
      idempotencyResult: [idempotency],
      ledger: ledgerWrites,
    }),
  );
  return { payloadHash, responseBody, results };
}
