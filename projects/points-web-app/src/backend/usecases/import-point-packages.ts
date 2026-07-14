import {
  createPointPackageRevision,
  InvalidPointPackageError,
  type PointPackageStatus,
} from "../domain/evaluation/point-package";
import {
  appendPointPackageRevisions,
  findCurrentEvaluationCriteria,
  findPointPackageHead,
} from "../infrastructure/db/d1-evaluation-repository";

export interface PointPackageImportItem {
  pointPackageId: string;
  expectedRevision: number | null;
  status: PointPackageStatus;
  name: string;
  description: string | null;
  relatedUrl: string | null;
  components: Array<{
    evaluationCriterionId: string;
    displayOrder: number;
    weight: number;
  }>;
}

export class PointPackageRevisionConflictError extends Error {
  constructor() {
    super("POINT_PACKAGE_REVISION_CONFLICT");
  }
}

export class PointPackageNameConflictError extends Error {
  constructor() {
    super("POINT_PACKAGE_NAME_CONFLICT");
  }
}

export interface ImportedPointPackageRevision {
  pointPackageId: string;
  pointPackageRevisionId: string;
  revision: number;
  status: PointPackageStatus;
  eligibilityVersion: number;
  contentHash: string;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("UNIQUE constraint failed") ||
      error.message.includes("POINT_PACKAGE_NAME_CONFLICT"))
  );
}

export async function importPointPackages(
  db: D1Database,
  input: {
    actorPointsUserId: string;
    reason: string;
    items: PointPackageImportItem[];
    now?: Date;
  },
): Promise<[ImportedPointPackageRevision, ...ImportedPointPackageRevision[]]> {
  if (
    input.items.length < 1 ||
    input.items.length > 20 ||
    input.reason.trim().length === 0 ||
    new Set(input.items.map(({ pointPackageId }) => pointPackageId)).size !== input.items.length
  ) {
    throw new InvalidPointPackageError();
  }

  const now = input.now ?? new Date();
  const rows = await Promise.all(
    input.items.map(async (item) => {
      const head = await findPointPackageHead(db, item.pointPackageId);
      if (
        (head === null && item.expectedRevision !== null) ||
        (head !== null && item.expectedRevision !== head.currentRevision)
      ) {
        throw new PointPackageRevisionConflictError();
      }
      const revision = (head?.currentRevision ?? 0) + 1;
      const criteria = await findCurrentEvaluationCriteria(
        db,
        item.components.map(({ evaluationCriterionId }) => evaluationCriterionId),
      );
      if (
        criteria.size !== new Set(item.components.map((value) => value.evaluationCriterionId)).size
      ) {
        throw new InvalidPointPackageError();
      }
      const value = await createPointPackageRevision({
        pointPackageId: item.pointPackageId,
        pointPackageRevisionId: `ppr_${item.pointPackageId}_${revision}`,
        status: item.status,
        name: item.name,
        description: item.description,
        relatedUrl: item.relatedUrl,
        components: item.components.map((component) => {
          const criterion = criteria.get(component.evaluationCriterionId);
          if (!criterion) {
            throw new InvalidPointPackageError();
          }
          return {
            ...component,
            evaluationCriterionRevisionId: criterion.revisionId,
            evaluationCriterionName: criterion.name,
            minimumUnitScaled: criterion.minimumUnitScaled,
            buyNowEnabled: criterion.buyNowEnabled === 1,
          };
        }),
      });
      return {
        value,
        revision,
        eligibilityVersion: (head?.eligibilityVersion ?? 0) + 1,
        actorPointsUserId: input.actorPointsUserId,
        reason: input.reason,
        now,
        isNew: head === null,
      };
    }),
  );

  if (new Set(rows.map(({ value }) => value.normalizedName)).size !== rows.length) {
    throw new PointPackageNameConflictError();
  }

  try {
    await appendPointPackageRevisions(db, rows);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new PointPackageNameConflictError();
    }
    throw error;
  }

  return rows.map(({ value, revision, eligibilityVersion }) => ({
    pointPackageId: value.pointPackageId,
    pointPackageRevisionId: value.pointPackageRevisionId,
    revision,
    status: value.status,
    eligibilityVersion,
    contentHash: value.contentHash,
  })) as [ImportedPointPackageRevision, ...ImportedPointPackageRevision[]];
}
