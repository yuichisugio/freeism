CREATE TABLE `auction_close_resume_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`buy_now_hold_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`settlement_outbox_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`dispatched_at` text,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buy_now_hold_id`) REFERENCES `buy_now_holds`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "auction_close_resume_outbox_status_check" CHECK("auction_close_resume_outbox"."status" in ('PENDING', 'DISPATCHED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auction_close_resume_outbox_hold_uidx` ON `auction_close_resume_outbox` (`buy_now_hold_id`);--> statement-breakpoint
CREATE INDEX `auction_close_resume_outbox_status_idx` ON `auction_close_resume_outbox` (`status`,`created_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settlement_round_winners` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_round_id` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`points_connection_id` text,
	`allocation_quantity` integer NOT NULL,
	`price_tick_count` integer NOT NULL,
	`price_ticks` integer NOT NULL,
	`reservation_key` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`point_reservation_id` text,
	`vector_hash` text,
	`expires_at` text,
	`failure_class` text,
	`failure_code` text,
	`failure_hash` text,
	`release_receipt_id` text,
	`release_content_hash` text,
	`released_at` text,
	`points_request_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_round_id`) REFERENCES `settlement_rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`points_connection_id`) REFERENCES `points_connection`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_round_winners_quantity_check" CHECK("__new_settlement_round_winners"."allocation_quantity" between 1 and 1000),
	CONSTRAINT "settlement_round_winners_attempt_check" CHECK("__new_settlement_round_winners"."attempt_count" between 0 and 9007199254740991),
	CONSTRAINT "settlement_round_winners_status_check" CHECK("__new_settlement_round_winners"."status" in ('PENDING', 'ACTIVE', 'REJECTED', 'UNKNOWN', 'RELEASED', 'EXPIRED', 'CAPTURED'))
);
--> statement-breakpoint
INSERT INTO `__new_settlement_round_winners`("id", "settlement_round_id", "markets_user_id", "points_connection_id", "allocation_quantity", "price_tick_count", "price_ticks", "reservation_key", "attempt_count", "status", "point_reservation_id", "vector_hash", "expires_at", "failure_class", "failure_code", "failure_hash", "release_receipt_id", "release_content_hash", "released_at", "points_request_id", "created_at", "updated_at") SELECT "id", "settlement_round_id", "markets_user_id", "points_connection_id", "allocation_quantity", "price_tick_count", "price_ticks", "reservation_key", "attempt_count", "status", "point_reservation_id", "vector_hash", "expires_at", "failure_class", "failure_code", "failure_hash", "release_receipt_id", "release_content_hash", "released_at", "points_request_id", "created_at", "updated_at" FROM `settlement_round_winners`;--> statement-breakpoint
DROP TABLE `settlement_round_winners`;--> statement-breakpoint
ALTER TABLE `__new_settlement_round_winners` RENAME TO `settlement_round_winners`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_round_winners_user_uidx` ON `settlement_round_winners` (`settlement_round_id`,`markets_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_round_winners_key_uidx` ON `settlement_round_winners` (`reservation_key`);