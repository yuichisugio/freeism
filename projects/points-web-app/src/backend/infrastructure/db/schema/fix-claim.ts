import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { unclaimedFixEntries } from "./fix-ledger";
import { pointsUsers } from "./points-user";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

// --------------------------------------------------
// 未受領 FIX の受領（経済履歴）
// --------------------------------------------------

/**
 * 未受領 FIX の受領コマンド。
 * 受領時点の Accounts 連携を snapshot で残す。
 * 連携は解除で消えるが、受領は経済履歴として残るため外部キーにしない。
 */
export const fixClaimCommands = sqliteTable(
  "fix_claim_command",
  {
    id: text("id").primaryKey(),
    accountsOrigin: text("accounts_origin").notNull(),
    accountsUserId: text("accounts_user_id").notNull(),
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

/**
 * 確定した未受領 FIX の受領。
 * 受領者の Accounts 連携を snapshot で残す。
 */
export const fixClaims = sqliteTable(
  "fix_claim",
  {
    id: text("id").primaryKey(),
    commandId: text("command_id")
      .notNull()
      .unique()
      .references(() => fixClaimCommands.id, { onDelete: "restrict" }),
    accountsOrigin: text("accounts_origin").notNull(),
    accountsUserId: text("accounts_user_id").notNull(),
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

/** 受領した未受領エントリーと、作成した台帳行の対応。 */
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
