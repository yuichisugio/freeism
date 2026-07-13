CREATE TABLE `auto_distribution_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`source_fix_revision_id` text NOT NULL,
	`source_amount_scaled` integer NOT NULL,
	`retained_amount_scaled` integer NOT NULL,
	`distribution_amount_scaled` integer NOT NULL,
	`source_debit_delta_scaled` integer NOT NULL,
	`allocation_snapshot` text NOT NULL,
	`credit_delta_snapshot` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `auto_distribution_snapshot`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "auto_distribution_revision_allocation_check" CHECK(json_valid("auto_distribution_revision"."allocation_snapshot")),
	CONSTRAINT "auto_distribution_revision_credit_delta_check" CHECK(json_valid("auto_distribution_revision"."credit_delta_snapshot"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_distribution_revision_source_uidx` ON `auto_distribution_revision` (`snapshot_id`,`source_fix_revision_id`);--> statement-breakpoint
CREATE TABLE `auto_distribution_setting_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`points_user_id` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`point_package_revision_id` text,
	`retention_type` text,
	`retention_rate_ppm` integer,
	`retention_amount_scaled` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`point_package_revision_id`) REFERENCES `point_package_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "auto_distribution_setting_revision_number_check" CHECK("auto_distribution_setting_revision"."revision" >= 1),
	CONSTRAINT "auto_distribution_setting_revision_value_check" CHECK(("auto_distribution_setting_revision"."status" = 'OFF' and "auto_distribution_setting_revision"."point_package_revision_id" is null
            and "auto_distribution_setting_revision"."retention_type" is null and "auto_distribution_setting_revision"."retention_rate_ppm" is null
            and "auto_distribution_setting_revision"."retention_amount_scaled" is null)
        or ("auto_distribution_setting_revision"."status" = 'ON' and "auto_distribution_setting_revision"."point_package_revision_id" is not null and (
          ("auto_distribution_setting_revision"."retention_type" = 'PERCENT' and "auto_distribution_setting_revision"."retention_rate_ppm" between 10 and 1000000
            and "auto_distribution_setting_revision"."retention_amount_scaled" is null)
          or ("auto_distribution_setting_revision"."retention_type" = 'FIXED' and "auto_distribution_setting_revision"."retention_rate_ppm" is null
            and typeof("auto_distribution_setting_revision"."retention_amount_scaled") = 'integer'
            and "auto_distribution_setting_revision"."retention_amount_scaled" between 0 and 9007199254740991))))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_distribution_setting_revision_number_uidx` ON `auto_distribution_setting_revision` (`points_user_id`,`revision`);--> statement-breakpoint
CREATE TABLE `auto_distribution_setting` (
	`points_user_id` text PRIMARY KEY NOT NULL,
	`current_revision_id` text NOT NULL,
	`current_revision` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `auto_distribution_snapshot_target` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`points_user_id` text NOT NULL,
	`score` integer NOT NULL,
	`component_snapshot` text NOT NULL,
	`tie_order` integer NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `auto_distribution_snapshot`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "auto_distribution_snapshot_target_score_check" CHECK("auto_distribution_snapshot_target"."score" between 1 and 9007199254740991),
	CONSTRAINT "auto_distribution_snapshot_target_component_check" CHECK(json_valid("auto_distribution_snapshot_target"."component_snapshot"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_distribution_snapshot_target_user_uidx` ON `auto_distribution_snapshot_target` (`snapshot_id`,`points_user_id`);--> statement-breakpoint
