import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import {
  evaluationCriteria,
  evaluationCriterionRevisions,
  pointPackageRevisions,
} from "./evaluation";
import { pointsUsers } from "./points-user";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const pointReservations = sqliteTable(
  "point_reservation",
  {
    id: text("id").primaryKey(),
    reservationKey: text("reservation_key").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    marketsClientId: text("markets_client_id").notNull(),
    marketsUserId: text("markets_user_id").notNull(),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    auctionId: text("auction_id").notNull(),
    settlementId: text("settlement_id").notNull(),
    planHash: text("plan_hash").notNull(),
    pointPackageRevisionId: text("point_package_revision_id")
      .notNull()
      .references(() => pointPackageRevisions.id, { onDelete: "restrict" }),
    priceTicks: integer("price_ticks").notNull(),
    quantity: integer("quantity").notNull(),
    vectorHash: text("vector_hash").notNull(),
    expectedComponentCount: integer("expected_component_count").notNull(),
    leaseSeconds: integer("lease_seconds").notNull(),
    createdAt: timestamp("created_at"),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    uniqueIndex("point_reservation_client_key_uidx").on(
      table.marketsClientId,
      table.reservationKey,
    ),
    uniqueIndex("point_reservation_client_idempotency_uidx").on(
      table.marketsClientId,
      table.idempotencyKey,
    ),
    uniqueIndex("point_reservation_settlement_user_uidx").on(
      table.marketsClientId,
      table.settlementId,
      table.planHash,
      table.pointsUserId,
    ),
    index("point_reservation_owner_idx").on(table.pointsUserId, table.expiresAt),
    check("point_reservation_price_check", sql`${table.priceTicks} between 0 and 9007199254740991`),
    check(
      "point_reservation_quantity_check",
      sql`${table.quantity} between 1 and 9007199254740991`,
    ),
    check("point_reservation_component_count_check", sql`${table.expectedComponentCount} >= 1`),
    check("point_reservation_lease_check", sql`${table.leaseSeconds} = 900`),
    check("point_reservation_expiry_check", sql`${table.expiresAt} = ${table.createdAt} + 900000`),
  ],
);

export const pointReservationComponents = sqliteTable(
  "point_reservation_component",
  {
    id: text("id").primaryKey(),
    pointReservationId: text("point_reservation_id")
      .notNull()
      .references(() => pointReservations.id, { onDelete: "restrict" }),
    evaluationCriterionId: text("evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    evaluationCriterionRevisionId: text("evaluation_criterion_revision_id")
      .notNull()
      .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
    displayOrder: integer("display_order").notNull(),
    amountScaled: integer("amount_scaled").notNull(),
  },
  (table) => [
    uniqueIndex("point_reservation_component_criterion_uidx").on(
      table.pointReservationId,
      table.evaluationCriterionId,
    ),
    uniqueIndex("point_reservation_component_order_uidx").on(
      table.pointReservationId,
      table.displayOrder,
    ),
    check("point_reservation_component_order_check", sql`${table.displayOrder} >= 0`),
    check(
      "point_reservation_component_amount_check",
      sql`typeof(${table.amountScaled}) = 'integer' and ${table.amountScaled} between 0 and 9007199254740991`,
    ),
  ],
);

export const pointSettlementCaptures = sqliteTable(
  "point_settlement_capture",
  {
    id: text("id").primaryKey(),
    marketsClientId: text("markets_client_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    settlementId: text("settlement_id").notNull(),
    auctionId: text("auction_id").notNull(),
    planHash: text("plan_hash").notNull(),
    status: text("status", { enum: ["PENDING", "VALIDATED", "COMMITTED"] }).notNull(),
    expectedReservationCount: integer("expected_reservation_count").notNull(),
    expectedEventCount: integer("expected_event_count").notNull(),
    expectedLedgerCount: integer("expected_ledger_count").notNull(),
    contentHash: text("content_hash").notNull(),
    capturedAt: timestamp("captured_at"),
  },
  (table) => [
    uniqueIndex("point_settlement_capture_idempotency_uidx").on(
      table.marketsClientId,
      table.idempotencyKey,
    ),
    check(
      "point_settlement_capture_status_check",
      sql`${table.status} in ('PENDING', 'VALIDATED', 'COMMITTED')`,
    ),
    check(
      "point_settlement_capture_count_check",
      sql`${table.expectedReservationCount} between 1 and 1000 and ${table.expectedEventCount} = ${table.expectedReservationCount} and ${table.expectedLedgerCount} >= 0`,
    ),
  ],
);

export const pointSettlementCaptureItems = sqliteTable(
  "point_settlement_capture_item",
  {
    id: text("id").primaryKey(),
    pointSettlementCaptureId: text("point_settlement_capture_id")
      .notNull()
      .references(() => pointSettlementCaptures.id, { onDelete: "restrict" }),
    pointReservationId: text("point_reservation_id")
      .notNull()
      .references(() => pointReservations.id, { onDelete: "restrict" }),
    expectedVectorHash: text("expected_vector_hash").notNull(),
  },
  (table) => [
    uniqueIndex("point_settlement_capture_item_reservation_uidx").on(
      table.pointSettlementCaptureId,
      table.pointReservationId,
    ),
  ],
);

export const pointReservationEvents = sqliteTable(
  "point_reservation_event",
  {
    id: text("id").primaryKey(),
    pointReservationId: text("point_reservation_id")
      .notNull()
      .references(() => pointReservations.id, { onDelete: "restrict" }),
    eventType: text("event_type", {
      enum: ["CREATED", "CAPTURED", "RELEASED", "EXPIRED"],
    }).notNull(),
    expectedVersion: integer("expected_version").notNull(),
    marketsClientId: text("markets_client_id").notNull(),
    planHash: text("plan_hash").notNull(),
    vectorHash: text("vector_hash").notNull(),
    pointSettlementCaptureId: text("point_settlement_capture_id").references(
      () => pointSettlementCaptures.id,
      { onDelete: "restrict" },
    ),
    receiptId: text("receipt_id"),
    idempotencyKey: text("idempotency_key"),
    payloadHash: text("payload_hash"),
    reason: text("reason"),
    occurredAt: timestamp("occurred_at"),
  },
  (table) => [
    uniqueIndex("point_reservation_event_version_uidx").on(
      table.pointReservationId,
      table.expectedVersion,
    ),
    index("point_reservation_event_receipt_idx").on(table.receiptId),
    uniqueIndex("point_reservation_event_idempotency_uidx").on(
      table.marketsClientId,
      table.eventType,
      table.idempotencyKey,
    ),
    check(
      "point_reservation_event_type_check",
      sql`${table.eventType} in ('CREATED', 'CAPTURED', 'RELEASED', 'EXPIRED')`,
    ),
    check("point_reservation_event_version_check", sql`${table.expectedVersion} >= 0`),
  ],
);

export const pointReservationStates = sqliteTable(
  "point_reservation_state",
  {
    pointReservationId: text("point_reservation_id")
      .primaryKey()
      .references(() => pointReservations.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["ACTIVE", "CAPTURED", "RELEASED", "EXPIRED"] }).notNull(),
    version: integer("version").notNull(),
    terminalAt: integer("terminal_at", { mode: "timestamp_ms" }),
    terminalReceiptId: text("terminal_receipt_id"),
  },
  (table) => [
    index("point_reservation_state_status_idx").on(table.status),
    check(
      "point_reservation_state_status_check",
      sql`${table.status} in ('ACTIVE', 'CAPTURED', 'RELEASED', 'EXPIRED')`,
    ),
    check("point_reservation_state_version_check", sql`${table.version} >= 1`),
  ],
);
