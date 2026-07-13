CREATE TABLE `settlement_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`workflow_attempt` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlement_plans`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_outbox_attempt_check" CHECK("settlement_outbox"."workflow_attempt" = 0),
	CONSTRAINT "settlement_outbox_status_check" CHECK("settlement_outbox"."status" = 'PENDING')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_outbox_attempt_uidx` ON `settlement_outbox` (`settlement_id`,`workflow_attempt`);--> statement-breakpoint
CREATE TABLE `settlement_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`auction_revision_id` text NOT NULL,
	`kind` text NOT NULL,
	`command_id` text NOT NULL,
	`buy_now_hold_id` text NOT NULL,
	`buyer_markets_user_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`price_tick_count` integer NOT NULL,
	`plan_json` text NOT NULL,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_revision_id`) REFERENCES `auction_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buy_now_hold_id`) REFERENCES `buy_now_holds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_plans_kind_check" CHECK("settlement_plans"."kind" = 'BUY_NOW'),
	CONSTRAINT "settlement_plans_quantity_check" CHECK("settlement_plans"."quantity" between 1 and 1000),
	CONSTRAINT "settlement_plans_price_tick_count_check" CHECK("settlement_plans"."price_tick_count" between 1 and 9007199254740991),
	CONSTRAINT "settlement_plans_json_check" CHECK(json_valid("settlement_plans"."plan_json")),
	CONSTRAINT "settlement_plans_status_check" CHECK("settlement_plans"."status" = 'PLANNED')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_plans_buy_now_hold_uidx` ON `settlement_plans` (`buy_now_hold_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_plans_auction_command_uidx` ON `settlement_plans` (`auction_id`,`command_id`);
--> statement-breakpoint
CREATE TRIGGER `auction_commands_market_command_guard`
BEFORE INSERT ON `auction_commands`
WHEN NEW.`operation` IN ('PLACE_BID', 'CANCEL_AUTO_BID', 'BUY_NOW')
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `auctions`
		WHERE `id` = NEW.`auction_id` AND `status` = 'OPEN'
	) THEN RAISE(ABORT, 'AUCTION_NOT_OPEN') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `auctions`
		WHERE `id` = NEW.`auction_id` AND `seller_markets_user_id` = NEW.`actor_markets_user_id`
	) THEN RAISE(ABORT, 'SELLER_CANNOT_BID') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `points_connection`
		WHERE `markets_user_id` = NEW.`actor_markets_user_id` AND `status` = 'ACTIVE'
	) THEN RAISE(ABORT, 'POINTS_LINK_REQUIRED') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `auctions`
		WHERE `id` = NEW.`auction_id` AND `version` = NEW.`expected_auction_version`
	) THEN RAISE(ABORT, 'AUCTION_VERSION_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER `settlement_plans_append_only_update`
BEFORE UPDATE ON `settlement_plans`
BEGIN
	SELECT RAISE(ABORT, 'SETTLEMENT_PLAN_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `settlement_plans_append_only_delete`
BEFORE DELETE ON `settlement_plans`
BEGIN
	SELECT RAISE(ABORT, 'SETTLEMENT_PLAN_IMMUTABLE');
END;
