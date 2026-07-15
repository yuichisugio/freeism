CREATE TABLE `fix_claim_command` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_ownership_id` text NOT NULL,
	`ownership_epoch_id` text NOT NULL,
	`actor_points_user_id` text NOT NULL,
	`expected_entry_ids` text NOT NULL,
	`claim_set_hash` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`identity_ownership_id`) REFERENCES `identity_ownership`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`ownership_epoch_id`) REFERENCES `ownership_epoch`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fix_claim_command_hash_check" CHECK(length("fix_claim_command"."claim_set_hash") = 64),
	CONSTRAINT "fix_claim_command_entries_check" CHECK(json_array_length("fix_claim_command"."expected_entry_ids") > 0)
);
--> statement-breakpoint
CREATE TABLE `fix_claim_item` (
	`id` text PRIMARY KEY NOT NULL,
	`fix_claim_id` text NOT NULL,
	`unclaimed_fix_entry_id` text NOT NULL,
	`ledger_entry_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`fix_claim_id`) REFERENCES `fix_claim`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`unclaimed_fix_entry_id`) REFERENCES `unclaimed_fix_entry`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fix_claim_item_unclaimed_fix_entry_id_unique` ON `fix_claim_item` (`unclaimed_fix_entry_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `fix_claim_item_ledger_entry_id_unique` ON `fix_claim_item` (`ledger_entry_id`);--> statement-breakpoint
CREATE INDEX `fix_claim_item_claim_idx` ON `fix_claim_item` (`fix_claim_id`);--> statement-breakpoint
CREATE TABLE `fix_claim` (
	`id` text PRIMARY KEY NOT NULL,
	`command_id` text NOT NULL,
	`ownership_epoch_id` text NOT NULL,
	`points_user_id` text NOT NULL,
	`claim_set_hash` text NOT NULL,
	`item_count` integer NOT NULL,
	`request_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`claimed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`command_id`) REFERENCES `fix_claim_command`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`ownership_epoch_id`) REFERENCES `ownership_epoch`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fix_claim_hash_check" CHECK(length("fix_claim"."claim_set_hash") = 64),
	CONSTRAINT "fix_claim_item_count_check" CHECK("fix_claim"."item_count" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fix_claim_command_id_unique` ON `fix_claim` (`command_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `fix_claim_actor_idempotency_uidx` ON `fix_claim` (`points_user_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `identity_ownership` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_type` text NOT NULL,
	`normalized_identity_key` text NOT NULL,
	`points_user_id` text NOT NULL,
	`status` text NOT NULL,
	`current_ownership_epoch_id` text NOT NULL,
	`verified_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`next_verification_at` integer,
	`permanent_correspondence` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "identity_ownership_key_check" CHECK(length("identity_ownership"."normalized_identity_key") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_ownership_type_key_uidx` ON `identity_ownership` (`identity_type`,`normalized_identity_key`);--> statement-breakpoint
CREATE TABLE `ownership_epoch` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_ownership_id` text NOT NULL,
	`owner_points_user_id` text NOT NULL,
	`effective_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`ended_at` integer,
	`verification_method` text NOT NULL,
	`evidence_hash` text NOT NULL,
	`success_count` integer NOT NULL,
	`request_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`identity_ownership_id`) REFERENCES `identity_ownership`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`owner_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ownership_epoch_evidence_hash_check" CHECK(length("ownership_epoch"."evidence_hash") = 64),
	CONSTRAINT "ownership_epoch_success_count_check" CHECK("ownership_epoch"."success_count" >= 1)
);
--> statement-breakpoint
CREATE INDEX `ownership_epoch_ownership_effective_idx` ON `ownership_epoch` (`identity_ownership_id`,`effective_at`);--> statement-breakpoint
DROP INDEX `point_ledger_entry_fix_subject_criterion_uidx`;--> statement-breakpoint
ALTER TABLE `point_ledger_entry` ADD `source_unclaimed_fix_entry_id` text REFERENCES unclaimed_fix_entry(id);--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_direct_fix_subject_criterion_uidx` ON `point_ledger_entry` (`source_fix_revision_id`,`points_user_id`,`evaluation_criterion_id`) WHERE "point_ledger_entry"."source_unclaimed_fix_entry_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_unclaimed_uidx` ON `point_ledger_entry` (`source_unclaimed_fix_entry_id`) WHERE "point_ledger_entry"."source_unclaimed_fix_entry_id" is not null;
--> statement-breakpoint
CREATE TRIGGER `fix_claim_command_no_update`
BEFORE UPDATE ON `fix_claim_command`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_CLAIM_COMMAND'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_claim_command_no_delete`
BEFORE DELETE ON `fix_claim_command`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_CLAIM_COMMAND'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_claim_no_update`
BEFORE UPDATE ON `fix_claim`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_CLAIM'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_claim_no_delete`
BEFORE DELETE ON `fix_claim`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_CLAIM'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_claim_item_no_update`
BEFORE UPDATE ON `fix_claim_item`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_CLAIM_ITEM'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_claim_item_no_delete`
BEFORE DELETE ON `fix_claim_item`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_CLAIM_ITEM'); END;
