CREATE TABLE `points_oauth_connection_deactivation` (
	`id` text PRIMARY KEY NOT NULL,
	`points_connection_id` text NOT NULL,
	`user_client_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`reason` text NOT NULL,
	`grant_version` integer NOT NULL,
	`deactivated_at` integer NOT NULL,
	FOREIGN KEY (`points_connection_id`) REFERENCES `points_oauth_connection`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "points_oauth_connection_deactivation_version_check" CHECK("points_oauth_connection_deactivation"."grant_version" >= 2)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_connection_deactivation_connection_uidx` ON `points_oauth_connection_deactivation` (`points_connection_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_connection_deactivation_idempotency_uidx` ON `points_oauth_connection_deactivation` (`user_client_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `points_oauth_revocation_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`points_connection_id` text NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`delivered_at` integer,
	FOREIGN KEY (`points_connection_id`) REFERENCES `points_oauth_connection`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "points_oauth_revocation_outbox_status_check" CHECK("points_oauth_revocation_outbox"."status" in ('PENDING', 'DELIVERED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_revocation_outbox_action_uidx` ON `points_oauth_revocation_outbox` (`points_connection_id`,`action`);--> statement-breakpoint
CREATE INDEX `points_oauth_revocation_outbox_pending_idx` ON `points_oauth_revocation_outbox` (`status`,`created_at`);