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

/**
 * 公開プロフィールを返す。
 * Accounts 連携は D1 に保存した取得結果の snapshot だけを読み、閲覧のたびに Accounts へ問い合わせない。
 * @see ../../../docs/v0.2/details-ja/profile-setting.md
 */
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

  const [accountsLinks, packages, evaluationAccounts] = await Promise.all([
    db
      .prepare(
        `SELECT link.accounts_origin AS accountsOrigin, link.accounts_user_id AS accountsUserId,
                link.external_accounts_fetched_at AS fetchedAt,
                link.external_accounts_json AS externalAccountsJson
         FROM accounts_links link
         WHERE link.points_user_id = ? AND link.provision_status = 'PROVIDED'
           AND link.external_accounts_json IS NOT NULL
         ORDER BY link.linked_at, link.id`,
      )
      .bind(pointsUserId)
      .all<{
        accountsOrigin: string;
        accountsUserId: string;
        externalAccountsJson: string;
        fetchedAt: number;
      }>(),
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
    accountsLinks: accountsLinks.results.map((link) => ({
      accountsOrigin: link.accountsOrigin,
      accountsUserId: link.accountsUserId,
      accountsProfileUrl: `${link.accountsOrigin}/profiles/${encodeURIComponent(link.accountsUserId)}`,
      fetchedAt: new Date(link.fetchedAt).toISOString(),
      externalAccounts: JSON.parse(link.externalAccountsJson) as unknown[],
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
