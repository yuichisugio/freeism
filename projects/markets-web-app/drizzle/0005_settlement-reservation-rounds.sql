CREATE TABLE `settlement_exclusions` (
	`settlement_id` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`first_round_ordinal` integer NOT NULL,
	`reason` text NOT NULL,
	`blacklist_event_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_exclusions_round_check" CHECK("settlement_exclusions"."first_round_ordinal" between 1 and 9007199254740991),
	CONSTRAINT "settlement_exclusions_reason_check" CHECK("settlement_exclusions"."reason" in ('INSUFFICIENT_BALANCE', 'REAUTH_REQUIRED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_exclusions_user_uidx` ON `settlement_exclusions` (`settlement_id`,`markets_user_id`);--> statement-breakpoint
CREATE TABLE `settlement_round_winners` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_round_id` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`points_connection_id` text NOT NULL,
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
	CONSTRAINT "settlement_round_winners_quantity_check" CHECK("settlement_round_winners"."allocation_quantity" between 1 and 1000),
	CONSTRAINT "settlement_round_winners_attempt_check" CHECK("settlement_round_winners"."attempt_count" between 0 and 9007199254740991),
	CONSTRAINT "settlement_round_winners_status_check" CHECK("settlement_round_winners"."status" in ('PENDING', 'ACTIVE', 'REJECTED', 'UNKNOWN', 'RELEASED', 'EXPIRED', 'CAPTURED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_round_winners_user_uidx` ON `settlement_round_winners` (`settlement_round_id`,`markets_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_round_winners_key_uidx` ON `settlement_round_winners` (`reservation_key`);--> statement-breakpoint
CREATE TABLE `settlement_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`round_ordinal` integer NOT NULL,
	`plan_hash` text NOT NULL,
	`cutoff_hash` text NOT NULL,
	`state` text DEFAULT 'RESERVING' NOT NULL,
	`excluded_user_ids_json` text DEFAULT '[]' NOT NULL,
	`first_attempt_at` text NOT NULL,
	`retry_deadline_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_rounds_ordinal_check" CHECK("settlement_rounds"."round_ordinal" between 1 and 9007199254740991),
	CONSTRAINT "settlement_rounds_plan_hash_check" CHECK(length("settlement_rounds"."plan_hash") = 64),
	CONSTRAINT "settlement_rounds_cutoff_hash_check" CHECK(length("settlement_rounds"."cutoff_hash") = 64),
	CONSTRAINT "settlement_rounds_excluded_json_check" CHECK(json_valid("settlement_rounds"."excluded_user_ids_json")),
	CONSTRAINT "settlement_rounds_deadline_check" CHECK("settlement_rounds"."retry_deadline_at" >= "settlement_rounds"."first_attempt_at"),
	CONSTRAINT "settlement_rounds_state_check" CHECK("settlement_rounds"."state" in ('RESERVING', 'RELEASING', 'RELEASED', 'RESERVED', 'FAILED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_rounds_ordinal_uidx` ON `settlement_rounds` (`settlement_id`,`round_ordinal`);