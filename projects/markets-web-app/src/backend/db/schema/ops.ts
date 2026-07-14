import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const opsAlerts = sqliteTable(
  "ops_alerts",
  {
    dedupeKey: text("dedupe_key").primaryKey(),
    signal: text("signal").notNull(),
    severity: text("severity", { enum: ["INFO", "WARNING", "CRITICAL"] }).notNull(),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    resolvedAt: text("resolved_at"),
    status: text("status", { enum: ["OPEN", "RESOLVED"] }).notNull(),
    deliveryAttemptCount: integer("delivery_attempt_count").default(0).notNull(),
    repeatCount: integer("repeat_count").default(1).notNull(),
    safeDetailCode: text("safe_detail_code").notNull(),
  },
  (table) => [
    index("ops_alerts_status_seen_idx").on(table.status, table.lastSeenAt),
    index("ops_alerts_status_resolved_at_idx").on(table.status, table.resolvedAt),
    check("ops_alerts_severity_check", sql`${table.severity} in ('INFO', 'WARNING', 'CRITICAL')`),
    check("ops_alerts_status_check", sql`${table.status} in ('OPEN', 'RESOLVED')`),
    check("ops_alerts_delivery_attempt_check", sql`${table.deliveryAttemptCount} >= 0`),
    check("ops_alerts_repeat_count_check", sql`${table.repeatCount} >= 1`),
  ],
);

export const opsAlertCleanupLeases = sqliteTable("ops_alert_cleanup_leases", {
  leaseKey: text("lease_key").primaryKey(),
  leaseExpiresAt: text("lease_expires_at").notNull(),
});
