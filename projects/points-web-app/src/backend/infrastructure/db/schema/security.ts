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

export const turnstileTokenReplays = sqliteTable(
  "turnstile_token_replay",
  {
    tokenHash: text("token_hash").primaryKey(),
    operation: text("operation").notNull(),
    hostname: text("hostname").notNull(),
    action: text("action").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("turnstile_token_replay_expiry_idx").on(table.expiresAt),
    check("turnstile_token_hash_check", sql`length(${table.tokenHash}) = 64`),
    check("turnstile_operation_check", sql`length(${table.operation}) > 0`),
    check("turnstile_hostname_check", sql`length(${table.hostname}) > 0`),
    check("turnstile_action_check", sql`length(${table.action}) > 0`),
    check("turnstile_expiry_check", sql`${table.expiresAt} >= ${table.usedAt}`),
  ],
);
