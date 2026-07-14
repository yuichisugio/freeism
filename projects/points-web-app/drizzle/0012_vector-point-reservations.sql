CREATE TABLE `point_reservation_component` (
	`id` text PRIMARY KEY NOT NULL,
	`point_reservation_id` text NOT NULL,
	`evaluation_criterion_id` text NOT NULL,
	`evaluation_criterion_revision_id` text NOT NULL,
	`display_order` integer NOT NULL,
	`amount_scaled` integer NOT NULL,
	FOREIGN KEY (`point_reservation_id`) REFERENCES `point_reservation`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_reservation_component_order_check" CHECK("point_reservation_component"."display_order" >= 0),
	CONSTRAINT "point_reservation_component_amount_check" CHECK(typeof("point_reservation_component"."amount_scaled") = 'integer' and "point_reservation_component"."amount_scaled" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_reservation_component_criterion_uidx` ON `point_reservation_component` (`point_reservation_id`,`evaluation_criterion_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `point_reservation_component_order_uidx` ON `point_reservation_component` (`point_reservation_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `point_reservation_event` (
	`id` text PRIMARY KEY NOT NULL,
	`point_reservation_id` text NOT NULL,
	`event_type` text NOT NULL,
	`expected_version` integer NOT NULL,
	`markets_client_id` text NOT NULL,
	`plan_hash` text NOT NULL,
	`vector_hash` text NOT NULL,
	`point_settlement_capture_id` text,
	`receipt_id` text,
	`idempotency_key` text,
	`payload_hash` text,
	`reason` text,
	`occurred_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`point_reservation_id`) REFERENCES `point_reservation`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`point_settlement_capture_id`) REFERENCES `point_settlement_capture`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_reservation_event_type_check" CHECK("point_reservation_event"."event_type" in ('CREATED', 'CAPTURED', 'RELEASED', 'EXPIRED')),
	CONSTRAINT "point_reservation_event_version_check" CHECK("point_reservation_event"."expected_version" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_reservation_event_version_uidx` ON `point_reservation_event` (`point_reservation_id`,`expected_version`);--> statement-breakpoint
CREATE INDEX `point_reservation_event_receipt_idx` ON `point_reservation_event` (`receipt_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `point_reservation_event_idempotency_uidx` ON `point_reservation_event` (`markets_client_id`,`event_type`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `point_reservation_state` (
	`point_reservation_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`terminal_at` integer,
	`terminal_receipt_id` text,
	FOREIGN KEY (`point_reservation_id`) REFERENCES `point_reservation`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_reservation_state_status_check" CHECK("point_reservation_state"."status" in ('ACTIVE', 'CAPTURED', 'RELEASED', 'EXPIRED')),
	CONSTRAINT "point_reservation_state_version_check" CHECK("point_reservation_state"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `point_reservation_state_status_idx` ON `point_reservation_state` (`status`);--> statement-breakpoint
CREATE TABLE `point_reservation` (
	`id` text PRIMARY KEY NOT NULL,
	`reservation_key` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`markets_client_id` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`points_user_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`settlement_id` text NOT NULL,
	`plan_hash` text NOT NULL,
	`point_package_revision_id` text NOT NULL,
	`price_ticks` integer NOT NULL,
	`quantity` integer NOT NULL,
	`vector_hash` text NOT NULL,
	`expected_component_count` integer NOT NULL,
	`lease_seconds` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`point_package_revision_id`) REFERENCES `point_package_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_reservation_price_check" CHECK("point_reservation"."price_ticks" between 0 and 9007199254740991),
	CONSTRAINT "point_reservation_quantity_check" CHECK("point_reservation"."quantity" between 1 and 9007199254740991),
	CONSTRAINT "point_reservation_component_count_check" CHECK("point_reservation"."expected_component_count" >= 1),
	CONSTRAINT "point_reservation_lease_check" CHECK("point_reservation"."lease_seconds" = 900),
	CONSTRAINT "point_reservation_expiry_check" CHECK("point_reservation"."expires_at" = "point_reservation"."created_at" + 900000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_reservation_client_key_uidx` ON `point_reservation` (`markets_client_id`,`reservation_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `point_reservation_client_idempotency_uidx` ON `point_reservation` (`markets_client_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `point_reservation_settlement_user_uidx` ON `point_reservation` (`markets_client_id`,`settlement_id`,`plan_hash`,`points_user_id`);--> statement-breakpoint
CREATE INDEX `point_reservation_owner_idx` ON `point_reservation` (`points_user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `point_settlement_capture_item` (
	`id` text PRIMARY KEY NOT NULL,
	`point_settlement_capture_id` text NOT NULL,
	`point_reservation_id` text NOT NULL,
	`expected_vector_hash` text NOT NULL,
	FOREIGN KEY (`point_settlement_capture_id`) REFERENCES `point_settlement_capture`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`point_reservation_id`) REFERENCES `point_reservation`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_settlement_capture_item_reservation_uidx` ON `point_settlement_capture_item` (`point_settlement_capture_id`,`point_reservation_id`);--> statement-breakpoint
CREATE TABLE `point_settlement_capture` (
	`id` text PRIMARY KEY NOT NULL,
	`markets_client_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`settlement_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`plan_hash` text NOT NULL,
	`status` text NOT NULL,
	`expected_reservation_count` integer NOT NULL,
	`expected_event_count` integer NOT NULL,
	`expected_ledger_count` integer NOT NULL,
	`content_hash` text NOT NULL,
	`captured_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "point_settlement_capture_status_check" CHECK("point_settlement_capture"."status" in ('PENDING', 'VALIDATED', 'COMMITTED')),
	CONSTRAINT "point_settlement_capture_count_check" CHECK("point_settlement_capture"."expected_reservation_count" between 1 and 1000 and "point_settlement_capture"."expected_event_count" = "point_settlement_capture"."expected_reservation_count" and "point_settlement_capture"."expected_ledger_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_settlement_capture_idempotency_uidx` ON `point_settlement_capture` (`markets_client_id`,`idempotency_key`);--> statement-breakpoint
DROP TRIGGER IF EXISTS `point_transaction_batch_commit_guard`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `point_transaction_batch_validate_guard`;--> statement-breakpoint
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
	`source_reservation_event_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_fix_revision_id`) REFERENCES `fix_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_unclaimed_fix_entry_id`) REFERENCES `unclaimed_fix_entry`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_transaction_item_id`) REFERENCES `point_transaction_item`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_reservation_event_id`) REFERENCES `point_reservation_event`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_ledger_entry_delta_check" CHECK(typeof("__new_point_ledger_entry"."delta_amount_scaled") = 'integer' and "__new_point_ledger_entry"."delta_amount_scaled" between -9007199254740991 and 9007199254740991),
	CONSTRAINT "point_ledger_entry_source_check" CHECK(("__new_point_ledger_entry"."source_type" = 'FIX'
             and "__new_point_ledger_entry"."source_fix_revision_id" is not null
             and "__new_point_ledger_entry"."source_transaction_item_id" is null
             and "__new_point_ledger_entry"."source_substitution_result_revision_id" is null
             and "__new_point_ledger_entry"."source_auto_distribution_revision_id" is null
             and "__new_point_ledger_entry"."source_reservation_event_id" is null
             and "__new_point_ledger_entry"."affects_evaluation_total" = 1)
          or ("__new_point_ledger_entry"."source_type" in
                ('TRANSFER_DEBIT', 'TRANSFER_CREDIT', 'EXCHANGE_BURN', 'EXCHANGE_MINT')
             and "__new_point_ledger_entry"."source_fix_revision_id" is null
             and "__new_point_ledger_entry"."source_unclaimed_fix_entry_id" is null
             and "__new_point_ledger_entry"."source_transaction_item_id" is not null
             and "__new_point_ledger_entry"."source_substitution_result_revision_id" is null
             and "__new_point_ledger_entry"."source_auto_distribution_revision_id" is null
             and "__new_point_ledger_entry"."source_reservation_event_id" is null
             and "__new_point_ledger_entry"."affects_evaluation_total" = 0)
          or ("__new_point_ledger_entry"."source_type" = 'SUBSTITUTION_FIX'
             and "__new_point_ledger_entry"."source_fix_revision_id" is null
             and "__new_point_ledger_entry"."source_unclaimed_fix_entry_id" is null
             and "__new_point_ledger_entry"."source_transaction_item_id" is null
             and "__new_point_ledger_entry"."source_substitution_result_revision_id" is not null
             and "__new_point_ledger_entry"."source_auto_distribution_revision_id" is null
             and "__new_point_ledger_entry"."source_reservation_event_id" is null
             and "__new_point_ledger_entry"."affects_evaluation_total" = 1)
          or ("__new_point_ledger_entry"."source_type" in
                ('AUTO_DISTRIBUTION_DEBIT', 'AUTO_DISTRIBUTION_CREDIT')
             and "__new_point_ledger_entry"."source_fix_revision_id" is null
             and "__new_point_ledger_entry"."source_unclaimed_fix_entry_id" is null
             and "__new_point_ledger_entry"."source_transaction_item_id" is null
             and "__new_point_ledger_entry"."source_substitution_result_revision_id" is null
             and "__new_point_ledger_entry"."source_auto_distribution_revision_id" is not null
             and "__new_point_ledger_entry"."source_reservation_event_id" is null
             and "__new_point_ledger_entry"."affects_evaluation_total" = 0)
          or ("__new_point_ledger_entry"."source_type" = 'RESERVATION_CAPTURE'
             and "__new_point_ledger_entry"."source_fix_revision_id" is null
             and "__new_point_ledger_entry"."source_unclaimed_fix_entry_id" is null
             and "__new_point_ledger_entry"."source_transaction_item_id" is null
             and "__new_point_ledger_entry"."source_substitution_result_revision_id" is null
             and "__new_point_ledger_entry"."source_auto_distribution_revision_id" is null
             and "__new_point_ledger_entry"."source_reservation_event_id" is not null
             and "__new_point_ledger_entry"."affects_evaluation_total" = 0))
);
--> statement-breakpoint
INSERT INTO `__new_point_ledger_entry`("id", "points_user_id", "evaluation_criterion_id", "evaluation_criterion_revision_id", "delta_amount_scaled", "affects_evaluation_total", "source_type", "source_fix_revision_id", "source_unclaimed_fix_entry_id", "source_transaction_item_id", "source_substitution_result_revision_id", "source_auto_distribution_revision_id", "source_reservation_event_id", "created_at") SELECT "id", "points_user_id", "evaluation_criterion_id", "evaluation_criterion_revision_id", "delta_amount_scaled", "affects_evaluation_total", "source_type", "source_fix_revision_id", "source_unclaimed_fix_entry_id", "source_transaction_item_id", "source_substitution_result_revision_id", "source_auto_distribution_revision_id", NULL, "created_at" FROM `point_ledger_entry`;--> statement-breakpoint
DROP TABLE `point_ledger_entry`;--> statement-breakpoint
ALTER TABLE `__new_point_ledger_entry` RENAME TO `point_ledger_entry`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_direct_fix_subject_criterion_uidx` ON `point_ledger_entry` (`source_fix_revision_id`,`points_user_id`,`evaluation_criterion_id`) WHERE "point_ledger_entry"."source_unclaimed_fix_entry_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_unclaimed_uidx` ON `point_ledger_entry` (`source_unclaimed_fix_entry_id`) WHERE "point_ledger_entry"."source_unclaimed_fix_entry_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_transaction_source_uidx` ON `point_ledger_entry` (`source_transaction_item_id`,`source_type`) WHERE "point_ledger_entry"."source_transaction_item_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_substitution_source_uidx` ON `point_ledger_entry` (`source_substitution_result_revision_id`,`points_user_id`,`evaluation_criterion_id`) WHERE "point_ledger_entry"."source_substitution_result_revision_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_auto_distribution_source_uidx` ON `point_ledger_entry` (`source_auto_distribution_revision_id`,`points_user_id`,`evaluation_criterion_id`,`source_type`) WHERE "point_ledger_entry"."source_auto_distribution_revision_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `point_ledger_entry_reservation_source_uidx` ON `point_ledger_entry` (`source_reservation_event_id`,`evaluation_criterion_id`) WHERE "point_ledger_entry"."source_reservation_event_id" is not null;--> statement-breakpoint
CREATE INDEX `point_ledger_entry_account_idx` ON `point_ledger_entry` (`points_user_id`,`evaluation_criterion_id`);
--> statement-breakpoint
CREATE TRIGGER `point_reservation_no_update`
BEFORE UPDATE ON `point_reservation`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_RESERVATION'); END;
--> statement-breakpoint
CREATE TRIGGER `point_reservation_no_delete`
BEFORE DELETE ON `point_reservation`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_RESERVATION'); END;
--> statement-breakpoint
CREATE TRIGGER `point_reservation_component_no_update`
BEFORE UPDATE ON `point_reservation_component`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_RESERVATION_COMPONENT'); END;
--> statement-breakpoint
CREATE TRIGGER `point_reservation_component_no_delete`
BEFORE DELETE ON `point_reservation_component`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_RESERVATION_COMPONENT'); END;
--> statement-breakpoint
CREATE TRIGGER `point_reservation_event_no_update`
BEFORE UPDATE ON `point_reservation_event`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_RESERVATION_EVENT'); END;
--> statement-breakpoint
CREATE TRIGGER `point_reservation_event_no_delete`
BEFORE DELETE ON `point_reservation_event`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_RESERVATION_EVENT'); END;
--> statement-breakpoint
CREATE TRIGGER `point_reservation_created_guard`
BEFORE INSERT ON `point_reservation_event`
WHEN NEW.`event_type` = 'CREATED' AND (
  NEW.`expected_version` <> 0
  OR EXISTS (SELECT 1 FROM `point_reservation_state` state
             WHERE state.`point_reservation_id` = NEW.`point_reservation_id`)
  OR NOT EXISTS (
    SELECT 1 FROM `point_reservation` reservation
    WHERE reservation.`id` = NEW.`point_reservation_id`
      AND reservation.`markets_client_id` = NEW.`markets_client_id`
      AND reservation.`plan_hash` = NEW.`plan_hash`
      AND reservation.`vector_hash` = NEW.`vector_hash`
      AND reservation.`created_at` = NEW.`occurred_at`
      AND reservation.`expires_at` = reservation.`created_at` + 900000
      AND reservation.`expected_component_count` = (
        SELECT COUNT(*) FROM `point_reservation_component` component
        WHERE component.`point_reservation_id` = reservation.`id`
      )
  )
  OR EXISTS (
    SELECT 1 FROM `point_reservation_component` component
    JOIN `point_reservation` reservation ON reservation.`id` = component.`point_reservation_id`
    LEFT JOIN `point_account` account
      ON account.`points_user_id` = reservation.`points_user_id`
     AND account.`evaluation_criterion_id` = component.`evaluation_criterion_id`
    WHERE reservation.`id` = NEW.`point_reservation_id`
      AND COALESCE(account.`balance`, 0) - COALESCE((
        SELECT SUM(active_component.`amount_scaled`)
        FROM `point_reservation_component` active_component
        JOIN `point_reservation` active_reservation
          ON active_reservation.`id` = active_component.`point_reservation_id`
        JOIN `point_reservation_state` active_state
          ON active_state.`point_reservation_id` = active_reservation.`id`
        WHERE active_reservation.`points_user_id` = reservation.`points_user_id`
          AND active_component.`evaluation_criterion_id` = component.`evaluation_criterion_id`
          AND active_state.`status` = 'ACTIVE'
          AND active_reservation.`expires_at` > NEW.`occurred_at`
      ), 0) < component.`amount_scaled`
  )
)
BEGIN SELECT RAISE(ABORT, 'INSUFFICIENT_BALANCE'); END;
--> statement-breakpoint
CREATE TRIGGER `point_reservation_terminal_guard`
BEFORE INSERT ON `point_reservation_event`
WHEN NEW.`event_type` <> 'CREATED' AND NOT EXISTS (
  SELECT 1 FROM `point_reservation` reservation
  JOIN `point_reservation_state` state ON state.`point_reservation_id` = reservation.`id`
  WHERE reservation.`id` = NEW.`point_reservation_id`
    AND state.`status` = 'ACTIVE' AND state.`version` = NEW.`expected_version`
    AND reservation.`markets_client_id` = NEW.`markets_client_id`
    AND reservation.`plan_hash` = NEW.`plan_hash`
    AND reservation.`vector_hash` = NEW.`vector_hash`
    AND ((NEW.`event_type` IN ('CAPTURED', 'RELEASED')
          AND NEW.`occurred_at` < reservation.`expires_at`)
      OR (NEW.`event_type` = 'EXPIRED' AND NEW.`occurred_at` >= reservation.`expires_at`))
    AND (NEW.`event_type` <> 'CAPTURED' OR EXISTS (
      SELECT 1 FROM `point_settlement_capture` capture
      JOIN `point_settlement_capture_item` item
        ON item.`point_settlement_capture_id` = capture.`id`
      WHERE capture.`id` = NEW.`point_settlement_capture_id`
        AND capture.`status` = 'VALIDATED'
        AND capture.`markets_client_id` = reservation.`markets_client_id`
        AND capture.`settlement_id` = reservation.`settlement_id`
        AND capture.`auction_id` = reservation.`auction_id`
        AND capture.`plan_hash` = reservation.`plan_hash`
        AND item.`point_reservation_id` = reservation.`id`
        AND item.`expected_vector_hash` = reservation.`vector_hash`
    ))
)
BEGIN SELECT RAISE(ABORT, 'RESERVATION_STATE_INVALID'); END;
--> statement-breakpoint
CREATE TRIGGER `point_reservation_created_project_after_insert`
AFTER INSERT ON `point_reservation_event`
WHEN NEW.`event_type` = 'CREATED'
BEGIN
  INSERT INTO `point_reservation_state`
    (`point_reservation_id`, `status`, `version`, `terminal_at`, `terminal_receipt_id`)
  VALUES (NEW.`point_reservation_id`, 'ACTIVE', 1, NULL, NULL);
END;
--> statement-breakpoint
CREATE TRIGGER `point_reservation_terminal_project_after_insert`
AFTER INSERT ON `point_reservation_event`
WHEN NEW.`event_type` <> 'CREATED'
BEGIN
  UPDATE `point_reservation_state` SET
    `status` = NEW.`event_type`, `version` = `version` + 1,
    `terminal_at` = NEW.`occurred_at`,
    `terminal_receipt_id` = CASE WHEN NEW.`event_type` = 'EXPIRED' THEN NULL ELSE NEW.`receipt_id` END
  WHERE `point_reservation_id` = NEW.`point_reservation_id`
    AND `status` = 'ACTIVE' AND `version` = NEW.`expected_version`;
END;
--> statement-breakpoint
CREATE TRIGGER `point_reservation_state_no_delete`
BEFORE DELETE ON `point_reservation_state`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_RESERVATION_STATE'); END;
--> statement-breakpoint
CREATE TRIGGER `point_settlement_capture_item_no_update`
BEFORE UPDATE ON `point_settlement_capture_item`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_SETTLEMENT_CAPTURE_ITEM'); END;
--> statement-breakpoint
CREATE TRIGGER `point_settlement_capture_item_no_delete`
BEFORE DELETE ON `point_settlement_capture_item`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_SETTLEMENT_CAPTURE_ITEM'); END;
--> statement-breakpoint
CREATE TRIGGER `point_settlement_capture_update_guard`
BEFORE UPDATE ON `point_settlement_capture`
WHEN NEW.`id` IS NOT OLD.`id`
  OR NEW.`markets_client_id` IS NOT OLD.`markets_client_id`
  OR NEW.`idempotency_key` IS NOT OLD.`idempotency_key`
  OR NEW.`payload_hash` IS NOT OLD.`payload_hash`
  OR NEW.`settlement_id` IS NOT OLD.`settlement_id`
  OR NEW.`auction_id` IS NOT OLD.`auction_id`
  OR NEW.`plan_hash` IS NOT OLD.`plan_hash`
  OR NEW.`expected_reservation_count` IS NOT OLD.`expected_reservation_count`
  OR NEW.`expected_event_count` IS NOT OLD.`expected_event_count`
  OR NEW.`expected_ledger_count` IS NOT OLD.`expected_ledger_count`
  OR NEW.`content_hash` IS NOT OLD.`content_hash`
  OR NEW.`captured_at` IS NOT OLD.`captured_at`
  OR NOT ((OLD.`status` = 'PENDING' AND NEW.`status` = 'VALIDATED')
       OR (OLD.`status` = 'VALIDATED' AND NEW.`status` = 'COMMITTED'))
BEGIN SELECT RAISE(ABORT, 'POINT_SETTLEMENT_CAPTURE_STATE_INVALID'); END;
--> statement-breakpoint
CREATE TRIGGER `point_settlement_capture_validate_guard`
BEFORE UPDATE OF `status` ON `point_settlement_capture`
WHEN OLD.`status` = 'PENDING' AND NEW.`status` = 'VALIDATED'
BEGIN
  SELECT RAISE(ABORT, 'CAPTURE_STATE_CHANGED') WHERE
    (SELECT COUNT(*) FROM `point_settlement_capture_item` item
                    WHERE item.`point_settlement_capture_id` = OLD.`id`)
                    <> OLD.`expected_reservation_count`;
  SELECT RAISE(ABORT, 'CAPTURE_STATE_CHANGED') WHERE EXISTS (
    SELECT 1 FROM `point_settlement_capture_item` item
    LEFT JOIN `point_reservation` reservation ON reservation.`id` = item.`point_reservation_id`
    LEFT JOIN `point_reservation_state` state
      ON state.`point_reservation_id` = reservation.`id`
    WHERE item.`point_settlement_capture_id` = OLD.`id`
      AND (reservation.`id` IS NULL OR reservation.`markets_client_id` <> OLD.`markets_client_id`
        OR reservation.`settlement_id` <> OLD.`settlement_id`
        OR reservation.`auction_id` <> OLD.`auction_id`
        OR reservation.`plan_hash` <> OLD.`plan_hash`
        OR reservation.`vector_hash` <> item.`expected_vector_hash`
        OR state.`status` <> 'ACTIVE' OR reservation.`expires_at` <= OLD.`captured_at`)
  );
  SELECT RAISE(ABORT, 'CAPTURE_STATE_CHANGED') WHERE OLD.`expected_ledger_count` <> (
    SELECT COUNT(*) FROM `point_settlement_capture_item` item
    JOIN `point_reservation_component` component
      ON component.`point_reservation_id` = item.`point_reservation_id`
    WHERE item.`point_settlement_capture_id` = OLD.`id` AND component.`amount_scaled` <> 0
  );
  SELECT RAISE(ABORT, 'INSUFFICIENT_BALANCE') WHERE EXISTS (
    SELECT 1 FROM `point_settlement_capture_item` item
    JOIN `point_reservation` reservation ON reservation.`id` = item.`point_reservation_id`
    JOIN `point_reservation_component` component
      ON component.`point_reservation_id` = reservation.`id`
    LEFT JOIN `point_account` account
      ON account.`points_user_id` = reservation.`points_user_id`
     AND account.`evaluation_criterion_id` = component.`evaluation_criterion_id`
    WHERE item.`point_settlement_capture_id` = OLD.`id`
      AND COALESCE(account.`balance`, 0) < component.`amount_scaled`
  );
END;
--> statement-breakpoint
CREATE TRIGGER `point_settlement_capture_commit_guard`
BEFORE UPDATE OF `status` ON `point_settlement_capture`
WHEN OLD.`status` = 'VALIDATED' AND NEW.`status` = 'COMMITTED'
BEGIN
  SELECT RAISE(ABORT, 'CAPTURE_EVENT_COUNT_MISMATCH') WHERE
    (SELECT COUNT(*) FROM `point_reservation_event` event
                    WHERE event.`point_settlement_capture_id` = OLD.`id`
                      AND event.`event_type` = 'CAPTURED') <> OLD.`expected_event_count`;
  SELECT RAISE(ABORT, 'CAPTURE_LEDGER_COUNT_MISMATCH') WHERE
    (SELECT COUNT(*) FROM `point_ledger_entry` ledger
                    JOIN `point_reservation_event` event
                      ON event.`id` = ledger.`source_reservation_event_id`
                    WHERE event.`point_settlement_capture_id` = OLD.`id`)
                    <> OLD.`expected_ledger_count`;
END;
--> statement-breakpoint
CREATE TRIGGER `point_settlement_capture_no_delete`
BEFORE DELETE ON `point_settlement_capture`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_POINT_SETTLEMENT_CAPTURE'); END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_transaction_guard`
BEFORE INSERT ON `point_ledger_entry`
WHEN NEW.`source_transaction_item_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `point_transaction_item` item
  JOIN `point_transaction_batch` batch ON batch.`id` = item.`batch_id`
  WHERE item.`id` = NEW.`source_transaction_item_id` AND batch.`status` = 'VALIDATED'
    AND ((NEW.`source_type` = 'TRANSFER_DEBIT' AND item.`transaction_type` = 'TRANSFER'
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
          AND NEW.`delta_amount_scaled` = item.`target_amount_scaled`))
)
BEGIN SELECT RAISE(ABORT, 'POINT_TRANSACTION_LEDGER_INVALID'); END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_substitution_guard`
BEFORE INSERT ON `point_ledger_entry`
WHEN NEW.`source_substitution_result_revision_id` IS NOT NULL AND NOT EXISTS (
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
WHEN NEW.`source_auto_distribution_revision_id` IS NOT NULL AND NOT EXISTS (
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
          AND EXISTS (SELECT 1 FROM json_each(revision.`credit_delta_snapshot`) delta
                      WHERE json_extract(delta.value, '$.pointsUserId') = NEW.`points_user_id`
                        AND json_extract(delta.value, '$.deltaAmountScaled') = NEW.`delta_amount_scaled`)))
)
BEGIN SELECT RAISE(ABORT, 'AUTO_DISTRIBUTION_LEDGER_INVALID'); END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_reservation_capture_guard`
BEFORE INSERT ON `point_ledger_entry`
WHEN NEW.`source_reservation_event_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `point_reservation_event` event
  JOIN `point_settlement_capture` capture ON capture.`id` = event.`point_settlement_capture_id`
  JOIN `point_reservation` reservation ON reservation.`id` = event.`point_reservation_id`
  JOIN `point_reservation_component` component
    ON component.`point_reservation_id` = reservation.`id`
  WHERE event.`id` = NEW.`source_reservation_event_id`
    AND event.`event_type` = 'CAPTURED' AND capture.`status` = 'VALIDATED'
    AND reservation.`points_user_id` = NEW.`points_user_id`
    AND component.`evaluation_criterion_id` = NEW.`evaluation_criterion_id`
    AND component.`evaluation_criterion_revision_id` = NEW.`evaluation_criterion_revision_id`
    AND component.`amount_scaled` <> 0
    AND NEW.`delta_amount_scaled` = -component.`amount_scaled`
)
BEGIN SELECT RAISE(ABORT, 'RESERVATION_CAPTURE_LEDGER_INVALID'); END;
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
      + CASE WHEN NEW.`affects_evaluation_total` = 1 THEN NEW.`delta_amount_scaled` ELSE 0 END) <> 'integer'
    OR COALESCE((SELECT `evaluation_total` FROM `point_account`
      WHERE `points_user_id` = NEW.`points_user_id`
        AND `evaluation_criterion_id` = NEW.`evaluation_criterion_id`), 0)
      + CASE WHEN NEW.`affects_evaluation_total` = 1 THEN NEW.`delta_amount_scaled` ELSE 0 END
      NOT BETWEEN -9007199254740991 AND 9007199254740991;
