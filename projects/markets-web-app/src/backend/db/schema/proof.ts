import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { auctionRevisions, auctions } from "./auction";
import { marketsUsers } from "./markets-user";
import { settlementRounds, settlements } from "./settlement";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const safeInteger = sql.raw("9007199254740991");

export const settlementCaptureReceipts = sqliteTable(
  "settlement_capture_receipts",
  {
    captureReceiptId: text("capture_receipt_id").primaryKey(),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    settlementRoundId: text("settlement_round_id")
      .notNull()
      .references(() => settlementRounds.id),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    planHash: text("plan_hash").notNull(),
    capturedAt: text("captured_at").notNull(),
    contentHash: text("content_hash").notNull(),
    reservationsJson: text("reservations_json").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlement_capture_receipts_settlement_uidx").on(table.settlementId),
    check("settlement_capture_receipts_plan_hash_check", sql`length(${table.planHash}) = 64`),
    check(
      "settlement_capture_receipts_content_hash_check",
      sql`length(${table.contentHash}) = 71 and substr(${table.contentHash}, 1, 7) = 'sha256:'`,
    ),
    check(
      "settlement_capture_receipts_reservations_json_check",
      sql`json_valid(${table.reservationsJson})`,
    ),
  ],
);

export const settlementAllocations = sqliteTable(
  "settlement_allocations",
  {
    id: text("id").primaryKey(),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    settlementRoundId: text("settlement_round_id")
      .notNull()
      .references(() => settlementRounds.id),
    allocationOrdinal: integer("allocation_ordinal").notNull(),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    buyerMarketsUserId: text("buyer_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    pointReservationId: text("point_reservation_id").notNull(),
    quantity: integer("quantity").notNull(),
    uniformPriceTickCount: integer("uniform_price_tick_count").notNull(),
    priceTicks: integer("price_ticks").notNull(),
    vectorHash: text("vector_hash").notNull(),
    settledAt: text("settled_at").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlement_allocations_ordinal_uidx").on(
      table.settlementId,
      table.allocationOrdinal,
    ),
    uniqueIndex("settlement_allocations_buyer_uidx").on(
      table.settlementId,
      table.buyerMarketsUserId,
    ),
    uniqueIndex("settlement_allocations_reservation_uidx").on(table.pointReservationId),
    check(
      "settlement_allocations_ordinal_check",
      sql`${table.allocationOrdinal} between 1 and ${safeInteger}`,
    ),
    check("settlement_allocations_quantity_check", sql`${table.quantity} between 1 and 1000`),
    check(
      "settlement_allocations_uniform_price_check",
      sql`${table.uniformPriceTickCount} between 0 and ${safeInteger}`,
    ),
    check(
      "settlement_allocations_price_ticks_check",
      sql`${table.priceTicks} between 0 and ${safeInteger}`,
    ),
    check(
      "settlement_allocations_vector_hash_check",
      sql`length(${table.vectorHash}) = 64 or (length(${table.vectorHash}) = 71 and substr(${table.vectorHash}, 1, 7) = 'sha256:')`,
    ),
  ],
);

export const proofs = sqliteTable(
  "proofs",
  {
    id: text("id").primaryKey(),
    allocationId: text("allocation_id")
      .notNull()
      .references(() => settlementAllocations.id),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    auctionRevisionId: text("auction_revision_id")
      .notNull()
      .references(() => auctionRevisions.id),
    buyerMarketsUserId: text("buyer_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    pointPackageRevisionId: text("point_package_revision_id").notNull(),
    itemSnapshotJson: text("item_snapshot_json").notNull(),
    sellerIdentitySnapshotJson: text("seller_identity_snapshot_json").notNull(),
    buyerIdentitySnapshotJson: text("buyer_identity_snapshot_json").notNull(),
    allocationQuantity: integer("allocation_quantity").notNull(),
    uniformPriceTickCount: integer("uniform_price_tick_count").notNull(),
    priceTicks: integer("price_ticks").notNull(),
    componentVectorJson: text("component_vector_json").notNull(),
    completionStatus: text("completion_status", { enum: ["SETTLED"] }).notNull(),
    settledAt: text("settled_at").notNull(),
    planHash: text("plan_hash").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("proofs_allocation_uidx").on(table.allocationId),
    check("proofs_item_snapshot_check", sql`json_valid(${table.itemSnapshotJson})`),
    check("proofs_seller_snapshot_check", sql`json_valid(${table.sellerIdentitySnapshotJson})`),
    check("proofs_buyer_snapshot_check", sql`json_valid(${table.buyerIdentitySnapshotJson})`),
    check("proofs_component_vector_check", sql`json_valid(${table.componentVectorJson})`),
    check("proofs_quantity_check", sql`${table.allocationQuantity} between 1 and 1000`),
    check(
      "proofs_uniform_price_check",
      sql`${table.uniformPriceTickCount} between 0 and ${safeInteger}`,
    ),
    check("proofs_price_ticks_check", sql`${table.priceTicks} between 0 and ${safeInteger}`),
    check("proofs_status_check", sql`${table.completionStatus} = 'SETTLED'`),
    check("proofs_plan_hash_check", sql`length(${table.planHash}) = 64`),
    check("proofs_content_hash_check", sql`length(${table.contentHash}) = 64`),
  ],
);

export const settlementFinalizeReceipts = sqliteTable(
  "settlement_finalize_receipts",
  {
    id: text("id").primaryKey(),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    captureReceiptId: text("capture_receipt_id")
      .notNull()
      .references(() => settlementCaptureReceipts.captureReceiptId),
    planHash: text("plan_hash").notNull(),
    proofIdsJson: text("proof_ids_json").notNull(),
    proofSetHash: text("proof_set_hash").notNull(),
    finalizedAt: text("finalized_at").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("settlement_finalize_receipts_settlement_uidx").on(table.settlementId),
    uniqueIndex("settlement_finalize_receipts_capture_uidx").on(table.captureReceiptId),
    check("settlement_finalize_receipts_plan_hash_check", sql`length(${table.planHash}) = 64`),
    check("settlement_finalize_receipts_proof_ids_check", sql`json_valid(${table.proofIdsJson})`),
    check(
      "settlement_finalize_receipts_proof_set_hash_check",
      sql`length(${table.proofSetHash}) = 64`,
    ),
  ],
);
