import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { identityOwnerships, ownershipEpochs } from "./ownership";
import { pointsUsers } from "./points-user";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const ownershipRevalidationJobs = sqliteTable(
  "ownership_revalidation_job",
  {
    id: text("id").primaryKey(),
    identityOwnershipId: text("identity_ownership_id")
      .notNull()
      .references(() => identityOwnerships.id, { onDelete: "restrict" }),
    ownershipEpochId: text("ownership_epoch_id")
      .notNull()
      .references(() => ownershipEpochs.id, { onDelete: "restrict" }),
    verificationCycleId: text("verification_cycle_id").notNull(),
    attempt: integer("attempt").notNull(),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    cycleStartedAt: integer("cycle_started_at", { mode: "timestamp_ms" }),
    status: text("status", { enum: ["PENDING", "LEASED", "SUCCEEDED", "FAILED"] }).notNull(),
    leaseUntil: integer("lease_until", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("ownership_revalidation_cycle_attempt_uidx").on(
      table.ownershipEpochId,
      table.verificationCycleId,
      table.attempt,
    ),
    index("ownership_revalidation_due_idx").on(table.status, table.dueAt),
    check("ownership_revalidation_attempt_check", sql`${table.attempt} BETWEEN 1 AND 3`),
  ],
);

export const webReownershipCandidates = sqliteTable("web_reownership_candidate", {
  identityOwnershipId: text("identity_ownership_id")
    .primaryKey()
    .references(() => identityOwnerships.id, { onDelete: "restrict" }),
  candidatePointsUserId: text("candidate_points_user_id")
    .notNull()
    .references(() => pointsUsers.id, { onDelete: "restrict" }),
  firstSuccessAt: integer("first_success_at", { mode: "timestamp_ms" }).notNull(),
  lastSuccessAt: integer("last_success_at", { mode: "timestamp_ms" }).notNull(),
  nextEligibleAt: integer("next_eligible_at", { mode: "timestamp_ms" }).notNull(),
  successCount: integer("success_count").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  updatedAt: timestamp("updated_at"),
});