CREATE TABLE `auto_distribution_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`source_business_key_hash` text NOT NULL,
	`source_fix_result_id` text NOT NULL,
	`source_recipient_key` text NOT NULL,
	`initial_source_fix_revision_id` text NOT NULL,
	`source_points_user_id` text NOT NULL,
	`evaluation_criterion_id` text NOT NULL,
	`evaluation_criterion_revision_id` text NOT NULL,
	`setting_revision_id` text,
	`point_package_revision_id` text,
	`minimum_unit_scaled` integer NOT NULL,
	`weight_cutoff_exclusive` integer NOT NULL,
	`outcome` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`setting_revision_id`) REFERENCES `auto_distribution_setting_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "auto_distribution_snapshot_hash_check" CHECK(length("auto_distribution_snapshot"."source_business_key_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_distribution_snapshot_source_uidx` ON `auto_distribution_snapshot` (`source_business_key_hash`);--> statement-breakpoint
CREATE TABLE `substitution_method_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`source_evaluation_criterion_id` text NOT NULL,
	`target_evaluation_criterion_id` text NOT NULL,
	`source_evaluation_criterion_revision_id` text NOT NULL,
	`target_evaluation_criterion_revision_id` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`similarity_numerator` integer,
	`similarity_denominator` integer,
	`exchange_rate_revision_id` text,
	`actor_points_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`source_evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`exchange_rate_revision_id`) REFERENCES `exchange_rate_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "substitution_method_revision_number_check" CHECK("substitution_method_revision"."revision" >= 1),
	CONSTRAINT "substitution_method_revision_value_check" CHECK(("substitution_method_revision"."status" = 'ACTIVE'
          and typeof("substitution_method_revision"."similarity_numerator") = 'integer'
          and "substitution_method_revision"."similarity_numerator" between 1 and 9007199254740991
          and typeof("substitution_method_revision"."similarity_denominator") = 'integer'
          and "substitution_method_revision"."similarity_denominator" between "substitution_method_revision"."similarity_numerator" and 9007199254740991
          and "substitution_method_revision"."exchange_rate_revision_id" is not null)
        or ("substitution_method_revision"."status" = 'DISABLED'
          and "substitution_method_revision"."similarity_numerator" is null
          and "substitution_method_revision"."similarity_denominator" is null
          and "substitution_method_revision"."exchange_rate_revision_id" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `substitution_method_revision_pair_number_uidx` ON `substitution_method_revision` (`source_evaluation_criterion_id`,`target_evaluation_criterion_id`,`revision`);--> statement-breakpoint
CREATE TABLE `substitution_method` (
	`source_evaluation_criterion_id` text NOT NULL,
	`target_evaluation_criterion_id` text NOT NULL,
	`current_revision_id` text NOT NULL,
	`current_revision` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`source_evaluation_criterion_id`, `target_evaluation_criterion_id`),
	FOREIGN KEY (`source_evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "substitution_method_distinct_check" CHECK("substitution_method"."source_evaluation_criterion_id" <> "substitution_method"."target_evaluation_criterion_id"),
	CONSTRAINT "substitution_method_revision_check" CHECK("substitution_method"."current_revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `substitution_method_current_revision_uidx` ON `substitution_method` (`current_revision_id`);--> statement-breakpoint
CREATE TABLE `substitution_result_item` (
	`id` text PRIMARY KEY NOT NULL,
	`substitution_result_revision_id` text NOT NULL,
	`points_user_id` text NOT NULL,
	`source_total_scaled` integer NOT NULL,
	`theoretical_numerator` text NOT NULL,
	`theoretical_denominator` text NOT NULL,
	`rounded_amount_scaled` integer NOT NULL,
	`expected_delta_amount_scaled` integer NOT NULL,
	FOREIGN KEY (`substitution_result_revision_id`) REFERENCES `substitution_result_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `substitution_result_item_user_uidx` ON `substitution_result_item` (`substitution_result_revision_id`,`points_user_id`);--> statement-breakpoint
CREATE TABLE `substitution_result_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`substitution_result_id` text NOT NULL,
	`revision` integer NOT NULL,
	`substitution_method_revision_id` text NOT NULL,
	`source_evaluation_criterion_revision_id` text NOT NULL,
	`target_evaluation_criterion_revision_id` text NOT NULL,
	`exchange_rate_revision_id` text NOT NULL,
	`evaluation_month` text NOT NULL,
	`month_start_inclusive` integer NOT NULL,
	`month_end_exclusive` integer NOT NULL,
	`execution_cutoff` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`source_fix_set_hash` text NOT NULL,
	`actor_points_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`substitution_result_id`) REFERENCES `substitution_result`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`substitution_method_revision_id`) REFERENCES `substitution_method_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "substitution_result_revision_number_check" CHECK("substitution_result_revision"."revision" >= 1),
	CONSTRAINT "substitution_result_revision_hash_check" CHECK(length("substitution_result_revision"."source_fix_set_hash") = 64),
	CONSTRAINT "substitution_result_revision_month_check" CHECK("substitution_result_revision"."month_start_inclusive" < "substitution_result_revision"."month_end_exclusive")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `substitution_result_revision_number_uidx` ON `substitution_result_revision` (`substitution_result_id`,`revision`);--> statement-breakpoint
CREATE TABLE `substitution_result` (
	`id` text PRIMARY KEY NOT NULL,
	`source_evaluation_criterion_id` text NOT NULL,
	`target_evaluation_criterion_id` text NOT NULL,
	`evaluation_month` text NOT NULL,
	`current_revision_id` text NOT NULL,
	`current_revision` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "substitution_result_revision_check" CHECK("substitution_result"."current_revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `substitution_result_business_uidx` ON `substitution_result` (`source_evaluation_criterion_id`,`target_evaluation_criterion_id`,`evaluation_month`);--> statement-breakpoint
DROP TRIGGER `point_transaction_batch_commit_guard`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_point_ledger_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`points_user_id` text NOT NULL,
	`evaluation_criterion_id` text NOT NULL,
	`evaluation_criterion_revision_id` text NOT NULL,
	`delta_amount_scaled` integer NOT NULL,
	`affects_evaluation_total` integer NOT NULL,
	`source_type` text NOT NULL,
	`source_fix_revision_id` text,
	`source_unclaimed_fix_entry_id` text,
	`source_transaction_item_id` text,
	`source_substitution_result_revision_id` text,
	`source_auto_distribution_revision_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_fix_revision_id`) REFERENCES `fix_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_unclaimed_fix_entry_id`) REFERENCES `unclaimed_fix_entry`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_transaction_item_id`) REFERENCES `point_transaction_item`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_ledger_entry_delta_check" CHECK(typeof("__new_point_ledger_entry"."delta_amount_scaled") = 'integer' and "__new_point_ledger_entry"."delta_amount_scaled" between -9007199254740991 and 9007199254740991),
	CONSTRAINT "point_ledger_entry_source_check" CHECK(("__new_point_ledger_entry"."source_type" = 'FIX'
             and "__new_point_ledger_entry"."source_fix_revision_id" is not null
             and "__new_point_ledger_entry"."source_transaction_item_id" is null
             and "__new_point_ledger_entry"."source_substitution_result_revision_id" is null
             and "__new_point_ledger_entry"."source_auto_distribution_revision_id" is null
             and "__new_point_ledger_entry"."affects_evaluation_total" = 1)
          or ("__new_point_ledger_entry"."source_type" in
                ('TRANSFER_DEBIT', 'TRANSFER_CREDIT', 'EXCHANGE_BURN', 'EXCHANGE_MINT')
             and "__new_point_ledger_entry"."source_fix_revision_id" is null
             and "__new_point_ledger_entry"."source_unclaimed_fix_entry_id" is null
             and "__new_point_ledger_entry"."source_transaction_item_id" is not null
             and "__new_point_ledger_entry"."source_substitution_result_revision_id" is null
             and "__new_point_ledger_entry"."source_auto_distribution_revision_id" is null
             and "__new_point_ledger_entry"."affects_evaluation_total" = 0)
          or ("__new_point_ledger_entry"."source_type" = 'SUBSTITUTION_FIX'
             and "__new_point_ledger_entry"."source_fix_revision_id" is null
             and "__new_point_ledger_entry"."source_unclaimed_fix_entry_id" is null
             and "__new_point_ledger_entry"."source_transaction_item_id" is null
             and "__new_point_ledger_entry"."source_substitution_result_revision_id" is not null
             and "__new_point_ledger_entry"."source_auto_distribution_revision_id" is null
             and "__new_point_ledger_entry"."affects_evaluation_total" = 1)
          or ("__new_point_ledger_entry"."source_type" in
                ('AUTO_DISTRIBUTION_DEBIT', 'AUTO_DISTRIBUTION_CREDIT')
             and "__new_point_ledger_entry"."source_fix_revision_id" is null
             and "__new_point_ledger_entry"."source_unclaimed_fix_entry_id" is null
             and "__new_point_ledger_entry"."source_transaction_item_id" is null
             and "__new_point_ledger_entry"."source_substitution_result_revision_id" is null
             and "__new_point_ledger_entry"."source_auto_distribution_revision_id" is not null
             and "__new_point_ledger_entry"."affects_evaluation_total" = 0))
);
--> statement-breakpoint
INSERT INTO `__new_point_ledger_entry`("id", "points_user_id", "evaluation_criterion_id", "evaluation_criterion_revision_id", "delta_amount_scaled", "affects_evaluation_total", "source_type", "source_fix_revision_id", "source_unclaimed_fix_entry_id", "source_transaction_item_id", "source_substitution_result_revision_id", "source_auto_distribution_revision_id", "created_at") SELECT "id", "points_user_id", "evaluation_criterion_id", "evaluation_criterion_revision_id", "delta_amount_scaled", "affects_evaluation_total", "source_type", "source_fix_revision_id", "source_unclaimed_fix_entry_id", "source_transaction_item_id", NULL, NULL, "created_at" FROM `point_ledger_entry`;--> statement-breakpoint
DROP TABLE `point_ledger_entry`;--> statement-breakpoint
ALTER TABLE `__new_point_ledger_entry` RENAME TO `point_ledger_entry`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_direct_fix_subject_criterion_uidx` ON `point_ledger_entry` (`source_fix_revision_id`,`points_user_id`,`evaluation_criterion_id`) WHERE "point_ledger_entry"."source_unclaimed_fix_entry_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_unclaimed_uidx` ON `point_ledger_entry` (`source_unclaimed_fix_entry_id`) WHERE "point_ledger_entry"."source_unclaimed_fix_entry_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_transaction_source_uidx` ON `point_ledger_entry` (`source_transaction_item_id`,`source_type`) WHERE "point_ledger_entry"."source_transaction_item_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_substitution_source_uidx` ON `point_ledger_entry` (`source_substitution_result_revision_id`,`points_user_id`,`evaluation_criterion_id`) WHERE "point_ledger_entry"."source_substitution_result_revision_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_auto_distribution_source_uidx` ON `point_ledger_entry` (`source_auto_distribution_revision_id`,`points_user_id`,`evaluation_criterion_id`,`source_type`) WHERE "point_ledger_entry"."source_auto_distribution_revision_id" is not null;--> statement-breakpoint
CREATE INDEX `point_ledger_entry_account_idx` ON `point_ledger_entry` (`points_user_id`,`evaluation_criterion_id`);--> statement-breakpoint
CREATE TABLE `__new_points_user` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_user_id` text NOT NULL,
	`account_status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "points_user_account_status_check" CHECK("__new_points_user"."account_status" in ('ACTIVE', 'CLOSED'))
);
--> statement-breakpoint
INSERT INTO `__new_points_user`("id", "auth_user_id", "account_status", "created_at") SELECT "id", "auth_user_id", 'ACTIVE', "created_at" FROM `points_user`;--> statement-breakpoint
DROP TABLE `points_user`;--> statement-breakpoint
ALTER TABLE `__new_points_user` RENAME TO `points_user`;--> statement-breakpoint
CREATE UNIQUE INDEX `points_user_auth_user_id_uidx` ON `points_user` (`auth_user_id`);
--> statement-breakpoint
CREATE TRIGGER `substitution_method_revision_no_update`
BEFORE UPDATE ON `substitution_method_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_SUBSTITUTION_METHOD_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `substitution_method_revision_no_delete`
BEFORE DELETE ON `substitution_method_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_SUBSTITUTION_METHOD_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `substitution_method_revision_insert_guard`
BEFORE INSERT ON `substitution_method_revision`
WHEN NOT EXISTS (
  SELECT 1 FROM `substitution_method` head
  WHERE head.`source_evaluation_criterion_id` = NEW.`source_evaluation_criterion_id`
    AND head.`target_evaluation_criterion_id` = NEW.`target_evaluation_criterion_id`
    AND ((head.`current_revision` = NEW.`revision` AND head.`current_revision_id` = NEW.`id`)
      OR head.`current_revision` = NEW.`revision` - 1)
)
BEGIN SELECT RAISE(ABORT, 'REVISION_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER `substitution_method_head_update_guard`
BEFORE UPDATE ON `substitution_method`
WHEN NEW.`source_evaluation_criterion_id` IS NOT OLD.`source_evaluation_criterion_id`
  OR NEW.`target_evaluation_criterion_id` IS NOT OLD.`target_evaluation_criterion_id`
  OR NEW.`created_at` IS NOT OLD.`created_at`
  OR NEW.`current_revision` <> OLD.`current_revision` + 1
  OR NOT EXISTS (
    SELECT 1 FROM `substitution_method_revision` revision
    WHERE revision.`id` = NEW.`current_revision_id`
      AND revision.`revision` = NEW.`current_revision`
      AND revision.`source_evaluation_criterion_id` = OLD.`source_evaluation_criterion_id`
      AND revision.`target_evaluation_criterion_id` = OLD.`target_evaluation_criterion_id`
  )
BEGIN SELECT RAISE(ABORT, 'REVISION_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER `substitution_method_head_no_delete`
BEFORE DELETE ON `substitution_method`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_SUBSTITUTION_METHOD'); END;
--> statement-breakpoint
CREATE TRIGGER `substitution_result_revision_no_update`
BEFORE UPDATE ON `substitution_result_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_SUBSTITUTION_RESULT_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `substitution_result_revision_no_delete`
BEFORE DELETE ON `substitution_result_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_SUBSTITUTION_RESULT_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `substitution_result_item_no_update`
BEFORE UPDATE ON `substitution_result_item`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_SUBSTITUTION_RESULT_ITEM'); END;
--> statement-breakpoint
CREATE TRIGGER `substitution_result_item_no_delete`
BEFORE DELETE ON `substitution_result_item`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_SUBSTITUTION_RESULT_ITEM'); END;
--> statement-breakpoint
CREATE TRIGGER `substitution_result_head_no_delete`
BEFORE DELETE ON `substitution_result`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_SUBSTITUTION_RESULT'); END;
--> statement-breakpoint
CREATE TRIGGER `auto_distribution_setting_revision_no_update`
BEFORE UPDATE ON `auto_distribution_setting_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_AUTO_DISTRIBUTION_SETTING_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `auto_distribution_setting_revision_no_delete`
BEFORE DELETE ON `auto_distribution_setting_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_AUTO_DISTRIBUTION_SETTING_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `auto_distribution_setting_no_delete`
BEFORE DELETE ON `auto_distribution_setting`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_AUTO_DISTRIBUTION_SETTING'); END;
--> statement-breakpoint
CREATE TRIGGER `auto_distribution_snapshot_no_update`
BEFORE UPDATE ON `auto_distribution_snapshot`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_AUTO_DISTRIBUTION_SNAPSHOT'); END;
--> statement-breakpoint
CREATE TRIGGER `auto_distribution_snapshot_no_delete`
BEFORE DELETE ON `auto_distribution_snapshot`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_AUTO_DISTRIBUTION_SNAPSHOT'); END;
--> statement-breakpoint
CREATE TRIGGER `auto_distribution_snapshot_target_no_update`
BEFORE UPDATE ON `auto_distribution_snapshot_target`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_AUTO_DISTRIBUTION_SNAPSHOT_TARGET'); END;
--> statement-breakpoint
CREATE TRIGGER `auto_distribution_snapshot_target_no_delete`
BEFORE DELETE ON `auto_distribution_snapshot_target`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_AUTO_DISTRIBUTION_SNAPSHOT_TARGET'); END;
--> statement-breakpoint
CREATE TRIGGER `auto_distribution_revision_no_update`
BEFORE UPDATE ON `auto_distribution_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_AUTO_DISTRIBUTION_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `auto_distribution_revision_no_delete`
BEFORE DELETE ON `auto_distribution_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_AUTO_DISTRIBUTION_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_transaction_guard`
BEFORE INSERT ON `point_ledger_entry`
WHEN NEW.`source_transaction_item_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `point_transaction_item` item
    JOIN `point_transaction_batch` batch ON batch.`id` = item.`batch_id`
    WHERE item.`id` = NEW.`source_transaction_item_id`
      AND batch.`status` = 'VALIDATED'
      AND (
        (NEW.`source_type` = 'TRANSFER_DEBIT' AND item.`transaction_type` = 'TRANSFER'
          AND NEW.`points_user_id` = item.`sender_points_user_id`
          AND NEW.`evaluation_criterion_id` = item.`source_evaluation_criterion_id`
          AND NEW.`evaluation_criterion_revision_id` = item.`source_evaluation_criterion_revision_id`
          AND NEW.`delta_amount_scaled` = -item.`source_amount_scaled`)
        OR (NEW.`source_type` = 'TRANSFER_CREDIT' AND item.`transaction_type` = 'TRANSFER'
          AND NEW.`points_user_id` = item.`recipient_points_user_id`
          AND NEW.`evaluation_criterion_id` = item.`source_evaluation_criterion_id`
          AND NEW.`evaluation_criterion_revision_id` = item.`source_evaluation_criterion_revision_id`
          AND NEW.`delta_amount_scaled` = item.`source_amount_scaled`)
        OR (NEW.`source_type` = 'EXCHANGE_BURN' AND item.`transaction_type` = 'EXCHANGE'
          AND NEW.`points_user_id` = item.`sender_points_user_id`
          AND NEW.`evaluation_criterion_id` = item.`source_evaluation_criterion_id`
          AND NEW.`evaluation_criterion_revision_id` = item.`source_evaluation_criterion_revision_id`
          AND NEW.`delta_amount_scaled` = -item.`source_amount_scaled`)
        OR (NEW.`source_type` = 'EXCHANGE_MINT' AND item.`transaction_type` = 'EXCHANGE'
          AND NEW.`points_user_id` = item.`sender_points_user_id`
          AND NEW.`evaluation_criterion_id` = item.`target_evaluation_criterion_id`
          AND NEW.`evaluation_criterion_revision_id` = item.`target_evaluation_criterion_revision_id`
          AND NEW.`delta_amount_scaled` = item.`target_amount_scaled`)
      )
  )
BEGIN SELECT RAISE(ABORT, 'POINT_TRANSACTION_LEDGER_INVALID'); END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_substitution_guard`
BEFORE INSERT ON `point_ledger_entry`
WHEN NEW.`source_substitution_result_revision_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `substitution_result_item` item
    JOIN `substitution_result_revision` revision
      ON revision.`id` = item.`substitution_result_revision_id`
    JOIN `substitution_method_revision` method
      ON method.`id` = revision.`substitution_method_revision_id`
    WHERE item.`substitution_result_revision_id` = NEW.`source_substitution_result_revision_id`
      AND item.`points_user_id` = NEW.`points_user_id`
      AND method.`target_evaluation_criterion_id` = NEW.`evaluation_criterion_id`
      AND revision.`target_evaluation_criterion_revision_id` = NEW.`evaluation_criterion_revision_id`
      AND item.`expected_delta_amount_scaled` = NEW.`delta_amount_scaled`
  )
