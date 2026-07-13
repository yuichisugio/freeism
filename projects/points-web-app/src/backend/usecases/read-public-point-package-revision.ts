import { canonicalPointPackageRevisionBytes } from "../domain/evaluation/point-package";
import { readPersistedPointPackageRevision } from "../infrastructure/db/d1-evaluation-repository";

export class PointPackageRevisionNotFoundError extends Error {
  constructor() {
    super("POINT_PACKAGE_REVISION_NOT_FOUND");
  }
}

export async function readPublicPointPackageRevision(db: D1Database, revisionId: string) {
  const revision = await readPersistedPointPackageRevision(db, revisionId);
  if (!revision) {
    throw new PointPackageRevisionNotFoundError();
  }
  const result = {
    pointPackageId: revision.pointPackageId,
    pointPackageRevisionId: revision.pointPackageRevisionId,
    status: revision.status,
    name: revision.name,
    description: revision.description,
    relatedUrl: revision.relatedUrl,
    totalWeight: revision.totalWeight,
    packageTick: revision.packageTick,
    components: revision.components.map((component) => ({
      ...component,
      minimumUnitScaled: String(component.minimumUnitScaled),
    })),
    contentHash: revision.contentHash,
  };
  return {
    ...result,
    canonicalBytes: canonicalPointPackageRevisionBytes(result),
  };
}
