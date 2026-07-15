import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { auctions } from "./auction";
import { marketsUsers } from "./markets-user";
import { settlements } from "./settlement";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const settlementRetryAuthorizations = sqliteTable(
  "settlement_retry_authorizations",
  {
    id: text("id").primaryKey(),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    authUserId: text("auth_user_id").notNull(),
    sessionId: text("session_id").notNull(),
    stateHash: text("state_hash").notNull(),
    pkceVerifier: text("pkce_verifier").notNull(),
    nonce: text("nonce").notNull(),
    callbackUri: text("callback_uri").notNull(),
    returnPath: text("return_path").notNull(),
    reasonHash: text("reason_hash").notNull(),
    pointsAdminSubjectHash: text("points_admin_subject_hash"),
    assertionJti: text("assertion_jti"),
    status: text("status", { enum: ["STARTED", "PENDING", "USED", "EXPIRED"] }).notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: text("created_at").default(now).notNull(),
    updatedAt: text("updated_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlement_retry_authorizations_state_uidx").on(table.stateHash),
    uniqueIndex("settlement_retry_authorizations_jti_uidx").on(table.assertionJti),
    index("settlement_retry_authorizations_target_idx").on(
      table.settlementId,
      table.marketsUserId,
      table.createdAt,
    ),
    check(
      "settlement_retry_authorizations_status_check",
      sql`${table.status} in ('STARTED', 'PENDING', 'USED', 'EXPIRED')`,
    ),
    check(
      "settlement_retry_authorizations_reason_hash_check",
      sql`length(${table.reasonHash}) = 71`,
    ),
  ],
);

export const settlementRetryAssertionJtis = sqliteTable(
  "settlement_retry_assertion_jtis",
  {
    jti: text("jti").primaryKey(),
    authorizationId: text("authorization_id")
      .notNull()
      .references(() => settlementRetryAuthorizations.id),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    sessionId: text("session_id").notNull(),
    reasonHash: text("reason_hash").notNull(),
    pointsAdminSubjectHash: text("points_admin_subject_hash").notNull(),
    status: text("status", { enum: ["PENDING", "USED"] }).notNull(),
    expiresAt: integer("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlement_retry_assertion_authorization_uidx").on(table.authorizationId),
    check(
      "settlement_retry_assertion_jtis_status_check",
      sql`${table.status} in ('PENDING', 'USED')`,
    ),
    check(
      "settlement_retry_assertion_jtis_reason_hash_check",
      sql`length(${table.reasonHash}) = 71`,
    ),
  ],
);

export const settlementRetryRateEvents = sqliteTable(
  "settlement_retry_rate_events",
  {
    id: text("id").primaryKey(),
    jti: text("jti").notNull(),
    pointsAdminSubjectHash: text("points_admin_subject_hash").notNull(),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("settlement_retry_rate_events_jti_uidx").on(table.jti),
    index("settlement_retry_rate_events_lookup_idx").on(
      table.pointsAdminSubjectHash,
      table.marketsUserId,
      table.auctionId,
      table.createdAt,
    ),
  ],
);

export const settlementReconciliationLeases = sqliteTable("settlement_reconciliation_leases", {
  settlementId: text("settlement_id")
    .primaryKey()
    .references(() => settlements.id),
  leaseToken: text("lease_token").notNull(),
  leaseExpiresAt: integer("lease_expires_at").notNull(),
  updatedAt: text("updated_at").default(now).notNull(),
});