BEGIN SELECT RAISE(ABORT, 'SUBSTITUTION_LEDGER_INVALID'); END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_auto_distribution_guard`
BEFORE INSERT ON `point_ledger_entry`
WHEN NEW.`source_auto_distribution_revision_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `auto_distribution_revision` revision
    JOIN `auto_distribution_snapshot` snapshot ON snapshot.`id` = revision.`snapshot_id`
    LEFT JOIN `auto_distribution_snapshot_target` target
      ON target.`snapshot_id` = snapshot.`id` AND target.`points_user_id` = NEW.`points_user_id`
    WHERE revision.`id` = NEW.`source_auto_distribution_revision_id`
      AND snapshot.`evaluation_criterion_id` = NEW.`evaluation_criterion_id`
      AND snapshot.`evaluation_criterion_revision_id` = NEW.`evaluation_criterion_revision_id`
      AND ((NEW.`source_type` = 'AUTO_DISTRIBUTION_DEBIT'
            AND snapshot.`source_points_user_id` = NEW.`points_user_id`
            AND revision.`source_debit_delta_scaled` = NEW.`delta_amount_scaled`)
        OR (NEW.`source_type` = 'AUTO_DISTRIBUTION_CREDIT' AND target.`id` IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM json_each(revision.`credit_delta_snapshot`) delta
              WHERE json_extract(delta.value, '$.pointsUserId') = NEW.`points_user_id`
                AND json_extract(delta.value, '$.deltaAmountScaled') = NEW.`delta_amount_scaled`
            )))
  )
