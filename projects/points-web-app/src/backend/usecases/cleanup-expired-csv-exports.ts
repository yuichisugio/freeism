export async function cleanupExpiredCsvExports(db: D1Database, now = new Date()): Promise<number> {
  const count = await db
    .prepare("SELECT COUNT(*) AS count FROM csv_export_snapshot WHERE expires_at <= ?")
    .bind(now.getTime())
    .first<{ count: number }>();
  await db
    .prepare("DELETE FROM csv_export_snapshot WHERE expires_at <= ?")
    .bind(now.getTime())
    .run();
  return count?.count ?? 0;
}
