import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { auctions } from "./auction";
import { marketsUsers } from "./markets-user";

export const watchlistEntries = sqliteTable(
  "watchlist_entries",
  {
    id: text("id").primaryKey(),
    marketsUserId: text("markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    auctionId: text("auction_id")
      .notNull()
      .references(() => auctions.id),
    createdAt: text("created_at")
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("watchlist_entries_user_auction_uidx").on(table.marketsUserId, table.auctionId),
    index("watchlist_entries_user_created_idx").on(
      table.marketsUserId,
      table.createdAt,
      table.auctionId,
    ),
  ],
);
