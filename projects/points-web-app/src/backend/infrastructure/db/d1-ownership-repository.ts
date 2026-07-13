import { hashCanonicalPayload } from "../../domain/idempotency/idempotency-result";

export class OwnershipClaimError extends Error {
  constructor(
    readonly code:
      | "CLAIM_SET_CHANGED"
      | "IDEMPOTENCY_KEY_REUSED"
      | "NO_UNCLAIMED_FIXES"
      | "OWNERSHIP_NOT_ACTIVE"
      | "OWNERSHIP_NOT_FOUND",
  ) {
    super(code);
  }
}

interface EligibleUnclaimedFix {
  deltaAmountScaled: number;
  evaluationAt: string;
  evaluationCriterionId: string;
  evaluationCriterionRevisionId: string;
  id: string;
  sourceFixRevisionId: string;
}

export interface ClaimPreviewAggregate {
  evaluationCriterionId: string;
  netAmountScaled: number;
  negativeCount: number;
  positiveCount: number;
  totalCount: number;
}

export interface UnclaimedFixClaimPreview {
  aggregates: ClaimPreviewAggregate[];
  claimSetHash: string;
  identityOwnershipId: string;
  totalCount: number;
}

async function findClaimReplay(
  db: D1Database,
  pointsUserId: string,
  idempotencyKey: string,
  payloadHash: string,
): Promise<{ responseBody: unknown; status: number } | null> {
  const replay = await db
    .prepare(
      `SELECT payload_hash AS payloadHash, status, response_body AS responseBody
       FROM idempotency_results
       WHERE actor_points_user_id = ? AND operation = 'UNCLAIMED_FIX_CLAIM'
         AND idempotency_key = ?`,
    )
    .bind(pointsUserId, idempotencyKey)
    .first<{ payloadHash: string; responseBody: string | unknown; status: number }>();
  if (!replay) return null;
  if (replay.payloadHash !== payloadHash) throw new OwnershipClaimError("IDEMPOTENCY_KEY_REUSED");
  return {
    responseBody:
      typeof replay.responseBody === "string"
        ? JSON.parse(replay.responseBody)
        : replay.responseBody,
    status: replay.status,
  };
}

interface InternalPreview extends UnclaimedFixClaimPreview {
  entries: EligibleUnclaimedFix[];
  ownershipEpochId: string;
}

const eligibleUnclaimedSql = `
  FROM unclaimed_fix_entry entry
  JOIN identity_ownership ownership ON ownership.id = ?
  JOIN ownership_epoch epoch ON epoch.id = ownership.current_ownership_epoch_id
  WHERE ownership.points_user_id = ?
    AND ownership.status = 'ACTIVE'
    AND epoch.owner_points_user_id = ownership.points_user_id
    AND NOT EXISTS (
      SELECT 1 FROM fix_claim_item item WHERE item.unclaimed_fix_entry_id = entry.id
    )
    AND (
      (ownership.identity_type = 'WEB_URL'
        AND entry.recipient_provider_id IS NULL
        AND entry.recipient_profile_url = ownership.normalized_identity_key)
      OR
      (ownership.identity_type = 'GITHUB_OAUTH'
        AND entry.recipient_provider_id = 'github'
        AND 'github:' || entry.recipient_account_id = ownership.normalized_identity_key)
    )
    AND (
      ownership.identity_type = 'GITHUB_OAUTH'
      OR NOT EXISTS (
        SELECT 1 FROM ownership_epoch previous
        WHERE previous.identity_ownership_id = ownership.id AND previous.id <> epoch.id
      )
      OR (CASE length(entry.evaluation_at)
        WHEN 7 THEN unixepoch(entry.evaluation_at || '-01T00:00:00Z') * 1000
        WHEN 10 THEN unixepoch(entry.evaluation_at || 'T00:00:00Z') * 1000
        ELSE unixepoch(entry.evaluation_at) * 1000
      END) >= epoch.effective_at
    )`;

async function loadEligibleEntries(
  db: D1Database,
  identityOwnershipId: string,
  pointsUserId: string,
): Promise<{ entries: EligibleUnclaimedFix[]; ownershipEpochId: string }> {
  const ownership = await db
    .prepare(
      `SELECT current_ownership_epoch_id AS ownershipEpochId, status
       FROM identity_ownership WHERE id = ? AND points_user_id = ?`,
    )
    .bind(identityOwnershipId, pointsUserId)
    .first<{ ownershipEpochId: string; status: string }>();
  if (!ownership) throw new OwnershipClaimError("OWNERSHIP_NOT_FOUND");
  if (ownership.status !== "ACTIVE") throw new OwnershipClaimError("OWNERSHIP_NOT_ACTIVE");
  const rows = await db
    .prepare(
      `SELECT entry.id, entry.source_fix_revision_id AS sourceFixRevisionId,
              entry.evaluation_criterion_id AS evaluationCriterionId,
              entry.evaluation_criterion_revision_id AS evaluationCriterionRevisionId,
              entry.delta_amount_scaled AS deltaAmountScaled, entry.evaluation_at AS evaluationAt
       ${eligibleUnclaimedSql}
       ORDER BY entry.id`,
    )
    .bind(identityOwnershipId, pointsUserId)
    .all<EligibleUnclaimedFix>();
  return { entries: rows.results, ownershipEpochId: ownership.ownershipEpochId };
}

