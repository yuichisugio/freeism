const DAY = 24 * 60 * 60_000;
const RETENTION = 180 * DAY;

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function cleanupResolvedOpsAlerts(
  db: D1Database,
  now = new Date(),
): Promise<{ deleted: number; skipped: boolean }> {
  const requestId = `cron:ops-alert-cleanup:${utcDay(now)}`;
  const alreadyRan = await db
    .prepare(
      `SELECT 1 AS found FROM audit_event
       WHERE action = 'OPS_ALERT_CLEANUP' AND request_id = ? LIMIT 1`,
    )
    .bind(requestId)
    .first<{ found: number }>();
  if (alreadyRan) return { deleted: 0, skipped: true };

  const cutoff = now.getTime() - RETENTION;
  const count = await db
    .prepare(
      `SELECT count(*) AS count FROM ops_alert
       WHERE status = 'RESOLVED' AND resolved_at <= ?`,
    )
    .bind(cutoff)
    .first<{ count: number }>();
  const deleted = count?.count ?? 0;
  await db.batch([
    db.prepare("DELETE FROM ops_alert WHERE status = 'RESOLVED' AND resolved_at <= ?").bind(cutoff),
    db
      .prepare(
        `INSERT INTO audit_event
           (id, actor_points_user_id, action, target, reason, request_id, result, created_at)
         VALUES (?, NULL, 'OPS_ALERT_CLEANUP', 'ops_alert', ?, ?, 'SUCCEEDED', ?)`,
      )
      .bind(
        `audit_${crypto.randomUUID()}`,
        JSON.stringify({ cutoff: new Date(cutoff).toISOString(), deleted }),
        requestId,
        now.getTime(),
      ),
  ]);
  return { deleted, skipped: false };
}
