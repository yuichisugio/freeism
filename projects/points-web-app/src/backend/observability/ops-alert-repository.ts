export const MANAGED_POINTS_ALERT_TYPES = [
  "OWNERSHIP_SCHEDULER_LAG",
  "COMMAND_OUTBOX_STUCK",
  "RECONCILIATION_MISMATCH",
] as const;

export type ManagedPointsAlertType = (typeof MANAGED_POINTS_ALERT_TYPES)[number];
export type OpsAlertStatus = "OPEN" | "RESOLVED";

export interface OpsAlertObservation {
  alertKey: string;
  resourceIdHash: string;
  safeDetailCode: string;
  type: ManagedPointsAlertType | "ALERT_DELIVERY_FAILED" | "REJECTION_AUDIT_FAILURE";
}

export interface OpsAlertRecord extends OpsAlertObservation {
  firstObservedAt: number;
  lastObservedAt: number;
  repeatCount: number;
  resolvedAt: number | null;
  status: OpsAlertStatus;
}

export async function observeOpsAlert(
  db: D1Database,
  observation: OpsAlertObservation,
  now: number,
): Promise<OpsAlertRecord> {
  const record = await db
    .prepare(
      `INSERT INTO ops_alert
         (alert_key, type, resource_id_hash, status, first_observed_at,
          last_observed_at, resolved_at, repeat_count, safe_detail_code)
       VALUES (?, ?, ?, 'OPEN', ?, ?, NULL, 1, ?)
       ON CONFLICT(alert_key) DO UPDATE SET
         type = excluded.type,
         resource_id_hash = excluded.resource_id_hash,
         status = 'OPEN',
         first_observed_at = CASE
           WHEN ops_alert.status = 'RESOLVED' THEN excluded.first_observed_at
           ELSE ops_alert.first_observed_at
         END,
         last_observed_at = excluded.last_observed_at,
         resolved_at = NULL,
         repeat_count = CASE
           WHEN ops_alert.status = 'RESOLVED' THEN 1
           ELSE ops_alert.repeat_count + 1
         END,
         safe_detail_code = excluded.safe_detail_code
       RETURNING alert_key AS alertKey, type, resource_id_hash AS resourceIdHash,
                 status, first_observed_at AS firstObservedAt,
                 last_observed_at AS lastObservedAt, resolved_at AS resolvedAt,
                 repeat_count AS repeatCount, safe_detail_code AS safeDetailCode`,
    )
    .bind(
      observation.alertKey,
      observation.type,
      observation.resourceIdHash,
      now,
      now,
      observation.safeDetailCode,
    )
    .first<OpsAlertRecord>();
  if (!record) throw new Error("OPS_ALERT_WRITE_FAILED");
  return record;
}

export async function resolveOpsAlert(
  db: D1Database,
  alertKey: string,
  now: number,
): Promise<OpsAlertRecord | null> {
  return db
    .prepare(
      `UPDATE ops_alert
       SET status = 'RESOLVED', last_observed_at = ?, resolved_at = ?
       WHERE alert_key = ? AND status = 'OPEN'
       RETURNING alert_key AS alertKey, type, resource_id_hash AS resourceIdHash,
                 status, first_observed_at AS firstObservedAt,
                 last_observed_at AS lastObservedAt, resolved_at AS resolvedAt,
                 repeat_count AS repeatCount, safe_detail_code AS safeDetailCode`,
    )
    .bind(now, now, alertKey)
    .first<OpsAlertRecord>();
}

export async function resolveUnobservedManagedAlerts(
  db: D1Database,
  observedKeys: ReadonlySet<string>,
  now: number,
): Promise<void> {
  const rows = await db
    .prepare(
      `SELECT alert_key AS alertKey FROM ops_alert
       WHERE status = 'OPEN' AND type IN (${MANAGED_POINTS_ALERT_TYPES.map(() => "?").join(", ")})`,
    )
    .bind(...MANAGED_POINTS_ALERT_TYPES)
    .all<{ alertKey: string }>();
  for (const row of rows.results) {
    if (!observedKeys.has(row.alertKey)) await resolveOpsAlert(db, row.alertKey, now);
  }
}

export async function listOpsAlertsDueForNotification(
  db: D1Database,
  now: number,
): Promise<OpsAlertRecord[]> {
  const oneHourAgo = now - 60 * 60_000;
  const rows = await db
    .prepare(
      `SELECT alert.alert_key AS alertKey, alert.type,
              alert.resource_id_hash AS resourceIdHash, alert.status,
              alert.first_observed_at AS firstObservedAt,
              alert.last_observed_at AS lastObservedAt,
              alert.resolved_at AS resolvedAt, alert.repeat_count AS repeatCount,
              alert.safe_detail_code AS safeDetailCode,
              (SELECT max(created_at) FROM audit_event notification
               WHERE notification.action = 'OPS_ALERT_NOTIFIED'
                 AND notification.target = alert.alert_key
                 AND notification.result = alert.status) AS lastStatusNotifiedAt
       FROM ops_alert alert
       WHERE alert.type != 'ALERT_DELIVERY_FAILED'
         AND (
           (alert.status = 'OPEN' AND (
             (SELECT max(created_at) FROM audit_event notification
              WHERE notification.action = 'OPS_ALERT_NOTIFIED'
                AND notification.target = alert.alert_key
                AND notification.result = 'OPEN') IS NULL
             OR (SELECT max(created_at) FROM audit_event notification
                 WHERE notification.action = 'OPS_ALERT_NOTIFIED'
                   AND notification.target = alert.alert_key
                   AND notification.result = 'OPEN') < alert.first_observed_at
             OR (SELECT max(created_at) FROM audit_event notification
                 WHERE notification.action = 'OPS_ALERT_NOTIFIED'
                   AND notification.target = alert.alert_key
                   AND notification.result = 'OPEN') <= ?
           ))
           OR (alert.status = 'RESOLVED' AND alert.resolved_at IS NOT NULL AND (
             (SELECT max(created_at) FROM audit_event notification
              WHERE notification.action = 'OPS_ALERT_NOTIFIED'
                AND notification.target = alert.alert_key
                AND notification.result = 'RESOLVED') IS NULL
             OR (SELECT max(created_at) FROM audit_event notification
                 WHERE notification.action = 'OPS_ALERT_NOTIFIED'
                   AND notification.target = alert.alert_key
                   AND notification.result = 'RESOLVED') < alert.resolved_at
           ))
         )
       ORDER BY alert.first_observed_at, alert.alert_key`,
    )
    .bind(oneHourAgo)
    .all<OpsAlertRecord>();
  return rows.results;
}

export async function recordOpsAlertNotification(
  db: D1Database,
  alert: OpsAlertRecord,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_event
         (id, actor_points_user_id, action, target, reason, request_id, result, created_at)
       VALUES (?, NULL, 'OPS_ALERT_NOTIFIED', ?, ?, ?, ?, ?)`,
    )
    .bind(
      `audit_${crypto.randomUUID()}`,
      alert.alertKey,
      JSON.stringify({ safeDetailCode: alert.safeDetailCode, type: alert.type }),
      `ops-alert:${alert.alertKey}:${now}`,
      alert.status,
      now,
    )
    .run();
}
