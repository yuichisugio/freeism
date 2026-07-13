CREATE TABLE `auction_blacklist_events` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`reason_code` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auction_blacklist_events_user_uidx` ON `auction_blacklist_events` (`auction_id`,`markets_user_id`);--> statement-breakpoint
CREATE TABLE `auction_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`command_id` text NOT NULL,
	`actor_markets_user_id` text NOT NULL,
	`operation` text NOT NULL,
	`payload_hash` text NOT NULL,
	`expected_auction_version` integer NOT NULL,
	`status` text NOT NULL,
	`response_body` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "auction_commands_payload_hash_check" CHECK(length("auction_commands"."payload_hash") = 64),
	CONSTRAINT "auction_commands_expected_version_check" CHECK("auction_commands"."expected_auction_version" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auction_commands_auction_command_uidx` ON `auction_commands` (`auction_id`,`command_id`);--> statement-breakpoint
CREATE TABLE `auction_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`external_url` text NOT NULL,
	`seller_identity_snapshot` text NOT NULL,
	`points_issuer` text NOT NULL,
	`point_package_snapshot_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`package_tick` integer NOT NULL,
	`buy_now_price_tick_count` integer,
	`extension_rule_json` text,
	`eligibility_receipt_id` text NOT NULL,
	`auction_command_id` text NOT NULL,
	`auction_command_hash` text NOT NULL,
	`package_eligibility_version` integer NOT NULL,
	`eligibility_checked_at` text NOT NULL,
	`eligibility_valid_until` text NOT NULL,
	`commit_started_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`point_package_snapshot_id`) REFERENCES `point_package_snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "auction_revisions_revision_check" CHECK("auction_revisions"."revision_number" between 1 and 9007199254740991),
	CONSTRAINT "auction_revisions_quantity_check" CHECK("auction_revisions"."quantity" between 1 and 1000),
	CONSTRAINT "auction_revisions_package_tick_check" CHECK("auction_revisions"."package_tick" between 1 and 9007199254740991),
	CONSTRAINT "auction_revisions_buy_now_tick_count_check" CHECK("auction_revisions"."buy_now_price_tick_count" is null or "auction_revisions"."buy_now_price_tick_count" between 1 and 9007199254740991),
	CONSTRAINT "auction_revisions_seller_snapshot_check" CHECK(json_valid("auction_revisions"."seller_identity_snapshot")),
	CONSTRAINT "auction_revisions_extension_rule_check" CHECK("auction_revisions"."extension_rule_json" is null or json_valid("auction_revisions"."extension_rule_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auction_revisions_number_uidx` ON `auction_revisions` (`auction_id`,`revision_number`);--> statement-breakpoint
