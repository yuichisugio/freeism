export interface MarketsOpsAlertRecord {
  dedupeKey: string;
  deliveryAttemptCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  repeatCount: number;
  resolvedAt: string | null;
  safeDetailCode: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  signal: string;
  status: "OPEN" | "RESOLVED";
}

export class OpsAlertRepository {
  constructor(private readonly database: D1Database) {}

  async observe(input: {
    dedupeKey: string;
    safeDetailCode: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    signal: string;
    seenAt: string;
  }) {
    await this.database
      .prepare(
        `INSERT INTO ops_alerts
           (dedupe_key, signal, severity, first_seen_at, last_seen_at, status,
            delivery_attempt_count, repeat_count, safe_detail_code)
         VALUES (?, ?, ?, ?, ?, 'OPEN', 0, 1, ?)
         ON CONFLICT(dedupe_key) DO UPDATE SET
           signal = excluded.signal,
           severity = excluded.severity,
           first_seen_at = CASE
             WHEN ops_alerts.status = 'RESOLVED' THEN excluded.first_seen_at
             ELSE ops_alerts.first_seen_at
           END,
           last_seen_at = excluded.last_seen_at,
           status = 'OPEN',
           resolved_at = NULL,
           repeat_count = CASE
             WHEN ops_alerts.status = 'RESOLVED' THEN 1
             ELSE ops_alerts.repeat_count + 1
           END,
           safe_detail_code = excluded.safe_detail_code`,
      )
      .bind(
        input.dedupeKey,
        input.signal,
        input.severity,
        input.seenAt,
        input.seenAt,
        input.safeDetailCode,
      )
      .run();
  }

  async resolve(dedupeKey: string, resolvedAt: string) {
    await this.database
      .prepare(
        `UPDATE ops_alerts
            SET status = 'RESOLVED', resolved_at = ?, last_seen_at = ?
          WHERE dedupe_key = ? AND status = 'OPEN'`,
      )
      .bind(resolvedAt, resolvedAt, dedupeKey)
      .run();
  }

  async resolveUnobserved(observedKeys: ReadonlySet<string>, resolvedAt: string) {
    const open = await this.database
      .prepare(
        "SELECT dedupe_key AS dedupeKey FROM ops_alerts WHERE status = 'OPEN' AND signal = 'SETTLEMENT_OUTBOX_STUCK'",
      )
      .all<{ dedupeKey: string }>();
    for (const alert of open.results) {
      if (!observedKeys.has(alert.dedupeKey)) await this.resolve(alert.dedupeKey, resolvedAt);
    }
  }

  async listDueForNotification(now: string): Promise<MarketsOpsAlertRecord[]> {
    const oneHourAgo = new Date(Date.parse(now) - 60 * 60_000).toISOString();
    const rows = await this.database
      .prepare(
        `SELECT alert.dedupe_key AS dedupeKey, alert.signal, alert.severity,
                alert.first_seen_at AS firstSeenAt, alert.last_seen_at AS lastSeenAt,
                alert.resolved_at AS resolvedAt, alert.status,
                alert.delivery_attempt_count AS deliveryAttemptCount,
                alert.repeat_count AS repeatCount, alert.safe_detail_code AS safeDetailCode
         FROM ops_alerts alert
         WHERE alert.signal != 'ALERT_DELIVERY_FAILED' AND (
           (alert.status = 'OPEN' AND (
             (SELECT max(created_at) FROM audit_events notification
              WHERE notification.event_code = 'OPS_ALERT_NOTIFIED'
                AND notification.target_id = alert.dedupe_key
                AND notification.result = 'OPEN') IS NULL
             OR (SELECT max(created_at) FROM audit_events notification
                 WHERE notification.event_code = 'OPS_ALERT_NOTIFIED'
                   AND notification.target_id = alert.dedupe_key
                   AND notification.result = 'OPEN') < alert.first_seen_at
             OR (SELECT max(created_at) FROM audit_events notification
                 WHERE notification.event_code = 'OPS_ALERT_NOTIFIED'
                   AND notification.target_id = alert.dedupe_key
                   AND notification.result = 'OPEN') <= ?
           ))
           OR (alert.status = 'RESOLVED' AND alert.resolved_at IS NOT NULL AND (
             (SELECT max(created_at) FROM audit_events notification
              WHERE notification.event_code = 'OPS_ALERT_NOTIFIED'
                AND notification.target_id = alert.dedupe_key
                AND notification.result = 'RESOLVED') IS NULL
             OR (SELECT max(created_at) FROM audit_events notification
                 WHERE notification.event_code = 'OPS_ALERT_NOTIFIED'
                   AND notification.target_id = alert.dedupe_key
                   AND notification.result = 'RESOLVED') < alert.resolved_at
           ))
         )
         ORDER BY alert.first_seen_at, alert.dedupe_key`,
      )
      .bind(oneHourAgo)
      .all<MarketsOpsAlertRecord>();
    return rows.results;
  }

  async recordDeliveryAttempt(dedupeKey: string) {
    await this.database
      .prepare(
        `UPDATE ops_alerts SET delivery_attempt_count = delivery_attempt_count + 1
         WHERE dedupe_key = ?`,
      )
      .bind(dedupeKey)
      .run();
  }

  async recordNotification(alert: MarketsOpsAlertRecord, now: string, environment: string) {
    await this.database
      .prepare(
        `INSERT INTO audit_events
           (id, actor_markets_user_id, event_code, target_type, target_id,
            before_json, after_json, reason, request_id, environment, result, created_at)
         VALUES (?, NULL, 'OPS_ALERT_NOTIFIED', 'ops_alerts', ?, NULL, ?,
                 'OPS_ALERT_DELIVERED', ?, ?, ?, ?)`,
      )
      .bind(
        `audit_${crypto.randomUUID()}`,
        alert.dedupeKey,
        JSON.stringify({ safeDetailCode: alert.safeDetailCode, signal: alert.signal }),
        `ops-alert:${alert.dedupeKey}:${now}`,
        environment,
        alert.status,
        now,
      )
      .run();
  }
}
