CREATE TABLE `points_oauth_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`link_attempt_id` text NOT NULL,
	`markets_points_connection_id` text NOT NULL,
	`user_client_id` text NOT NULL,
	`m2m_client_id` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`points_user_id` text NOT NULL,
	`issuer` text NOT NULL,
	`points_subject` text NOT NULL,
	`granted_scopes` text NOT NULL,
	`status` text NOT NULL,
	`grant_version` integer DEFAULT 1 NOT NULL,
	`linked_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`link_attempt_id`) REFERENCES `points_oauth_link_attempt`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "points_oauth_connection_status_check" CHECK("points_oauth_connection"."status" in ('ACTIVE', 'REAUTH_REQUIRED', 'UNLINKED')),
	CONSTRAINT "points_oauth_connection_version_check" CHECK("points_oauth_connection"."grant_version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_connection_attempt_uidx` ON `points_oauth_connection` (`link_attempt_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_connection_markets_id_uidx` ON `points_oauth_connection` (`markets_points_connection_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_connection_active_markets_user_uidx` ON `points_oauth_connection` (`user_client_id`,`markets_user_id`) WHERE "points_oauth_connection"."status" in ('ACTIVE', 'REAUTH_REQUIRED');--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_connection_active_points_user_uidx` ON `points_oauth_connection` (`user_client_id`,`points_user_id`) WHERE "points_oauth_connection"."status" in ('ACTIVE', 'REAUTH_REQUIRED');--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_connection_subject_uidx` ON `points_oauth_connection` (`issuer`,`user_client_id`,`points_subject`);--> statement-breakpoint
CREATE TABLE `points_oauth_link_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`user_client_id` text NOT NULL,
	`m2m_client_id` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`points_user_id` text NOT NULL,
	`requested_scopes` text NOT NULL,
	`status` text NOT NULL,
	`issuer` text,
	`points_subject` text,
	`markets_points_connection_id` text,
	`finalize_idempotency_key` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`finalized_at` integer,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "points_oauth_link_attempt_status_check" CHECK("points_oauth_link_attempt"."status" in ('PENDING_MARKETS_CONFIRMATION', 'CONFIRMED', 'CANCELLED')),
	CONSTRAINT "points_oauth_link_attempt_expiry_check" CHECK("points_oauth_link_attempt"."expires_at" > "points_oauth_link_attempt"."created_at" and "points_oauth_link_attempt"."expires_at" <= "points_oauth_link_attempt"."created_at" + 600000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_link_attempt_idempotency_uidx` ON `points_oauth_link_attempt` (`m2m_client_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_link_attempt_pending_markets_user_uidx` ON `points_oauth_link_attempt` (`user_client_id`,`markets_user_id`) WHERE "points_oauth_link_attempt"."status" = 'PENDING_MARKETS_CONFIRMATION';--> statement-breakpoint
CREATE INDEX `points_oauth_link_attempt_expiry_idx` ON `points_oauth_link_attempt` (`status`,`expires_at`);