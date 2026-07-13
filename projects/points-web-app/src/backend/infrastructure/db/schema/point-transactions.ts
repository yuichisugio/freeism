import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { evaluationCriteria, evaluationCriterionRevisions } from "./evaluation";
import { pointsUsers } from "./points-user";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const exchangeRates = sqliteTable(
  "exchange_rate",
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
    primaryKey({
      columns: [table.sourceEvaluationCriterionId, table.targetEvaluationCriterionId],
    }),
    uniqueIndex("exchange_rate_current_revision_uidx").on(table.currentRevisionId),
    check(
      "exchange_rate_distinct_criteria_check",
      sql`${table.sourceEvaluationCriterionId} <> ${table.targetEvaluationCriterionId}`,
    ),
    check("exchange_rate_revision_check", sql`${table.currentRevision} >= 1`),
  ],
);

export const exchangeRateRevisions = sqliteTable(
  "exchange_rate_revision",
  {
    id: text("id").primaryKey(),
    sourceEvaluationCriterionId: text("source_evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    targetEvaluationCriterionId: text("target_evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    sourceEvaluationCriterionRevisionId: text("source_evaluation_criterion_revision_id")
      .notNull()
      .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
    targetEvaluationCriterionRevisionId: text("target_evaluation_criterion_revision_id")
      .notNull()
      .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    status: text("status", { enum: ["ACTIVE", "DISABLED"] }).notNull(),
    numerator: integer("numerator"),
    denominator: integer("denominator"),
    actorPointsUserId: text("actor_points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("exchange_rate_revision_pair_number_uidx").on(
      table.sourceEvaluationCriterionId,
      table.targetEvaluationCriterionId,
      table.revision,
    ),
    check(
      "exchange_rate_revision_distinct_criteria_check",
      sql`${table.sourceEvaluationCriterionId} <> ${table.targetEvaluationCriterionId}`,
    ),
    check("exchange_rate_revision_number_check", sql`${table.revision} >= 1`),
    check(
      "exchange_rate_revision_value_check",
      sql`(${table.status} = 'ACTIVE'
             and typeof(${table.numerator}) = 'integer'
             and ${table.numerator} between 1 and 9007199254740991
             and typeof(${table.denominator}) = 'integer'
             and ${table.denominator} between 1 and 9007199254740991)
          or (${table.status} = 'DISABLED'
             and ${table.numerator} is null and ${table.denominator} is null)`,
    ),
    check("exchange_rate_revision_reason_check", sql`length(trim(${table.reason})) > 0`),
  ],
);

export const pointTransactionBatches = sqliteTable(
  "point_transaction_batch",
  {
    id: text("id").primaryKey(),
    transactionType: text("transaction_type", { enum: ["TRANSFER", "EXCHANGE"] }).notNull(),
    actorPointsUserId: text("actor_points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["PENDING", "VALIDATED", "COMMITTED"] }).notNull(),
    expectedItemCount: integer("expected_item_count").notNull(),
    fileHash: text("file_hash").notNull(),
    validationHash: text("validation_hash").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("point_transaction_batch_idempotency_uidx").on(
      table.actorPointsUserId,
      table.transactionType,
      table.idempotencyKey,
    ),
    check(
      "point_transaction_batch_status_check",
      sql`${table.status} in ('PENDING', 'VALIDATED', 'COMMITTED')`,
    ),
    check(
      "point_transaction_batch_item_count_check",
      sql`${table.expectedItemCount} between 1 and 1000`,
    ),
    check("point_transaction_batch_file_hash_check", sql`length(${table.fileHash}) = 64`),
    check(
      "point_transaction_batch_validation_hash_check",
      sql`length(${table.validationHash}) = 64`,
    ),
    check(
      "point_transaction_batch_idempotency_key_check",
      sql`length(trim(${table.idempotencyKey})) > 0`,
    ),
  ],
);

export const pointTransactionItems = sqliteTable(
  "point_transaction_item",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => pointTransactionBatches.id, { onDelete: "restrict" }),
    rowNumber: integer("row_number").notNull(),
    transactionType: text("transaction_type", { enum: ["TRANSFER", "EXCHANGE"] }).notNull(),
    senderPointsUserId: text("sender_points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    recipientPointsUserId: text("recipient_points_user_id").references(() => pointsUsers.id, {
      onDelete: "restrict",
    }),
    sourceEvaluationCriterionId: text("source_evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    sourceEvaluationCriterionRevisionId: text("source_evaluation_criterion_revision_id")
      .notNull()
      .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
    sourceAmountScaled: integer("source_amount_scaled").notNull(),
    targetEvaluationCriterionId: text("target_evaluation_criterion_id").references(
      () => evaluationCriteria.id,
      { onDelete: "restrict" },
    ),
    targetEvaluationCriterionRevisionId: text("target_evaluation_criterion_revision_id").references(
      () => evaluationCriterionRevisions.id,
      { onDelete: "restrict" },
    ),
    targetAmountScaled: integer("target_amount_scaled"),
    exchangeRateRevisionId: text("exchange_rate_revision_id").references(
      () => exchangeRateRevisions.id,
      { onDelete: "restrict" },
    ),
    roundingRule: text("rounding_rule", { enum: ["FLOOR"] }),
    rateDivisionRemainder: integer("rate_division_remainder"),
    minimumUnitRemainderScaled: integer("minimum_unit_remainder_scaled"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("point_transaction_item_batch_row_uidx").on(table.batchId, table.rowNumber),
    index("point_transaction_item_source_account_idx").on(
      table.batchId,
      table.senderPointsUserId,
      table.sourceEvaluationCriterionId,
    ),
    check("point_transaction_item_row_check", sql`${table.rowNumber} between 2 and 1001`),
    check(
      "point_transaction_item_source_amount_check",
      sql`typeof(${table.sourceAmountScaled}) = 'integer'
          and ${table.sourceAmountScaled} between 1 and 9007199254740991`,
    ),
    check(
      "point_transaction_item_shape_check",
      sql`(${table.transactionType} = 'TRANSFER'
             and ${table.recipientPointsUserId} is not null
             and ${table.targetEvaluationCriterionId} is null
             and ${table.targetEvaluationCriterionRevisionId} is null
             and ${table.targetAmountScaled} is null
             and ${table.exchangeRateRevisionId} is null
             and ${table.roundingRule} is null
             and ${table.rateDivisionRemainder} is null
             and ${table.minimumUnitRemainderScaled} is null)
          or (${table.transactionType} = 'EXCHANGE'
             and ${table.recipientPointsUserId} is null
             and ${table.targetEvaluationCriterionId} is not null
             and ${table.targetEvaluationCriterionRevisionId} is not null
             and typeof(${table.targetAmountScaled}) = 'integer'
             and ${table.targetAmountScaled} between 1 and 9007199254740991
             and ${table.exchangeRateRevisionId} is not null
             and ${table.roundingRule} = 'FLOOR'
             and typeof(${table.rateDivisionRemainder}) = 'integer'
             and ${table.rateDivisionRemainder} >= 0
             and typeof(${table.minimumUnitRemainderScaled}) = 'integer'
             and ${table.minimumUnitRemainderScaled} >= 0)`,
    ),
  ],
);
