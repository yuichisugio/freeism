CREATE TABLE `exchange_rate_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`source_evaluation_criterion_id` text NOT NULL,
	`target_evaluation_criterion_id` text NOT NULL,
	`source_evaluation_criterion_revision_id` text NOT NULL,
	`target_evaluation_criterion_revision_id` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`numerator` integer,
	`denominator` integer,
	`actor_points_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`source_evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "exchange_rate_revision_distinct_criteria_check" CHECK("exchange_rate_revision"."source_evaluation_criterion_id" <> "exchange_rate_revision"."target_evaluation_criterion_id"),
	CONSTRAINT "exchange_rate_revision_number_check" CHECK("exchange_rate_revision"."revision" >= 1),
	CONSTRAINT "exchange_rate_revision_value_check" CHECK(("exchange_rate_revision"."status" = 'ACTIVE'
             and typeof("exchange_rate_revision"."numerator") = 'integer'
             and "exchange_rate_revision"."numerator" between 1 and 9007199254740991
             and typeof("exchange_rate_revision"."denominator") = 'integer'
             and "exchange_rate_revision"."denominator" between 1 and 9007199254740991)
          or ("exchange_rate_revision"."status" = 'DISABLED'
             and "exchange_rate_revision"."numerator" is null and "exchange_rate_revision"."denominator" is null)),
	CONSTRAINT "exchange_rate_revision_reason_check" CHECK(length(trim("exchange_rate_revision"."reason")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exchange_rate_revision_pair_number_uidx` ON `exchange_rate_revision` (`source_evaluation_criterion_id`,`target_evaluation_criterion_id`,`revision`);--> statement-breakpoint
