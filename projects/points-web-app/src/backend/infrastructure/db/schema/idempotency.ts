import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { pointsUsers } from "./points-user";

export const idempotencyResults = sqliteTable(
  "idempotency_results",
  {
    id: text("id").primaryKey(),
    actorPointsUserId: text("actor_points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "cascade" }),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: integer("status").notNull(),
    responseBody: text("response_body", { mode: "json" }).$type<unknown>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("idempotency_results_actor_operation_key_uidx").on(
      table.actorPointsUserId,
      table.operation,
      table.idempotencyKey,
    ),
    check("idempotency_results_key_check", sql`length(${table.idempotencyKey}) > 0`),
    check("idempotency_results_payload_hash_check", sql`length(${table.payloadHash}) = 64`),
    check("idempotency_results_status_check", sql`${table.status} between 100 and 599`),
    check("idempotency_results_response_body_check", sql`json_valid(${table.responseBody})`),
  ],
);
