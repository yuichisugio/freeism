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
            delivery_attempt_count, safe_detail_code)
         VALUES (?, ?, ?, ?, ?, 'OPEN', 0, ?)
         ON CONFLICT(dedupe_key) DO UPDATE SET
           last_seen_at = excluded.last_seen_at,
           status = 'OPEN',
           resolved_at = NULL,
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
}
