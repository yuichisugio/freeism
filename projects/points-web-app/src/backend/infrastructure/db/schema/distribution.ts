import { sql } from "drizzle-orm";
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import {
  evaluationCriteria,
  evaluationCriterionRevisions,
  pointPackageRevisions,
} from "./evaluation";
import { exchangeRateRevisions } from "./point-transactions";
import { pointsUsers } from "./points-user";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const substitutionMethods = sqliteTable(
  "substitution_method",
  {
    sourceEvaluationCriterionId: text("source_evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    targetEvaluationCriterionId: text("target_evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    currentRevisionId: text("current_revision_id").notNull(),
    currentRevision: integer("current_revision").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    primaryKey({ columns: [table.sourceEvaluationCriterionId, table.targetEvaluationCriterionId] }),
    uniqueIndex("substitution_method_current_revision_uidx").on(table.currentRevisionId),
    check(
      "substitution_method_distinct_check",
      sql`${table.sourceEvaluationCriterionId} <> ${table.targetEvaluationCriterionId}`,
    ),
    check("substitution_method_revision_check", sql`${table.currentRevision} >= 1`),
  ],
);

export const substitutionMethodRevisions = sqliteTable(
  "substitution_method_revision",
  {
    id: text("id").primaryKey(),
    sourceEvaluationCriterionId: text("source_evaluation_criterion_id").notNull(),
    targetEvaluationCriterionId: text("target_evaluation_criterion_id").notNull(),
    sourceEvaluationCriterionRevisionId: text("source_evaluation_criterion_revision_id")
      .notNull()
      .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
    targetEvaluationCriterionRevisionId: text("target_evaluation_criterion_revision_id")
      .notNull()
      .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    status: text("status", { enum: ["ACTIVE", "DISABLED"] }).notNull(),
    similarityNumerator: integer("similarity_numerator"),
    similarityDenominator: integer("similarity_denominator"),
    exchangeRateRevisionId: text("exchange_rate_revision_id").references(
      () => exchangeRateRevisions.id,
      { onDelete: "restrict" },
    ),
    actorPointsUserId: text("actor_points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("substitution_method_revision_pair_number_uidx").on(
      table.sourceEvaluationCriterionId,
      table.targetEvaluationCriterionId,
      table.revision,
    ),
    check("substitution_method_revision_number_check", sql`${table.revision} >= 1`),
    check(
      "substitution_method_revision_value_check",
      sql`(${table.status} = 'ACTIVE'
          and typeof(${table.similarityNumerator}) = 'integer'
          and ${table.similarityNumerator} between 1 and 9007199254740991
          and typeof(${table.similarityDenominator}) = 'integer'
          and ${table.similarityDenominator} between ${table.similarityNumerator} and 9007199254740991
          and ${table.exchangeRateRevisionId} is not null)
        or (${table.status} = 'DISABLED'
          and ${table.similarityNumerator} is null
          and ${table.similarityDenominator} is null
          and ${table.exchangeRateRevisionId} is null)`,
    ),
  ],
);

export const substitutionResults = sqliteTable(
  "substitution_result",
  {
    id: text("id").primaryKey(),
    sourceEvaluationCriterionId: text("source_evaluation_criterion_id").notNull(),
    targetEvaluationCriterionId: text("target_evaluation_criterion_id").notNull(),
    evaluationMonth: text("evaluation_month").notNull(),
    currentRevisionId: text("current_revision_id").notNull(),
    currentRevision: integer("current_revision").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("substitution_result_business_uidx").on(
      table.sourceEvaluationCriterionId,
      table.targetEvaluationCriterionId,
      table.evaluationMonth,
    ),
    check("substitution_result_revision_check", sql`${table.currentRevision} >= 1`),
  ],
);

export const substitutionResultRevisions = sqliteTable(
  "substitution_result_revision",
  {
    id: text("id").primaryKey(),
    substitutionResultId: text("substitution_result_id")
      .notNull()
      .references(() => substitutionResults.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    substitutionMethodRevisionId: text("substitution_method_revision_id")
      .notNull()
      .references(() => substitutionMethodRevisions.id, { onDelete: "restrict" }),
    sourceEvaluationCriterionRevisionId: text("source_evaluation_criterion_revision_id").notNull(),
    targetEvaluationCriterionRevisionId: text("target_evaluation_criterion_revision_id").notNull(),
    exchangeRateRevisionId: text("exchange_rate_revision_id").notNull(),
    evaluationMonth: text("evaluation_month").notNull(),
    monthStartInclusive: integer("month_start_inclusive").notNull(),
    monthEndExclusive: integer("month_end_exclusive").notNull(),
    executionCutoff: timestamp("execution_cutoff"),
    sourceFixSetHash: text("source_fix_set_hash").notNull(),
    actorPointsUserId: text("actor_points_user_id").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("substitution_result_revision_number_uidx").on(
      table.substitutionResultId,
      table.revision,
    ),
    check("substitution_result_revision_number_check", sql`${table.revision} >= 1`),
    check("substitution_result_revision_hash_check", sql`length(${table.sourceFixSetHash}) = 64`),
    check(
      "substitution_result_revision_month_check",
      sql`${table.monthStartInclusive} < ${table.monthEndExclusive}`,
    ),
  ],
);

export const substitutionResultItems = sqliteTable(
  "substitution_result_item",
  {
    id: text("id").primaryKey(),
    substitutionResultRevisionId: text("substitution_result_revision_id")
      .notNull()
      .references(() => substitutionResultRevisions.id, { onDelete: "restrict" }),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    sourceTotalScaled: integer("source_total_scaled").notNull(),
    theoreticalNumerator: text("theoretical_numerator").notNull(),
    theoreticalDenominator: text("theoretical_denominator").notNull(),
    roundedAmountScaled: integer("rounded_amount_scaled").notNull(),
    expectedDeltaAmountScaled: integer("expected_delta_amount_scaled").notNull(),
  },
  (table) => [
    uniqueIndex("substitution_result_item_user_uidx").on(
      table.substitutionResultRevisionId,
      table.pointsUserId,
    ),
  ],
);

export const autoDistributionSettings = sqliteTable("auto_distribution_setting", {
  pointsUserId: text("points_user_id")
    .primaryKey()
    .references(() => pointsUsers.id, { onDelete: "restrict" }),
  currentRevisionId: text("current_revision_id").notNull(),
  currentRevision: integer("current_revision").notNull(),
  createdAt: timestamp("created_at"),
});

export const autoDistributionSettingRevisions = sqliteTable(
  "auto_distribution_setting_revision",
  {
    id: text("id").primaryKey(),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    status: text("status", { enum: ["ON", "OFF"] }).notNull(),
    pointPackageRevisionId: text("point_package_revision_id").references(
      () => pointPackageRevisions.id,
      { onDelete: "restrict" },
    ),
    retentionType: text("retention_type", { enum: ["PERCENT", "FIXED"] }),
    retentionRatePpm: integer("retention_rate_ppm"),
    retentionAmountScaled: integer("retention_amount_scaled"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("auto_distribution_setting_revision_number_uidx").on(
      table.pointsUserId,
      table.revision,
    ),
    check("auto_distribution_setting_revision_number_check", sql`${table.revision} >= 1`),
    check(
      "auto_distribution_setting_revision_value_check",
      sql`(${table.status} = 'OFF' and ${table.pointPackageRevisionId} is null
            and ${table.retentionType} is null and ${table.retentionRatePpm} is null
            and ${table.retentionAmountScaled} is null)
        or (${table.status} = 'ON' and ${table.pointPackageRevisionId} is not null and (
          (${table.retentionType} = 'PERCENT' and ${table.retentionRatePpm} between 10 and 1000000
            and ${table.retentionAmountScaled} is null)
          or (${table.retentionType} = 'FIXED' and ${table.retentionRatePpm} is null
            and typeof(${table.retentionAmountScaled}) = 'integer'
            and ${table.retentionAmountScaled} between 0 and 9007199254740991)))`,
    ),
  ],
);

export const autoDistributionSnapshots = sqliteTable(
  "auto_distribution_snapshot",
  {
    id: text("id").primaryKey(),
    sourceBusinessKeyHash: text("source_business_key_hash").notNull(),
    sourceFixResultId: text("source_fix_result_id").notNull(),
    sourceRecipientKey: text("source_recipient_key").notNull(),
    initialSourceFixRevisionId: text("initial_source_fix_revision_id").notNull(),
    sourcePointsUserId: text("source_points_user_id").notNull(),
    evaluationCriterionId: text("evaluation_criterion_id").notNull(),
    evaluationCriterionRevisionId: text("evaluation_criterion_revision_id").notNull(),
    settingRevisionId: text("setting_revision_id").references(
      () => autoDistributionSettingRevisions.id,
      { onDelete: "restrict" },
    ),
    pointPackageRevisionId: text("point_package_revision_id"),
    minimumUnitScaled: integer("minimum_unit_scaled").notNull(),
    weightCutoffExclusive: integer("weight_cutoff_exclusive").notNull(),
    outcome: text("outcome", {
      enum: ["DISTRIBUTED", "NO_ELIGIBLE_WEIGHT", "NOT_ENABLED"],
    }).notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("auto_distribution_snapshot_source_uidx").on(table.sourceBusinessKeyHash),
    check(
      "auto_distribution_snapshot_hash_check",
      sql`length(${table.sourceBusinessKeyHash}) = 64`,
    ),
  ],
);

export const autoDistributionSnapshotTargets = sqliteTable(
  "auto_distribution_snapshot_target",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => autoDistributionSnapshots.id, { onDelete: "restrict" }),
    pointsUserId: text("points_user_id").notNull(),
    score: integer("score").notNull(),
    componentSnapshot: text("component_snapshot", { mode: "json" }).$type<unknown>().notNull(),
    tieOrder: integer("tie_order").notNull(),
  },
  (table) => [
    uniqueIndex("auto_distribution_snapshot_target_user_uidx").on(
      table.snapshotId,
      table.pointsUserId,
    ),
    check(
      "auto_distribution_snapshot_target_score_check",
      sql`${table.score} between 1 and 9007199254740991`,
    ),
    check(
      "auto_distribution_snapshot_target_component_check",
      sql`json_valid(${table.componentSnapshot})`,
    ),
  ],
);

export const autoDistributionRevisions = sqliteTable(
  "auto_distribution_revision",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => autoDistributionSnapshots.id, { onDelete: "restrict" }),
    sourceFixRevisionId: text("source_fix_revision_id").notNull(),
    sourceAmountScaled: integer("source_amount_scaled").notNull(),
    retainedAmountScaled: integer("retained_amount_scaled").notNull(),
    distributionAmountScaled: integer("distribution_amount_scaled").notNull(),
    sourceDebitDeltaScaled: integer("source_debit_delta_scaled").notNull(),
    allocationSnapshot: text("allocation_snapshot", { mode: "json" }).$type<unknown>().notNull(),
    creditDeltaSnapshot: text("credit_delta_snapshot", { mode: "json" }).$type<unknown>().notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("auto_distribution_revision_source_uidx").on(
      table.snapshotId,
      table.sourceFixRevisionId,
    ),
    check(
      "auto_distribution_revision_allocation_check",
      sql`json_valid(${table.allocationSnapshot})`,
    ),
    check(
      "auto_distribution_revision_credit_delta_check",
      sql`json_valid(${table.creditDeltaSnapshot})`,
    ),
  ],
);
