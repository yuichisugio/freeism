import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { pointsUsers } from "./points-user";

export const adminMemberships = sqliteTable(
  "admin_membership",
  {
    id: text("id").primaryKey(),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    role: text("role").default("ADMIN").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("admin_membership_points_user_id_uidx").on(table.pointsUserId),
    check("admin_membership_role_check", sql`${table.role} = 'ADMIN'`),
  ],
);
