const DAY = 24 * 60 * 60_000;
const RETENTION = 180 * DAY;
const LEASE_KEY = "ops-alert-cleanup:daily";

function nextUtcDay(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}

export async function cleanupResolvedOpsAlerts(
  db: D1Database,
  now = new Date(),
  environment = "unknown",
): Promise<{ deleted: number; skipped: boolean }> {
  const nowIso = now.toISOString();
  const acquired = await db
    .prepare(
      `INSERT INTO ops_alert_cleanup_leases (lease_key, lease_expires_at)
       VALUES (?, ?)
       ON CONFLICT(lease_key) DO UPDATE SET lease_expires_at = excluded.lease_expires_at
       WHERE ops_alert_cleanup_leases.lease_expires_at <= ?
       RETURNING lease_key`,
    )
    .bind(LEASE_KEY, nextUtcDay(now), nowIso)
    .first<{ lease_key: string }>();
  if (!acquired) return { deleted: 0, skipped: true };

  const cutoff = new Date(now.getTime() - RETENTION).toISOString();
  const count = await db
    .prepare(
      `SELECT count(*) AS count FROM ops_alerts
       WHERE status = 'RESOLVED' AND resolved_at <= ?`,
    )
    .bind(cutoff)
    .first<{ count: number }>();
  const deleted = count?.count ?? 0;
  const day = nowIso.slice(0, 10);

  await db.batch([
    db
      .prepare("DELETE FROM ops_alerts WHERE status = 'RESOLVED' AND resolved_at <= ?")
      .bind(cutoff),
    db
      .prepare(
        `INSERT INTO audit_events
           (id, actor_markets_user_id, event_code, target_type, target_id,
            before_json, after_json, reason, request_id, environment, result, created_at)
         VALUES (?, NULL, 'OPS_ALERT_CLEANUP', 'ops_alerts', ?, NULL, ?,
                 'RESOLVED_RETENTION_EXPIRED', ?, ?, 'SUCCEEDED', ?)`,
      )
      .bind(
        `audit_${crypto.randomUUID()}`,
        day,
        JSON.stringify({ cutoff, deleted }),
        `cron:ops-alert-cleanup:${day}`,
        environment,
        nowIso,
      ),
  ]);

  return { deleted, skipped: false };
}
