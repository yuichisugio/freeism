CREATE TABLE `points_provider` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`origin` text NOT NULL,
	`issuer` text NOT NULL,
	`resource` text NOT NULL,
	`client_id` text,
	`client_public_jwk` text NOT NULL,
	`signing_key_ciphertext` text,
	`dpop_key_ciphertext` text,
	`status` text DEFAULT 'PENDING_CLIENT_REGISTRATION' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`activated_at` integer,
	`stopped_at` integer,
	CONSTRAINT "points_provider_status_check" CHECK("points_provider"."status" in ('PENDING_CLIENT_REGISTRATION', 'ACTIVE', 'STOPPED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_provider_origin_uidx` ON `points_provider` (`origin`);--> statement-breakpoint
CREATE INDEX `points_provider_status_idx` ON `points_provider` (`status`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settlement_capture_receipts` (
	`capture_receipt_id` text NOT NULL,
	`settlement_id` text NOT NULL,
	`settlement_round_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`plan_hash` text NOT NULL,
	`captured_at` text NOT NULL,
	`content_hash` text NOT NULL,
	`reservations_json` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`settlement_id`, `capture_receipt_id`),
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_round_id`) REFERENCES `settlement_rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_capture_receipts_plan_hash_check" CHECK(length("__new_settlement_capture_receipts"."plan_hash") = 71 and substr("__new_settlement_capture_receipts"."plan_hash", 1, 7) = 'sha256:' and substr("__new_settlement_capture_receipts"."plan_hash", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "settlement_capture_receipts_content_hash_check" CHECK(length("__new_settlement_capture_receipts"."content_hash") = 71 and substr("__new_settlement_capture_receipts"."content_hash", 1, 7) = 'sha256:' and substr("__new_settlement_capture_receipts"."content_hash", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "settlement_capture_receipts_reservations_json_check" CHECK(json_valid("__new_settlement_capture_receipts"."reservations_json"))
);
--> statement-breakpoint
INSERT INTO `__new_settlement_capture_receipts`("capture_receipt_id", "settlement_id", "settlement_round_id", "auction_id", "plan_hash", "captured_at", "content_hash", "reservations_json", "created_at") SELECT "capture_receipt_id", "settlement_id", "settlement_round_id", "auction_id", "plan_hash", "captured_at", "content_hash", "reservations_json", "created_at" FROM `settlement_capture_receipts`;--> statement-breakpoint
DROP TABLE `settlement_capture_receipts`;--> statement-breakpoint
ALTER TABLE `__new_settlement_capture_receipts` RENAME TO `settlement_capture_receipts`;--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_capture_receipts_settlement_uidx` ON `settlement_capture_receipts` (`settlement_id`);--> statement-breakpoint
CREATE TABLE `__new_settlement_finalize_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`capture_receipt_id` text NOT NULL,
	`plan_hash` text NOT NULL,
	`proof_ids_json` text NOT NULL,
	`proof_set_hash` text NOT NULL,
	`finalized_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`,`capture_receipt_id`) REFERENCES `settlement_capture_receipts`(`settlement_id`,`capture_receipt_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_finalize_receipts_plan_hash_check" CHECK(length("__new_settlement_finalize_receipts"."plan_hash") = 71 and substr("__new_settlement_finalize_receipts"."plan_hash", 1, 7) = 'sha256:' and substr("__new_settlement_finalize_receipts"."plan_hash", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "settlement_finalize_receipts_proof_ids_check" CHECK(json_valid("__new_settlement_finalize_receipts"."proof_ids_json")),
	CONSTRAINT "settlement_finalize_receipts_proof_set_hash_check" CHECK(length("__new_settlement_finalize_receipts"."proof_set_hash") = 64)
);
--> statement-breakpoint
INSERT INTO `__new_settlement_finalize_receipts`("id", "settlement_id", "capture_receipt_id", "plan_hash", "proof_ids_json", "proof_set_hash", "finalized_at", "created_at") SELECT "id", "settlement_id", "capture_receipt_id", "plan_hash", "proof_ids_json", "proof_set_hash", "finalized_at", "created_at" FROM `settlement_finalize_receipts`;--> statement-breakpoint
DROP TABLE `settlement_finalize_receipts`;--> statement-breakpoint
ALTER TABLE `__new_settlement_finalize_receipts` RENAME TO `settlement_finalize_receipts`;--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_finalize_receipts_settlement_uidx` ON `settlement_finalize_receipts` (`settlement_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TRIGGER settlement_capture_receipts_no_update
BEFORE UPDATE ON settlement_capture_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_CAPTURE_RECEIPT_IMMUTABLE'); END;--> statement-breakpoint
CREATE TRIGGER settlement_capture_receipts_no_delete
BEFORE DELETE ON settlement_capture_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_CAPTURE_RECEIPT_IMMUTABLE'); END;--> statement-breakpoint
CREATE TRIGGER settlement_finalize_receipts_no_update
BEFORE UPDATE ON settlement_finalize_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_FINALIZE_RECEIPT_IMMUTABLE'); END;--> statement-breakpoint
CREATE TRIGGER settlement_finalize_receipts_no_delete
BEFORE DELETE ON settlement_finalize_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_FINALIZE_RECEIPT_IMMUTABLE'); END;--> statement-breakpoint
DROP INDEX `points_connection_live_markets_user_uidx`;--> statement-breakpoint
DROP INDEX `points_connection_live_subject_uidx`;--> statement-breakpoint
ALTER TABLE `points_connection` ADD `provider_id` text NOT NULL REFERENCES points_provider(id);--> statement-breakpoint
CREATE UNIQUE INDEX `points_connection_live_markets_user_provider_uidx` ON `points_connection` (`markets_user_id`,`provider_id`) WHERE "points_connection"."status" IN ('PENDING_CONFIRMATION', 'ACTIVE');--> statement-breakpoint
CREATE UNIQUE INDEX `points_connection_live_subject_uidx` ON `points_connection` (`provider_id`,`points_subject`) WHERE "points_connection"."status" IN ('PENDING_CONFIRMATION', 'ACTIVE');--> statement-breakpoint
DROP INDEX `settlement_allocations_reservation_uidx`;--> statement-breakpoint
DROP INDEX `point_package_snapshots_revision_uidx`;--> statement-breakpoint
ALTER TABLE `point_package_snapshots` ADD `provider_id` text NOT NULL REFERENCES points_provider(id);--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_snapshots_revision_uidx` ON `point_package_snapshots` (`provider_id`,`point_package_revision_id`);--> statement-breakpoint
ALTER TABLE `auctions` ADD `provider_id` text NOT NULL REFERENCES points_provider(id);--> statement-breakpoint
ALTER TABLE `points_oauth_state` ADD `provider_id` text NOT NULL REFERENCES points_provider(id);--> statement-breakpoint
ALTER TABLE `points_oauth_state` ADD `reauth_connection_id` text;--> statement-breakpoint
ALTER TABLE `points_unlink_authorization` ADD `provider_id` text NOT NULL REFERENCES points_provider(id);
--> statement-breakpoint
DROP TRIGGER `auction_commands_market_command_guard`;
--> statement-breakpoint
CREATE TRIGGER `auction_commands_market_command_guard`
BEFORE INSERT ON `auction_commands`
WHEN NEW.`operation` IN ('PLACE_BID', 'CANCEL_AUTO_BID', 'BUY_NOW')
BEGIN
	SELECT RAISE(ABORT, 'AUCTION_NOT_OPEN') WHERE NOT EXISTS (
		SELECT 1 FROM `auctions` WHERE `id` = NEW.`auction_id` AND `status` = 'OPEN'
	);
	SELECT RAISE(ABORT, 'SELLER_CANNOT_BID') WHERE EXISTS (
		SELECT 1 FROM `auctions`
		WHERE `id` = NEW.`auction_id` AND `seller_markets_user_id` = NEW.`actor_markets_user_id`
	);
	SELECT RAISE(ABORT, 'POINTS_PROVIDER_INACTIVE')
	WHERE NEW.`operation` IN ('PLACE_BID', 'BUY_NOW') AND NOT EXISTS (
		SELECT 1 FROM `auctions` a
		JOIN `points_provider` p ON p.`id` = a.`provider_id`
		WHERE a.`id` = NEW.`auction_id` AND p.`status` = 'ACTIVE'
	);
	SELECT RAISE(ABORT, 'POINTS_LINK_REQUIRED')
	WHERE NEW.`operation` IN ('PLACE_BID', 'BUY_NOW') AND NOT EXISTS (
		SELECT 1 FROM `auctions` a
		JOIN `points_connection` c ON c.`provider_id` = a.`provider_id`
		WHERE a.`id` = NEW.`auction_id`
		  AND c.`markets_user_id` = NEW.`actor_markets_user_id`
		  AND c.`status` = 'ACTIVE'
	);
	SELECT RAISE(ABORT, 'AUCTION_VERSION_CONFLICT') WHERE NOT EXISTS (
		SELECT 1 FROM `auctions`
		WHERE `id` = NEW.`auction_id` AND `version` = NEW.`expected_auction_version`
	);
END;
--> statement-breakpoint
CREATE TRIGGER `auctions_points_provider_active_guard`
BEFORE INSERT ON `auctions`
BEGIN
	SELECT RAISE(ABORT, 'POINTS_PROVIDER_INACTIVE') WHERE NOT EXISTS (
		SELECT 1 FROM `points_provider`
		WHERE `id` = NEW.`provider_id` AND `status` = 'ACTIVE'
	);
END;
