PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_proofs` (
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
	CONSTRAINT "proofs_item_snapshot_check" CHECK(json_valid("__new_proofs"."item_snapshot_json")),
	CONSTRAINT "proofs_seller_snapshot_check" CHECK(json_valid("__new_proofs"."seller_identity_snapshot_json")),
	CONSTRAINT "proofs_buyer_snapshot_check" CHECK(json_valid("__new_proofs"."buyer_identity_snapshot_json")),
	CONSTRAINT "proofs_component_vector_check" CHECK(json_valid("__new_proofs"."component_vector_json")),
	CONSTRAINT "proofs_quantity_check" CHECK("__new_proofs"."allocation_quantity" between 1 and 1000),
	CONSTRAINT "proofs_uniform_price_check" CHECK("__new_proofs"."uniform_price_tick_count" between 0 and 9007199254740991),
	CONSTRAINT "proofs_price_ticks_check" CHECK("__new_proofs"."price_ticks" between 0 and 9007199254740991),
	CONSTRAINT "proofs_status_check" CHECK("__new_proofs"."completion_status" = 'SETTLED'),
	CONSTRAINT "proofs_plan_hash_check" CHECK(length("__new_proofs"."plan_hash") = 71 and substr("__new_proofs"."plan_hash", 1, 7) = 'sha256:' and substr("__new_proofs"."plan_hash", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "proofs_content_hash_check" CHECK(length("__new_proofs"."content_hash") = 64)
);
--> statement-breakpoint
INSERT INTO `__new_proofs`("id", "allocation_id", "settlement_id", "auction_id", "auction_revision_id", "buyer_markets_user_id", "point_package_revision_id", "item_snapshot_json", "seller_identity_snapshot_json", "buyer_identity_snapshot_json", "allocation_quantity", "uniform_price_tick_count", "price_ticks", "component_vector_json", "completion_status", "settled_at", "plan_hash", "content_hash", "created_at") SELECT "id", "allocation_id", "settlement_id", "auction_id", "auction_revision_id", "buyer_markets_user_id", "point_package_revision_id", "item_snapshot_json", "seller_identity_snapshot_json", "buyer_identity_snapshot_json", "allocation_quantity", "uniform_price_tick_count", "price_ticks", "component_vector_json", "completion_status", "settled_at", "plan_hash", "content_hash", "created_at" FROM `proofs`;--> statement-breakpoint
DROP TABLE `proofs`;--> statement-breakpoint
ALTER TABLE `__new_proofs` RENAME TO `proofs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `proofs_allocation_uidx` ON `proofs` (`allocation_id`);--> statement-breakpoint
CREATE TABLE `__new_settlement_capture_receipts` (
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
	FOREIGN KEY (`capture_receipt_id`) REFERENCES `settlement_capture_receipts`(`capture_receipt_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_finalize_receipts_plan_hash_check" CHECK(length("__new_settlement_finalize_receipts"."plan_hash") = 71 and substr("__new_settlement_finalize_receipts"."plan_hash", 1, 7) = 'sha256:' and substr("__new_settlement_finalize_receipts"."plan_hash", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "settlement_finalize_receipts_proof_ids_check" CHECK(json_valid("__new_settlement_finalize_receipts"."proof_ids_json")),
	CONSTRAINT "settlement_finalize_receipts_proof_set_hash_check" CHECK(length("__new_settlement_finalize_receipts"."proof_set_hash") = 64)
);
--> statement-breakpoint
INSERT INTO `__new_settlement_finalize_receipts`("id", "settlement_id", "capture_receipt_id", "plan_hash", "proof_ids_json", "proof_set_hash", "finalized_at", "created_at") SELECT "id", "settlement_id", "capture_receipt_id", "plan_hash", "proof_ids_json", "proof_set_hash", "finalized_at", "created_at" FROM `settlement_finalize_receipts`;--> statement-breakpoint
DROP TABLE `settlement_finalize_receipts`;--> statement-breakpoint
ALTER TABLE `__new_settlement_finalize_receipts` RENAME TO `settlement_finalize_receipts`;--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_finalize_receipts_settlement_uidx` ON `settlement_finalize_receipts` (`settlement_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_finalize_receipts_capture_uidx` ON `settlement_finalize_receipts` (`capture_receipt_id`);--> statement-breakpoint
CREATE TABLE `__new_settlement_outbox` (
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
	CONSTRAINT "settlement_outbox_revision_check" CHECK("__new_settlement_outbox"."settlement_revision" between 1 and 9007199254740991),
	CONSTRAINT "settlement_outbox_attempt_check" CHECK("__new_settlement_outbox"."workflow_attempt" between 0 and 9007199254740991),
	CONSTRAINT "settlement_outbox_plan_hash_check" CHECK(length("__new_settlement_outbox"."plan_hash") = 71 and substr("__new_settlement_outbox"."plan_hash", 1, 7) = 'sha256:' and substr("__new_settlement_outbox"."plan_hash", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "settlement_outbox_status_check" CHECK("__new_settlement_outbox"."status" in ('PENDING', 'DISPATCHED')),
	CONSTRAINT "settlement_outbox_delivery_attempt_check" CHECK("__new_settlement_outbox"."delivery_attempt_count" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_settlement_outbox`("id", "settlement_id", "settlement_revision", "workflow_attempt", "plan_hash", "workflow_instance_id", "status", "delivery_attempt_count", "last_error_code", "created_at", "dispatched_at") SELECT "id", "settlement_id", "settlement_revision", "workflow_attempt", "plan_hash", "workflow_instance_id", "status", "delivery_attempt_count", "last_error_code", "created_at", "dispatched_at" FROM `settlement_outbox`;--> statement-breakpoint
DROP TABLE `settlement_outbox`;--> statement-breakpoint
ALTER TABLE `__new_settlement_outbox` RENAME TO `settlement_outbox`;--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_outbox_attempt_uidx` ON `settlement_outbox` (`settlement_id`,`settlement_revision`,`workflow_attempt`);--> statement-breakpoint
CREATE INDEX `settlement_outbox_status_idx` ON `settlement_outbox` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_settlement_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`settlement_revision` integer NOT NULL,
	`plan_json` text NOT NULL,
	`plan_hash` text NOT NULL,
	`algorithm_version` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_plans_revision_check" CHECK("__new_settlement_plans"."settlement_revision" between 1 and 9007199254740991),
	CONSTRAINT "settlement_plans_json_check" CHECK(json_valid("__new_settlement_plans"."plan_json")),
	CONSTRAINT "settlement_plans_hash_check" CHECK(length("__new_settlement_plans"."plan_hash") = 71 and substr("__new_settlement_plans"."plan_hash", 1, 7) = 'sha256:' and substr("__new_settlement_plans"."plan_hash", 8) not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
INSERT INTO `__new_settlement_plans`("id", "settlement_id", "settlement_revision", "plan_json", "plan_hash", "algorithm_version", "created_at") SELECT "id", "settlement_id", "settlement_revision", "plan_json", "plan_hash", "algorithm_version", "created_at" FROM `settlement_plans`;--> statement-breakpoint
DROP TABLE `settlement_plans`;--> statement-breakpoint
ALTER TABLE `__new_settlement_plans` RENAME TO `settlement_plans`;--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_plans_revision_uidx` ON `settlement_plans` (`settlement_id`,`settlement_revision`);--> statement-breakpoint
CREATE TABLE `__new_settlement_rounds` (
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
	CONSTRAINT "settlement_rounds_ordinal_check" CHECK("__new_settlement_rounds"."round_ordinal" between 1 and 9007199254740991),
	CONSTRAINT "settlement_rounds_plan_hash_check" CHECK(length("__new_settlement_rounds"."plan_hash") = 71 and substr("__new_settlement_rounds"."plan_hash", 1, 7) = 'sha256:' and substr("__new_settlement_rounds"."plan_hash", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "settlement_rounds_cutoff_hash_check" CHECK(length("__new_settlement_rounds"."cutoff_hash") = 64 or (length("__new_settlement_rounds"."cutoff_hash") = 71 and substr("__new_settlement_rounds"."cutoff_hash", 1, 7) = 'sha256:')),
	CONSTRAINT "settlement_rounds_excluded_json_check" CHECK(json_valid("__new_settlement_rounds"."excluded_user_ids_json")),
	CONSTRAINT "settlement_rounds_deadline_check" CHECK("__new_settlement_rounds"."retry_deadline_at" >= "__new_settlement_rounds"."first_attempt_at"),
	CONSTRAINT "settlement_rounds_state_check" CHECK("__new_settlement_rounds"."state" in ('RESERVING', 'RELEASING', 'RELEASED', 'RESERVED', 'FAILED'))
);
--> statement-breakpoint
INSERT INTO `__new_settlement_rounds`("id", "settlement_id", "round_ordinal", "plan_hash", "cutoff_hash", "state", "excluded_user_ids_json", "first_attempt_at", "retry_deadline_at", "created_at", "updated_at") SELECT "id", "settlement_id", "round_ordinal", "plan_hash", "cutoff_hash", "state", "excluded_user_ids_json", "first_attempt_at", "retry_deadline_at", "created_at", "updated_at" FROM `settlement_rounds`;--> statement-breakpoint
DROP TABLE `settlement_rounds`;--> statement-breakpoint
ALTER TABLE `__new_settlement_rounds` RENAME TO `settlement_rounds`;--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_rounds_ordinal_uidx` ON `settlement_rounds` (`settlement_id`,`round_ordinal`);--> statement-breakpoint
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
CREATE TRIGGER settlement_capture_receipts_no_update
BEFORE UPDATE ON settlement_capture_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_CAPTURE_RECEIPT_IMMUTABLE'); END;--> statement-breakpoint
CREATE TRIGGER settlement_capture_receipts_no_delete
BEFORE DELETE ON settlement_capture_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_CAPTURE_RECEIPT_IMMUTABLE'); END;--> statement-breakpoint
CREATE TRIGGER proofs_no_update
BEFORE UPDATE ON proofs BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_PROOF_IMMUTABLE'); END;--> statement-breakpoint
CREATE TRIGGER proofs_no_delete
BEFORE DELETE ON proofs BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_PROOF_IMMUTABLE'); END;--> statement-breakpoint
CREATE TRIGGER settlement_finalize_receipts_no_update
BEFORE UPDATE ON settlement_finalize_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_FINALIZE_RECEIPT_IMMUTABLE'); END;--> statement-breakpoint
CREATE TRIGGER settlement_finalize_receipts_no_delete
BEFORE DELETE ON settlement_finalize_receipts BEGIN SELECT RAISE(ABORT, 'SETTLEMENT_FINALIZE_RECEIPT_IMMUTABLE'); END;--> statement-breakpoint
CREATE TRIGGER `settlement_rounds_delete_guard`
BEFORE DELETE ON `settlement_rounds`
BEGIN
	SELECT RAISE(ABORT, 'SETTLEMENT_ROUND_IMMUTABLE');
END;
