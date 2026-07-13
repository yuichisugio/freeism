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

export const fixResults = sqliteTable(
  "fix_result",
  {
    id: text("id").primaryKey(),
    currentRevisionId: text("current_revision_id").notNull(),
    currentRevision: integer("current_revision").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [check("fix_result_revision_check", sql`${table.currentRevision} >= 1`)],
);

export const fixRevisions = sqliteTable(
  "fix_revision",
  {
    id: text("id").primaryKey(),
    fixResultId: text("fix_result_id")
      .notNull()
      .references(() => fixResults.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    fileHash: text("file_hash").notNull(),
    validationHash: text("validation_hash").notNull(),
    contentHash: text("content_hash").notNull(),
    actorPointsUserId: text("actor_points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("fix_revision_result_number_uidx").on(table.fixResultId, table.revision),
    check("fix_revision_revision_check", sql`${table.revision} >= 1`),
    check("fix_revision_file_hash_check", sql`length(${table.fileHash}) = 64`),
    check("fix_revision_validation_hash_check", sql`length(${table.validationHash}) = 64`),
    check("fix_revision_content_hash_check", sql`length(${table.contentHash}) = 64`),
    check("fix_revision_reason_check", sql`length(trim(${table.reason})) > 0`),
  ],
);

export const fixRevisionSeals = sqliteTable("fix_revision_seal", {
  fixRevisionId: text("fix_revision_id")
    .primaryKey()
    .references(() => fixRevisions.id, { onDelete: "restrict" }),
  sealedAt: timestamp("sealed_at"),
});

export const fixRevisionEntries = sqliteTable(
  "fix_revision_entry",
  {
    id: text("id").primaryKey(),
    fixRevisionId: text("fix_revision_id")
      .notNull()
      .references(() => fixRevisions.id, { onDelete: "restrict" }),
    recipientProviderId: text("recipient_provider_id"),
    recipientAccountId: text("recipient_account_id"),
    recipientProfileUrl: text("recipient_profile_url").notNull(),
    identityResolvedAt: integer("identity_resolved_at", { mode: "timestamp_ms" }),
    pointsUserId: text("points_user_id").references(() => pointsUsers.id, {
      onDelete: "restrict",
    }),
    evaluationCriterionId: text("evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    evaluationCriterionRevisionId: text("evaluation_criterion_revision_id")
      .notNull()
      .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
    amountScaled: integer("amount_scaled").notNull(),
    evaluationAt: text("evaluation_at").notNull(),
    managementId: text("management_id"),
    memo: text("memo"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("fix_revision_entry_subject_criterion_uidx").on(
      table.fixRevisionId,
      table.recipientProfileUrl,
      table.evaluationCriterionId,
    ),
    index("fix_revision_entry_github_subject_idx").on(
      table.recipientProviderId,
      table.recipientAccountId,
    ),
    check(
      "fix_revision_entry_amount_check",
      sql`typeof(${table.amountScaled}) = 'integer' and ${table.amountScaled} between -9007199254740991 and 9007199254740991`,
    ),
    check(
      "fix_revision_entry_memo_check",
      sql`${table.memo} is null or length(${table.memo}) <= 200`,
    ),
  ],
);

export const unclaimedFixEntries = sqliteTable(
  "unclaimed_fix_entry",
  {
    id: text("id").primaryKey(),
    sourceFixRevisionId: text("source_fix_revision_id")
      .notNull()
      .references(() => fixRevisions.id, { onDelete: "restrict" }),
    recipientProviderId: text("recipient_provider_id"),
    recipientAccountId: text("recipient_account_id"),
    recipientProfileUrl: text("recipient_profile_url").notNull(),
    evaluationCriterionId: text("evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    evaluationCriterionRevisionId: text("evaluation_criterion_revision_id")
      .notNull()
      .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
    deltaAmountScaled: integer("delta_amount_scaled").notNull(),
    evaluationAt: text("evaluation_at").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("unclaimed_fix_entry_source_subject_criterion_uidx").on(
      table.sourceFixRevisionId,
      table.recipientProviderId,
      table.recipientAccountId,
      table.recipientProfileUrl,
      table.evaluationCriterionId,
    ),
    check(
      "unclaimed_fix_entry_delta_check",
      sql`typeof(${table.deltaAmountScaled}) = 'integer' and ${table.deltaAmountScaled} between -9007199254740991 and 9007199254740991`,
    ),
  ],
);

export const pointLedgerEntries = sqliteTable(
  "point_ledger_entry",
  {
    id: text("id").primaryKey(),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    evaluationCriterionId: text("evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    evaluationCriterionRevisionId: text("evaluation_criterion_revision_id")
      .notNull()
      .references(() => evaluationCriterionRevisions.id, { onDelete: "restrict" }),
    deltaAmountScaled: integer("delta_amount_scaled").notNull(),
    affectsEvaluationTotal: integer("affects_evaluation_total", { mode: "boolean" }).notNull(),
    sourceType: text("source_type", { enum: ["FIX"] }).notNull(),
    sourceFixRevisionId: text("source_fix_revision_id")
      .notNull()
      .references(() => fixRevisions.id, { onDelete: "restrict" }),
    sourceUnclaimedFixEntryId: text("source_unclaimed_fix_entry_id").references(
      () => unclaimedFixEntries.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("point_ledger_entry_direct_fix_subject_criterion_uidx")
      .on(table.sourceFixRevisionId, table.pointsUserId, table.evaluationCriterionId)
      .where(sql`${table.sourceUnclaimedFixEntryId} is null`),
    uniqueIndex("point_ledger_entry_unclaimed_uidx")
      .on(table.sourceUnclaimedFixEntryId)
      .where(sql`${table.sourceUnclaimedFixEntryId} is not null`),
    index("point_ledger_entry_account_idx").on(table.pointsUserId, table.evaluationCriterionId),
    check(
      "point_ledger_entry_delta_check",
      sql`typeof(${table.deltaAmountScaled}) = 'integer' and ${table.deltaAmountScaled} between -9007199254740991 and 9007199254740991`,
    ),
    check("point_ledger_entry_source_type_check", sql`${table.sourceType} = 'FIX'`),
  ],
);

export const pointAccounts = sqliteTable(
  "point_account",
  {
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    evaluationCriterionId: text("evaluation_criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "restrict" }),
    balance: integer("balance").notNull(),
    evaluationTotal: integer("evaluation_total").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    primaryKey({ columns: [table.pointsUserId, table.evaluationCriterionId] }),
    check(
      "point_account_balance_check",
      sql`typeof(${table.balance}) = 'integer' and ${table.balance} between -9007199254740991 and 9007199254740991`,
    ),
    check(
      "point_account_evaluation_total_check",
      sql`typeof(${table.evaluationTotal}) = 'integer' and ${table.evaluationTotal} between -9007199254740991 and 9007199254740991`,
    ),
  ],
);

export const githubApiBudgets = sqliteTable("github_api_budget", {
  id: text("id").primaryKey(),
  remaining: integer("remaining").notNull(),
  resetAt: integer("reset_at").notNull(),
  updatedAt: timestamp("updated_at"),
});
