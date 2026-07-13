export async function reapExpiredPointsLinkAttempts(
  db: D1Database,
  now = new Date(),
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE points_oauth_link_attempt
       SET status = 'CANCELLED', finalized_at = ?
       WHERE status = 'PENDING_MARKETS_CONFIRMATION' AND expires_at <= ?`,
    )
    .bind(now.getTime(), now.getTime())
    .run();
  return result.meta.changes ?? 0;
}
