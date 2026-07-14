CREATE TABLE `evaluation_criterion` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_name` text NOT NULL,
	`current_revision_id` text NOT NULL,
	`current_revision` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "evaluation_criterion_revision_check" CHECK("evaluation_criterion"."current_revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_criterion_normalized_name_uidx` ON `evaluation_criterion` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `evaluation_criterion_related_url` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_criterion_revision_id` text NOT NULL,
	`display_order` integer NOT NULL,
	`url` text NOT NULL,
	FOREIGN KEY (`evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evaluation_criterion_related_url_order_check" CHECK("evaluation_criterion_related_url"."display_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_criterion_related_url_order_uidx` ON `evaluation_criterion_related_url` (`evaluation_criterion_revision_id`,`display_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_criterion_related_url_value_uidx` ON `evaluation_criterion_related_url` (`evaluation_criterion_revision_id`,`url`);--> statement-breakpoint
CREATE TABLE `evaluation_criterion_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_criterion_id` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`minimum_unit_scaled` integer NOT NULL,
	`transfer_enabled` integer NOT NULL,
	`exchange_enabled` integer NOT NULL,
	`balance_visible_by_default` integer NOT NULL,
	`buy_now_enabled` integer NOT NULL,
	`actor_points_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evaluation_criterion_revision_revision_check" CHECK("evaluation_criterion_revision"."revision" >= 1),
	CONSTRAINT "evaluation_criterion_revision_status_check" CHECK("evaluation_criterion_revision"."status" in ('ACTIVE', 'ARCHIVED')),
	CONSTRAINT "evaluation_criterion_revision_name_check" CHECK(length("evaluation_criterion_revision"."name") between 1 and 30),
	CONSTRAINT "evaluation_criterion_revision_description_check" CHECK(length("evaluation_criterion_revision"."description") between 1 and 200),
	CONSTRAINT "evaluation_criterion_revision_minimum_unit_check" CHECK("evaluation_criterion_revision"."minimum_unit_scaled" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_criterion_revision_number_uidx` ON `evaluation_criterion_revision` (`evaluation_criterion_id`,`revision`);--> statement-breakpoint
CREATE TABLE `point_package_auction_eligibility_idempotency` (
	`id` text PRIMARY KEY NOT NULL,
	`markets_client_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`expected_item_count` integer NOT NULL,
	`status` integer NOT NULL,
	`response_body` text NOT NULL,
	`checked_at` integer NOT NULL,
	`valid_until` integer,
	CONSTRAINT "point_package_auction_eligibility_idempotency_item_count_check" CHECK("point_package_auction_eligibility_idempotency"."expected_item_count" between 1 and 1000),
	CONSTRAINT "point_package_auction_eligibility_idempotency_status_check" CHECK("point_package_auction_eligibility_idempotency"."status" in (0, 201, 409)),
	CONSTRAINT "point_package_auction_eligibility_idempotency_body_check" CHECK(json_valid("point_package_auction_eligibility_idempotency"."response_body"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_auction_eligibility_idempotency_key_uidx` ON `point_package_auction_eligibility_idempotency` (`markets_client_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `point_package_auction_eligibility_item` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`auction_item_id` text NOT NULL,
	`point_package_id` text NOT NULL,
	`point_package_revision_id` text NOT NULL,
	`content_hash` text NOT NULL,
	`package_eligibility_version` integer NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `point_package_auction_eligibility_receipt`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_package_auction_eligibility_item_version_check" CHECK("point_package_auction_eligibility_item"."package_eligibility_version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_auction_eligibility_item_uidx` ON `point_package_auction_eligibility_item` (`receipt_id`,`auction_item_id`);--> statement-breakpoint
CREATE TABLE `point_package_auction_eligibility_receipt` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_id` text NOT NULL,
	`markets_client_id` text NOT NULL,
	`auction_command_id` text NOT NULL,
	`auction_command_hash` text NOT NULL,
	`checked_at` integer NOT NULL,
	`valid_until` integer NOT NULL,
	FOREIGN KEY (`idempotency_id`) REFERENCES `point_package_auction_eligibility_idempotency`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_package_auction_eligibility_receipt_lease_check" CHECK("point_package_auction_eligibility_receipt"."valid_until" = "point_package_auction_eligibility_receipt"."checked_at" + 30000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_auction_eligibility_receipt_idempotency_id_unique` ON `point_package_auction_eligibility_receipt` (`idempotency_id`);--> statement-breakpoint
CREATE TABLE `point_package_component` (
	`id` text PRIMARY KEY NOT NULL,
	`point_package_revision_id` text NOT NULL,
	`evaluation_criterion_id` text NOT NULL,
	`evaluation_criterion_revision_id` text NOT NULL,
	`evaluation_criterion_name` text NOT NULL,
	`display_order` integer NOT NULL,
	`minimum_unit_scaled` integer NOT NULL,
	`buy_now_enabled` integer NOT NULL,
	`weight` integer NOT NULL,
	FOREIGN KEY (`point_package_revision_id`) REFERENCES `point_package_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_package_component_order_check" CHECK("point_package_component"."display_order" >= 0),
	CONSTRAINT "point_package_component_minimum_unit_check" CHECK("point_package_component"."minimum_unit_scaled" between 1 and 9007199254740991),
	CONSTRAINT "point_package_component_weight_check" CHECK("point_package_component"."weight" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_component_criterion_uidx` ON `point_package_component` (`point_package_revision_id`,`evaluation_criterion_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_component_order_uidx` ON `point_package_component` (`point_package_revision_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `point_package_lifecycle_event` (
	`id` text PRIMARY KEY NOT NULL,
	`point_package_id` text NOT NULL,
	`point_package_revision_id` text NOT NULL,
	`eligibility_version` integer NOT NULL,
	`status` text NOT NULL,
	`actor_points_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`point_package_id`) REFERENCES `point_package`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`point_package_revision_id`) REFERENCES `point_package_revision`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_package_lifecycle_event_status_check" CHECK("point_package_lifecycle_event"."status" in ('ACTIVE', 'INACTIVE')),
	CONSTRAINT "point_package_lifecycle_event_version_check" CHECK("point_package_lifecycle_event"."eligibility_version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_lifecycle_event_version_uidx` ON `point_package_lifecycle_event` (`point_package_id`,`eligibility_version`);--> statement-breakpoint
CREATE TABLE `point_package_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`point_package_id` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`related_url` text,
	`total_weight` integer NOT NULL,
	`package_tick` integer NOT NULL,
	`content_hash` text NOT NULL,
	`actor_points_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`point_package_id`) REFERENCES `point_package`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "point_package_revision_revision_check" CHECK("point_package_revision"."revision" >= 1),
	CONSTRAINT "point_package_revision_status_check" CHECK("point_package_revision"."status" in ('ACTIVE', 'INACTIVE')),
	CONSTRAINT "point_package_revision_total_weight_check" CHECK("point_package_revision"."total_weight" between 1 and 9007199254740991),
	CONSTRAINT "point_package_revision_package_tick_check" CHECK("point_package_revision"."package_tick" between 1 and 9007199254740991),
	CONSTRAINT "point_package_revision_content_hash_check" CHECK(length("point_package_revision"."content_hash") = 71 and substr("point_package_revision"."content_hash", 1, 7) = 'sha256:')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_revision_number_uidx` ON `point_package_revision` (`point_package_id`,`revision`);--> statement-breakpoint
CREATE TABLE `point_package` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_name` text NOT NULL,
	`current_revision_id` text NOT NULL,
	`current_revision` integer NOT NULL,
	`lifecycle_status` text NOT NULL,
	`eligibility_version` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "point_package_revision_check" CHECK("point_package"."current_revision" >= 1),
	CONSTRAINT "point_package_lifecycle_status_check" CHECK("point_package"."lifecycle_status" in ('ACTIVE', 'INACTIVE')),
	CONSTRAINT "point_package_eligibility_version_check" CHECK("point_package"."eligibility_version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_package_normalized_name_uidx` ON `point_package` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `point_package_normalized_name_history` (
	`normalized_name` text PRIMARY KEY NOT NULL,
	`point_package_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`point_package_id`) REFERENCES `point_package`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `profile_evaluation_visibility` (
	`id` text PRIMARY KEY NOT NULL,
	`points_user_id` text NOT NULL,
	`evaluation_criterion_id` text NOT NULL,
	`balance_visibility` text NOT NULL,
	`evaluation_total_visibility` text NOT NULL,
	`fix_visibility` text NOT NULL,
	`transfer_visibility` text NOT NULL,
	`exchange_visibility` text NOT NULL,
	FOREIGN KEY (`evaluation_criterion_id`) REFERENCES `evaluation_criterion`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "profile_evaluation_visibility_balance_check" CHECK("profile_evaluation_visibility"."balance_visibility" in ('PUBLIC', 'PRIVATE')),
	CONSTRAINT "profile_evaluation_visibility_evaluation_total_check" CHECK("profile_evaluation_visibility"."evaluation_total_visibility" in ('PUBLIC', 'PRIVATE')),
	CONSTRAINT "profile_evaluation_visibility_fix_check" CHECK("profile_evaluation_visibility"."fix_visibility" in ('PUBLIC', 'PRIVATE')),
	CONSTRAINT "profile_evaluation_visibility_transfer_check" CHECK("profile_evaluation_visibility"."transfer_visibility" in ('PUBLIC', 'PRIVATE')),
	CONSTRAINT "profile_evaluation_visibility_exchange_check" CHECK("profile_evaluation_visibility"."exchange_visibility" in ('PUBLIC', 'PRIVATE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_evaluation_visibility_criterion_uidx` ON `profile_evaluation_visibility` (`points_user_id`,`evaluation_criterion_id`);--> statement-breakpoint
CREATE TABLE `profile_point_package` (
	`id` text PRIMARY KEY NOT NULL,
	`points_user_id` text NOT NULL,
	`point_package_id` text NOT NULL,
	`display_order` integer NOT NULL,
	FOREIGN KEY (`point_package_id`) REFERENCES `point_package`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "profile_point_package_order_check" CHECK("profile_point_package"."display_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_point_package_package_uidx` ON `profile_point_package` (`points_user_id`,`point_package_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_point_package_order_uidx` ON `profile_point_package` (`points_user_id`,`display_order`);
--> statement-breakpoint
CREATE TRIGGER `evaluation_criterion_revision_no_update`
BEFORE UPDATE ON `evaluation_criterion_revision`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_EVALUATION_CRITERION_REVISION');
END;
--> statement-breakpoint
CREATE TRIGGER `evaluation_criterion_revision_no_delete`
BEFORE DELETE ON `evaluation_criterion_revision`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_EVALUATION_CRITERION_REVISION');
END;
--> statement-breakpoint
CREATE TRIGGER `evaluation_criterion_related_url_no_update`
BEFORE UPDATE ON `evaluation_criterion_related_url`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_EVALUATION_CRITERION_RELATED_URL');
END;
--> statement-breakpoint
CREATE TRIGGER `evaluation_criterion_related_url_no_delete`
BEFORE DELETE ON `evaluation_criterion_related_url`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_EVALUATION_CRITERION_RELATED_URL');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_revision_no_update`
BEFORE UPDATE ON `point_package_revision`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_POINT_PACKAGE_REVISION');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_revision_no_delete`
BEFORE DELETE ON `point_package_revision`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_POINT_PACKAGE_REVISION');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_component_no_update`
BEFORE UPDATE ON `point_package_component`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_POINT_PACKAGE_COMPONENT');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_component_no_delete`
BEFORE DELETE ON `point_package_component`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_POINT_PACKAGE_COMPONENT');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_lifecycle_event_no_update`
BEFORE UPDATE ON `point_package_lifecycle_event`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_POINT_PACKAGE_LIFECYCLE_EVENT');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_lifecycle_event_no_delete`
BEFORE DELETE ON `point_package_lifecycle_event`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_POINT_PACKAGE_LIFECYCLE_EVENT');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_normalized_name_history_owner_guard`
BEFORE INSERT ON `point_package_normalized_name_history`
WHEN EXISTS (
  SELECT 1 FROM `point_package_normalized_name_history`
  WHERE `normalized_name` = NEW.`normalized_name`
    AND `point_package_id` <> NEW.`point_package_id`
)
BEGIN
  SELECT RAISE(ABORT, 'POINT_PACKAGE_NAME_CONFLICT');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_normalized_name_history_no_update`
BEFORE UPDATE ON `point_package_normalized_name_history`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_POINT_PACKAGE_NORMALIZED_NAME_HISTORY');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_normalized_name_history_no_delete`
BEFORE DELETE ON `point_package_normalized_name_history`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_POINT_PACKAGE_NORMALIZED_NAME_HISTORY');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_auction_eligibility_finalize_guard`
BEFORE UPDATE OF `status` ON `point_package_auction_eligibility_idempotency`
WHEN OLD.status = 0 AND NEW.status = 201
  AND (
    SELECT COUNT(*)
    FROM point_package_auction_eligibility_item item
    JOIN point_package_auction_eligibility_receipt receipt ON receipt.id = item.receipt_id
    WHERE receipt.idempotency_id = NEW.id
  ) <> NEW.expected_item_count
BEGIN
  SELECT RAISE(ABORT, 'POINT_PACKAGE_AUCTION_INELIGIBLE');
END;