BEGIN SELECT RAISE(ABORT, 'AUTO_DISTRIBUTION_LEDGER_INVALID'); END;
--> statement-breakpoint
CREATE TRIGGER `point_transaction_batch_commit_guard`
BEFORE UPDATE OF `status` ON `point_transaction_batch`
WHEN OLD.`status` = 'VALIDATED' AND NEW.`status` = 'COMMITTED'
  AND EXISTS (
    SELECT 1 FROM `point_transaction_item` item
    WHERE item.`batch_id` = OLD.`id`
      AND (
        (item.`transaction_type` = 'TRANSFER' AND (
          NOT EXISTS (SELECT 1 FROM `point_ledger_entry` ledger
            WHERE ledger.`source_transaction_item_id` = item.`id`
              AND ledger.`source_type` = 'TRANSFER_DEBIT')
          OR NOT EXISTS (SELECT 1 FROM `point_ledger_entry` ledger
            WHERE ledger.`source_transaction_item_id` = item.`id`
              AND ledger.`source_type` = 'TRANSFER_CREDIT')
        ))
        OR (item.`transaction_type` = 'EXCHANGE' AND (
          NOT EXISTS (SELECT 1 FROM `point_ledger_entry` ledger
            WHERE ledger.`source_transaction_item_id` = item.`id`
              AND ledger.`source_type` = 'EXCHANGE_BURN')
          OR NOT EXISTS (SELECT 1 FROM `point_ledger_entry` ledger
            WHERE ledger.`source_transaction_item_id` = item.`id`
              AND ledger.`source_type` = 'EXCHANGE_MINT')
        ))
      )
  )
