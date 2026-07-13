import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";

export class PointsAccountReopenError extends Error {
  constructor(
    readonly code:
      | "ACCOUNT_NOT_CLOSED"
      | "IDEMPOTENCY_KEY_REUSED"
      | "REOPEN_SET_CHANGED"
      | "SAFE_INTEGER_OVERFLOW",
  ) {
    super(code);
  }
}

export interface ReopenFixAggregate {
  evaluationCriterionId: string;
  negativeCount: number;
  netAmountScaled: number;
  positiveCount: number;
  totalCount: number;
}

interface ReopenFixEntry {
  deltaAmountScaled: number;
  evaluationAt: string;
  evaluationCriterionId: string;
  evaluationCriterionRevisionId: string;
  id: string;
  identityOwnershipId: string;
  ownershipEpochId: string;
  sourceFixRevisionId: string;
}

export interface PointsAccountReopenPreview {
  aggregates: ReopenFixAggregate[];
  reopenSetHash: string;
  totalCount: number;
}

export interface InternalPointsAccountReopenPreview extends PointsAccountReopenPreview {
  entries: ReopenFixEntry[];
}

export const eligibleReopenFixSql = `
  FROM unclaimed_fix_entry entry
  JOIN permanent_oauth_subject subject
    ON subject.points_user_id = ?
   AND subject.provider_id = entry.recipient_provider_id
   AND subject.account_id = entry.recipient_account_id
  JOIN identity_ownership ownership
    ON ownership.points_user_id = subject.points_user_id
   AND ownership.identity_type = 'GITHUB_OAUTH'
   AND ownership.permanent_correspondence = 1
   AND ownership.normalized_identity_key = 'github:' || subject.account_id
  JOIN ownership_epoch epoch ON epoch.id = ownership.current_ownership_epoch_id
  JOIN account_close_ownership_suspension suspension
    ON suspension.identity_ownership_id = ownership.id
   AND suspension.points_user_id = subject.points_user_id
   AND suspension.restored_at IS NULL
  WHERE NOT EXISTS (
      SELECT 1 FROM fix_claim_item item WHERE item.unclaimed_fix_entry_id = entry.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM point_ledger_entry ledger
      WHERE ledger.source_unclaimed_fix_entry_id = entry.id
    )`;

export async function loadPointsAccountReopenPreview(
  db: D1Database,
  pointsUserId: string,
): Promise<InternalPointsAccountReopenPreview> {
  const account = await db
    .prepare("SELECT account_status AS accountStatus FROM points_user WHERE id = ?")
    .bind(pointsUserId)
    .first<{ accountStatus: string }>();
  if (!account || account.accountStatus !== "CLOSED") {
    throw new PointsAccountReopenError("ACCOUNT_NOT_CLOSED");
  }

  const entries = await db
    .prepare(
      `SELECT entry.id, entry.source_fix_revision_id AS sourceFixRevisionId,
              ownership.id AS identityOwnershipId, epoch.id AS ownershipEpochId,
              entry.evaluation_criterion_id AS evaluationCriterionId,
              entry.evaluation_criterion_revision_id AS evaluationCriterionRevisionId,
              entry.delta_amount_scaled AS deltaAmountScaled,
              entry.evaluation_at AS evaluationAt
       ${eligibleReopenFixSql}
       ORDER BY entry.id`,
    )
    .bind(pointsUserId)
    .all<ReopenFixEntry>();

  const byCriterion = new Map<string, ReopenFixAggregate>();
  for (const entry of entries.results) {
    const aggregate = byCriterion.get(entry.evaluationCriterionId) ?? {
      evaluationCriterionId: entry.evaluationCriterionId,
      negativeCount: 0,
      netAmountScaled: 0,
      positiveCount: 0,
      totalCount: 0,
    };
    aggregate.netAmountScaled += entry.deltaAmountScaled;
    if (!Number.isSafeInteger(aggregate.netAmountScaled)) {
      throw new PointsAccountReopenError("SAFE_INTEGER_OVERFLOW");
    }
    aggregate.totalCount += 1;
    if (entry.deltaAmountScaled > 0) aggregate.positiveCount += 1;
    if (entry.deltaAmountScaled < 0) aggregate.negativeCount += 1;
    byCriterion.set(entry.evaluationCriterionId, aggregate);
  }

  return {
    aggregates: [...byCriterion.values()].sort((left, right) =>
      left.evaluationCriterionId.localeCompare(right.evaluationCriterionId),
    ),
    entries: entries.results,
    reopenSetHash: await hashCanonicalPayload({ entries: entries.results }),
    totalCount: entries.results.length,
  };
}

export async function previewPointsAccountReopen(
  db: D1Database,
  pointsUserId: string,
): Promise<PointsAccountReopenPreview> {
  const { entries: _entries, ...preview } = await loadPointsAccountReopenPreview(db, pointsUserId);
  return preview;
}
