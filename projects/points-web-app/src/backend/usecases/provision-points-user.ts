export interface PointsUser {
  id: string;
  authUserId: string;
}

export async function provisionPointsUser(
  db: D1Database,
  authUserId: string,
  createId: () => string = () => `pusr_${crypto.randomUUID()}`,
): Promise<PointsUser> {
  await db
    .prepare("INSERT OR IGNORE INTO points_user (id, auth_user_id) VALUES (?, ?)")
    .bind(createId(), authUserId)
    .run();

  const user = await db
    .prepare("SELECT id, auth_user_id AS authUserId FROM points_user WHERE auth_user_id = ?")
    .bind(authUserId)
    .first<PointsUser>();
  if (!user) {
    throw new Error("POINTS_USER_PROVISION_FAILED");
  }
  return user;
}
