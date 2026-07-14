import { PublicResourceNotFoundError } from "./read-public-profile";

const PUBLIC_ORIGIN = "https://points.freeism.app";

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function minimumUnit(value: number) {
  const whole = Math.floor(value / 10_000);
  const fraction = String(value % 10_000)
    .padStart(4, "0")
    .replace(/0+$/, "");
  return `${whole}${fraction.length === 0 ? "" : `.${fraction}`}`;
}

export async function searchPoints(db: D1Database, query: string) {
  const pattern = `%${escapeLike(query)}%`;
  const [profiles, criteria, packages] = await Promise.all([
    db
      .prepare(
        `SELECT points_user.id AS pointsUserId,
                COALESCE(profile.display_name, auth_user.name) AS displayName
         FROM points_user
         JOIN user auth_user ON auth_user.id = points_user.auth_user_id
         LEFT JOIN profiles profile ON profile.points_user_id = points_user.id
         WHERE points_user.account_status = 'ACTIVE'
           AND COALESCE(profile.visibility, 'PUBLIC') = 'PUBLIC'
           AND (points_user.id LIKE ? ESCAPE '\\' COLLATE NOCASE
             OR COALESCE(profile.display_name, auth_user.name) LIKE ? ESCAPE '\\' COLLATE NOCASE)
         ORDER BY displayName, pointsUserId LIMIT 20`,
      )
      .bind(pattern, pattern)
      .all<{ displayName: string; pointsUserId: string }>(),
    db
      .prepare(
        `SELECT criterion.id AS evaluationCriterionId, revision.name
         FROM evaluation_criterion criterion
         JOIN evaluation_criterion_revision revision ON revision.id = criterion.current_revision_id
         WHERE revision.status = 'ACTIVE'
           AND (criterion.id LIKE ? ESCAPE '\\' COLLATE NOCASE
             OR revision.name LIKE ? ESCAPE '\\' COLLATE NOCASE)
         ORDER BY revision.name, criterion.id LIMIT 20`,
      )
      .bind(pattern, pattern)
      .all<{ evaluationCriterionId: string; name: string }>(),
    db
      .prepare(
        `SELECT package.id AS pointPackageId,
                package.current_revision_id AS pointPackageRevisionId, revision.name
         FROM point_package package
         JOIN point_package_revision revision ON revision.id = package.current_revision_id
         WHERE package.lifecycle_status = 'ACTIVE' AND revision.status = 'ACTIVE'
           AND (package.id LIKE ? ESCAPE '\\' COLLATE NOCASE
             OR revision.name LIKE ? ESCAPE '\\' COLLATE NOCASE)
         ORDER BY revision.name, package.id LIMIT 20`,
      )
      .bind(pattern, pattern)
      .all<{ name: string; pointPackageId: string; pointPackageRevisionId: string }>(),
  ]);
  return {
    profiles: profiles.results.map((profile) => ({
      ...profile,
      canonicalUrl: `${PUBLIC_ORIGIN}/profiles/${encodeURIComponent(profile.pointsUserId)}`,
    })),
    evaluationCriteria: criteria.results,
    pointPackages: packages.results.map((pointPackage) => ({
      ...pointPackage,
      pointPackageRevisionUrl: `${PUBLIC_ORIGIN}/api/v1/point-package-revisions/${encodeURIComponent(pointPackage.pointPackageRevisionId)}`,
    })),
  };
}

export async function readPublicEvaluationCriterion(db: D1Database, evaluationCriterionId: string) {
  const criterion = await db
    .prepare(
      `SELECT criterion.id AS evaluationCriterionId,
              criterion.current_revision_id AS evaluationCriterionRevisionId,
              criterion.current_revision AS revision, current.name, current.description,
              current.minimum_unit_scaled AS minimumUnitScaled,
              current.transfer_enabled AS transferEnabled,
              current.exchange_enabled AS exchangeEnabled,
              current.balance_visible_by_default AS balanceVisibleByDefault,
              current.buy_now_enabled AS buyNowEnabled
       FROM evaluation_criterion criterion
       JOIN evaluation_criterion_revision current ON current.id = criterion.current_revision_id
       WHERE criterion.id = ? AND current.status = 'ACTIVE'`,
    )
    .bind(evaluationCriterionId)
    .first<{
      balanceVisibleByDefault: number;
      buyNowEnabled: number;
      description: string;
      evaluationCriterionId: string;
      evaluationCriterionRevisionId: string;
      exchangeEnabled: number;
      minimumUnitScaled: number;
      name: string;
      revision: number;
      transferEnabled: number;
    }>();
  if (!criterion) throw new PublicResourceNotFoundError();
  const urls = await db
    .prepare(
      `SELECT url FROM evaluation_criterion_related_url
       WHERE evaluation_criterion_revision_id = ? ORDER BY display_order`,
    )
    .bind(criterion.evaluationCriterionRevisionId)
    .all<{ url: string }>();
  return {
    evaluationCriterionId: criterion.evaluationCriterionId,
    evaluationCriterionRevisionId: criterion.evaluationCriterionRevisionId,
    revision: criterion.revision,
    name: criterion.name,
    description: criterion.description,
    minimumUnit: minimumUnit(criterion.minimumUnitScaled),
    transferEnabled: criterion.transferEnabled === 1,
    exchangeEnabled: criterion.exchangeEnabled === 1,
    balanceVisibleByDefault: criterion.balanceVisibleByDefault === 1,
    buyNowEnabled: criterion.buyNowEnabled === 1,
    relatedUrls: urls.results.map(({ url }) => url),
  };
}

export async function readPublicPointPackage(db: D1Database, pointPackageId: string) {
  const pointPackage = await db
    .prepare(
      `SELECT package.id AS pointPackageId,
              package.current_revision_id AS pointPackageRevisionId, revision.name
       FROM point_package package
       JOIN point_package_revision revision ON revision.id = package.current_revision_id
       WHERE package.id = ? AND package.lifecycle_status = 'ACTIVE'
         AND revision.status = 'ACTIVE'`,
    )
    .bind(pointPackageId)
    .first<{ name: string; pointPackageId: string; pointPackageRevisionId: string }>();
  if (!pointPackage) throw new PublicResourceNotFoundError();
  return {
    ...pointPackage,
    pointPackageRevisionUrl: `${PUBLIC_ORIGIN}/api/v1/point-package-revisions/${encodeURIComponent(pointPackage.pointPackageRevisionId)}`,
  };
}
