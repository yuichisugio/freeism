import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { auctions } from "./auction";
import { marketsUsers } from "./markets-user";
import { settlements } from "./settlement";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const settlementRetryRateEvents = sqliteTable(
  "settlement_retry_rate_events",
  {
    id: text("id").primaryKey(),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    idempotencyKey: text("idempotency_key").notNull(),
    reasonHash: text("reason_hash").notNull(),
    outboxId: text("outbox_id").notNull(),
    workflowAttempt: integer("workflow_attempt").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("settlement_retry_rate_events_idempotency_uidx").on(
      table.marketsUserId,
      table.idempotencyKey,
    ),
    index("settlement_retry_rate_events_lookup_idx").on(
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
