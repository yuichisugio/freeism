import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { pointsUsers } from "./points-user";

export const profiles = sqliteTable(
  "profiles",
  {
    pointsUserId: text("points_user_id")
      .primaryKey()
      .references(() => pointsUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    description: text("description").default("").notNull(),
    externalUrls: text("external_urls", { mode: "json" }).$type<string[]>().default([]).notNull(),
    visibility: text("visibility", { enum: ["PUBLIC", "PRIVATE"] })
      .default("PUBLIC")
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    check(
      "profiles_display_name_length_check",
      sql`length(${table.displayName}) between 1 and 100`,
    ),
    check("profiles_description_length_check", sql`length(${table.description}) <= 500`),
    check(
      "profiles_external_urls_check",
      sql`json_valid(${table.externalUrls}) and json_type(${table.externalUrls}) = 'array' and json_array_length(${table.externalUrls}) <= 30`,
    ),
    check("profiles_visibility_check", sql`${table.visibility} in ('PUBLIC', 'PRIVATE')`),
  ],
);
