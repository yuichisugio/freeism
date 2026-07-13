export interface BootstrapInitialAdminInput {
  authUserId: string;
  initialGoogleAccountId: string;
  membershipId: string;
  pointsUserId: string;
}

export async function bootstrapInitialAdmin(
  db: D1Database,
  input: BootstrapInitialAdminInput,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO admin_membership (id, points_user_id, role)
       SELECT ?, ?, 'ADMIN'
       WHERE EXISTS (
         SELECT 1 FROM account
         WHERE user_id = ? AND provider_id = 'google' AND account_id = ?
       )
       AND EXISTS (
         SELECT 1 FROM points_user WHERE id = ? AND auth_user_id = ?
       )
       AND NOT EXISTS (SELECT 1 FROM admin_membership)
       ON CONFLICT(points_user_id) DO NOTHING`,
    )
    .bind(
      input.membershipId,
      input.pointsUserId,
      input.authUserId,
      input.initialGoogleAccountId,
      input.pointsUserId,
      input.authUserId,
    )
    .run();

  return result.meta.changes === 1;
}
