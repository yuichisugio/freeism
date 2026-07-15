CREATE TABLE `proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`allocation_id` text NOT NULL,
	`settlement_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`auction_revision_id` text NOT NULL,
	`buyer_markets_user_id` text NOT NULL,
	`point_package_revision_id` text NOT NULL,
	`item_snapshot_json` text NOT NULL,
	`seller_identity_snapshot_json` text NOT NULL,
	`buyer_identity_snapshot_json` text NOT NULL,
	`allocation_quantity` integer NOT NULL,
	`uniform_price_tick_count` integer NOT NULL,
	`price_ticks` integer NOT NULL,
	`component_vector_json` text NOT NULL,
	`completion_status` text NOT NULL,
	`settled_at` text NOT NULL,
	`plan_hash` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`allocation_id`) REFERENCES `settlement_allocations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_revision_id`) REFERENCES `auction_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "proofs_item_snapshot_check" CHECK(json_valid("proofs"."item_snapshot_json")),
	CONSTRAINT "proofs_seller_snapshot_check" CHECK(json_valid("proofs"."seller_identity_snapshot_json")),
	CONSTRAINT "proofs_buyer_snapshot_check" CHECK(json_valid("proofs"."buyer_identity_snapshot_json")),
	CONSTRAINT "proofs_component_vector_check" CHECK(json_valid("proofs"."component_vector_json")),
	CONSTRAINT "proofs_quantity_check" CHECK("proofs"."allocation_quantity" between 1 and 1000),
	CONSTRAINT "proofs_uniform_price_check" CHECK("proofs"."uniform_price_tick_count" between 0 and 9007199254740991),
	CONSTRAINT "proofs_price_ticks_check" CHECK("proofs"."price_ticks" between 0 and 9007199254740991),
	CONSTRAINT "proofs_status_check" CHECK("proofs"."completion_status" = 'SETTLED'),
	CONSTRAINT "proofs_plan_hash_check" CHECK(length("proofs"."plan_hash") = 64),
	CONSTRAINT "proofs_content_hash_check" CHECK(length("proofs"."content_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proofs_allocation_uidx` ON `proofs` (`allocation_id`);--> statement-breakpoint
CREATE TABLE `settlement_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`settlement_round_id` text NOT NULL,
	`allocation_ordinal` integer NOT NULL,
	`auction_id` text NOT NULL,
	`buyer_markets_user_id` text NOT NULL,
	`point_reservation_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`uniform_price_tick_count` integer NOT NULL,
	`price_ticks` integer NOT NULL,
	`vector_hash` text NOT NULL,
	`settled_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_round_id`) REFERENCES `settlement_rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_allocations_ordinal_check" CHECK("settlement_allocations"."allocation_ordinal" between 1 and 9007199254740991),
	CONSTRAINT "settlement_allocations_quantity_check" CHECK("settlement_allocations"."quantity" between 1 and 1000),
	CONSTRAINT "settlement_allocations_uniform_price_check" CHECK("settlement_allocations"."uniform_price_tick_count" between 0 and 9007199254740991),
	CONSTRAINT "settlement_allocations_price_ticks_check" CHECK("settlement_allocations"."price_ticks" between 0 and 9007199254740991),
	CONSTRAINT "settlement_allocations_vector_hash_check" CHECK(length("settlement_allocations"."vector_hash") = 64 or (length("settlement_allocations"."vector_hash") = 71 and substr("settlement_allocations"."vector_hash", 1, 7) = 'sha256:'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_allocations_ordinal_uidx` ON `settlement_allocations` (`settlement_id`,`allocation_ordinal`);--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_allocations_buyer_uidx` ON `settlement_allocations` (`settlement_id`,`buyer_markets_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_allocations_reservation_uidx` ON `settlement_allocations` (`point_reservation_id`);--> statement-breakpoint
CREATE TABLE `settlement_capture_receipts` (
	`capture_receipt_id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`settlement_round_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`plan_hash` text NOT NULL,
	`captured_at` text NOT NULL,
	`content_hash` text NOT NULL,
	`reservations_json` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_round_id`) REFERENCES `settlement_rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_capture_receipts_plan_hash_check" CHECK(length("settlement_capture_receipts"."plan_hash") = 64),
	CONSTRAINT "settlement_capture_receipts_content_hash_check" CHECK(length("settlement_capture_receipts"."content_hash") = 71 and substr("settlement_capture_receipts"."content_hash", 1, 7) = 'sha256:' and substr("settlement_capture_receipts"."content_hash", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "settlement_capture_receipts_reservations_json_check" CHECK(json_valid("settlement_capture_receipts"."reservations_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_capture_receipts_settlement_uidx` ON `settlement_capture_receipts` (`settlement_id`);--> statement-breakpoint
