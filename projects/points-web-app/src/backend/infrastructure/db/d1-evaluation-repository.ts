import type {
  CreatedPointPackageRevision,
  PointPackageStatus,
} from "../../domain/evaluation/point-package";
import type { ValidatedEvaluationCriterionRevision } from "../../domain/evaluation/evaluation-criterion";

export interface EvaluationCriterionHead {
  id: string;
  normalizedName: string;
  currentRevision: number;
  currentRevisionId: string;
}

export interface PointPackageHead {
  id: string;
  normalizedName: string;
  currentRevision: number;
  currentRevisionId: string;
  lifecycleStatus: PointPackageStatus;
  eligibilityVersion: number;
}

export interface CurrentEvaluationCriterion {
  id: string;
  revisionId: string;
  name: string;
  minimumUnitScaled: number;
  buyNowEnabled: number;
}

export interface PersistedPointPackageRevision {
  pointPackageId: string;
  pointPackageRevisionId: string;
  revision: number;
  contentHash: string;
  status: PointPackageStatus;
  eligibilityVersion: number;
}

export async function findEvaluationCriterionHead(
  db: D1Database,
  id: string,
): Promise<EvaluationCriterionHead | null> {
  return (
    (await db
      .prepare(
        `SELECT id, normalized_name AS normalizedName,
                current_revision AS currentRevision, current_revision_id AS currentRevisionId
         FROM evaluation_criterion WHERE id = ?`,
      )
      .bind(id)
      .first<EvaluationCriterionHead>()) ?? null
  );
}

export async function findPointPackageHead(
  db: D1Database,
  id: string,
): Promise<PointPackageHead | null> {
  return (
    (await db
      .prepare(
        `SELECT id, normalized_name AS normalizedName,
                current_revision AS currentRevision, current_revision_id AS currentRevisionId,
                lifecycle_status AS lifecycleStatus, eligibility_version AS eligibilityVersion
         FROM point_package WHERE id = ?`,
      )
      .bind(id)
      .first<PointPackageHead>()) ?? null
  );
}

export async function findCurrentEvaluationCriteria(
  db: D1Database,
  ids: string[],
): Promise<Map<string, CurrentEvaluationCriterion>> {
  const rows = await Promise.all(
    ids.map((id) =>
      db
        .prepare(
          `SELECT criterion.id, revision.id AS revisionId, revision.name,
                  revision.minimum_unit_scaled AS minimumUnitScaled,
                  revision.buy_now_enabled AS buyNowEnabled
           FROM evaluation_criterion criterion
           JOIN evaluation_criterion_revision revision
             ON revision.id = criterion.current_revision_id
           WHERE criterion.id = ?`,
        )
        .bind(id)
        .first<CurrentEvaluationCriterion>(),
    ),
  );
  return new Map(
    rows
      .filter((row): row is CurrentEvaluationCriterion => row !== null)
      .map((row) => [row.id, row]),
  );
}

export async function appendEvaluationCriterionRevisions(
  db: D1Database,
  inputs: Array<{
    value: ValidatedEvaluationCriterionRevision;
    revision: number;
    revisionId: string;
    actorPointsUserId: string;
    reason: string;
    now: Date;
    isNew: boolean;
  }>,
): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  for (const input of inputs) {
    const value = input.value;
    if (input.isNew) {
      statements.push(
        db
          .prepare(
            `INSERT INTO evaluation_criterion
               (id, normalized_name, current_revision_id, current_revision, created_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(
            value.evaluationCriterionId,
            value.normalizedName,
            input.revisionId,
            input.revision,
            input.now.getTime(),
          ),
      );
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO evaluation_criterion_revision
             (id, evaluation_criterion_id, revision, status, name, description,
              minimum_unit_scaled, transfer_enabled, exchange_enabled,
              balance_visible_by_default, buy_now_enabled, actor_points_user_id,
              reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.revisionId,
          value.evaluationCriterionId,
          input.revision,
          value.status,
          value.name,
          value.description,
          value.minimumUnitScaled,
          value.transferEnabled ? 1 : 0,
          value.exchangeEnabled ? 1 : 0,
          value.balanceVisibleByDefault ? 1 : 0,
          value.buyNowEnabled ? 1 : 0,
          input.actorPointsUserId,
          input.reason,
          input.now.getTime(),
        ),
    );
    value.relatedUrls.forEach((url, displayOrder) => {
      statements.push(
        db
          .prepare(
            `INSERT INTO evaluation_criterion_related_url
               (id, evaluation_criterion_revision_id, display_order, url)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(`${input.revisionId}_url_${displayOrder}`, input.revisionId, displayOrder, url),
      );
    });
    statements.push(
      db
        .prepare(
          `INSERT INTO evaluation_criterion_revision_seal
             (evaluation_criterion_revision_id, sealed_at)
           VALUES (?, ?)`,
        )
        .bind(input.revisionId, input.now.getTime()),
    );
    if (!input.isNew) {
      statements.push(
        db
          .prepare(
            `UPDATE evaluation_criterion
             SET normalized_name = ?, current_revision_id = ?, current_revision = ?
             WHERE id = ? AND current_revision = ?`,
          )
          .bind(
            value.normalizedName,
            input.revisionId,
            input.revision,
            value.evaluationCriterionId,
            input.revision - 1,
          ),
      );
    }
  }
  await db.batch(statements);
}

