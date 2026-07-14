import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { unclaimedFixEntries } from "./fix-ledger";
import { pointsUsers } from "./points-user";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const identityOwnerships = sqliteTable(
  "identity_ownership",
  {
    id: text("id").primaryKey(),
    identityType: text("identity_type", { enum: ["GITHUB_OAUTH", "WEB_URL"] }).notNull(),
    normalizedIdentityKey: text("normalized_identity_key").notNull(),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["ACTIVE", "REVERIFYING", "INACTIVE", "LAPSED"] }).notNull(),
    currentOwnershipEpochId: text("current_ownership_epoch_id").notNull(),
    verifiedAt: timestamp("verified_at"),
    nextVerificationAt: integer("next_verification_at", { mode: "timestamp_ms" }),
    permanentCorrespondence: integer("permanent_correspondence", { mode: "boolean" })
      .default(false)
      .notNull(),
  },
  (table) => [
    uniqueIndex("identity_ownership_type_key_uidx").on(
      table.identityType,
      table.normalizedIdentityKey,
    ),
    check("identity_ownership_key_check", sql`length(${table.normalizedIdentityKey}) > 0`),
  ],
);

export const ownershipEpochs = sqliteTable(
  "ownership_epoch",
  {
    id: text("id").primaryKey(),
    identityOwnershipId: text("identity_ownership_id")
      .notNull()
      .references(() => identityOwnerships.id, { onDelete: "restrict" }),
    ownerPointsUserId: text("owner_points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    effectiveAt: timestamp("effective_at"),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    verificationMethod: text("verification_method").notNull(),
    evidenceHash: text("evidence_hash").notNull(),
    successCount: integer("success_count").notNull(),
    requestId: text("request_id").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("ownership_epoch_ownership_effective_idx").on(
      table.identityOwnershipId,
      table.effectiveAt,
    ),
    check("ownership_epoch_evidence_hash_check", sql`length(${table.evidenceHash}) = 64`),
    check("ownership_epoch_success_count_check", sql`${table.successCount} >= 1`),
  ],
);

export const fixClaimCommands = sqliteTable(
  "fix_claim_command",
  {
    id: text("id").primaryKey(),
    identityOwnershipId: text("identity_ownership_id")
      .notNull()
      .references(() => identityOwnerships.id, { onDelete: "restrict" }),
    ownershipEpochId: text("ownership_epoch_id")
      .notNull()
      .references(() => ownershipEpochs.id, { onDelete: "restrict" }),
    actorPointsUserId: text("actor_points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    expectedEntryIds: text("expected_entry_ids", { mode: "json" }).$type<string[]>().notNull(),
    claimSetHash: text("claim_set_hash").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    check("fix_claim_command_hash_check", sql`length(${table.claimSetHash}) = 64`),
    check("fix_claim_command_entries_check", sql`json_array_length(${table.expectedEntryIds}) > 0`),
  ],
);

export const fixClaims = sqliteTable(
  "fix_claim",
  {
    id: text("id").primaryKey(),
    commandId: text("command_id")
      .notNull()
      .unique()
      .references(() => fixClaimCommands.id, { onDelete: "restrict" }),
    ownershipEpochId: text("ownership_epoch_id")
      .notNull()
      .references(() => ownershipEpochs.id, { onDelete: "restrict" }),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    claimSetHash: text("claim_set_hash").notNull(),
    itemCount: integer("item_count").notNull(),
    requestId: text("request_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    claimedAt: timestamp("claimed_at"),
  },
  (table) => [
    uniqueIndex("fix_claim_actor_idempotency_uidx").on(table.pointsUserId, table.idempotencyKey),
    check("fix_claim_hash_check", sql`length(${table.claimSetHash}) = 64`),
    check("fix_claim_item_count_check", sql`${table.itemCount} > 0`),
  ],
);

export const fixClaimItems = sqliteTable(
  "fix_claim_item",
  {
    id: text("id").primaryKey(),
    fixClaimId: text("fix_claim_id")
      .notNull()
      .references(() => fixClaims.id, { onDelete: "restrict" }),
    unclaimedFixEntryId: text("unclaimed_fix_entry_id")
      .notNull()
      .unique()
      .references(() => unclaimedFixEntries.id, { onDelete: "restrict" }),
    ledgerEntryId: text("ledger_entry_id").notNull().unique(),
    createdAt: timestamp("created_at"),
  },
  (table) => [index("fix_claim_item_claim_idx").on(table.fixClaimId)],
);
