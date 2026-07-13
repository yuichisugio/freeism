import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { pointsUsers } from "./points-user";

export const permanentOAuthSubjects = sqliteTable(
  "permanent_oauth_subject",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("permanent_oauth_subject_provider_account_uidx").on(
      table.providerId,
      table.accountId,
    ),
    check(
      "permanent_oauth_subject_provider_check",
      sql`${table.providerId} in ('google', 'github')`,
    ),
    check("permanent_oauth_subject_account_check", sql`length(${table.accountId}) > 0`),
  ],
);
