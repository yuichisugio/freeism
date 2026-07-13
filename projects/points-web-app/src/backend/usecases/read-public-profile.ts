const PUBLIC_ORIGIN = "https://points.freeism.app";

export class PublicResourceNotFoundError extends Error {
  constructor() {
    super("PUBLIC_RESOURCE_NOT_FOUND");
  }
}

function defaultDisplayName(name: string, pointsUserId: string) {
  const trimmed = name.trim();
  return (trimmed.length === 0 ? pointsUserId : trimmed).slice(0, 100);
}

function scaledAmount(value: number) {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 10_000);
  const fraction = String(absolute % 10_000)
    .padStart(4, "0")
    .replace(/0+$/, "");
  return `${sign}${whole}${fraction.length === 0 ? "" : `.${fraction}`}`;
}

export async function readPublicProfile(db: D1Database, pointsUserId: string) {
  const profile = await db
    .prepare(
      `SELECT points_user.id AS pointsUserId, auth_user.name AS authDisplayName,
              profile.display_name AS displayName, profile.description
       FROM points_user
       JOIN user auth_user ON auth_user.id = points_user.auth_user_id
       LEFT JOIN profiles profile ON profile.points_user_id = points_user.id
       WHERE points_user.id = ? AND points_user.account_status = 'ACTIVE'
         AND COALESCE(profile.visibility, 'PUBLIC') = 'PUBLIC'`,
    )
    .bind(pointsUserId)
    .first<{
      authDisplayName: string;
      description: string | null;
      displayName: string | null;
      pointsUserId: string;
    }>();
  if (!profile) throw new PublicResourceNotFoundError();

  const [identities, packages, evaluationAccounts] = await Promise.all([
    db
      .prepare(
        `SELECT ownership.identity_type AS identityType,
                ownership.normalized_identity_key AS profileUrl,
                ownership.verified_at AS verifiedAt
         FROM identity_ownership ownership
         JOIN ownership_epoch epoch
           ON epoch.id = ownership.current_ownership_epoch_id
          AND epoch.identity_ownership_id = ownership.id
          AND epoch.owner_points_user_id = ownership.points_user_id
          AND epoch.ended_at IS NULL
         WHERE ownership.points_user_id = ? AND ownership.status = 'ACTIVE'
         ORDER BY ownership.identity_type, ownership.normalized_identity_key`,
      )
      .bind(pointsUserId)
      .all<{ identityType: "GITHUB_OAUTH" | "WEB_URL"; profileUrl: string; verifiedAt: number }>(),
    db
      .prepare(
        `SELECT package.id AS pointPackageId,
                package.current_revision_id AS pointPackageRevisionId,
                revision.name, profile_package.display_order AS displayOrder
         FROM profile_point_package profile_package
         JOIN point_package package ON package.id = profile_package.point_package_id
         JOIN point_package_revision revision ON revision.id = package.current_revision_id
         WHERE profile_package.points_user_id = ?
           AND package.lifecycle_status = 'ACTIVE' AND revision.status = 'ACTIVE'
         ORDER BY profile_package.display_order`,
      )
      .bind(pointsUserId)
      .all<{
        displayOrder: number;
        name: string;
        pointPackageId: string;
        pointPackageRevisionId: string;
      }>(),
    db
      .prepare(
        `SELECT criterion.id AS evaluationCriterionId, revision.name,
                account.balance, account.evaluation_total AS evaluationTotal,
                COALESCE(visibility.balance_visibility,
                         CASE WHEN revision.balance_visible_by_default = 1
                              THEN 'PUBLIC' ELSE 'PRIVATE' END) AS balanceVisibility,
                COALESCE(visibility.evaluation_total_visibility, 'PRIVATE')
                  AS evaluationTotalVisibility
         FROM evaluation_criterion criterion
         JOIN evaluation_criterion_revision revision ON revision.id = criterion.current_revision_id
         LEFT JOIN point_account account
           ON account.evaluation_criterion_id = criterion.id AND account.points_user_id = ?
         LEFT JOIN profile_evaluation_visibility visibility
           ON visibility.evaluation_criterion_id = criterion.id AND visibility.points_user_id = ?
         WHERE revision.status = 'ACTIVE'
           AND (account.points_user_id IS NOT NULL OR visibility.points_user_id IS NOT NULL)
         ORDER BY criterion.id`,
      )
      .bind(pointsUserId, pointsUserId)
      .all<{
        balance: number | null;
        balanceVisibility: "PUBLIC" | "PRIVATE";
        evaluationCriterionId: string;
        evaluationTotal: number | null;
        evaluationTotalVisibility: "PUBLIC" | "PRIVATE";
        name: string;
      }>(),
  ]);

  return {
    canonicalUrl: `${PUBLIC_ORIGIN}/profiles/${encodeURIComponent(pointsUserId)}`,
    pointsUserId,
    displayName:
      profile.displayName ?? defaultDisplayName(profile.authDisplayName, profile.pointsUserId),
    description: profile.description ?? "",
    externalIdentities: identities.results.map((identity) => ({
      identityType: identity.identityType,
      profileUrl: identity.profileUrl,
      verifiedAt: new Date(identity.verifiedAt).toISOString(),
    })),
    pointPackages: packages.results.map((pointPackage) => ({
      ...pointPackage,
      pointPackageRevisionUrl: `${PUBLIC_ORIGIN}/api/v1/point-package-revisions/${encodeURIComponent(pointPackage.pointPackageRevisionId)}`,
    })),
    evaluationAccounts: evaluationAccounts.results.flatMap((account) => {
      const balanceIsPublic = account.balanceVisibility === "PUBLIC";
      const evaluationTotalIsPublic = account.evaluationTotalVisibility === "PUBLIC";
      if (!balanceIsPublic && !evaluationTotalIsPublic) return [];
      return [
        {
          evaluationCriterionId: account.evaluationCriterionId,
          name: account.name,
          ...(balanceIsPublic ? { balance: scaledAmount(account.balance ?? 0) } : {}),
          ...(evaluationTotalIsPublic
            ? { evaluationTotal: scaledAmount(account.evaluationTotal ?? 0) }
            : {}),
        },
      ];
    }),
  };
}
