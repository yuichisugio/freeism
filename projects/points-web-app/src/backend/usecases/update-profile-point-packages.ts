export class DuplicatePointPackageError extends Error {
  constructor() {
    super("DUPLICATE_POINT_PACKAGE");
  }
}

export async function updateProfilePointPackages(
  db: D1Database,
  input: { pointsUserId: string; pointPackageIds: string[] },
): Promise<string[]> {
  if (new Set(input.pointPackageIds).size !== input.pointPackageIds.length) {
    throw new DuplicatePointPackageError();
  }

  const statements = [
    db
      .prepare("DELETE FROM profile_point_package WHERE points_user_id = ?")
      .bind(input.pointsUserId),
    ...input.pointPackageIds.map((pointPackageId, displayOrder) =>
      db
        .prepare(
          `INSERT INTO profile_point_package (id, points_user_id, point_package_id, display_order)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(
          `ppp_${input.pointsUserId}_${displayOrder}`,
          input.pointsUserId,
          pointPackageId,
          displayOrder,
        ),
    ),
  ];
  await db.batch(statements);
  return [...input.pointPackageIds];
}