CREATE TABLE `auctions` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_markets_user_id` text NOT NULL,
	`current_revision_id` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`seller_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "auctions_status_check" CHECK("auctions"."status" in ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSING', 'SETTLING', 'SETTLED', 'CANCELLED', 'SETTLEMENT_RETRYABLE', 'SETTLEMENT_MANUAL_ACTION_REQUIRED')),
	CONSTRAINT "auctions_version_check" CHECK("auctions"."version" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE INDEX `auctions_seller_status_idx` ON `auctions` (`seller_markets_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `auto_bid_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`bidder_markets_user_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`auto_bid_max_tick_count` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bidder_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "auto_bid_rules_quantity_check" CHECK("auto_bid_rules"."quantity" between 1 and 1000),
	CONSTRAINT "auto_bid_rules_max_tick_count_check" CHECK("auto_bid_rules"."auto_bid_max_tick_count" between 0 and 9007199254740991),
	CONSTRAINT "auto_bid_rules_active_check" CHECK("auto_bid_rules"."active" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_bid_rules_auction_user_uidx` ON `auto_bid_rules` (`auction_id`,`bidder_markets_user_id`);--> statement-breakpoint
CREATE TABLE `bid_events` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`bid_seq` integer NOT NULL,
	`bidder_markets_user_id` text NOT NULL,
	`command_id` text NOT NULL,
	`event_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`price_tick_count` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bidder_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bid_events_bid_seq_check" CHECK("bid_events"."bid_seq" between 1 and 9007199254740991),
	CONSTRAINT "bid_events_quantity_check" CHECK("bid_events"."quantity" between 1 and 1000),
	CONSTRAINT "bid_events_price_tick_count_check" CHECK("bid_events"."price_tick_count" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bid_events_auction_sequence_uidx` ON `bid_events` (`auction_id`,`bid_seq`);--> statement-breakpoint
CREATE TABLE `bid_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`bidder_markets_user_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`price_tick_count` integer NOT NULL,
	`reached_sequence` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bidder_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bid_positions_quantity_check" CHECK("bid_positions"."quantity" between 1 and 1000),
	CONSTRAINT "bid_positions_price_tick_count_check" CHECK("bid_positions"."price_tick_count" between 0 and 9007199254740991),
	CONSTRAINT "bid_positions_reached_sequence_check" CHECK("bid_positions"."reached_sequence" between 1 and 9007199254740991),
	CONSTRAINT "bid_positions_status_check" CHECK("bid_positions"."status" in ('ACTIVE', 'INACTIVE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bid_positions_active_user_uidx` ON `bid_positions` (`auction_id`,`bidder_markets_user_id`);--> statement-breakpoint
CREATE TABLE `buy_now_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`auction_id` text NOT NULL,
	`buyer_markets_user_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`buy_now_price_tick_count` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "buy_now_holds_quantity_check" CHECK("buy_now_holds"."quantity" between 1 and 1000),
	CONSTRAINT "buy_now_holds_price_tick_count_check" CHECK("buy_now_holds"."buy_now_price_tick_count" between 1 and 9007199254740991),
	CONSTRAINT "buy_now_holds_status_check" CHECK("buy_now_holds"."status" in ('PENDING', 'CAPTURED_PENDING_FINALIZE', 'SETTLED', 'FAILED_RESTORED'))
);
--> statement-breakpoint
CREATE INDEX `buy_now_holds_auction_status_idx` ON `buy_now_holds` (`auction_id`,`status`);--> statement-breakpoint
CREATE TABLE `point_package_snapshot_components` (
	`id` text PRIMARY KEY NOT NULL,
	`point_package_snapshot_id` text NOT NULL,
	`evaluation_criterion_id` text NOT NULL,
	`evaluation_criterion_revision_id` text NOT NULL,
	`evaluation_criterion_name` text NOT NULL,
	`weight` integer NOT NULL,
	`minimum_unit_scaled` integer NOT NULL,
	`display_order` integer NOT NULL,
	FOREIGN KEY (`point_package_snapshot_id`) REFERENCES `point_package_snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "point_package_snapshot_components_weight_check" CHECK("point_package_snapshot_components"."weight" between 1 and 9007199254740991),
	CONSTRAINT "point_package_snapshot_components_unit_check" CHECK("point_package_snapshot_components"."minimum_unit_scaled" between 1 and 9007199254740991),
	CONSTRAINT "point_package_snapshot_components_order_check" CHECK("point_package_snapshot_components"."display_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_snapshot_components_criterion_uidx` ON `point_package_snapshot_components` (`point_package_snapshot_id`,`evaluation_criterion_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_snapshot_components_order_uidx` ON `point_package_snapshot_components` (`point_package_snapshot_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `point_package_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`point_package_id` text NOT NULL,
	`point_package_revision_id` text NOT NULL,
	`name` text NOT NULL,
	`total_weight` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "point_package_snapshots_total_weight_check" CHECK("point_package_snapshots"."total_weight" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_snapshots_revision_uidx` ON `point_package_snapshots` (`point_package_revision_id`);--> statement-breakpoint
CREATE TABLE `turnstile_token_replays` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`operation` text NOT NULL,
	`hostname` text NOT NULL,
	`action` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "turnstile_token_replays_hash_check" CHECK(length("turnstile_token_replays"."token_hash") = 64)
);
--> statement-breakpoint
CREATE INDEX `turnstile_token_replays_expiry_idx` ON `turnstile_token_replays` (`expires_at`);--> statement-breakpoint
CREATE TABLE `websocket_slot_leases` (
	`id` text PRIMARY KEY NOT NULL,
	`markets_user_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`user_slot` integer NOT NULL,
	`auction_slot` integer NOT NULL,
	`lease_expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "websocket_slot_leases_user_slot_check" CHECK("websocket_slot_leases"."user_slot" between 1 and 20),
	CONSTRAINT "websocket_slot_leases_auction_slot_check" CHECK("websocket_slot_leases"."auction_slot" between 1 and 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `websocket_slot_leases_user_slot_uidx` ON `websocket_slot_leases` (`markets_user_id`,`user_slot`);--> statement-breakpoint
CREATE UNIQUE INDEX `websocket_slot_leases_auction_slot_uidx` ON `websocket_slot_leases` (`markets_user_id`,`auction_id`,`auction_slot`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_markets_user_id` text,
	`event_code` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text,
	`request_id` text NOT NULL,
	`environment` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`actor_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "audit_events_before_json_check" CHECK("audit_events"."before_json" is null or json_valid("audit_events"."before_json")),
	CONSTRAINT "audit_events_after_json_check" CHECK("audit_events"."after_json" is null or json_valid("audit_events"."after_json"))
);
--> statement-breakpoint
CREATE INDEX `audit_events_target_idx` ON `audit_events` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `idempotency_results` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_markets_user_id` text NOT NULL,
	`operation` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`state` text DEFAULT 'PENDING' NOT NULL,
	`response_status` integer,
	`response_body` text,
	`response_content_type` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`actor_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "idempotency_results_key_check" CHECK(length("idempotency_results"."idempotency_key") between 1 and 200),
	CONSTRAINT "idempotency_results_payload_hash_check" CHECK(length("idempotency_results"."payload_hash") = 64),
	CONSTRAINT "idempotency_results_state_check" CHECK("idempotency_results"."state" in ('PENDING', 'COMPLETED')),
	CONSTRAINT "idempotency_results_response_status_check" CHECK("idempotency_results"."response_status" is null or "idempotency_results"."response_status" between 100 and 599)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_results_actor_operation_key_uidx` ON `idempotency_results` (`actor_markets_user_id`,`operation`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `ops_alerts` (
	`dedupe_key` text PRIMARY KEY NOT NULL,
	`signal` text NOT NULL,
	`severity` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`resolved_at` text,
	`status` text NOT NULL,
	`delivery_attempt_count` integer DEFAULT 0 NOT NULL,
	`safe_detail_code` text NOT NULL,
	CONSTRAINT "ops_alerts_severity_check" CHECK("ops_alerts"."severity" in ('INFO', 'WARNING', 'CRITICAL')),
	CONSTRAINT "ops_alerts_status_check" CHECK("ops_alerts"."status" in ('OPEN', 'RESOLVED')),
	CONSTRAINT "ops_alerts_delivery_attempt_check" CHECK("ops_alerts"."delivery_attempt_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `ops_alerts_status_seen_idx` ON `ops_alerts` (`status`,`last_seen_at`);--> statement-breakpoint
CREATE TRIGGER `audit_events_append_only_update`
BEFORE UPDATE ON `audit_events`
BEGIN
	SELECT RAISE(ABORT, 'AUDIT_EVENT_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER `audit_events_append_only_delete`
BEFORE DELETE ON `audit_events`
BEGIN
	SELECT RAISE(ABORT, 'AUDIT_EVENT_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER `bid_events_append_only_update`
BEFORE UPDATE ON `bid_events`
BEGIN
	SELECT RAISE(ABORT, 'BID_EVENT_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER `bid_events_append_only_delete`
BEFORE DELETE ON `bid_events`
BEGIN
	SELECT RAISE(ABORT, 'BID_EVENT_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER `auction_revisions_append_only_update`
BEFORE UPDATE ON `auction_revisions`
BEGIN
	SELECT RAISE(ABORT, 'AUCTION_REVISION_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER `auction_revisions_append_only_delete`
BEFORE DELETE ON `auction_revisions`
BEGIN
	SELECT RAISE(ABORT, 'AUCTION_REVISION_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER `auctions_cancelled_terminal`
BEFORE UPDATE OF `status` ON `auctions`
WHEN OLD.`status` = 'CANCELLED' AND NEW.`status` <> 'CANCELLED'
BEGIN
	SELECT RAISE(ABORT, 'AUCTION_CANCELLED_TERMINAL');
END;--> statement-breakpoint
CREATE TRIGGER `auctions_cancellation_guard`
BEFORE UPDATE OF `status` ON `auctions`
WHEN NEW.`status` = 'CANCELLED' AND OLD.`status` <> 'CANCELLED'
BEGIN
	SELECT CASE
		WHEN OLD.`status` NOT IN ('DRAFT', 'SCHEDULED')
		THEN RAISE(ABORT, 'AUCTION_CANCELLATION_INVALID_STATE')
	END;
	SELECT CASE
		WHEN EXISTS (SELECT 1 FROM `bid_events` WHERE `auction_id` = OLD.`id`)
		  OR EXISTS (SELECT 1 FROM `auto_bid_rules` WHERE `auction_id` = OLD.`id` AND `active` = 1)
		  OR EXISTS (SELECT 1 FROM `buy_now_holds` WHERE `auction_id` = OLD.`id` AND `status` <> 'FAILED_RESTORED')
		THEN RAISE(ABORT, 'AUCTION_CANCELLATION_BLOCKED')
	END;
END;
