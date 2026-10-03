import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Marketsが管理するPoints互換サービス。鍵は停止後の精算が終わるまで保持する。 */
export const pointsProviders = sqliteTable(
  "points_provider",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    origin: text("origin").notNull(),
    issuer: text("issuer").notNull(),
    resource: text("resource").notNull(),
    clientId: text("client_id"),
    clientPublicJwk: text("client_public_jwk").notNull(),
    signingKeyCiphertext: text("signing_key_ciphertext"),
    dpopKeyCiphertext: text("dpop_key_ciphertext"),
    status: text("status", { enum: ["PENDING_CLIENT_REGISTRATION", "ACTIVE", "STOPPED"] })
      .default("PENDING_CLIENT_REGISTRATION")
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
    stoppedAt: integer("stopped_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("points_provider_origin_uidx").on(table.origin),
    index("points_provider_status_idx").on(table.status),
    check(
      "points_provider_status_check",
      sql`${table.status} in ('PENDING_CLIENT_REGISTRATION', 'ACTIVE', 'STOPPED')`,
    ),
  ],
);

export type PointsProvider = typeof pointsProviders.$inferSelect;
