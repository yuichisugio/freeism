import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const opsAlertRecords = sqliteTable(
  "ops_alert",
  {
    alertKey: text("alert_key").primaryKey(),
    type: text("type").notNull(),
    resourceIdHash: text("resource_id_hash").notNull(),
    status: text("status", { enum: ["OPEN", "RESOLVED"] }).notNull(),
    firstObservedAt: integer("first_observed_at", { mode: "timestamp_ms" }).notNull(),
    lastObservedAt: integer("last_observed_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    repeatCount: integer("repeat_count").notNull(),
    safeDetailCode: text("safe_detail_code").notNull(),
  },
  (table) => [
    index("ops_alert_status_observed_idx").on(table.status, table.lastObservedAt),
    index("ops_alert_resolved_cleanup_idx").on(table.status, table.resolvedAt),
    check("ops_alert_status_check", sql`${table.status} in ('OPEN', 'RESOLVED')`),
    check("ops_alert_repeat_count_check", sql`${table.repeatCount} >= 1`),
  ],
);
