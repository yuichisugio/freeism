import { canonicalJson, sha256Hex } from "../csv/csv-validation-result";
import {
  allocateByLargestRemainderDetailed,
  assertDistributionTargetLimit,
  buildEligibleDistributionCandidates,
  calculateEffectiveDistributionAmounts,
  type DistributionCandidateInput,
} from "../domain/distribution/largest-remainder";

interface Setting {
  id: string;
  pointPackageRevisionId: string;
  retentionAmountScaled: number | null;
  retentionRatePpm: number | null;
}

interface TargetRow {
  componentSnapshot: unknown;
  id: string;
  pointsUserId: string;
  score: number;
  snapshotId: string;
  tieOrder: number;
}

export interface AutoDistributionPlan {
  ledger: Array<{
    createdAt: number;
    deltaAmountScaled: number;
    evaluationCriterionId: string;
    evaluationCriterionRevisionId: string;
    id: string;
    pointsUserId: string;
    revisionId: string;
    sourceType: "AUTO_DISTRIBUTION_CREDIT" | "AUTO_DISTRIBUTION_DEBIT";
  }>;
  revisions: Array<{
    allocationSnapshot: unknown;
    creditDeltaSnapshot: unknown;
    createdAt: number;
    distributionAmountScaled: number;
    id: string;
    retainedAmountScaled: number;
    sourceDebitDeltaScaled: number;
    snapshotId: string;
    sourceAmountScaled: number;
    sourceFixRevisionId: string;
  }>;
  snapshots: Array<Record<string, unknown>>;
  targets: TargetRow[];
}

export function emptyAutoDistributionPlan(): AutoDistributionPlan {
  return { ledger: [], revisions: [], snapshots: [], targets: [] };
}

function cutoffExclusive(value: string): number {
  if (value.length === 7) {
    const [year, month] = value.split("-").map(Number);
    return Date.UTC(year!, month!, 1);
  }
  if (value.length === 10) return Date.parse(`${value}T00:00:00Z`) + 86_400_000;
  return Date.parse(value) + 1;
}

async function currentSetting(db: D1Database, pointsUserId: string): Promise<Setting | null> {
  return db
    .prepare(
      `SELECT revision.id, revision.point_package_revision_id AS pointPackageRevisionId,
              revision.retention_rate_ppm AS retentionRatePpm,
              revision.retention_amount_scaled AS retentionAmountScaled
       FROM auto_distribution_setting setting
       JOIN auto_distribution_setting_revision revision
         ON revision.id = setting.current_revision_id
       JOIN point_package_revision package_revision
         ON package_revision.id = revision.point_package_revision_id
        AND package_revision.status = 'ACTIVE'
       JOIN point_package package
         ON package.id = package_revision.point_package_id
        AND package.lifecycle_status = 'ACTIVE'
       JOIN profile_point_package profile_package
         ON profile_package.points_user_id = setting.points_user_id
        AND profile_package.point_package_id = package.id
       WHERE setting.points_user_id = ? AND revision.status = 'ON'`,
    )
    .bind(pointsUserId)
    .first<Setting>();
}

async function buildCandidates(
  db: D1Database,
  pointPackageRevisionId: string,
  sourcePointsUserId: string,
  cutoff: number,
) {
  const components = await db
    .prepare(
      `SELECT evaluation_criterion_id AS evaluationCriterionId,
              evaluation_criterion_revision_id AS evaluationCriterionRevisionId, weight
       FROM point_package_component WHERE point_package_revision_id = ?
       ORDER BY display_order`,
    )
    .bind(pointPackageRevisionId)
    .all<{
      evaluationCriterionId: string;
      evaluationCriterionRevisionId: string;
      weight: number;
    }>();
  const candidates = await db
    .prepare(
      `SELECT points_user.id AS pointsUserId,
              component.evaluation_criterion_id AS evaluationCriterionId,
              component.evaluation_criterion_revision_id AS evaluationCriterionRevisionId,
              component.weight,
              COALESCE(SUM(CASE WHEN ledger.created_at < ? AND ledger.affects_evaluation_total = 1
                THEN ledger.delta_amount_scaled ELSE 0 END), 0) AS evaluationTotalScaled
       FROM points_user
       CROSS JOIN point_package_component component
       LEFT JOIN point_ledger_entry ledger
         ON ledger.points_user_id = points_user.id
        AND ledger.evaluation_criterion_id = component.evaluation_criterion_id
       WHERE points_user.account_status = 'ACTIVE'
         AND component.point_package_revision_id = ?
       GROUP BY points_user.id, component.evaluation_criterion_id, component.weight
       ORDER BY points_user.id, component.display_order`,
    )
    .bind(cutoff, pointPackageRevisionId)
    .all<{
      evaluationCriterionId: string;
      evaluationCriterionRevisionId: string;
      evaluationTotalScaled: number;
      pointsUserId: string;
      weight: number;
    }>();
  const grouped = new Map<string, DistributionCandidateInput>();
  for (const row of candidates.results) {
    const candidate = grouped.get(row.pointsUserId) ?? {
      components: [],
      pointsUserId: row.pointsUserId,
    };
    candidate.components.push({
      evaluationCriterionId: row.evaluationCriterionId,
      evaluationCriterionRevisionId: row.evaluationCriterionRevisionId,
      evaluationTotalScaled: row.evaluationTotalScaled,
      weight: row.weight,
    });
    grouped.set(row.pointsUserId, candidate);
  }
  const eligible = buildEligibleDistributionCandidates({
    candidates: [...grouped.values()],
    sourcePointsUserId,
  });
  assertDistributionTargetLimit(eligible.length);
  return {
    components: components.results,
    eligible,
    grouped,
  };
}

