-- Ownership 系の表を削除し、Accounts 連携の表を追加する。
-- FIX・受領・ownership の既存行は移行しない（未リリースのため）。
-- 受領の行がある D1 では適用に失敗し、未受領 FIX がある D1 では旧 entry が空として扱われるため、0021 の適用前に D1 を作り直す。
-- 表の作り直しで消える trigger は末尾で再作成する（原文は 0005・0006・0007）。
-- 監視対象から外す OWNERSHIP_SCHEDULER_LAG の未解決 alert は解決済みにする。
CREATE TABLE `accounts_client_tokens` (
	`accounts_connection_id` text PRIMARY KEY NOT NULL,
	`access_token_ciphertext` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`accounts_connection_id`) REFERENCES `accounts_connections`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `accounts_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`accounts_origin` text NOT NULL,
	`display_name` text NOT NULL,
	`client_id` text,
	`status` text NOT NULL,
	`client_key_id` text NOT NULL,
	`client_public_jwk` text NOT NULL,
	`client_private_jwk_ciphertext` text,
	`dpop_private_jwk_ciphertext` text,
	`created_by_points_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`activated_at` integer,
	`withdrawn_at` integer,
	FOREIGN KEY (`created_by_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "accounts_connections_status_check" CHECK("accounts_connections"."status" in ('PENDING_CLIENT_REGISTRATION', 'ACTIVE', 'WITHDRAWN')),
	CONSTRAINT "accounts_connections_display_name_check" CHECK(length("accounts_connections"."display_name") between 1 and 100),
	CONSTRAINT "accounts_connections_client_id_check" CHECK("accounts_connections"."status" <> 'ACTIVE' or "accounts_connections"."client_id" is not null),
	CONSTRAINT "accounts_connections_private_key_check" CHECK(("accounts_connections"."status" = 'WITHDRAWN'
             and "accounts_connections"."client_private_jwk_ciphertext" is null
             and "accounts_connections"."dpop_private_jwk_ciphertext" is null)
          or ("accounts_connections"."status" <> 'WITHDRAWN'
             and "accounts_connections"."client_private_jwk_ciphertext" is not null
             and "accounts_connections"."dpop_private_jwk_ciphertext" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_connections_live_origin_uidx` ON `accounts_connections` (`accounts_origin`) WHERE "accounts_connections"."status" <> 'WITHDRAWN';
--> statement-breakpoint
CREATE TABLE `accounts_link_attempts` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`points_user_id` text NOT NULL,
	`auth_session_id_hash` text NOT NULL,
	`accounts_connection_id` text NOT NULL,
	`nonce` text NOT NULL,
	`code_verifier` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`accounts_connection_id`) REFERENCES `accounts_connections`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "accounts_link_attempts_expiry_check" CHECK("accounts_link_attempts"."expires_at" > "accounts_link_attempts"."created_at" and "accounts_link_attempts"."expires_at" <= "accounts_link_attempts"."created_at" + 600000)
);
--> statement-breakpoint
CREATE INDEX `accounts_link_attempts_expiry_idx` ON `accounts_link_attempts` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `accounts_links` (
	`id` text PRIMARY KEY NOT NULL,
	`points_user_id` text NOT NULL,
	`accounts_connection_id` text NOT NULL,
	`accounts_origin` text NOT NULL,
	`accounts_user_id` text NOT NULL,
	`linked_at` integer NOT NULL,
	`relinked_at` integer,
	`provision_status` text,
	`external_accounts_json` text,
	`external_accounts_fetched_at` integer,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`accounts_connection_id`) REFERENCES `accounts_connections`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "accounts_links_provision_status_check" CHECK("accounts_links"."provision_status" is null or "accounts_links"."provision_status" in ('PROVIDED', 'NOT_PROVIDED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_links_accounts_user_uidx` ON `accounts_links` (`accounts_origin`,`accounts_user_id`);
--> statement-breakpoint
CREATE INDEX `accounts_links_points_user_idx` ON `accounts_links` (`points_user_id`);
--> statement-breakpoint
CREATE INDEX `accounts_links_refresh_idx` ON `accounts_links` (`external_accounts_fetched_at`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_fix_claim_command` (
	`id` text PRIMARY KEY NOT NULL,
	`accounts_origin` text NOT NULL,
	`accounts_user_id` text NOT NULL,
	`actor_points_user_id` text NOT NULL,
	`expected_entry_ids` text NOT NULL,
	`claim_set_hash` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`actor_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fix_claim_command_hash_check" CHECK(length("__new_fix_claim_command"."claim_set_hash") = 64),
	CONSTRAINT "fix_claim_command_entries_check" CHECK(json_array_length("__new_fix_claim_command"."expected_entry_ids") > 0)
);
--> statement-breakpoint
DROP TABLE `fix_claim_command`;
--> statement-breakpoint
ALTER TABLE `__new_fix_claim_command` RENAME TO `fix_claim_command`;
--> statement-breakpoint
CREATE TABLE `__new_fix_claim` (
	`id` text PRIMARY KEY NOT NULL,
	`command_id` text NOT NULL,
	`accounts_origin` text NOT NULL,
	`accounts_user_id` text NOT NULL,
	`points_user_id` text NOT NULL,
	`claim_set_hash` text NOT NULL,
	`item_count` integer NOT NULL,
	`request_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`claimed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`command_id`) REFERENCES `fix_claim_command`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fix_claim_hash_check" CHECK(length("__new_fix_claim"."claim_set_hash") = 64),
	CONSTRAINT "fix_claim_item_count_check" CHECK("__new_fix_claim"."item_count" > 0)
);
--> statement-breakpoint
DROP TABLE `fix_claim`;
--> statement-breakpoint
ALTER TABLE `__new_fix_claim` RENAME TO `fix_claim`;
--> statement-breakpoint
DROP TABLE `account_close_ownership_suspension`;
--> statement-breakpoint
DROP TABLE `ownership_revalidation_job`;
--> statement-breakpoint
DROP TABLE `web_reownership_candidate`;
--> statement-breakpoint
DROP TABLE `ownership_epoch`;
--> statement-breakpoint
DROP TABLE `identity_ownership`;
--> statement-breakpoint
DROP TABLE `github_api_budget`;
--> statement-breakpoint
CREATE UNIQUE INDEX `fix_claim_command_id_unique` ON `fix_claim` (`command_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `fix_claim_actor_idempotency_uidx` ON `fix_claim` (`points_user_id`,`idempotency_key`);
--> statement-breakpoint
CREATE TABLE `__new_profiles` (
	`points_user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'PUBLIC' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "profiles_display_name_length_check" CHECK(length("__new_profiles"."display_name") between 1 and 100),
	CONSTRAINT "profiles_description_length_check" CHECK(length("__new_profiles"."description") <= 500),
	CONSTRAINT "profiles_visibility_check" CHECK("__new_profiles"."visibility" in ('PUBLIC', 'PRIVATE'))
);
--> statement-breakpoint
INSERT INTO `__new_profiles`("points_user_id", "display_name", "description", "visibility", "created_at", "updated_at") SELECT "points_user_id", "display_name", "description", "visibility", "created_at", "updated_at" FROM `profiles`;
--> statement-breakpoint
DROP TABLE `profiles`;
--> statement-breakpoint
ALTER TABLE `__new_profiles` RENAME TO `profiles`;
--> statement-breakpoint
CREATE TABLE `__new_fix_revision_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`fix_revision_id` text NOT NULL,
	`recipient_identifier_type` text NOT NULL,
	`recipient_identifier_value` text NOT NULL,
	`accounts_origin` text NOT NULL,
	`resolved_accounts_user_id` text,
	`accounts_resolved_at` integer NOT NULL,
	`points_user_id` text,
	`evaluation_criterion_id` text NOT NULL,
	`evaluation_criterion_revision_id` text NOT NULL,
	`amount_scaled` integer NOT NULL,
	`evaluation_at` text NOT NULL,
	`management_id` text,
	`memo` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`fix_revision_id`) REFERENCES `fix_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fix_revision_entry_recipient_identifier_check" CHECK("__new_fix_revision_entry"."recipient_identifier_type" in ('url', 'accounts_user') and length("__new_fix_revision_entry"."recipient_identifier_value") > 0),
	CONSTRAINT "fix_revision_entry_amount_check" CHECK(typeof("__new_fix_revision_entry"."amount_scaled") = 'integer' and "__new_fix_revision_entry"."amount_scaled" between -9007199254740991 and 9007199254740991),
	CONSTRAINT "fix_revision_entry_memo_check" CHECK("__new_fix_revision_entry"."memo" is null or length("__new_fix_revision_entry"."memo") <= 200)
);
--> statement-breakpoint
DROP TABLE `fix_revision_entry`;
--> statement-breakpoint
ALTER TABLE `__new_fix_revision_entry` RENAME TO `fix_revision_entry`;
--> statement-breakpoint
CREATE UNIQUE INDEX `fix_revision_entry_subject_criterion_uidx` ON `fix_revision_entry` (`fix_revision_id`,`recipient_identifier_type`,`recipient_identifier_value`,`evaluation_criterion_id`);
--> statement-breakpoint
CREATE INDEX `fix_revision_entry_accounts_user_idx` ON `fix_revision_entry` (`accounts_origin`,`resolved_accounts_user_id`);
--> statement-breakpoint
CREATE TABLE `__new_unclaimed_fix_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`source_fix_revision_id` text NOT NULL,
	`recipient_identifier_type` text NOT NULL,
	`recipient_identifier_value` text NOT NULL,
	`accounts_origin` text NOT NULL,
	`resolved_accounts_user_id` text,
	`accounts_resolved_at` integer NOT NULL,
	`evaluation_criterion_id` text NOT NULL,
	`evaluation_criterion_revision_id` text NOT NULL,
	`delta_amount_scaled` integer NOT NULL,
	`evaluation_at` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`source_fix_revision_id`) REFERENCES `fix_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "unclaimed_fix_entry_recipient_identifier_check" CHECK("__new_unclaimed_fix_entry"."recipient_identifier_type" in ('url', 'accounts_user') and length("__new_unclaimed_fix_entry"."recipient_identifier_value") > 0),
	CONSTRAINT "unclaimed_fix_entry_delta_check" CHECK(typeof("__new_unclaimed_fix_entry"."delta_amount_scaled") = 'integer' and "__new_unclaimed_fix_entry"."delta_amount_scaled" between -9007199254740991 and 9007199254740991)
);
--> statement-breakpoint
DROP TABLE `unclaimed_fix_entry`;
--> statement-breakpoint
ALTER TABLE `__new_unclaimed_fix_entry` RENAME TO `unclaimed_fix_entry`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `unclaimed_fix_entry_source_subject_criterion_uidx` ON `unclaimed_fix_entry` (`source_fix_revision_id`,`recipient_identifier_type`,`recipient_identifier_value`,`evaluation_criterion_id`);
--> statement-breakpoint
CREATE INDEX `unclaimed_fix_entry_accounts_origin_idx` ON `unclaimed_fix_entry` (`accounts_origin`);
--> statement-breakpoint
UPDATE `ops_alert`
SET `status` = 'RESOLVED',
    `last_observed_at` = cast(unixepoch('subsecond') * 1000 as integer),
    `resolved_at` = cast(unixepoch('subsecond') * 1000 as integer)