CREATE TABLE `settlement_finalize_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`capture_receipt_id` text NOT NULL,
	`plan_hash` text NOT NULL,
	`proof_ids_json` text NOT NULL,
	`proof_set_hash` text NOT NULL,
	`finalized_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`capture_receipt_id`) REFERENCES `settlement_capture_receipts`(`capture_receipt_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_finalize_receipts_plan_hash_check" CHECK(length("settlement_finalize_receipts"."plan_hash") = 64),
	CONSTRAINT "settlement_finalize_receipts_proof_ids_check" CHECK(json_valid("settlement_finalize_receipts"."proof_ids_json")),
	CONSTRAINT "settlement_finalize_receipts_proof_set_hash_check" CHECK(length("settlement_finalize_receipts"."proof_set_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_finalize_receipts_settlement_uidx` ON `settlement_finalize_receipts` (`settlement_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_finalize_receipts_capture_uidx` ON `settlement_finalize_receipts` (`capture_receipt_id`);--> statement-breakpoint
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
	`component_vector_json` text,
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
	CONSTRAINT "settlement_round_winners_status_check" CHECK("__new_settlement_round_winners"."status" in ('PENDING', 'ACTIVE', 'REJECTED', 'UNKNOWN', 'RELEASED', 'EXPIRED', 'CAPTURED')),
	CONSTRAINT "settlement_round_winners_component_vector_check" CHECK("__new_settlement_round_winners"."component_vector_json" is null or json_valid("__new_settlement_round_winners"."component_vector_json"))
);
--> statement-breakpoint
INSERT INTO `__new_settlement_round_winners`("id", "settlement_round_id", "markets_user_id", "points_connection_id", "allocation_quantity", "price_tick_count", "price_ticks", "reservation_key", "attempt_count", "status", "point_reservation_id", "vector_hash", "component_vector_json", "expires_at", "failure_class", "failure_code", "failure_hash", "release_receipt_id", "release_content_hash", "released_at", "points_request_id", "created_at", "updated_at") SELECT "id", "settlement_round_id", "markets_user_id", "points_connection_id", "allocation_quantity", "price_tick_count", "price_ticks", "reservation_key", "attempt_count", "status", "point_reservation_id", "vector_hash", "component_vector_json", "expires_at", "failure_class", "failure_code", "failure_hash", "release_receipt_id", "release_content_hash", "released_at", "points_request_id", "created_at", "updated_at" FROM `settlement_round_winners`;--> statement-breakpoint
DROP TABLE `settlement_round_winners`;--> statement-breakpoint
ALTER TABLE `__new_settlement_round_winners` RENAME TO `settlement_round_winners`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_round_winners_user_uidx` ON `settlement_round_winners` (`settlement_round_id`,`markets_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_round_winners_key_uidx` ON `settlement_round_winners` (`reservation_key`);
--> statement-breakpoint
CREATE TRIGGER settlement_capture_receipts_no_update
BEFORE UPDATE ON settlement_capture_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_CAPTURE_RECEIPT_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER settlement_capture_receipts_no_delete
BEFORE DELETE ON settlement_capture_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_CAPTURE_RECEIPT_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER settlement_allocations_no_update
BEFORE UPDATE ON settlement_allocations BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_ALLOCATION_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER settlement_allocations_no_delete
BEFORE DELETE ON settlement_allocations BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_ALLOCATION_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER proofs_no_update
BEFORE UPDATE ON proofs BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_PROOF_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER proofs_no_delete
BEFORE DELETE ON proofs BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_PROOF_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER settlement_finalize_receipts_no_update
BEFORE UPDATE ON settlement_finalize_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_FINALIZE_RECEIPT_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER settlement_finalize_receipts_no_delete
BEFORE DELETE ON settlement_finalize_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_FINALIZE_RECEIPT_IMMUTABLE'); END;
