import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const evaluationCriteria = sqliteTable(
  "evaluation_criterion",
  {
    id: text("id").primaryKey(),
    normalizedName: text("normalized_name").notNull(),
    currentRevisionId: text("current_revision_id").notNull(),
    currentRevision: integer("current_revision").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("evaluation_criterion_normalized_name_uidx").on(table.normalizedName),
    check("evaluation_criterion_revision_check", sql`${table.currentRevision} >= 1`),
  ],
);

export const evaluationCriterionRevisions = sqliteTable(
  "evaluation_criterion_revision",
  {
    id: text("id").primaryKey(),
    evaluationCriterionId: text("evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    status: text("status", { enum: ["ACTIVE", "ARCHIVED"] }).notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    minimumUnitScaled: integer("minimum_unit_scaled").notNull(),
    transferEnabled: integer("transfer_enabled", { mode: "boolean" }).notNull(),
    exchangeEnabled: integer("exchange_enabled", { mode: "boolean" }).notNull(),
    balanceVisibleByDefault: integer("balance_visible_by_default", { mode: "boolean" }).notNull(),
    buyNowEnabled: integer("buy_now_enabled", { mode: "boolean" }).notNull(),
    actorPointsUserId: text("actor_points_user_id").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("evaluation_criterion_revision_number_uidx").on(
      table.evaluationCriterionId,
      table.revision,
    ),
    check("evaluation_criterion_revision_revision_check", sql`${table.revision} >= 1`),
    check(
      "evaluation_criterion_revision_status_check",
      sql`${table.status} in ('ACTIVE', 'ARCHIVED')`,
    ),
    check("evaluation_criterion_revision_name_check", sql`length(${table.name}) between 1 and 30`),
    check(
      "evaluation_criterion_revision_description_check",
      sql`length(${table.description}) between 1 and 200`,
    ),
    check(
      "evaluation_criterion_revision_minimum_unit_check",
      sql`${table.minimumUnitScaled} between 1 and 9007199254740991`,
    ),
  ],
);

export const evaluationCriterionRelatedUrls = sqliteTable(
  "evaluation_criterion_related_url",
  {
    id: text("id").primaryKey(),
    evaluationCriterionRevisionId: text("evaluation_criterion_revision_id")
      .notNull()
      .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
    displayOrder: integer("display_order").notNull(),
    url: text("url").notNull(),
  },
  (table) => [
    uniqueIndex("evaluation_criterion_related_url_order_uidx").on(
      table.evaluationCriterionRevisionId,
      table.displayOrder,
    ),
    uniqueIndex("evaluation_criterion_related_url_value_uidx").on(
      table.evaluationCriterionRevisionId,
      table.url,
    ),
    check("evaluation_criterion_related_url_order_check", sql`${table.displayOrder} >= 0`),
  ],
);

export const evaluationCriterionRevisionSeals = sqliteTable("evaluation_criterion_revision_seal", {
  evaluationCriterionRevisionId: text("evaluation_criterion_revision_id")
    .primaryKey()
    .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
  sealedAt: timestamp("sealed_at"),
});

export const pointPackages = sqliteTable(
  "point_package",
  {
    id: text("id").primaryKey(),
    normalizedName: text("normalized_name").notNull(),
    currentRevisionId: text("current_revision_id").notNull(),
    currentRevision: integer("current_revision").notNull(),
    lifecycleStatus: text("lifecycle_status", { enum: ["ACTIVE", "INACTIVE"] }).notNull(),
    eligibilityVersion: integer("eligibility_version").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("point_package_normalized_name_uidx").on(table.normalizedName),
    check("point_package_revision_check", sql`${table.currentRevision} >= 1`),
    check(
      "point_package_lifecycle_status_check",
      sql`${table.lifecycleStatus} in ('ACTIVE', 'INACTIVE')`,
    ),
    check("point_package_eligibility_version_check", sql`${table.eligibilityVersion} >= 1`),
  ],
);

export const pointPackageRevisions = sqliteTable(
  "point_package_revision",
  {
    id: text("id").primaryKey(),
    pointPackageId: text("point_package_id")
      .notNull()
      .references(() => pointPackages.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    status: text("status", { enum: ["ACTIVE", "INACTIVE"] }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    relatedUrl: text("related_url"),
    totalWeight: integer("total_weight").notNull(),
    packageTick: integer("package_tick").notNull(),
    contentHash: text("content_hash").notNull(),
    actorPointsUserId: text("actor_points_user_id").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("point_package_revision_number_uidx").on(table.pointPackageId, table.revision),
    check("point_package_revision_revision_check", sql`${table.revision} >= 1`),
    check("point_package_revision_status_check", sql`${table.status} in ('ACTIVE', 'INACTIVE')`),
    check(
      "point_package_revision_total_weight_check",
      sql`${table.totalWeight} between 1 and 9007199254740991`,
    ),
    check(
      "point_package_revision_package_tick_check",
      sql`${table.packageTick} between 1 and 9007199254740991`,
    ),
    check(
      "point_package_revision_content_hash_check",
      sql`length(${table.contentHash}) = 71 and substr(${table.contentHash}, 1, 7) = 'sha256:'`,
    ),
  ],
);

export const pointPackageComponents = sqliteTable(
  "point_package_component",
  {
    id: text("id").primaryKey(),
    pointPackageRevisionId: text("point_package_revision_id")
      .notNull()
      .references(() => pointPackageRevisions.id, { onDelete: "restrict" }),
    evaluationCriterionId: text("evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    evaluationCriterionRevisionId: text("evaluation_criterion_revision_id")
      .notNull()
      .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
    evaluationCriterionName: text("evaluation_criterion_name").notNull(),
    displayOrder: integer("display_order").notNull(),
    minimumUnitScaled: integer("minimum_unit_scaled").notNull(),
    buyNowEnabled: integer("buy_now_enabled", { mode: "boolean" }).notNull(),
    weight: integer("weight").notNull(),
  },
  (table) => [
    uniqueIndex("point_package_component_criterion_uidx").on(
      table.pointPackageRevisionId,
      table.evaluationCriterionId,
    ),
    uniqueIndex("point_package_component_order_uidx").on(
      table.pointPackageRevisionId,
      table.displayOrder,
    ),
    check("point_package_component_order_check", sql`${table.displayOrder} >= 0`),
    check(
      "point_package_component_minimum_unit_check",
      sql`${table.minimumUnitScaled} between 1 and 9007199254740991`,
    ),
    check(
      "point_package_component_weight_check",
      sql`${table.weight} between 1 and 9007199254740991`,
    ),
  ],
);

export const pointPackageRevisionSeals = sqliteTable("point_package_revision_seal", {
  pointPackageRevisionId: text("point_package_revision_id")
    .primaryKey()
    .references(() => pointPackageRevisions.id, { onDelete: "restrict" }),
  sealedAt: timestamp("sealed_at"),
});

export const pointPackageLifecycleEvents = sqliteTable(
  "point_package_lifecycle_event",
  {
    id: text("id").primaryKey(),
    pointPackageId: text("point_package_id")
      .notNull()
      .references(() => pointPackages.id, { onDelete: "restrict" }),
    pointPackageRevisionId: text("point_package_revision_id")
      .notNull()
      .references(() => pointPackageRevisions.id, { onDelete: "restrict" }),
    eligibilityVersion: integer("eligibility_version").notNull(),
    status: text("status", { enum: ["ACTIVE", "INACTIVE"] }).notNull(),
    actorPointsUserId: text("actor_points_user_id").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("point_package_lifecycle_event_version_uidx").on(
      table.pointPackageId,
      table.eligibilityVersion,
    ),
    check(
      "point_package_lifecycle_event_status_check",
      sql`${table.status} in ('ACTIVE', 'INACTIVE')`,
    ),
    check("point_package_lifecycle_event_version_check", sql`${table.eligibilityVersion} >= 1`),
  ],
);

export const profilePointPackages = sqliteTable(
  "profile_point_package",
  {
    id: text("id").primaryKey(),
    pointsUserId: text("points_user_id").notNull(),
    pointPackageId: text("point_package_id")
      .notNull()
      .references(() => pointPackages.id, { onDelete: "restrict" }),
    displayOrder: integer("display_order").notNull(),
  },
  (table) => [
    uniqueIndex("profile_point_package_package_uidx").on(table.pointsUserId, table.pointPackageId),
    uniqueIndex("profile_point_package_order_uidx").on(table.pointsUserId, table.displayOrder),
    check("profile_point_package_order_check", sql`${table.displayOrder} >= 0`),
  ],
);

export const profileEvaluationVisibilities = sqliteTable(
  "profile_evaluation_visibility",
  {
    id: text("id").primaryKey(),
    pointsUserId: text("points_user_id").notNull(),
    evaluationCriterionId: text("evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    balanceVisibility: text("balance_visibility", { enum: ["PUBLIC", "PRIVATE"] }).notNull(),
    evaluationTotalVisibility: text("evaluation_total_visibility", {
      enum: ["PUBLIC", "PRIVATE"],
    }).notNull(),
    fixVisibility: text("fix_visibility", { enum: ["PUBLIC", "PRIVATE"] }).notNull(),
    transferVisibility: text("transfer_visibility", { enum: ["PUBLIC", "PRIVATE"] }).notNull(),
    exchangeVisibility: text("exchange_visibility", { enum: ["PUBLIC", "PRIVATE"] }).notNull(),
  },
  (table) => [
    uniqueIndex("profile_evaluation_visibility_criterion_uidx").on(
      table.pointsUserId,
      table.evaluationCriterionId,
    ),
    check(
      "profile_evaluation_visibility_balance_check",
      sql`${table.balanceVisibility} in ('PUBLIC', 'PRIVATE')`,
    ),
    check(
      "profile_evaluation_visibility_evaluation_total_check",
      sql`${table.evaluationTotalVisibility} in ('PUBLIC', 'PRIVATE')`,
    ),
    check(
      "profile_evaluation_visibility_fix_check",
      sql`${table.fixVisibility} in ('PUBLIC', 'PRIVATE')`,
    ),
    check(
      "profile_evaluation_visibility_transfer_check",
      sql`${table.transferVisibility} in ('PUBLIC', 'PRIVATE')`,
    ),
    check(
      "profile_evaluation_visibility_exchange_check",
      sql`${table.exchangeVisibility} in ('PUBLIC', 'PRIVATE')`,
    ),
  ],
);

export const pointPackageAuctionEligibilityIdempotency = sqliteTable(
  "point_package_auction_eligibility_idempotency",
  {
    id: text("id").primaryKey(),
    marketsClientId: text("markets_client_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    expectedItemCount: integer("expected_item_count").notNull(),
    status: integer("status").notNull(),
    responseBody: text("response_body", { mode: "json" }).$type<unknown>().notNull(),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }).notNull(),
    validUntil: integer("valid_until", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("point_package_auction_eligibility_idempotency_key_uidx").on(
      table.marketsClientId,
      table.idempotencyKey,
    ),
    check(
      "point_package_auction_eligibility_idempotency_item_count_check",
      sql`${table.expectedItemCount} between 1 and 1000`,
    ),
    check(
      "point_package_auction_eligibility_idempotency_status_check",
      sql`${table.status} in (0, 201, 409)`,
    ),
    check(
      "point_package_auction_eligibility_idempotency_body_check",
      sql`json_valid(${table.responseBody})`,
    ),
  ],
);

export const pointPackageAuctionEligibilityReceipts = sqliteTable(
  "point_package_auction_eligibility_receipt",
  {
    id: text("id").primaryKey(),
    idempotencyId: text("idempotency_id")
      .notNull()
      .unique()
      .references(() => pointPackageAuctionEligibilityIdempotency.id, { onDelete: "restrict" }),
    marketsClientId: text("markets_client_id").notNull(),
    auctionCommandId: text("auction_command_id").notNull(),
    auctionCommandHash: text("auction_command_hash").notNull(),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }).notNull(),
    validUntil: integer("valid_until", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "point_package_auction_eligibility_receipt_lease_check",
      sql`${table.validUntil} = ${table.checkedAt} + 30000`,
    ),
  ],
);

export const pointPackageAuctionEligibilityItems = sqliteTable(
  "point_package_auction_eligibility_item",
  {
    id: text("id").primaryKey(),
    receiptId: text("receipt_id")
      .notNull()
      .references(() => pointPackageAuctionEligibilityReceipts.id, { onDelete: "restrict" }),
    auctionItemId: text("auction_item_id").notNull(),
    pointPackageId: text("point_package_id").notNull(),
    pointPackageRevisionId: text("point_package_revision_id").notNull(),
    contentHash: text("content_hash").notNull(),
    packageEligibilityVersion: integer("package_eligibility_version").notNull(),
  },
  (table) => [
    uniqueIndex("point_package_auction_eligibility_item_uidx").on(
      table.receiptId,
      table.auctionItemId,
    ),
    check(
      "point_package_auction_eligibility_item_version_check",
      sql`${table.packageEligibilityVersion} >= 1`,
    ),
  ],
);
