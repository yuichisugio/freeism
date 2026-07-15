PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_points_oauth_link_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`user_client_id` text NOT NULL,
	`m2m_client_id` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`points_user_id` text,
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
	CONSTRAINT "points_oauth_link_attempt_status_check" CHECK("__new_points_oauth_link_attempt"."status" in ('PENDING_MARKETS_CONFIRMATION', 'CONFIRMED', 'CANCELLED')),
	CONSTRAINT "points_oauth_link_attempt_expiry_check" CHECK("__new_points_oauth_link_attempt"."expires_at" > "__new_points_oauth_link_attempt"."created_at" and "__new_points_oauth_link_attempt"."expires_at" <= "__new_points_oauth_link_attempt"."created_at" + 600000)
);
--> statement-breakpoint
INSERT INTO `__new_points_oauth_link_attempt`("id", "idempotency_key", "payload_hash", "user_client_id", "m2m_client_id", "markets_user_id", "points_user_id", "requested_scopes", "status", "issuer", "points_subject", "markets_points_connection_id", "finalize_idempotency_key", "created_at", "expires_at", "finalized_at") SELECT "id", "idempotency_key", "payload_hash", "user_client_id", "m2m_client_id", "markets_user_id", "points_user_id", "requested_scopes", "status", "issuer", "points_subject", "markets_points_connection_id", "finalize_idempotency_key", "created_at", "expires_at", "finalized_at" FROM `points_oauth_link_attempt`;--> statement-breakpoint
DROP TABLE `points_oauth_link_attempt`;--> statement-breakpoint
ALTER TABLE `__new_points_oauth_link_attempt` RENAME TO `points_oauth_link_attempt`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_link_attempt_idempotency_uidx` ON `points_oauth_link_attempt` (`m2m_client_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_link_attempt_pending_markets_user_uidx` ON `points_oauth_link_attempt` (`user_client_id`,`markets_user_id`) WHERE "points_oauth_link_attempt"."status" = 'PENDING_MARKETS_CONFIRMATION';--> statement-breakpoint
CREATE INDEX `points_oauth_link_attempt_expiry_idx` ON `points_oauth_link_attempt` (`status`,`expires_at`);