CREATE TABLE `app_rate_limit_window` (
	`operation` text NOT NULL,
	`subject_key_hash` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`window_seconds` integer NOT NULL,
	`request_count` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`operation`, `subject_key_hash`, `window_started_at`),
	CONSTRAINT "app_rate_limit_operation_check" CHECK(length("app_rate_limit_window"."operation") > 0),
	CONSTRAINT "app_rate_limit_subject_hash_check" CHECK(length("app_rate_limit_window"."subject_key_hash") = 64),
	CONSTRAINT "app_rate_limit_window_seconds_check" CHECK("app_rate_limit_window"."window_seconds" > 0),
	CONSTRAINT "app_rate_limit_request_count_check" CHECK("app_rate_limit_window"."request_count" > 0)
);
--> statement-breakpoint
CREATE INDEX `app_rate_limit_window_expiry_idx` ON `app_rate_limit_window` (`window_started_at`,`window_seconds`);--> statement-breakpoint
CREATE TABLE `turnstile_token_replay` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`operation` text NOT NULL,
	`hostname` text NOT NULL,
	`action` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer NOT NULL,
	CONSTRAINT "turnstile_token_hash_check" CHECK(length("turnstile_token_replay"."token_hash") = 64),
	CONSTRAINT "turnstile_operation_check" CHECK(length("turnstile_token_replay"."operation") > 0),
	CONSTRAINT "turnstile_hostname_check" CHECK(length("turnstile_token_replay"."hostname") > 0),
	CONSTRAINT "turnstile_action_check" CHECK(length("turnstile_token_replay"."action") > 0),
	CONSTRAINT "turnstile_expiry_check" CHECK("turnstile_token_replay"."expires_at" >= "turnstile_token_replay"."used_at")
);
--> statement-breakpoint
CREATE INDEX `turnstile_token_replay_expiry_idx` ON `turnstile_token_replay` (`expires_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ops_alert` (
	`alert_key` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`resource_id_hash` text NOT NULL,
	`status` text NOT NULL,
	`first_observed_at` integer NOT NULL,
	`last_observed_at` integer NOT NULL,
	`resolved_at` integer,
	`repeat_count` integer NOT NULL,
	`safe_detail_code` text NOT NULL,
	CONSTRAINT "ops_alert_status_check" CHECK("__new_ops_alert"."status" in ('OPEN', 'RESOLVED')),
	CONSTRAINT "ops_alert_repeat_count_check" CHECK("__new_ops_alert"."repeat_count" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_ops_alert`("alert_key", "type", "resource_id_hash", "status", "first_observed_at", "last_observed_at", "resolved_at", "repeat_count", "safe_detail_code") SELECT "alert_key", "type", "resource_id_hash", "status", "first_observed_at", "last_observed_at", "resolved_at", "repeat_count", "safe_detail_code" FROM `ops_alert`;--> statement-breakpoint
DROP TABLE `ops_alert`;--> statement-breakpoint
ALTER TABLE `__new_ops_alert` RENAME TO `ops_alert`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ops_alert_status_observed_idx` ON `ops_alert` (`status`,`last_observed_at`);--> statement-breakpoint
CREATE INDEX `ops_alert_resolved_cleanup_idx` ON `ops_alert` (`status`,`resolved_at`);