WHERE `type` = 'OWNERSHIP_SCHEDULER_LAG' AND `status` = 'OPEN';
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
CREATE TRIGGER `fix_revision_entry_no_update`
BEFORE UPDATE ON `fix_revision_entry`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_REVISION_ENTRY'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_revision_entry_no_delete`
BEFORE DELETE ON `fix_revision_entry`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_REVISION_ENTRY'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_revision_entry_no_late_insert`
BEFORE INSERT ON `fix_revision_entry`
WHEN EXISTS (
  SELECT 1 FROM `fix_revision_seal`
  WHERE `fix_revision_id` = NEW.`fix_revision_id`
)
BEGIN SELECT RAISE(ABORT, 'SEALED_FIX_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `unclaimed_fix_entry_no_update`
BEFORE UPDATE ON `unclaimed_fix_entry`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_UNCLAIMED_FIX_ENTRY'); END;
--> statement-breakpoint
CREATE TRIGGER `unclaimed_fix_entry_no_delete`
BEFORE DELETE ON `unclaimed_fix_entry`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_UNCLAIMED_FIX_ENTRY'); END;
--> statement-breakpoint
CREATE TRIGGER `unclaimed_fix_entry_no_late_insert`
BEFORE INSERT ON `unclaimed_fix_entry`
WHEN EXISTS (
  SELECT 1 FROM `fix_revision_seal`
  WHERE `fix_revision_id` = NEW.`source_fix_revision_id`
)
BEGIN SELECT RAISE(ABORT, 'SEALED_FIX_REVISION'); END;