CREATE TABLE `exchange_rate` (
	`source_evaluation_criterion_id` text NOT NULL,
	`target_evaluation_criterion_id` text NOT NULL,
	`current_revision_id` text NOT NULL,
	`current_revision` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`source_evaluation_criterion_id`, `target_evaluation_criterion_id`),
	FOREIGN KEY (`source_evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "exchange_rate_distinct_criteria_check" CHECK("exchange_rate"."source_evaluation_criterion_id" <> "exchange_rate"."target_evaluation_criterion_id"),
	CONSTRAINT "exchange_rate_revision_check" CHECK("exchange_rate"."current_revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exchange_rate_current_revision_uidx` ON `exchange_rate` (`current_revision_id`);--> statement-breakpoint
CREATE TABLE `point_transaction_batch` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_type` text NOT NULL,
	`actor_points_user_id` text NOT NULL,
	`status` text NOT NULL,
	`expected_item_count` integer NOT NULL,
	`file_hash` text NOT NULL,
	`validation_hash` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`actor_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_transaction_batch_status_check" CHECK("point_transaction_batch"."status" in ('PENDING', 'VALIDATED', 'COMMITTED')),
	CONSTRAINT "point_transaction_batch_item_count_check" CHECK("point_transaction_batch"."expected_item_count" between 1 and 1000),
	CONSTRAINT "point_transaction_batch_file_hash_check" CHECK(length("point_transaction_batch"."file_hash") = 64),
	CONSTRAINT "point_transaction_batch_validation_hash_check" CHECK(length("point_transaction_batch"."validation_hash") = 64),
	CONSTRAINT "point_transaction_batch_idempotency_key_check" CHECK(length(trim("point_transaction_batch"."idempotency_key")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_transaction_batch_idempotency_uidx` ON `point_transaction_batch` (`actor_points_user_id`,`transaction_type`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `point_transaction_item` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`transaction_type` text NOT NULL,
	`sender_points_user_id` text NOT NULL,
	`recipient_points_user_id` text,
	`source_evaluation_criterion_id` text NOT NULL,
	`source_evaluation_criterion_revision_id` text NOT NULL,
	`source_amount_scaled` integer NOT NULL,
	`target_evaluation_criterion_id` text,
	`target_evaluation_criterion_revision_id` text,
	`target_amount_scaled` integer,
	`exchange_rate_revision_id` text,
	`rounding_rule` text,
	`rate_division_remainder` integer,
	`minimum_unit_remainder_scaled` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `point_transaction_batch`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sender_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recipient_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`exchange_rate_revision_id`) REFERENCES `exchange_rate_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_transaction_item_row_check" CHECK("point_transaction_item"."row_number" between 2 and 1001),
	CONSTRAINT "point_transaction_item_source_amount_check" CHECK(typeof("point_transaction_item"."source_amount_scaled") = 'integer'
          and "point_transaction_item"."source_amount_scaled" between 1 and 9007199254740991),
	CONSTRAINT "point_transaction_item_shape_check" CHECK(("point_transaction_item"."transaction_type" = 'TRANSFER'
             and "point_transaction_item"."recipient_points_user_id" is not null
             and "point_transaction_item"."target_evaluation_criterion_id" is null
             and "point_transaction_item"."target_evaluation_criterion_revision_id" is null
             and "point_transaction_item"."target_amount_scaled" is null
             and "point_transaction_item"."exchange_rate_revision_id" is null
             and "point_transaction_item"."rounding_rule" is null
             and "point_transaction_item"."rate_division_remainder" is null
             and "point_transaction_item"."minimum_unit_remainder_scaled" is null)
          or ("point_transaction_item"."transaction_type" = 'EXCHANGE'
             and "point_transaction_item"."recipient_points_user_id" is null
             and "point_transaction_item"."target_evaluation_criterion_id" is not null
             and "point_transaction_item"."target_evaluation_criterion_revision_id" is not null
             and typeof("point_transaction_item"."target_amount_scaled") = 'integer'
             and "point_transaction_item"."target_amount_scaled" between 1 and 9007199254740991
             and "point_transaction_item"."exchange_rate_revision_id" is not null
             and "point_transaction_item"."rounding_rule" = 'FLOOR'
             and typeof("point_transaction_item"."rate_division_remainder") = 'integer'
             and "point_transaction_item"."rate_division_remainder" between 0 and 9007199254740991
             and typeof("point_transaction_item"."minimum_unit_remainder_scaled") = 'integer'
             and "point_transaction_item"."minimum_unit_remainder_scaled" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_transaction_item_batch_row_uidx` ON `point_transaction_item` (`batch_id`,`row_number`);--> statement-breakpoint
CREATE INDEX `point_transaction_item_source_account_idx` ON `point_transaction_item` (`batch_id`,`sender_points_user_id`,`source_evaluation_criterion_id`);--> statement-breakpoint
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
             and "__new_point_ledger_entry"."affects_evaluation_total" = 1)
          or ("__new_point_ledger_entry"."source_type" in
                ('TRANSFER_DEBIT', 'TRANSFER_CREDIT', 'EXCHANGE_BURN', 'EXCHANGE_MINT')
             and "__new_point_ledger_entry"."source_fix_revision_id" is null
             and "__new_point_ledger_entry"."source_unclaimed_fix_entry_id" is null
             and "__new_point_ledger_entry"."source_transaction_item_id" is not null
             and "__new_point_ledger_entry"."affects_evaluation_total" = 0))
);
--> statement-breakpoint
INSERT INTO `__new_point_ledger_entry`("id", "points_user_id", "evaluation_criterion_id", "evaluation_criterion_revision_id", "delta_amount_scaled", "affects_evaluation_total", "source_type", "source_fix_revision_id", "source_unclaimed_fix_entry_id", "source_transaction_item_id", "created_at") SELECT "id", "points_user_id", "evaluation_criterion_id", "evaluation_criterion_revision_id", "delta_amount_scaled", "affects_evaluation_total", "source_type", "source_fix_revision_id", "source_unclaimed_fix_entry_id", NULL, "created_at" FROM `point_ledger_entry`;--> statement-breakpoint
DROP TABLE `point_ledger_entry`;--> statement-breakpoint
ALTER TABLE `__new_point_ledger_entry` RENAME TO `point_ledger_entry`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_direct_fix_subject_criterion_uidx` ON `point_ledger_entry` (`source_fix_revision_id`,`points_user_id`,`evaluation_criterion_id`) WHERE "point_ledger_entry"."source_unclaimed_fix_entry_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_unclaimed_uidx` ON `point_ledger_entry` (`source_unclaimed_fix_entry_id`) WHERE "point_ledger_entry"."source_unclaimed_fix_entry_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_transaction_source_uidx` ON `point_ledger_entry` (`source_transaction_item_id`,`source_type`) WHERE "point_ledger_entry"."source_transaction_item_id" is not null;--> statement-breakpoint
CREATE INDEX `point_ledger_entry_account_idx` ON `point_ledger_entry` (`points_user_id`,`evaluation_criterion_id`);
--> statement-breakpoint
CREATE TRIGGER `exchange_rate_revision_no_update`
BEFORE UPDATE ON `exchange_rate_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_EXCHANGE_RATE_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `exchange_rate_revision_no_delete`
BEFORE DELETE ON `exchange_rate_revision`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_EXCHANGE_RATE_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `exchange_rate_revision_head_guard_before_insert`
BEFORE INSERT ON `exchange_rate_revision`
WHEN NOT EXISTS (
  SELECT 1 FROM `exchange_rate` head
  WHERE head.`source_evaluation_criterion_id` = NEW.`source_evaluation_criterion_id`
    AND head.`target_evaluation_criterion_id` = NEW.`target_evaluation_criterion_id`
    AND (
      (head.`current_revision` = NEW.`revision`
        AND head.`current_revision_id` = NEW.`id`)
      OR head.`current_revision` = NEW.`revision` - 1
    )
)
BEGIN SELECT RAISE(ABORT, 'REVISION_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER `exchange_rate_revision_reference_guard_before_insert`
BEFORE INSERT ON `exchange_rate_revision`
WHEN NOT EXISTS (
  SELECT 1
  FROM `evaluation_criterion` source_head
  JOIN `evaluation_criterion_revision` source_revision
    ON source_revision.`id` = source_head.`current_revision_id`
  JOIN `evaluation_criterion` target_head
    ON target_head.`id` = NEW.`target_evaluation_criterion_id`
  JOIN `evaluation_criterion_revision` target_revision
    ON target_revision.`id` = target_head.`current_revision_id`
  WHERE source_head.`id` = NEW.`source_evaluation_criterion_id`
    AND source_head.`current_revision_id` = NEW.`source_evaluation_criterion_revision_id`
    AND target_head.`current_revision_id` = NEW.`target_evaluation_criterion_revision_id`
    AND source_revision.`status` = 'ACTIVE'
    AND target_revision.`status` = 'ACTIVE'
)
BEGIN SELECT RAISE(ABORT, 'REVISION_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER `exchange_rate_head_update_guard`
BEFORE UPDATE ON `exchange_rate`
WHEN NEW.`source_evaluation_criterion_id` IS NOT OLD.`source_evaluation_criterion_id`
  OR NEW.`target_evaluation_criterion_id` IS NOT OLD.`target_evaluation_criterion_id`
  OR NEW.`created_at` IS NOT OLD.`created_at`
  OR NEW.`current_revision` <> OLD.`current_revision` + 1
  OR NEW.`current_revision_id` = OLD.`current_revision_id`
  OR NOT EXISTS (
    SELECT 1 FROM `exchange_rate_revision` revision
    WHERE revision.`id` = NEW.`current_revision_id`
      AND revision.`source_evaluation_criterion_id` = OLD.`source_evaluation_criterion_id`
      AND revision.`target_evaluation_criterion_id` = OLD.`target_evaluation_criterion_id`
      AND revision.`revision` = NEW.`current_revision`
  )
BEGIN SELECT RAISE(ABORT, 'REVISION_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER `exchange_rate_head_no_delete`
BEFORE DELETE ON `exchange_rate`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_EXCHANGE_RATE'); END;
--> statement-breakpoint
CREATE TRIGGER `point_transaction_item_insert_guard`
BEFORE INSERT ON `point_transaction_item`
WHEN NOT EXISTS (
  SELECT 1 FROM `point_transaction_batch` batch
  WHERE batch.`id` = NEW.`batch_id`
    AND batch.`status` = 'PENDING'
    AND batch.`transaction_type` = NEW.`transaction_type`
    AND batch.`actor_points_user_id` = NEW.`sender_points_user_id`
)
BEGIN SELECT RAISE(ABORT, 'POINT_TRANSACTION_ITEM_INVALID'); END;
--> statement-breakpoint
CREATE TRIGGER `point_transaction_item_no_update`
BEFORE UPDATE ON `point_transaction_item`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_TRANSACTION_ITEM'); END;
--> statement-breakpoint
CREATE TRIGGER `point_transaction_item_no_delete`
BEFORE DELETE ON `point_transaction_item`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_TRANSACTION_ITEM'); END;
--> statement-breakpoint
CREATE TRIGGER `point_transaction_batch_update_guard`
BEFORE UPDATE ON `point_transaction_batch`
WHEN NEW.`id` IS NOT OLD.`id`
  OR NEW.`transaction_type` IS NOT OLD.`transaction_type`
  OR NEW.`actor_points_user_id` IS NOT OLD.`actor_points_user_id`
  OR NEW.`expected_item_count` IS NOT OLD.`expected_item_count`
  OR NEW.`file_hash` IS NOT OLD.`file_hash`
  OR NEW.`validation_hash` IS NOT OLD.`validation_hash`
  OR NEW.`idempotency_key` IS NOT OLD.`idempotency_key`
  OR NEW.`created_at` IS NOT OLD.`created_at`
  OR NOT (
    (OLD.`status` = 'PENDING' AND NEW.`status` = 'VALIDATED')
    OR (OLD.`status` = 'VALIDATED' AND NEW.`status` = 'COMMITTED')
  )
BEGIN SELECT RAISE(ABORT, 'POINT_TRANSACTION_STATE_INVALID'); END;
--> statement-breakpoint
CREATE TRIGGER `point_transaction_batch_validate_guard`
BEFORE UPDATE OF `status` ON `point_transaction_batch`
WHEN OLD.`status` = 'PENDING' AND NEW.`status` = 'VALIDATED'
BEGIN
  SELECT RAISE(ABORT, 'POINT_TRANSACTION_ITEM_COUNT_MISMATCH') WHERE (
    SELECT COUNT(*) FROM `point_transaction_item` item WHERE item.`batch_id` = OLD.`id`
  ) <> OLD.`expected_item_count`;

  SELECT RAISE(ABORT, 'POINT_TRANSACTION_REFERENCE_INVALID') WHERE EXISTS (
    SELECT 1 FROM `point_transaction_item` item
    JOIN `evaluation_criterion` source_head
      ON source_head.`id` = item.`source_evaluation_criterion_id`
    JOIN `evaluation_criterion_revision` source_revision
      ON source_revision.`id` = source_head.`current_revision_id`
    WHERE item.`batch_id` = OLD.`id`
      AND (
        item.`transaction_type` <> OLD.`transaction_type`
        OR item.`sender_points_user_id` <> OLD.`actor_points_user_id`
        OR item.`source_evaluation_criterion_revision_id` <> source_head.`current_revision_id`
        OR source_revision.`status` <> 'ACTIVE'
        OR item.`source_amount_scaled` % source_revision.`minimum_unit_scaled` <> 0
        OR (item.`transaction_type` = 'TRANSFER' AND (
          source_revision.`transfer_enabled` <> 1
          OR item.`recipient_points_user_id` = item.`sender_points_user_id`
        ))
        OR (item.`transaction_type` = 'EXCHANGE' AND (
          source_revision.`exchange_enabled` <> 1
          OR item.`source_evaluation_criterion_id` = item.`target_evaluation_criterion_id`
          OR NOT EXISTS (
            SELECT 1
            FROM `evaluation_criterion` target_head
            JOIN `evaluation_criterion_revision` target_revision
              ON target_revision.`id` = target_head.`current_revision_id`
            JOIN `exchange_rate` rate_head
              ON rate_head.`source_evaluation_criterion_id` = item.`source_evaluation_criterion_id`
             AND rate_head.`target_evaluation_criterion_id` = item.`target_evaluation_criterion_id`
            JOIN `exchange_rate_revision` rate_revision
              ON rate_revision.`id` = rate_head.`current_revision_id`
            WHERE target_head.`id` = item.`target_evaluation_criterion_id`
              AND target_head.`current_revision_id` = item.`target_evaluation_criterion_revision_id`
              AND target_revision.`status` = 'ACTIVE'
              AND target_revision.`exchange_enabled` = 1
              AND item.`target_amount_scaled` % target_revision.`minimum_unit_scaled` = 0
              AND rate_revision.`id` = item.`exchange_rate_revision_id`
              AND rate_revision.`status` = 'ACTIVE'
          )
        ))
      )
  );

  SELECT RAISE(ABORT, 'INSUFFICIENT_BALANCE') WHERE EXISTS (
    SELECT 1
    FROM (
      SELECT item.`sender_points_user_id` AS points_user_id,
             item.`source_evaluation_criterion_id` AS evaluation_criterion_id,
             SUM(item.`source_amount_scaled`) AS debit_amount
      FROM `point_transaction_item` item
      WHERE item.`batch_id` = OLD.`id`
      GROUP BY item.`sender_points_user_id`, item.`source_evaluation_criterion_id`
    ) debit
    LEFT JOIN `point_account` account
      ON account.`points_user_id` = debit.`points_user_id`
     AND account.`evaluation_criterion_id` = debit.`evaluation_criterion_id`
    WHERE COALESCE(account.`balance`, 0) < debit.`debit_amount`
  );
END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_transaction_guard`
BEFORE INSERT ON `point_ledger_entry`
WHEN NEW.`source_transaction_item_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `point_transaction_item` item
    JOIN `point_transaction_batch` batch ON batch.`id` = item.`batch_id`
    WHERE item.`id` = NEW.`source_transaction_item_id`
      AND batch.`status` = 'VALIDATED'
      AND (
        (NEW.`source_type` = 'TRANSFER_DEBIT'
          AND item.`transaction_type` = 'TRANSFER'
          AND NEW.`points_user_id` = item.`sender_points_user_id`
          AND NEW.`evaluation_criterion_id` = item.`source_evaluation_criterion_id`
          AND NEW.`evaluation_criterion_revision_id` = item.`source_evaluation_criterion_revision_id`
          AND NEW.`delta_amount_scaled` = -item.`source_amount_scaled`)
        OR (NEW.`source_type` = 'TRANSFER_CREDIT'
          AND item.`transaction_type` = 'TRANSFER'
          AND NEW.`points_user_id` = item.`recipient_points_user_id`
          AND NEW.`evaluation_criterion_id` = item.`source_evaluation_criterion_id`
          AND NEW.`evaluation_criterion_revision_id` = item.`source_evaluation_criterion_revision_id`
          AND NEW.`delta_amount_scaled` = item.`source_amount_scaled`)
        OR (NEW.`source_type` = 'EXCHANGE_BURN'
          AND item.`transaction_type` = 'EXCHANGE'
          AND NEW.`points_user_id` = item.`sender_points_user_id`
          AND NEW.`evaluation_criterion_id` = item.`source_evaluation_criterion_id`
          AND NEW.`evaluation_criterion_revision_id` = item.`source_evaluation_criterion_revision_id`
          AND NEW.`delta_amount_scaled` = -item.`source_amount_scaled`)
        OR (NEW.`source_type` = 'EXCHANGE_MINT'
          AND item.`transaction_type` = 'EXCHANGE'
          AND NEW.`points_user_id` = item.`sender_points_user_id`
          AND NEW.`evaluation_criterion_id` = item.`target_evaluation_criterion_id`
          AND NEW.`evaluation_criterion_revision_id` = item.`target_evaluation_criterion_revision_id`
          AND NEW.`delta_amount_scaled` = item.`target_amount_scaled`)
      )
  )
BEGIN SELECT RAISE(ABORT, 'POINT_TRANSACTION_LEDGER_INVALID'); END;
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
CREATE TRIGGER `point_transaction_batch_no_delete`
BEFORE DELETE ON `point_transaction_batch`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_TRANSACTION_BATCH'); END;
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
  SELECT RAISE(ABORT, 'SAFE_INTEGER_OVERFLOW') WHERE
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
      NOT BETWEEN -9007199254740991 AND 9007199254740991;
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