export async function preparePositiveFixDistribution(
  db: D1Database,
  input: {
    amountScaled: number;
    createdAt: number;
    evaluationAt: string;
    evaluationCriterionId: string;
    evaluationCriterionRevisionId: string;
    fixResultId: string;
    fixRevisionId: string;
    minimumUnitScaled: number;
    pointsUserId: string;
    recipientKey: string;
  },
): Promise<AutoDistributionPlan> {
  const sourceBusinessKeyHash = await sha256Hex(
    canonicalJson({
      evaluationCriterionId: input.evaluationCriterionId,
      fixResultId: input.fixResultId,
      recipientKey: input.recipientKey,
    }),
  );
  const existing = await db
    .prepare(
      `SELECT snapshot.*, setting.retention_rate_ppm AS retentionRatePpm,
              setting.retention_amount_scaled AS retentionAmountScaled
       FROM auto_distribution_snapshot snapshot
       LEFT JOIN auto_distribution_setting_revision setting ON setting.id = snapshot.setting_revision_id
       WHERE snapshot.source_business_key_hash = ?`,
    )
    .bind(sourceBusinessKeyHash)
    .first<Record<string, string | number | null>>();
  if (!existing && input.amountScaled <= 0) return emptyAutoDistributionPlan();
  if (existing?.outcome === "NOT_ENABLED") return emptyAutoDistributionPlan();

  let snapshotId: string;
  let targets: TargetRow[];
  let setting: Setting;
  let minimumUnitScaled = input.minimumUnitScaled;
  let evaluationCriterionRevisionId = input.evaluationCriterionRevisionId;
  const plan = emptyAutoDistributionPlan();
  if (existing) {
    snapshotId = String(existing.id);
    setting = {
      id: String(existing.setting_revision_id),
      pointPackageRevisionId: String(existing.point_package_revision_id),
      retentionAmountScaled:
        existing.retentionAmountScaled === null ? null : Number(existing.retentionAmountScaled),
      retentionRatePpm:
        existing.retentionRatePpm === null ? null : Number(existing.retentionRatePpm),
    };
    minimumUnitScaled = Number(existing.minimum_unit_scaled);
    evaluationCriterionRevisionId = String(existing.evaluation_criterion_revision_id);
    const savedTargets = await db
      .prepare(
        `SELECT id, snapshot_id AS snapshotId, points_user_id AS pointsUserId,
                score, component_snapshot AS componentSnapshot, tie_order AS tieOrder
         FROM auto_distribution_snapshot_target WHERE snapshot_id = ? ORDER BY tie_order`,
      )
      .bind(snapshotId)
      .all<TargetRow & { componentSnapshot: string | unknown }>();
    targets = savedTargets.results.map((row) => ({
      ...row,
      componentSnapshot:
        typeof row.componentSnapshot === "string"
          ? JSON.parse(row.componentSnapshot)
          : row.componentSnapshot,
    }));
  } else {
    const activeSetting = await currentSetting(db, input.pointsUserId);
    if (!activeSetting) {
      plan.snapshots.push({
        createdAt: input.createdAt,
        evaluationCriterionId: input.evaluationCriterionId,
        evaluationCriterionRevisionId: input.evaluationCriterionRevisionId,
        id: `autodistsnap_${crypto.randomUUID()}`,
        initialSourceFixRevisionId: input.fixRevisionId,
        minimumUnitScaled: input.minimumUnitScaled,
        outcome: "NOT_ENABLED",
        pointPackageRevisionId: null,
        settingRevisionId: null,
        sourceBusinessKeyHash,
        sourceFixResultId: input.fixResultId,
        sourcePointsUserId: input.pointsUserId,
        sourceRecipientKey: input.recipientKey,
        weightCutoffExclusive: cutoffExclusive(input.evaluationAt),
      });
      return plan;
    }
    setting = activeSetting;
    snapshotId = `autodistsnap_${crypto.randomUUID()}`;
    const cutoff = cutoffExclusive(input.evaluationAt);
    const candidateState = await buildCandidates(
      db,
      setting.pointPackageRevisionId,
      input.pointsUserId,
      cutoff,
    );
    targets = candidateState.eligible.map((candidate, tieOrder) => ({
      componentSnapshot: candidateState.grouped.get(candidate.pointsUserId)!.components,
      id: `autodisttarget_${crypto.randomUUID()}`,
      pointsUserId: candidate.pointsUserId,
      score: candidate.score,
      snapshotId,
      tieOrder,
    }));
    plan.snapshots.push({
      createdAt: input.createdAt,
      evaluationCriterionId: input.evaluationCriterionId,
      evaluationCriterionRevisionId: input.evaluationCriterionRevisionId,
      id: snapshotId,
      initialSourceFixRevisionId: input.fixRevisionId,
      minimumUnitScaled: input.minimumUnitScaled,
      outcome: targets.length === 0 ? "NO_ELIGIBLE_WEIGHT" : "DISTRIBUTED",
      pointPackageRevisionId: setting.pointPackageRevisionId,
      settingRevisionId: setting.id,
      sourceBusinessKeyHash,
      sourceFixResultId: input.fixResultId,
      sourcePointsUserId: input.pointsUserId,
      sourceRecipientKey: input.recipientKey,
      weightCutoffExclusive: cutoff,
    });
    plan.targets.push(...targets);
  }

  const previous = existing
    ? await db
        .prepare(
          `SELECT distribution_amount_scaled AS distributionAmountScaled, allocation_snapshot AS allocations
           FROM auto_distribution_revision distribution_revision
           JOIN fix_revision source_revision
             ON source_revision.id = distribution_revision.source_fix_revision_id
           WHERE distribution_revision.snapshot_id = ?
           ORDER BY source_revision.revision DESC LIMIT 1`,
        )
        .bind(snapshotId)
        .first<{ allocations: string | unknown; distributionAmountScaled: number }>()
    : null;
  const previousAllocations = new Map<string, number>(
    (previous
      ? typeof previous.allocations === "string"
        ? JSON.parse(previous.allocations)
        : previous.allocations
      : []
    ).map((row: { amountScaled: number; pointsUserId: string }) => [
      row.pointsUserId,
      row.amountScaled,
    ]),
  );
  const retention =
    input.amountScaled > 0
      ? calculateEffectiveDistributionAmounts({
          minimumUnitScaled,
          retentionAmountScaled: setting.retentionAmountScaled ?? undefined,
          retentionRatePpm: setting.retentionRatePpm ?? undefined,
          sourceAmountScaled: input.amountScaled,
          targetCount: targets.length,
        })
      : { distributionAmountScaled: 0, retainedAmountScaled: input.amountScaled };
  const allocations =
    targets.length === 0
      ? []
      : allocateByLargestRemainderDetailed({
          candidates: targets.map((target) => ({
            pointsUserId: target.pointsUserId,
            score: target.score,
          })),
          distributionAmountScaled: retention.distributionAmountScaled,
          minimumUnitScaled,
        });
  const revisionId = `autodistrev_${crypto.randomUUID()}`;
  const nextAllocations = new Map(allocations.map((row) => [row.pointsUserId, row.amountScaled]));
  const creditDeltas = [...new Set([...previousAllocations.keys(), ...nextAllocations.keys()])]
    .sort()
    .map((pointsUserId) => ({
      deltaAmountScaled:
        (nextAllocations.get(pointsUserId) ?? 0) - (previousAllocations.get(pointsUserId) ?? 0),
      pointsUserId,
    }))
    .filter((row) => row.deltaAmountScaled !== 0);
  const previousDistribution = previous?.distributionAmountScaled ?? 0;
  const debitDelta = previousDistribution - retention.distributionAmountScaled;
  plan.revisions.push({
    allocationSnapshot: allocations,
    creditDeltaSnapshot: creditDeltas,
    createdAt: input.createdAt,
    distributionAmountScaled: retention.distributionAmountScaled,
    id: revisionId,
    retainedAmountScaled: retention.retainedAmountScaled,
    snapshotId,
    sourceDebitDeltaScaled: debitDelta,
    sourceAmountScaled: input.amountScaled,
    sourceFixRevisionId: input.fixRevisionId,
  });
  if (debitDelta !== 0) {
    plan.ledger.push({
      createdAt: input.createdAt,
      deltaAmountScaled: debitDelta,
      evaluationCriterionId: input.evaluationCriterionId,
      evaluationCriterionRevisionId,
      id: `ledger_${crypto.randomUUID()}`,
      pointsUserId: input.pointsUserId,
      revisionId,
      sourceType: "AUTO_DISTRIBUTION_DEBIT",
    });
  }
  for (const { deltaAmountScaled: delta, pointsUserId } of creditDeltas) {
    plan.ledger.push({
      createdAt: input.createdAt,
      deltaAmountScaled: delta,
      evaluationCriterionId: input.evaluationCriterionId,
      evaluationCriterionRevisionId,
      id: `ledger_${crypto.randomUUID()}`,
      pointsUserId,
      revisionId,
      sourceType: "AUTO_DISTRIBUTION_CREDIT",
    });
  }
  return plan;
}
