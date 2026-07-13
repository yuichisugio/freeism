import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { marketsUsers } from "./markets-user";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const safeInteger = sql.raw("9007199254740991");

export const auctions = sqliteTable(
  "auctions",
  {
    id: text("id").primaryKey(),
    sellerMarketsUserId: text("seller_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    currentRevisionId: text("current_revision_id"),
    status: text("status", {
      enum: [
        "DRAFT",
        "SCHEDULED",
        "OPEN",
        "CLOSING",
        "SETTLING",
        "SETTLED",
        "CANCELLED",
        "SETTLEMENT_RETRYABLE",
        "SETTLEMENT_MANUAL_ACTION_REQUIRED",
      ],
    })
      .default("DRAFT")
      .notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: text("created_at").default(now).notNull(),
    updatedAt: text("updated_at").default(now).notNull(),
  },
  (table) => [
    index("auctions_seller_status_idx").on(table.sellerMarketsUserId, table.status),
    check(
      "auctions_status_check",
      sql`${table.status} in ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSING', 'SETTLING', 'SETTLED', 'CANCELLED', 'SETTLEMENT_RETRYABLE', 'SETTLEMENT_MANUAL_ACTION_REQUIRED')`,
    ),
    check("auctions_version_check", sql`${table.version} between 1 and ${safeInteger}`),
  ],
);

export const pointPackageSnapshots = sqliteTable(
  "point_package_snapshots",
  {
    id: text("id").primaryKey(),
    pointPackageId: text("point_package_id").notNull(),
    pointPackageRevisionId: text("point_package_revision_id").notNull(),
    name: text("name").notNull(),
    totalWeight: integer("total_weight").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("point_package_snapshots_revision_uidx").on(table.pointPackageRevisionId),
    check(
      "point_package_snapshots_total_weight_check",
      sql`${table.totalWeight} between 1 and ${safeInteger}`,
    ),
  ],
);

export const pointPackageSnapshotComponents = sqliteTable(
  "point_package_snapshot_components",
  {
    id: text("id").primaryKey(),
    pointPackageSnapshotId: text("point_package_snapshot_id")
      .notNull()
      .references(() => pointPackageSnapshots.id),
    evaluationCriterionId: text("evaluation_criterion_id").notNull(),
    evaluationCriterionRevisionId: text("evaluation_criterion_revision_id").notNull(),
    evaluationCriterionName: text("evaluation_criterion_name").notNull(),
    weight: integer("weight").notNull(),
    minimumUnitScaled: integer("minimum_unit_scaled").notNull(),
    displayOrder: integer("display_order").notNull(),
  },
  (table) => [
    uniqueIndex("point_package_snapshot_components_criterion_uidx").on(
      table.pointPackageSnapshotId,
      table.evaluationCriterionId,
    ),
    uniqueIndex("point_package_snapshot_components_order_uidx").on(
      table.pointPackageSnapshotId,
      table.displayOrder,
    ),
    check(
      "point_package_snapshot_components_weight_check",
      sql`${table.weight} between 1 and ${safeInteger}`,
    ),
    check(
      "point_package_snapshot_components_unit_check",
      sql`${table.minimumUnitScaled} between 1 and ${safeInteger}`,
    ),
    check("point_package_snapshot_components_order_check", sql`${table.displayOrder} >= 0`),
  ],
);

export const auctionRevisions = sqliteTable(
  "auction_revisions",
  {
    id: text("id").primaryKey(),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    revisionNumber: integer("revision_number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    externalUrl: text("external_url").notNull(),
    sellerIdentitySnapshot: text("seller_identity_snapshot").notNull(),
    pointsIssuer: text("points_issuer").notNull(),
    pointPackageSnapshotId: text("point_package_snapshot_id")
      .notNull()
      .references(() => pointPackageSnapshots.id),
    quantity: integer("quantity").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    packageTick: integer("package_tick").notNull(),
    buyNowPriceTickCount: integer("buy_now_price_tick_count"),
    extensionRuleJson: text("extension_rule_json"),
    eligibilityReceiptId: text("eligibility_receipt_id").notNull(),
    auctionCommandId: text("auction_command_id").notNull(),
    auctionCommandHash: text("auction_command_hash").notNull(),
    packageEligibilityVersion: integer("package_eligibility_version").notNull(),
    eligibilityCheckedAt: text("eligibility_checked_at").notNull(),
    eligibilityValidUntil: text("eligibility_valid_until").notNull(),
    commitStartedAt: text("commit_started_at").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("auction_revisions_number_uidx").on(table.auctionId, table.revisionNumber),
    check(
      "auction_revisions_revision_check",
      sql`${table.revisionNumber} between 1 and ${safeInteger}`,
    ),
    check("auction_revisions_quantity_check", sql`${table.quantity} between 1 and 1000`),
    check(
      "auction_revisions_package_tick_check",
      sql`${table.packageTick} between 1 and ${safeInteger}`,
    ),
    check(
      "auction_revisions_buy_now_tick_count_check",
      sql`${table.buyNowPriceTickCount} is null or ${table.buyNowPriceTickCount} between 1 and ${safeInteger}`,
    ),
    check(
      "auction_revisions_seller_snapshot_check",
      sql`json_valid(${table.sellerIdentitySnapshot})`,
    ),
    check(
      "auction_revisions_extension_rule_check",
      sql`${table.extensionRuleJson} is null or json_valid(${table.extensionRuleJson})`,
    ),
  ],
);

export const auctionCommands = sqliteTable(
  "auction_commands",
  {
    id: text("id").primaryKey(),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    commandId: text("command_id").notNull(),
    actorMarketsUserId: text("actor_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    operation: text("operation").notNull(),
    payloadHash: text("payload_hash").notNull(),
    expectedAuctionVersion: integer("expected_auction_version").notNull(),
    status: text("status").notNull(),
    responseBody: text("response_body"),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("auction_commands_auction_command_uidx").on(table.auctionId, table.commandId),
    check("auction_commands_payload_hash_check", sql`length(${table.payloadHash}) = 64`),
    check(
      "auction_commands_expected_version_check",
      sql`${table.expectedAuctionVersion} between 1 and ${safeInteger}`,
    ),
  ],
);

export const bidPositions = sqliteTable(
  "bid_positions",
  {
    id: text("id").primaryKey(),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    bidderMarketsUserId: text("bidder_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    quantity: integer("quantity").notNull(),
    priceTickCount: integer("price_tick_count").notNull(),
    reachedSequence: integer("reached_sequence").notNull(),
    status: text("status", { enum: ["ACTIVE", "INACTIVE"] })
      .default("ACTIVE")
      .notNull(),
    updatedAt: text("updated_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("bid_positions_active_user_uidx").on(table.auctionId, table.bidderMarketsUserId),
    check("bid_positions_quantity_check", sql`${table.quantity} between 1 and 1000`),
    check(
      "bid_positions_price_tick_count_check",
      sql`${table.priceTickCount} between 0 and ${safeInteger}`,
    ),
    check(
      "bid_positions_reached_sequence_check",
      sql`${table.reachedSequence} between 1 and ${safeInteger}`,
    ),
    check("bid_positions_status_check", sql`${table.status} in ('ACTIVE', 'INACTIVE')`),
  ],
);

export const bidEvents = sqliteTable(
  "bid_events",
  {
    id: text("id").primaryKey(),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    bidSeq: integer("bid_seq").notNull(),
    bidderMarketsUserId: text("bidder_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    commandId: text("command_id").notNull(),
    eventType: text("event_type").notNull(),
    quantity: integer("quantity").notNull(),
    priceTickCount: integer("price_tick_count").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("bid_events_auction_sequence_uidx").on(table.auctionId, table.bidSeq),
    check("bid_events_bid_seq_check", sql`${table.bidSeq} between 1 and ${safeInteger}`),
    check("bid_events_quantity_check", sql`${table.quantity} between 1 and 1000`),
    check(
      "bid_events_price_tick_count_check",
      sql`${table.priceTickCount} between 0 and ${safeInteger}`,
    ),
  ],
);

export const autoBidRules = sqliteTable(
  "auto_bid_rules",
  {
    id: text("id").primaryKey(),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    bidderMarketsUserId: text("bidder_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    quantity: integer("quantity").notNull(),
    autoBidMaxTickCount: integer("auto_bid_max_tick_count").notNull(),
    active: integer("active", { mode: "boolean" }).default(true).notNull(),
    createdAt: text("created_at").default(now).notNull(),
    updatedAt: text("updated_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("auto_bid_rules_auction_user_uidx").on(table.auctionId, table.bidderMarketsUserId),
    check("auto_bid_rules_quantity_check", sql`${table.quantity} between 1 and 1000`),
    check(
      "auto_bid_rules_max_tick_count_check",
      sql`${table.autoBidMaxTickCount} between 0 and ${safeInteger}`,
    ),
    check("auto_bid_rules_active_check", sql`${table.active} in (0, 1)`),
  ],
);

export const buyNowHolds = sqliteTable(
  "buy_now_holds",
  {
    id: text("id").primaryKey(),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    buyerMarketsUserId: text("buyer_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    quantity: integer("quantity").notNull(),
    buyNowPriceTickCount: integer("buy_now_price_tick_count").notNull(),
    status: text("status", {
      enum: ["PENDING", "CAPTURED_PENDING_FINALIZE", "SETTLED", "FAILED_RESTORED"],
    }).notNull(),
    createdAt: text("created_at").default(now).notNull(),
    updatedAt: text("updated_at").default(now).notNull(),
  },
  (table) => [
    index("buy_now_holds_auction_status_idx").on(table.auctionId, table.status),
    check("buy_now_holds_quantity_check", sql`${table.quantity} between 1 and 1000`),
    check(
      "buy_now_holds_price_tick_count_check",
      sql`${table.buyNowPriceTickCount} between 1 and ${safeInteger}`,
    ),
    check(
      "buy_now_holds_status_check",
      sql`${table.status} in ('PENDING', 'CAPTURED_PENDING_FINALIZE', 'SETTLED', 'FAILED_RESTORED')`,
    ),
  ],
);

export const auctionBlacklistEvents = sqliteTable(
  "auction_blacklist_events",
  {
    id: text("id").primaryKey(),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    reasonCode: text("reason_code").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("auction_blacklist_events_user_uidx").on(table.auctionId, table.marketsUserId),
  ],
);

export const websocketSlotLeases = sqliteTable(
  "websocket_slot_leases",
  {
    id: text("id").primaryKey(),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    userSlot: integer("user_slot").notNull(),
    auctionSlot: integer("auction_slot").notNull(),
    leaseExpiresAt: text("lease_expires_at").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("websocket_slot_leases_user_slot_uidx").on(table.marketsUserId, table.userSlot),
    uniqueIndex("websocket_slot_leases_auction_slot_uidx").on(
      table.marketsUserId,
      table.auctionId,
      table.auctionSlot,
    ),
    check("websocket_slot_leases_user_slot_check", sql`${table.userSlot} between 1 and 20`),
    check("websocket_slot_leases_auction_slot_check", sql`${table.auctionSlot} between 1 and 3`),
  ],
);

export const turnstileTokenReplays = sqliteTable(
  "turnstile_token_replays",
  {
    tokenHash: text("token_hash").primaryKey(),
    operation: text("operation").notNull(),
    hostname: text("hostname").notNull(),
    action: text("action").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at").default(now).notNull(),
  },
  (table) => [
    index("turnstile_token_replays_expiry_idx").on(table.expiresAt),
    check("turnstile_token_replays_hash_check", sql`length(${table.tokenHash}) = 64`),
  ],
);