BEGIN SELECT RAISE(ABORT, 'POINT_TRANSACTION_LEDGER_COUNT_MISMATCH'); END;
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
    typeof(COALESCE((SELECT `balance` FROM `point_account`
      WHERE `points_user_id` = NEW.`points_user_id`
        AND `evaluation_criterion_id` = NEW.`evaluation_criterion_id`), 0)
      + NEW.`delta_amount_scaled`) <> 'integer'
    OR COALESCE((SELECT `balance` FROM `point_account`
      WHERE `points_user_id` = NEW.`points_user_id`
        AND `evaluation_criterion_id` = NEW.`evaluation_criterion_id`), 0)
      + NEW.`delta_amount_scaled` NOT BETWEEN -9007199254740991 AND 9007199254740991
    OR typeof(COALESCE((SELECT `evaluation_total` FROM `point_account`
      WHERE `points_user_id` = NEW.`points_user_id`
        AND `evaluation_criterion_id` = NEW.`evaluation_criterion_id`), 0)
      + CASE WHEN NEW.`affects_evaluation_total` = 1
        THEN NEW.`delta_amount_scaled` ELSE 0 END) <> 'integer'
    OR COALESCE((SELECT `evaluation_total` FROM `point_account`
      WHERE `points_user_id` = NEW.`points_user_id`
        AND `evaluation_criterion_id` = NEW.`evaluation_criterion_id`), 0)
      + CASE WHEN NEW.`affects_evaluation_total` = 1
        THEN NEW.`delta_amount_scaled` ELSE 0 END
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
    NEW.`points_user_id`, NEW.`evaluation_criterion_id`, NEW.`delta_amount_scaled`,
    CASE WHEN NEW.`affects_evaluation_total` = 1 THEN NEW.`delta_amount_scaled` ELSE 0 END,
    NEW.`created_at`
  )
  ON CONFLICT (`points_user_id`, `evaluation_criterion_id`) DO UPDATE SET
    `balance` = `point_account`.`balance` + NEW.`delta_amount_scaled`,
    `evaluation_total` = `point_account`.`evaluation_total`
      + CASE WHEN NEW.`affects_evaluation_total` = 1 THEN NEW.`delta_amount_scaled` ELSE 0 END,
    `updated_at` = NEW.`created_at`;
END;
