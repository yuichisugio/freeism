import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const pointsUsers = sqliteTable(
  "points_user",
  {
    id: text("id").primaryKey(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountStatus: text("account_status", { enum: ["ACTIVE", "CLOSED"] })
      .default("ACTIVE")
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("points_user_auth_user_id_uidx").on(table.authUserId),
    check("points_user_account_status_check", sql`${table.accountStatus} in ('ACTIVE', 'CLOSED')`),
  ],
);
