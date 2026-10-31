import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appRateLimitWindows = sqliteTable(
  "app_rate_limit_window",
  {
    operation: text("operation").notNull(),
    subjectKeyHash: text("subject_key_hash").notNull(),
    windowStartedAt: integer("window_started_at", { mode: "timestamp_ms" }).notNull(),
    windowSeconds: integer("window_seconds").notNull(),
    requestCount: integer("request_count").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.operation, table.subjectKeyHash, table.windowStartedAt],
    }),
    index("app_rate_limit_window_expiry_idx").on(table.windowStartedAt, table.windowSeconds),
    check("app_rate_limit_operation_check", sql`length(${table.operation}) > 0`),
    check("app_rate_limit_subject_hash_check", sql`length(${table.subjectKeyHash}) = 64`),
    check("app_rate_limit_window_seconds_check", sql`${table.windowSeconds} > 0`),
    check("app_rate_limit_request_count_check", sql`${table.requestCount} > 0`),
  ],
);