async function buildPreview(
  identityOwnershipId: string,
  ownershipEpochId: string,
  entries: EligibleUnclaimedFix[],
): Promise<InternalPreview> {
  const byCriterion = new Map<string, ClaimPreviewAggregate>();
  for (const entry of entries) {
    const aggregate = byCriterion.get(entry.evaluationCriterionId) ?? {
      evaluationCriterionId: entry.evaluationCriterionId,
      negativeCount: 0,
      netAmountScaled: 0,
      positiveCount: 0,
      totalCount: 0,
    };
    aggregate.netAmountScaled += entry.deltaAmountScaled;
    if (!Number.isSafeInteger(aggregate.netAmountScaled)) throw new Error("SAFE_INTEGER_OVERFLOW");
    aggregate.totalCount += 1;
    if (entry.deltaAmountScaled > 0) aggregate.positiveCount += 1;
    if (entry.deltaAmountScaled < 0) aggregate.negativeCount += 1;
    byCriterion.set(entry.evaluationCriterionId, aggregate);
  }
  const claimSetHash = await hashCanonicalPayload({
    entries: entries.map((entry) => ({
      deltaAmountScaled: entry.deltaAmountScaled,
      evaluationAt: entry.evaluationAt,
      evaluationCriterionId: entry.evaluationCriterionId,
      evaluationCriterionRevisionId: entry.evaluationCriterionRevisionId,
      id: entry.id,
      sourceFixRevisionId: entry.sourceFixRevisionId,
    })),
    ownershipEpochId,
  });
  return {
    aggregates: [...byCriterion.values()].sort((left, right) =>
      left.evaluationCriterionId.localeCompare(right.evaluationCriterionId),
    ),
    claimSetHash,
    entries,
    identityOwnershipId,
    ownershipEpochId,
    totalCount: entries.length,
  };
}

export async function previewUnclaimedFixes(
  db: D1Database,
  identityOwnershipId: string,
  pointsUserId: string,
): Promise<UnclaimedFixClaimPreview> {
  const loaded = await loadEligibleEntries(db, identityOwnershipId, pointsUserId);
  const {
    entries: _entries,
    ownershipEpochId: _epoch,
    ...preview
  } = await buildPreview(identityOwnershipId, loaded.ownershipEpochId, loaded.entries);
  return preview;
}

