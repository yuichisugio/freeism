import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { auctionRevisions, auctions, buyNowHolds } from "./auction";
import { marketsUsers } from "./markets-user";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const safeInteger = sql.raw("9007199254740991");

export const settlementPlans = sqliteTable(
  "settlement_plans",
  {
    id: text("id").primaryKey(),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    auctionRevisionId: text("auction_revision_id")
      .notNull()
      .references(() => auctionRevisions.id),
    kind: text("kind", { enum: ["BUY_NOW"] }).notNull(),
    commandId: text("command_id").notNull(),
    buyNowHoldId: text("buy_now_hold_id")
      .notNull()
      .references(() => buyNowHolds.id),
    buyerMarketsUserId: text("buyer_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    quantity: integer("quantity").notNull(),
    priceTickCount: integer("price_tick_count").notNull(),
    planJson: text("plan_json").notNull(),
    status: text("status", { enum: ["PLANNED"] })
      .default("PLANNED")
      .notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlement_plans_buy_now_hold_uidx").on(table.buyNowHoldId),
    uniqueIndex("settlement_plans_auction_command_uidx").on(table.auctionId, table.commandId),
    check("settlement_plans_kind_check", sql`${table.kind} = 'BUY_NOW'`),
    check("settlement_plans_quantity_check", sql`${table.quantity} between 1 and 1000`),
    check(
      "settlement_plans_price_tick_count_check",
      sql`${table.priceTickCount} between 1 and ${safeInteger}`,
    ),
    check("settlement_plans_json_check", sql`json_valid(${table.planJson})`),
    check("settlement_plans_status_check", sql`${table.status} = 'PLANNED'`),
  ],
);

export const settlementOutbox = sqliteTable(
  "settlement_outbox",
  {
    id: text("id").primaryKey(),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlementPlans.id),
    workflowAttempt: integer("workflow_attempt").default(0).notNull(),
    status: text("status", { enum: ["PENDING"] })
      .default("PENDING")
      .notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlement_outbox_attempt_uidx").on(table.settlementId, table.workflowAttempt),
    check("settlement_outbox_attempt_check", sql`${table.workflowAttempt} = 0`),
    check("settlement_outbox_status_check", sql`${table.status} = 'PENDING'`),
  ],
);
