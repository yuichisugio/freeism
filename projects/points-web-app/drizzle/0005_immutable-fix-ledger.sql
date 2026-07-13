CREATE TABLE `fix_result` (
	`id` text PRIMARY KEY NOT NULL,
	`current_revision_id` text NOT NULL,
	`current_revision` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "fix_result_revision_check" CHECK("fix_result"."current_revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE `fix_revision_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`fix_revision_id` text NOT NULL,
	`recipient_provider_id` text,
	`recipient_account_id` text,
	`recipient_profile_url` text NOT NULL,
	`identity_resolved_at` integer,
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
	CONSTRAINT "fix_revision_entry_amount_check" CHECK(typeof("fix_revision_entry"."amount_scaled") = 'integer' and "fix_revision_entry"."amount_scaled" between -9007199254740991 and 9007199254740991),
	CONSTRAINT "fix_revision_entry_memo_check" CHECK("fix_revision_entry"."memo" is null or length("fix_revision_entry"."memo") <= 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fix_revision_entry_subject_criterion_uidx` ON `fix_revision_entry` (`fix_revision_id`,`recipient_profile_url`,`evaluation_criterion_id`);--> statement-breakpoint
CREATE INDEX `fix_revision_entry_github_subject_idx` ON `fix_revision_entry` (`recipient_provider_id`,`recipient_account_id`);--> statement-breakpoint
CREATE TABLE `fix_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`fix_result_id` text NOT NULL,
	`revision` integer NOT NULL,
	`file_hash` text NOT NULL,
	`validation_hash` text NOT NULL,
	`content_hash` text NOT NULL,
	`actor_points_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`fix_result_id`) REFERENCES `fix_result`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fix_revision_revision_check" CHECK("fix_revision"."revision" >= 1),
	CONSTRAINT "fix_revision_file_hash_check" CHECK(length("fix_revision"."file_hash") = 64),
	CONSTRAINT "fix_revision_validation_hash_check" CHECK(length("fix_revision"."validation_hash") = 64),
	CONSTRAINT "fix_revision_content_hash_check" CHECK(length("fix_revision"."content_hash") = 64),
	CONSTRAINT "fix_revision_reason_check" CHECK(length(trim("fix_revision"."reason")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fix_revision_result_number_uidx` ON `fix_revision` (`fix_result_id`,`revision`);--> statement-breakpoint
CREATE TABLE `github_api_budget` (
	`id` text PRIMARY KEY NOT NULL,
	`remaining` integer NOT NULL,
	`reset_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `point_account` (
	`points_user_id` text NOT NULL,
	`evaluation_criterion_id` text NOT NULL,
	`balance` integer NOT NULL,
	`evaluation_total` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`points_user_id`, `evaluation_criterion_id`),
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_account_balance_check" CHECK(typeof("point_account"."balance") = 'integer' and "point_account"."balance" between -9007199254740991 and 9007199254740991),
	CONSTRAINT "point_account_evaluation_total_check" CHECK(typeof("point_account"."evaluation_total") = 'integer' and "point_account"."evaluation_total" between -9007199254740991 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE `point_ledger_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`points_user_id` text NOT NULL,
	`evaluation_criterion_id` text NOT NULL,
	`evaluation_criterion_revision_id` text NOT NULL,
	`delta_amount_scaled` integer NOT NULL,
	`affects_evaluation_total` integer NOT NULL,
	`source_type` text NOT NULL,
	`source_fix_revision_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_fix_revision_id`) REFERENCES `fix_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_ledger_entry_delta_check" CHECK(typeof("point_ledger_entry"."delta_amount_scaled") = 'integer' and "point_ledger_entry"."delta_amount_scaled" between -9007199254740991 and 9007199254740991),
	CONSTRAINT "point_ledger_entry_source_type_check" CHECK("point_ledger_entry"."source_type" = 'FIX')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_fix_subject_criterion_uidx` ON `point_ledger_entry` (`source_fix_revision_id`,`points_user_id`,`evaluation_criterion_id`);--> statement-breakpoint
CREATE INDEX `point_ledger_entry_account_idx` ON `point_ledger_entry` (`points_user_id`,`evaluation_criterion_id`);--> statement-breakpoint
CREATE TABLE `unclaimed_fix_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`source_fix_revision_id` text NOT NULL,
	`recipient_provider_id` text,
	`recipient_account_id` text,
	`recipient_profile_url` text NOT NULL,
	`evaluation_criterion_id` text NOT NULL,
	`evaluation_criterion_revision_id` text NOT NULL,
	`delta_amount_scaled` integer NOT NULL,
	`evaluation_at` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`source_fix_revision_id`) REFERENCES `fix_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "unclaimed_fix_entry_delta_check" CHECK(typeof("unclaimed_fix_entry"."delta_amount_scaled") = 'integer' and "unclaimed_fix_entry"."delta_amount_scaled" between -9007199254740991 and 9007199254740991)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unclaimed_fix_entry_source_subject_criterion_uidx` ON `unclaimed_fix_entry` (`source_fix_revision_id`,`recipient_provider_id`,`recipient_account_id`,`recipient_profile_url`,`evaluation_criterion_id`);
--> statement-breakpoint
CREATE TRIGGER `fix_revision_no_update`
BEFORE UPDATE ON `fix_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_revision_head_guard_before_insert`
BEFORE INSERT ON `fix_revision`
WHEN NOT EXISTS (
  SELECT 1 FROM `fix_result`
  WHERE `id` = NEW.`fix_result_id`
    AND (
      (NEW.`revision` = 1 AND `current_revision` = 1 AND `current_revision_id` = NEW.`id`)
      OR (NEW.`revision` > 1 AND `current_revision` = NEW.`revision` - 1)
    )
)
BEGIN SELECT RAISE(ABORT, 'REVISION_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_revision_no_delete`
BEFORE DELETE ON `fix_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_revision_entry_no_update`
BEFORE UPDATE ON `fix_revision_entry`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_REVISION_ENTRY'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_revision_entry_no_delete`
BEFORE DELETE ON `fix_revision_entry`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_REVISION_ENTRY'); END;
--> statement-breakpoint
CREATE TRIGGER `unclaimed_fix_entry_no_update`
BEFORE UPDATE ON `unclaimed_fix_entry`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_UNCLAIMED_FIX_ENTRY'); END;
--> statement-breakpoint
CREATE TRIGGER `unclaimed_fix_entry_no_delete`
BEFORE DELETE ON `unclaimed_fix_entry`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_UNCLAIMED_FIX_ENTRY'); END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_no_update`
BEFORE UPDATE ON `point_ledger_entry`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_LEDGER_ENTRY'); END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_no_delete`
BEFORE DELETE ON `point_ledger_entry`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_LEDGER_ENTRY'); END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_safe_integer_before_insert`
BEFORE INSERT ON `point_ledger_entry`
BEGIN
  SELECT CASE WHEN
    typeof(COALESCE((
      SELECT `balance` FROM `point_account`
      WHERE `points_user_id` = NEW.`points_user_id`
        AND `evaluation_criterion_id` = NEW.`evaluation_criterion_id`
    ), 0) + NEW.`delta_amount_scaled`) <> 'integer'
    OR COALESCE((
      SELECT `balance` FROM `point_account`
      WHERE `points_user_id` = NEW.`points_user_id`
        AND `evaluation_criterion_id` = NEW.`evaluation_criterion_id`
    ), 0) + NEW.`delta_amount_scaled` NOT BETWEEN -9007199254740991 AND 9007199254740991
    OR typeof(COALESCE((
      SELECT `evaluation_total` FROM `point_account`
      WHERE `points_user_id` = NEW.`points_user_id`
        AND `evaluation_criterion_id` = NEW.`evaluation_criterion_id`
    ), 0) + CASE WHEN NEW.`affects_evaluation_total` = 1 THEN NEW.`delta_amount_scaled` ELSE 0 END) <> 'integer'
    OR COALESCE((
      SELECT `evaluation_total` FROM `point_account`
      WHERE `points_user_id` = NEW.`points_user_id`
        AND `evaluation_criterion_id` = NEW.`evaluation_criterion_id`
    ), 0) + CASE WHEN NEW.`affects_evaluation_total` = 1 THEN NEW.`delta_amount_scaled` ELSE 0 END
      NOT BETWEEN -9007199254740991 AND 9007199254740991
  THEN RAISE(ABORT, 'SAFE_INTEGER_OVERFLOW') END;
END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_project_after_insert`
AFTER INSERT ON `point_ledger_entry`
BEGIN
  INSERT INTO `point_account`
    (`points_user_id`, `evaluation_criterion_id`, `balance`, `evaluation_total`, `updated_at`)
  VALUES (
    NEW.`points_user_id`,
    NEW.`evaluation_criterion_id`,
    NEW.`delta_amount_scaled`,
    CASE WHEN NEW.`affects_evaluation_total` = 1 THEN NEW.`delta_amount_scaled` ELSE 0 END,
    NEW.`created_at`
  )
  ON CONFLICT (`points_user_id`, `evaluation_criterion_id`) DO UPDATE SET
    `balance` = `point_account`.`balance` + NEW.`delta_amount_scaled`,
    `evaluation_total` = `point_account`.`evaluation_total`
      + CASE WHEN NEW.`affects_evaluation_total` = 1 THEN NEW.`delta_amount_scaled` ELSE 0 END,
    `updated_at` = NEW.`created_at`;
END;
