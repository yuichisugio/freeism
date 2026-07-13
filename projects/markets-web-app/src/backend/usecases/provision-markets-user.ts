export interface MarketsUser {
  authUserId: string;
  id: string;
}

export async function provisionMarketsUser(
  db: D1Database,
  authUserId: string,
  createId: () => string = () => `musr_${crypto.randomUUID()}`,
): Promise<MarketsUser> {
  await db
    .prepare("INSERT OR IGNORE INTO markets_user (id, auth_user_id) VALUES (?, ?)")
    .bind(createId(), authUserId)
    .run();
  const user = await db
    .prepare("SELECT id, auth_user_id AS authUserId FROM markets_user WHERE auth_user_id = ?")
    .bind(authUserId)
    .first<MarketsUser>();
  if (!user) throw new Error("MARKETS_USER_PROVISION_FAILED");
  return user;
}
