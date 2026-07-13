import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { pointsUsers } from "./points-user";

export const auditEvents = sqliteTable("audit_event", {
  id: text("id").primaryKey(),
  actorPointsUserId: text("actor_points_user_id").references(() => pointsUsers.id, {
    onDelete: "restrict",
  }),
  action: text("action").notNull(),
  target: text("target").notNull(),
  reason: text("reason"),
  requestId: text("request_id").notNull(),
  result: text("result").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});