export async function claimUnclaimedFixes(
  db: D1Database,
  input: {
    claimSetHash: string;
    idempotencyKey: string;
    identityOwnershipId: string;
    now: Date;
    pointsUserId: string;
    requestId: string;
  },
): Promise<{ responseBody: unknown; status: number }> {
  const payloadHash = await hashCanonicalPayload({
    claimSetHash: input.claimSetHash,
    identityOwnershipId: input.identityOwnershipId,
  });
  const replay = await findClaimReplay(db, input.pointsUserId, input.idempotencyKey, payloadHash);
  if (replay) return replay;

  const loaded = await loadEligibleEntries(db, input.identityOwnershipId, input.pointsUserId);
  const preview = await buildPreview(
    input.identityOwnershipId,
    loaded.ownershipEpochId,
    loaded.entries,
  );
  if (preview.entries.length === 0) throw new OwnershipClaimError("NO_UNCLAIMED_FIXES");
  if (preview.claimSetHash !== input.claimSetHash)
    throw new OwnershipClaimError("CLAIM_SET_CHANGED");

  const claimId = `fixclaim_${crypto.randomUUID()}`;
  const commandId = `fixclaimcmd_${crypto.randomUUID()}`;
  const claimedAt = input.now.getTime();
  const expectedEntryIds = JSON.stringify(preview.entries.map((entry) => entry.id));
  const responseBody = {
    data: {
      claimId,
      claimedCount: preview.entries.length,
      claimSetHash: preview.claimSetHash,
    },
    meta: { requestId: input.requestId },
  };
  const ledgerRows = preview.entries.map((entry) => ({
    ...entry,
    createdAt: claimedAt,
    id: `ledger_${crypto.randomUUID()}`,
  }));
  const claimItems = ledgerRows.map((entry, index) => ({
    createdAt: claimedAt,
    fixClaimId: claimId,
    id: `fixclaimitem_${crypto.randomUUID()}`,
    ledgerEntryId: entry.id,
    unclaimedFixEntryId: preview.entries[index]!.id,
  }));

  const guard = db
    .prepare(
      `INSERT INTO fix_claim_command
         (id, identity_ownership_id, ownership_epoch_id, actor_points_user_id,
          expected_entry_ids, claim_set_hash, created_at)
       SELECT ?, ownership.id, epoch.id, ownership.points_user_id, ?, ?, ?
       FROM identity_ownership ownership
       JOIN ownership_epoch epoch ON epoch.id = ownership.current_ownership_epoch_id
       WHERE ownership.id = ? AND ownership.points_user_id = ? AND ownership.status = 'ACTIVE'
         AND epoch.id = ?
         AND ? = COALESCE((
           SELECT json_group_array(id) FROM (
             SELECT entry.id ${eligibleUnclaimedSql} ORDER BY entry.id
           )
         ), '[]')`,
    )
    .bind(
      commandId,
      expectedEntryIds,
      preview.claimSetHash,
      claimedAt,
      input.identityOwnershipId,
      input.pointsUserId,
      preview.ownershipEpochId,
      expectedEntryIds,
      input.identityOwnershipId,
      input.pointsUserId,
    );
  const claim = db
    .prepare(
      `INSERT INTO fix_claim
         (id, command_id, ownership_epoch_id, points_user_id, claim_set_hash,
          item_count, request_id, idempotency_key, claimed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      claimId,
      commandId,
      preview.ownershipEpochId,
      input.pointsUserId,
      preview.claimSetHash,
      preview.entries.length,
      input.requestId,
      input.idempotencyKey,
      claimedAt,
    );
  const ledger = db
    .prepare(
      `INSERT INTO point_ledger_entry
         (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
          delta_amount_scaled, affects_evaluation_total, source_type, source_fix_revision_id,
          source_unclaimed_fix_entry_id, created_at)
       SELECT json_extract(value, '$.id'), ?, json_extract(value, '$.evaluationCriterionId'),
              json_extract(value, '$.evaluationCriterionRevisionId'),
              json_extract(value, '$.deltaAmountScaled'), 1, 'FIX',
              json_extract(value, '$.sourceFixRevisionId'),
              json_extract(value, '$.sourceUnclaimedFixEntryId'), json_extract(value, '$.createdAt')
       FROM json_each(?)`,
    )
    .bind(
      input.pointsUserId,
      JSON.stringify(
        ledgerRows.map((row, index) => ({
          ...row,
          sourceUnclaimedFixEntryId: preview.entries[index]!.id,
        })),
      ),
    );
  const items = db
    .prepare(
      `INSERT INTO fix_claim_item
         (id, fix_claim_id, unclaimed_fix_entry_id, ledger_entry_id, created_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.fixClaimId'),
              json_extract(value, '$.unclaimedFixEntryId'), json_extract(value, '$.ledgerEntryId'),
              json_extract(value, '$.createdAt') FROM json_each(?)`,
    )
    .bind(JSON.stringify(claimItems));
  const idempotency = db
    .prepare(
      `INSERT INTO idempotency_results
         (id, actor_points_user_id, operation, idempotency_key, payload_hash,
          status, response_body, created_at)
       VALUES (?, ?, 'UNCLAIMED_FIX_CLAIM', ?, ?, 201, ?, ?)`,
    )
    .bind(
      `idem_${crypto.randomUUID()}`,
      input.pointsUserId,
      input.idempotencyKey,
      payloadHash,
      JSON.stringify(responseBody),
      claimedAt,
    );
  const audit = db
    .prepare(
      `INSERT INTO audit_event
         (id, actor_points_user_id, action, target, request_id, result, created_at)
       VALUES (?, ?, 'UNCLAIMED_FIX_CLAIM', ?, ?, 'SUCCESS', ?)`,
    )
    .bind(
      `audit_${crypto.randomUUID()}`,
      input.pointsUserId,
      input.identityOwnershipId,
      input.requestId,
      claimedAt,
    );
  try {
    await db.batch([guard, claim, ledger, items, idempotency, audit]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("FOREIGN KEY constraint failed")) {
      const concurrentReplay = await findClaimReplay(
        db,
        input.pointsUserId,
        input.idempotencyKey,
        payloadHash,
      );
      if (concurrentReplay) return concurrentReplay;
      throw new OwnershipClaimError("CLAIM_SET_CHANGED");
    }
    throw error;
  }
  return { responseBody, status: 201 };
}
