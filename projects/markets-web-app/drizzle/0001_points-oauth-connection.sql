CREATE TABLE `points_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`markets_user_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`status` text NOT NULL,
	`link_attempt_id` text NOT NULL,
	`attempt_payload_hash` text NOT NULL,
	`points_issuer` text NOT NULL,
	`points_subject` text NOT NULL,
	`user_client_id` text NOT NULL,
	`m2m_client_id` text NOT NULL,
	`granted_scopes` text NOT NULL,
	`session_id` text NOT NULL,
	`points_grant_id` text,
	`points_grant_version` integer,
	`confirmation_receipt_id` text,
	`deactivation_receipt_id` text,
	`better_auth_account_id` text,
	`token_version` integer DEFAULT 1 NOT NULL,
	`refresh_lease_owner` text,
	`refresh_lease_expires_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_connection_link_attempt_uidx` ON `points_connection` (`link_attempt_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `points_connection_live_markets_user_uidx` ON `points_connection` (`markets_user_id`) WHERE "points_connection"."status" IN ('PENDING_CONFIRMATION', 'ACTIVE');--> statement-breakpoint
CREATE UNIQUE INDEX `points_connection_live_subject_uidx` ON `points_connection` (`points_issuer`,`points_subject`) WHERE "points_connection"."status" IN ('PENDING_CONFIRMATION', 'ACTIVE');--> statement-breakpoint
CREATE INDEX `points_connection_auth_user_idx` ON `points_connection` (`auth_user_id`);--> statement-breakpoint
CREATE TABLE `points_oauth_state` (
	`link_attempt_id` text PRIMARY KEY NOT NULL,
	`markets_user_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`state_hash` text NOT NULL,
	`pkce_verifier` text NOT NULL,
	`nonce` text NOT NULL,
	`callback_uri` text NOT NULL,
	`return_url_hash` text NOT NULL,
	`requested_scopes` text NOT NULL,
	`attempt_payload_hash` text NOT NULL,
	`status` text DEFAULT 'STARTED' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_oauth_state_hash_uidx` ON `points_oauth_state` (`state_hash`);--> statement-breakpoint
CREATE INDEX `points_oauth_state_markets_user_idx` ON `points_oauth_state` (`markets_user_id`);--> statement-breakpoint
CREATE TABLE `points_unlink_authorization` (
	`id` text PRIMARY KEY NOT NULL,
	`points_connection_id` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`state_hash` text NOT NULL,
	`pkce_verifier` text NOT NULL,
	`nonce` text NOT NULL,
	`callback_uri` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'STARTED' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`points_connection_id`) REFERENCES `points_connection`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_unlink_authorization_state_uidx` ON `points_unlink_authorization` (`state_hash`);