export async function appendPointPackageRevisions(
  db: D1Database,
  inputs: Array<{
    value: CreatedPointPackageRevision;
    revision: number;
    eligibilityVersion: number;
    actorPointsUserId: string;
    reason: string;
    now: Date;
    isNew: boolean;
  }>,
): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  for (const input of inputs) {
    const value = input.value;
    if (input.isNew) {
      statements.push(
        db
          .prepare(
            `INSERT INTO point_package
               (id, normalized_name, current_revision_id, current_revision,
                lifecycle_status, eligibility_version, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            value.pointPackageId,
            value.normalizedName,
            value.pointPackageRevisionId,
            input.revision,
            value.status,
            input.eligibilityVersion,
            input.now.getTime(),
          ),
      );
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO point_package_normalized_name_history
             (normalized_name, point_package_id, created_at)
           VALUES (?, ?, ?)
           ON CONFLICT(normalized_name) DO NOTHING`,
        )
        .bind(value.normalizedName, value.pointPackageId, input.now.getTime()),
    );
    statements.push(
      db
        .prepare(
          `INSERT INTO point_package_revision
             (id, point_package_id, revision, status, name, description, related_url,
              total_weight, package_tick, content_hash, actor_points_user_id, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          value.pointPackageRevisionId,
          value.pointPackageId,
          input.revision,
          value.status,
          value.name,
          value.description,
          value.relatedUrl,
          value.totalWeight,
          value.packageTick,
          value.contentHash,
          input.actorPointsUserId,
          input.reason,
          input.now.getTime(),
        ),
    );
    for (const component of value.components) {
      statements.push(
        db
          .prepare(
            `INSERT INTO point_package_component
               (id, point_package_revision_id, evaluation_criterion_id,
                evaluation_criterion_revision_id, evaluation_criterion_name,
                display_order, minimum_unit_scaled, buy_now_enabled, weight)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            `${value.pointPackageRevisionId}_component_${component.displayOrder}`,
            value.pointPackageRevisionId,
            component.evaluationCriterionId,
            component.evaluationCriterionRevisionId,
            component.name,
            component.displayOrder,
            component.minimumUnitScaled,
            component.buyNowEnabled ? 1 : 0,
            component.weight,
          ),
      );
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO point_package_revision_seal (point_package_revision_id, sealed_at)
           VALUES (?, ?)`,
        )
        .bind(value.pointPackageRevisionId, input.now.getTime()),
    );
    statements.push(
      db
        .prepare(
          `INSERT INTO point_package_lifecycle_event
             (id, point_package_id, point_package_revision_id, eligibility_version,
              status, actor_points_user_id, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `${value.pointPackageRevisionId}_lifecycle`,
          value.pointPackageId,
          value.pointPackageRevisionId,
          input.eligibilityVersion,
          value.status,
          input.actorPointsUserId,
          input.reason,
          input.now.getTime(),
        ),
    );
    if (!input.isNew) {
      statements.push(
        db
          .prepare(
            `UPDATE point_package
             SET normalized_name = ?, current_revision_id = ?, current_revision = ?,
                 lifecycle_status = ?, eligibility_version = ?
             WHERE id = ? AND current_revision = ? AND eligibility_version = ?`,
          )
          .bind(
            value.normalizedName,
            value.pointPackageRevisionId,
            input.revision,
            value.status,
            input.eligibilityVersion,
            value.pointPackageId,
            input.revision - 1,
            input.eligibilityVersion - 1,
          ),
      );
    }
  }
  await db.batch(statements);
}

export async function readPersistedPointPackageRevision(db: D1Database, revisionId: string) {
  const revision = await db
    .prepare(
      `SELECT id AS pointPackageRevisionId, point_package_id AS pointPackageId,
              revision, status, name, description, related_url AS relatedUrl,
              total_weight AS totalWeight, package_tick AS packageTick,
              content_hash AS contentHash
       FROM point_package_revision WHERE id = ?`,
    )
    .bind(revisionId)
    .first<{
      pointPackageRevisionId: string;
      pointPackageId: string;
      revision: number;
      status: PointPackageStatus;
      name: string;
      description: string | null;
      relatedUrl: string | null;
      totalWeight: number;
      packageTick: number;
      contentHash: string;
    }>();
  if (!revision) {
    return null;
  }
  const components = await db
    .prepare(
      `SELECT evaluation_criterion_id AS evaluationCriterionId,
              evaluation_criterion_revision_id AS evaluationCriterionRevisionId,
              evaluation_criterion_name AS name,
              display_order AS displayOrder, minimum_unit_scaled AS minimumUnitScaled,
              buy_now_enabled AS buyNowEnabled, weight
       FROM point_package_component
       WHERE point_package_revision_id = ?
       ORDER BY display_order, evaluation_criterion_id`,
    )
    .bind(revisionId)
    .all<{
      evaluationCriterionId: string;
      evaluationCriterionRevisionId: string;
      name: string;
      displayOrder: number;
      minimumUnitScaled: number;
      buyNowEnabled: number;
      weight: number;
    }>();
  return {
    ...revision,
    components: components.results.map((component) => ({
      ...component,
      buyNowEnabled: component.buyNowEnabled === 1,
    })),
  };
}
