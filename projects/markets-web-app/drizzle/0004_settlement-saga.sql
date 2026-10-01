CREATE TABLE `auction_close_cutoffs` (
	`auction_id` text PRIMARY KEY NOT NULL,
	`auction_revision_id` text NOT NULL,
	`closed_auction_version` integer NOT NULL,
	`cutoff_at` text NOT NULL,
	`max_bid_seq` integer NOT NULL,
	`eligible_bid_ids_json` text NOT NULL,
	`ranking_input_hash` text NOT NULL,
	`available_quantity` integer NOT NULL,
	`point_package_revision_id` text NOT NULL,
	`package_tick` integer NOT NULL,
	`algorithm_version` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_revision_id`) REFERENCES `auction_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "auction_close_cutoffs_version_check" CHECK("auction_close_cutoffs"."closed_auction_version" between 1 and 9007199254740991),
	CONSTRAINT "auction_close_cutoffs_bid_seq_check" CHECK("auction_close_cutoffs"."max_bid_seq" between 0 and 9007199254740991),
	CONSTRAINT "auction_close_cutoffs_quantity_check" CHECK("auction_close_cutoffs"."available_quantity" between 0 and 1000),
	CONSTRAINT "auction_close_cutoffs_package_tick_check" CHECK("auction_close_cutoffs"."package_tick" between 1 and 9007199254740991),
	CONSTRAINT "auction_close_cutoffs_eligible_json_check" CHECK(json_valid("auction_close_cutoffs"."eligible_bid_ids_json")),
	CONSTRAINT "auction_close_cutoffs_hash_check" CHECK(length("auction_close_cutoffs"."ranking_input_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`kind` text NOT NULL,
	`source_key` text NOT NULL,
	`settlement_revision` integer DEFAULT 1 NOT NULL,
	`workflow_attempt` integer DEFAULT 0 NOT NULL,
	`saga_state` text DEFAULT 'PLANNED' NOT NULL,
	`current_plan_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlements_kind_check" CHECK("settlements"."kind" in ('END_OF_AUCTION', 'BUY_NOW')),
	CONSTRAINT "settlements_revision_check" CHECK("settlements"."settlement_revision" between 1 and 9007199254740991),
	CONSTRAINT "settlements_attempt_check" CHECK("settlements"."workflow_attempt" between 0 and 9007199254740991),
	CONSTRAINT "settlements_state_check" CHECK("settlements"."saga_state" in ('PLANNED', 'RESERVING', 'RESERVED', 'CAPTURING', 'CAPTURED', 'FINALIZING', 'SETTLED', 'MANUAL_ACTION_REQUIRED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlements_source_uidx` ON `settlements` (`auction_id`,`kind`,`source_key`);--> statement-breakpoint
CREATE INDEX `settlements_auction_state_idx` ON `settlements` (`auction_id`,`saga_state`);--> statement-breakpoint
DROP TABLE `settlement_outbox`;--> statement-breakpoint
DROP TABLE `settlement_plans`;--> statement-breakpoint
CREATE TABLE `settlement_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`settlement_revision` integer NOT NULL,
	`workflow_attempt` integer DEFAULT 0 NOT NULL,
	`plan_hash` text NOT NULL,
	`workflow_instance_id` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`delivery_attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error_code` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`dispatched_at` text,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_outbox_revision_check" CHECK("settlement_outbox"."settlement_revision" between 1 and 9007199254740991),
	CONSTRAINT "settlement_outbox_attempt_check" CHECK("settlement_outbox"."workflow_attempt" between 0 and 9007199254740991),
	CONSTRAINT "settlement_outbox_plan_hash_check" CHECK(length("settlement_outbox"."plan_hash") = 64),
	CONSTRAINT "settlement_outbox_status_check" CHECK("settlement_outbox"."status" in ('PENDING', 'DISPATCHED')),
	CONSTRAINT "settlement_outbox_delivery_attempt_check" CHECK("settlement_outbox"."delivery_attempt_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_outbox_attempt_uidx` ON `settlement_outbox` (`settlement_id`,`settlement_revision`,`workflow_attempt`);--> statement-breakpoint
CREATE INDEX `settlement_outbox_status_idx` ON `settlement_outbox` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `settlement_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`settlement_revision` integer NOT NULL,
	`plan_json` text NOT NULL,
	`plan_hash` text NOT NULL,
	`algorithm_version` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_plans_revision_check" CHECK("settlement_plans"."settlement_revision" between 1 and 9007199254740991),
	CONSTRAINT "settlement_plans_json_check" CHECK(json_valid("settlement_plans"."plan_json")),
	CONSTRAINT "settlement_plans_hash_check" CHECK(length("settlement_plans"."plan_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_plans_revision_uidx` ON `settlement_plans` (`settlement_id`,`settlement_revision`);--> statement-breakpoint
CREATE TRIGGER `settlement_plans_append_only_update`
BEFORE UPDATE ON `settlement_plans`
BEGIN
	SELECT RAISE(ABORT, 'SETTLEMENT_PLAN_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER `settlement_plans_append_only_delete`
BEFORE DELETE ON `settlement_plans`
BEGIN
	SELECT RAISE(ABORT, 'SETTLEMENT_PLAN_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER `auction_close_cutoffs_append_only_update`
BEFORE UPDATE ON `auction_close_cutoffs`
BEGIN
	SELECT RAISE(ABORT, 'AUCTION_CLOSE_CUTOFF_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER `auction_close_cutoffs_append_only_delete`
BEFORE DELETE ON `auction_close_cutoffs`
BEGIN
	SELECT RAISE(ABORT, 'AUCTION_CLOSE_CUTOFF_IMMUTABLE');
END;
