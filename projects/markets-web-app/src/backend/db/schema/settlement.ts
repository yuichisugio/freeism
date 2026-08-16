import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { auctionRevisions, auctions, buyNowHolds } from "./auction";
import { marketsUsers } from "./markets-user";
import { pointsConnections } from "./points-connection";

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
    check(
      "settlement_plans_hash_check",
      sql`length(${table.planHash}) = 71 and substr(${table.planHash}, 1, 7) = 'sha256:' and substr(${table.planHash}, 8) not glob '*[^0-9a-f]*'`,
    ),
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
    check(
      "settlement_outbox_plan_hash_check",
      sql`length(${table.planHash}) = 71 and substr(${table.planHash}, 1, 7) = 'sha256:' and substr(${table.planHash}, 8) not glob '*[^0-9a-f]*'`,
    ),
    check("settlement_outbox_status_check", sql`${table.status} in ('PENDING', 'DISPATCHED')`),
    check("settlement_outbox_delivery_attempt_check", sql`${table.deliveryAttemptCount} >= 0`),
  ],
);

export const auctionCloseResumeOutbox = sqliteTable(
  "auction_close_resume_outbox",
  {
    id: text("id").primaryKey(),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    buyNowHoldId: text("buy_now_hold_id")
      .notNull()
      .references(() => buyNowHolds.id),
    status: text("status", { enum: ["PENDING", "DISPATCHED"] })
      .default("PENDING")
      .notNull(),
    settlementOutboxId: text("settlement_outbox_id"),
    createdAt: text("created_at").default(now).notNull(),
    dispatchedAt: text("dispatched_at"),
  },
  (table) => [
    uniqueIndex("auction_close_resume_outbox_hold_uidx").on(table.buyNowHoldId),
    index("auction_close_resume_outbox_status_idx").on(table.status, table.createdAt),
    check(
      "auction_close_resume_outbox_status_check",
      sql`${table.status} in ('PENDING', 'DISPATCHED')`,
    ),
  ],
);

export const settlementRounds = sqliteTable(
  "settlement_rounds",
  {
    id: text("id").primaryKey(),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    roundOrdinal: integer("round_ordinal").notNull(),
    planHash: text("plan_hash").notNull(),
    cutoffHash: text("cutoff_hash").notNull(),
    state: text("state", {
      enum: ["RESERVING", "RELEASING", "RELEASED", "RESERVED", "FAILED"],
    })
      .default("RESERVING")
      .notNull(),
    excludedUserIdsJson: text("excluded_user_ids_json").default("[]").notNull(),
    firstAttemptAt: text("first_attempt_at").notNull(),
    retryDeadlineAt: text("retry_deadline_at").notNull(),
    createdAt: text("created_at").default(now).notNull(),
    updatedAt: text("updated_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlement_rounds_ordinal_uidx").on(table.settlementId, table.roundOrdinal),
    check(
      "settlement_rounds_ordinal_check",
      sql`${table.roundOrdinal} between 1 and ${safeInteger}`,
    ),
    check(
      "settlement_rounds_plan_hash_check",
      sql`length(${table.planHash}) = 71 and substr(${table.planHash}, 1, 7) = 'sha256:' and substr(${table.planHash}, 8) not glob '*[^0-9a-f]*'`,
    ),
    check(
      "settlement_rounds_cutoff_hash_check",
      sql`length(${table.cutoffHash}) = 64 or (length(${table.cutoffHash}) = 71 and substr(${table.cutoffHash}, 1, 7) = 'sha256:')`,
    ),
    check("settlement_rounds_excluded_json_check", sql`json_valid(${table.excludedUserIdsJson})`),
    check(
      "settlement_rounds_deadline_check",
      sql`${table.retryDeadlineAt} >= ${table.firstAttemptAt}`,
    ),
    check(
      "settlement_rounds_state_check",
      sql`${table.state} in ('RESERVING', 'RELEASING', 'RELEASED', 'RESERVED', 'FAILED')`,
    ),
  ],
);

export const settlementRoundWinners = sqliteTable(
  "settlement_round_winners",
  {
    id: text("id").primaryKey(),
    settlementRoundId: text("settlement_round_id")
      .notNull()
      .references(() => settlementRounds.id),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    pointsConnectionId: text("points_connection_id").references(() => pointsConnections.id),
    allocationQuantity: integer("allocation_quantity").notNull(),
    priceTickCount: integer("price_tick_count").notNull(),
    priceTicks: integer("price_ticks").notNull(),
    reservationKey: text("reservation_key").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    status: text("status", {
      enum: ["PENDING", "ACTIVE", "REJECTED", "UNKNOWN", "RELEASED", "EXPIRED", "CAPTURED"],
    })
      .default("PENDING")
      .notNull(),
    pointReservationId: text("point_reservation_id"),
    vectorHash: text("vector_hash"),
    componentVectorJson: text("component_vector_json"),
    expiresAt: text("expires_at"),
    failureClass: text("failure_class"),
    failureCode: text("failure_code"),
    failureHash: text("failure_hash"),
    releaseReceiptId: text("release_receipt_id"),
    releaseContentHash: text("release_content_hash"),
    releasedAt: text("released_at"),
    pointsRequestId: text("points_request_id"),
    createdAt: text("created_at").default(now).notNull(),
    updatedAt: text("updated_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlement_round_winners_user_uidx").on(
      table.settlementRoundId,
      table.marketsUserId,
    ),
    uniqueIndex("settlement_round_winners_key_uidx").on(table.reservationKey),
    check(
      "settlement_round_winners_quantity_check",
      sql`${table.allocationQuantity} between 1 and 1000`,
    ),
    check(
      "settlement_round_winners_attempt_check",
      sql`${table.attemptCount} between 0 and ${safeInteger}`,
    ),
    check(
      "settlement_round_winners_status_check",
      sql`${table.status} in ('PENDING', 'ACTIVE', 'REJECTED', 'UNKNOWN', 'RELEASED', 'EXPIRED', 'CAPTURED')`,
    ),
    check(
      "settlement_round_winners_component_vector_check",
      sql`${table.componentVectorJson} is null or json_valid(${table.componentVectorJson})`,
    ),
  ],
);

export const settlementExclusions = sqliteTable(
  "settlement_exclusions",
  {
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    firstRoundOrdinal: integer("first_round_ordinal").notNull(),
    reason: text("reason", { enum: ["INSUFFICIENT_BALANCE", "REAUTH_REQUIRED"] }).notNull(),
    blacklistEventId: text("blacklist_event_id"),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlement_exclusions_user_uidx").on(table.settlementId, table.marketsUserId),
    check(
      "settlement_exclusions_round_check",
      sql`${table.firstRoundOrdinal} between 1 and ${safeInteger}`,
    ),
    check(
      "settlement_exclusions_reason_check",
      sql`${table.reason} in ('INSUFFICIENT_BALANCE', 'REAUTH_REQUIRED')`,
    ),
  ],
);
