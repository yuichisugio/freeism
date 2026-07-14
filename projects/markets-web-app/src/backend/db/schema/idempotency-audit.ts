import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { marketsUsers } from "./markets-user";

export const idempotencyResults = sqliteTable(
  "idempotency_results",
  {
    id: text("id").primaryKey(),
    actorMarketsUserId: text("actor_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    state: text("state", { enum: ["PENDING", "COMPLETED"] })
      .default("PENDING")
      .notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    responseContentType: text("response_content_type"),
    createdAt: text("created_at")
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
      .notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("idempotency_results_actor_operation_key_uidx").on(
      table.actorMarketsUserId,
      table.operation,
      table.idempotencyKey,
    ),
    check("idempotency_results_key_check", sql`length(${table.idempotencyKey}) between 1 and 200`),
    check("idempotency_results_payload_hash_check", sql`length(${table.payloadHash}) = 64`),
    check("idempotency_results_state_check", sql`${table.state} in ('PENDING', 'COMPLETED')`),
    check(
      "idempotency_results_response_status_check",
      sql`${table.responseStatus} is null or ${table.responseStatus} between 100 and 599`,
    ),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorMarketsUserId: text("actor_markets_user_id").references(() => marketsUsers.id),
    eventCode: text("event_code").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    reason: text("reason"),
    requestId: text("request_id").notNull(),
    environment: text("environment").notNull(),
    result: text("result").notNull(),
    createdAt: text("created_at")
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
      .notNull(),
  },
  (table) => [
    index("audit_events_target_idx").on(table.targetType, table.targetId, table.createdAt),
    check(
      "audit_events_before_json_check",
      sql`${table.beforeJson} is null or json_valid(${table.beforeJson})`,
    ),
    check(
      "audit_events_after_json_check",
      sql`${table.afterJson} is null or json_valid(${table.afterJson})`,
    ),
  ],
);
