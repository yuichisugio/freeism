import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { auctionRevisions, auctions } from "./auction";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const safeInteger = sql.raw("9007199254740991");

export const settlements = sqliteTable(
  "settlements",
  {
    id: text("id").primaryKey(),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    kind: text("kind", { enum: ["END_OF_AUCTION", "BUY_NOW"] }).notNull(),
    sourceKey: text("source_key").notNull(),
    settlementRevision: integer("settlement_revision").default(1).notNull(),
    workflowAttempt: integer("workflow_attempt").default(0).notNull(),
    sagaState: text("saga_state", {
      enum: [
        "PLANNED",
        "RESERVING",
        "RESERVED",
        "CAPTURING",
        "CAPTURED",
        "FINALIZING",
        "SETTLED",
        "MANUAL_ACTION_REQUIRED",
      ],
    })
      .default("PLANNED")
      .notNull(),
    currentPlanId: text("current_plan_id").notNull(),
    createdAt: text("created_at").default(now).notNull(),
    updatedAt: text("updated_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlements_source_uidx").on(table.auctionId, table.kind, table.sourceKey),
    index("settlements_auction_state_idx").on(table.auctionId, table.sagaState),
    check("settlements_kind_check", sql`${table.kind} in ('END_OF_AUCTION', 'BUY_NOW')`),
    check(
      "settlements_revision_check",
      sql`${table.settlementRevision} between 1 and ${safeInteger}`,
    ),
    check("settlements_attempt_check", sql`${table.workflowAttempt} between 0 and ${safeInteger}`),
    check(
      "settlements_state_check",
      sql`${table.sagaState} in ('PLANNED', 'RESERVING', 'RESERVED', 'CAPTURING', 'CAPTURED', 'FINALIZING', 'SETTLED', 'MANUAL_ACTION_REQUIRED')`,
    ),
  ],
);

export const settlementPlans = sqliteTable(
  "settlement_plans",
  {
    id: text("id").primaryKey(),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    settlementRevision: integer("settlement_revision").notNull(),
    planJson: text("plan_json").notNull(),
    planHash: text("plan_hash").notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlement_plans_revision_uidx").on(table.settlementId, table.settlementRevision),
    check(
      "settlement_plans_revision_check",
      sql`${table.settlementRevision} between 1 and ${safeInteger}`,
    ),
    check("settlement_plans_json_check", sql`json_valid(${table.planJson})`),
    check("settlement_plans_hash_check", sql`length(${table.planHash}) = 64`),
  ],
);

export const auctionCloseCutoffs = sqliteTable(
  "auction_close_cutoffs",
  {
    auctionId: text("auction_id")
      .primaryKey()
      .references(() => auctions.id),
    auctionRevisionId: text("auction_revision_id")
      .notNull()
      .references(() => auctionRevisions.id),
    closedAuctionVersion: integer("closed_auction_version").notNull(),
    cutoffAt: text("cutoff_at").notNull(),
    maxBidSeq: integer("max_bid_seq").notNull(),
    eligibleBidIdsJson: text("eligible_bid_ids_json").notNull(),
    rankingInputHash: text("ranking_input_hash").notNull(),
    availableQuantity: integer("available_quantity").notNull(),
    pointPackageRevisionId: text("point_package_revision_id").notNull(),
    packageTick: integer("package_tick").notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    check(
      "auction_close_cutoffs_version_check",
      sql`${table.closedAuctionVersion} between 1 and ${safeInteger}`,
    ),
    check(
      "auction_close_cutoffs_bid_seq_check",
      sql`${table.maxBidSeq} between 0 and ${safeInteger}`,
    ),
    check(
      "auction_close_cutoffs_quantity_check",
      sql`${table.availableQuantity} between 0 and 1000`,
    ),
    check(
      "auction_close_cutoffs_package_tick_check",
      sql`${table.packageTick} between 1 and ${safeInteger}`,
    ),
    check(
      "auction_close_cutoffs_eligible_json_check",
      sql`json_valid(${table.eligibleBidIdsJson})`,
    ),
    check("auction_close_cutoffs_hash_check", sql`length(${table.rankingInputHash}) = 64`),
  ],
);

export const settlementOutbox = sqliteTable(
  "settlement_outbox",
  {
    id: text("id").primaryKey(),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    settlementRevision: integer("settlement_revision").notNull(),
    workflowAttempt: integer("workflow_attempt").default(0).notNull(),
    planHash: text("plan_hash").notNull(),
    workflowInstanceId: text("workflow_instance_id"),
    status: text("status", { enum: ["PENDING", "DISPATCHED"] })
      .default("PENDING")
      .notNull(),
    deliveryAttemptCount: integer("delivery_attempt_count").default(0).notNull(),
    lastErrorCode: text("last_error_code"),
    createdAt: text("created_at").default(now).notNull(),
    dispatchedAt: text("dispatched_at"),
  },
  (table) => [
    uniqueIndex("settlement_outbox_attempt_uidx").on(
      table.settlementId,
      table.settlementRevision,
      table.workflowAttempt,
    ),
    index("settlement_outbox_status_idx").on(table.status, table.createdAt),
    check(
      "settlement_outbox_revision_check",
      sql`${table.settlementRevision} between 1 and ${safeInteger}`,
    ),
    check(
      "settlement_outbox_attempt_check",
      sql`${table.workflowAttempt} between 0 and ${safeInteger}`,
    ),
    check("settlement_outbox_plan_hash_check", sql`length(${table.planHash}) = 64`),
    check("settlement_outbox_status_check", sql`${table.status} in ('PENDING', 'DISPATCHED')`),
    check("settlement_outbox_delivery_attempt_check", sql`${table.deliveryAttemptCount} >= 0`),
  ],
);
