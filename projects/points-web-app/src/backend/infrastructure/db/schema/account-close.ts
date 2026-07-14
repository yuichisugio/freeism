import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { identityOwnerships } from "./ownership";
import { pointsUsers } from "./points-user";

export const accountCloseOwnershipSuspensions = sqliteTable(
  "account_close_ownership_suspension",
  {
    id: text("id").primaryKey(),
    closeReceiptId: text("close_receipt_id").notNull(),
    pointsUserId: text("points_user_id")
      .notNull()
      .references(() => pointsUsers.id, { onDelete: "restrict" }),
    identityOwnershipId: text("identity_ownership_id")
      .notNull()
      .references(() => identityOwnerships.id, { onDelete: "restrict" }),
    suspendedAt: integer("suspended_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    restoredAt: integer("restored_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("account_close_suspension_receipt_ownership_uidx").on(
      table.closeReceiptId,
      table.identityOwnershipId,
    ),
    uniqueIndex("account_close_suspension_unrestored_ownership_uidx")
      .on(table.identityOwnershipId)
      .where(sql`${table.restoredAt} is null`),
    index("account_close_suspension_user_idx").on(table.pointsUserId, table.restoredAt),
  ],
);
