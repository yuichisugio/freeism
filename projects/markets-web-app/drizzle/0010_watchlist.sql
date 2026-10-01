CREATE TABLE `watchlist_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`markets_user_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watchlist_entries_user_auction_uidx` ON `watchlist_entries` (`markets_user_id`,`auction_id`);--> statement-breakpoint
CREATE INDEX `watchlist_entries_user_created_idx` ON `watchlist_entries` (`markets_user_id`,`created_at`,`auction_id`);