END;
--> statement-breakpoint
CREATE TRIGGER `point_ledger_entry_project_after_insert`
AFTER INSERT ON `point_ledger_entry`
BEGIN
  INSERT INTO `point_account`
    (`points_user_id`, `evaluation_criterion_id`, `balance`, `evaluation_total`, `updated_at`)
  VALUES (NEW.`points_user_id`, NEW.`evaluation_criterion_id`, NEW.`delta_amount_scaled`,
    CASE WHEN NEW.`affects_evaluation_total` = 1 THEN NEW.`delta_amount_scaled` ELSE 0 END,
    NEW.`created_at`)
  ON CONFLICT (`points_user_id`, `evaluation_criterion_id`) DO UPDATE SET
    `balance` = `point_account`.`balance` + NEW.`delta_amount_scaled`,
    `evaluation_total` = `point_account`.`evaluation_total`
      + CASE WHEN NEW.`affects_evaluation_total` = 1 THEN NEW.`delta_amount_scaled` ELSE 0 END,
    `updated_at` = NEW.`created_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `point_transaction_batch_commit_guard`
BEFORE UPDATE OF `status` ON `point_transaction_batch`
WHEN OLD.`status` = 'VALIDATED' AND NEW.`status` = 'COMMITTED' AND EXISTS (
  SELECT 1 FROM `point_transaction_item` item WHERE item.`batch_id` = OLD.`id` AND (
    (item.`transaction_type` = 'TRANSFER' AND (
      NOT EXISTS (SELECT 1 FROM `point_ledger_entry` ledger
        WHERE ledger.`source_transaction_item_id` = item.`id` AND ledger.`source_type` = 'TRANSFER_DEBIT')
      OR NOT EXISTS (SELECT 1 FROM `point_ledger_entry` ledger
        WHERE ledger.`source_transaction_item_id` = item.`id` AND ledger.`source_type` = 'TRANSFER_CREDIT')))
    OR (item.`transaction_type` = 'EXCHANGE' AND (
      NOT EXISTS (SELECT 1 FROM `point_ledger_entry` ledger
        WHERE ledger.`source_transaction_item_id` = item.`id` AND ledger.`source_type` = 'EXCHANGE_BURN')
      OR NOT EXISTS (SELECT 1 FROM `point_ledger_entry` ledger
        WHERE ledger.`source_transaction_item_id` = item.`id` AND ledger.`source_type` = 'EXCHANGE_MINT'))))
)
BEGIN SELECT RAISE(ABORT, 'POINT_TRANSACTION_LEDGER_COUNT_MISMATCH'); END;
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
      AND (item.`transaction_type` <> OLD.`transaction_type`
        OR item.`sender_points_user_id` <> OLD.`actor_points_user_id`
        OR item.`source_evaluation_criterion_revision_id` <> source_head.`current_revision_id`
        OR source_revision.`status` <> 'ACTIVE'
        OR item.`source_amount_scaled` % source_revision.`minimum_unit_scaled` <> 0
        OR (item.`transaction_type` = 'TRANSFER' AND (
          source_revision.`transfer_enabled` <> 1
          OR item.`recipient_points_user_id` = item.`sender_points_user_id`))
        OR (item.`transaction_type` = 'EXCHANGE' AND (
          source_revision.`exchange_enabled` <> 1
          OR item.`source_evaluation_criterion_id` = item.`target_evaluation_criterion_id`
          OR NOT EXISTS (
            SELECT 1 FROM `evaluation_criterion` target_head
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
              AND rate_revision.`status` = 'ACTIVE'))))
  );

  SELECT RAISE(ABORT, 'INSUFFICIENT_BALANCE') WHERE EXISTS (
    SELECT 1 FROM (
      SELECT item.`sender_points_user_id` AS points_user_id,
             item.`source_evaluation_criterion_id` AS evaluation_criterion_id,
             SUM(item.`source_amount_scaled`) AS debit_amount
      FROM `point_transaction_item` item WHERE item.`batch_id` = OLD.`id`
      GROUP BY item.`sender_points_user_id`, item.`source_evaluation_criterion_id`
    ) debit
    LEFT JOIN `point_account` account
      ON account.`points_user_id` = debit.`points_user_id`
     AND account.`evaluation_criterion_id` = debit.`evaluation_criterion_id`
    WHERE COALESCE(account.`balance`, 0) - COALESCE((
      SELECT SUM(component.`amount_scaled`)
      FROM `point_reservation_component` component
      JOIN `point_reservation` reservation
        ON reservation.`id` = component.`point_reservation_id`
      JOIN `point_reservation_state` state
        ON state.`point_reservation_id` = reservation.`id`
      WHERE reservation.`points_user_id` = debit.`points_user_id`
        AND component.`evaluation_criterion_id` = debit.`evaluation_criterion_id`
        AND state.`status` = 'ACTIVE'
        AND reservation.`expires_at` > cast(unixepoch('subsecond') * 1000 as integer)
    ), 0) < debit.`debit_amount`
  );
END;
