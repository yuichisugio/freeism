CREATE TABLE `settlement_reconciliation_leases` (
	`settlement_id` text PRIMARY KEY NOT NULL,
	`lease_token` text NOT NULL,
	`lease_expires_at` integer NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settlement_retry_assertion_jtis` (
	`jti` text PRIMARY KEY NOT NULL,
	`authorization_id` text NOT NULL,
	`settlement_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`reason_hash` text NOT NULL,
	`points_admin_subject_hash` text NOT NULL,
	`status` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`authorization_id`) REFERENCES `settlement_retry_authorizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_retry_assertion_jtis_status_check" CHECK("settlement_retry_assertion_jtis"."status" in ('PENDING', 'USED')),
	CONSTRAINT "settlement_retry_assertion_jtis_reason_hash_check" CHECK(length("settlement_retry_assertion_jtis"."reason_hash") = 71)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_retry_assertion_authorization_uidx` ON `settlement_retry_assertion_jtis` (`authorization_id`);--> statement-breakpoint
CREATE TABLE `settlement_retry_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`settlement_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`state_hash` text NOT NULL,
	`pkce_verifier` text NOT NULL,
	`nonce` text NOT NULL,
	`callback_uri` text NOT NULL,
	`return_path` text NOT NULL,
	`reason_hash` text NOT NULL,
	`points_admin_subject_hash` text,
	`assertion_jti` text,
	`status` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlement_retry_authorizations_status_check" CHECK("settlement_retry_authorizations"."status" in ('STARTED', 'PENDING', 'USED', 'EXPIRED')),
	CONSTRAINT "settlement_retry_authorizations_reason_hash_check" CHECK(length("settlement_retry_authorizations"."reason_hash") = 71)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_retry_authorizations_state_uidx` ON `settlement_retry_authorizations` (`state_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_retry_authorizations_jti_uidx` ON `settlement_retry_authorizations` (`assertion_jti`);--> statement-breakpoint
CREATE INDEX `settlement_retry_authorizations_target_idx` ON `settlement_retry_authorizations` (`settlement_id`,`markets_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `settlement_retry_rate_events` (
	`id` text PRIMARY KEY NOT NULL,
	`jti` text NOT NULL,
	`points_admin_subject_hash` text NOT NULL,
	`markets_user_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_retry_rate_events_jti_uidx` ON `settlement_retry_rate_events` (`jti`);--> statement-breakpoint
CREATE INDEX `settlement_retry_rate_events_lookup_idx` ON `settlement_retry_rate_events` (`points_admin_subject_hash`,`markets_user_id`,`auction_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER settlement_retry_rate_events_no_update
BEFORE UPDATE ON settlement_retry_rate_events BEGIN
  SELECT RAISE(ABORT, 'SETTLEMENT_RETRY_RATE_EVENT_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER settlement_retry_rate_events_no_delete
BEFORE DELETE ON settlement_retry_rate_events BEGIN
  SELECT RAISE(ABORT, 'SETTLEMENT_RETRY_RATE_EVENT_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER settlement_retry_assertion_status_guard
BEFORE UPDATE OF status ON settlement_retry_assertion_jtis
WHEN NOT (OLD.status = 'PENDING' AND NEW.status = 'USED')
BEGIN
  SELECT RAISE(ABORT, 'SETTLEMENT_RETRY_ASSERTION_INVALID_TRANSITION');
END;
--> statement-breakpoint
CREATE TRIGGER settlement_retry_rate_limit_guard
BEFORE INSERT ON settlement_retry_rate_events
WHEN (SELECT count(*) FROM settlement_retry_rate_events
      WHERE points_admin_subject_hash = NEW.points_admin_subject_hash
        AND markets_user_id = NEW.markets_user_id
        AND auction_id = NEW.auction_id
        AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at, '-1 hour')) >= 5
BEGIN
  SELECT RAISE(ABORT, 'SETTLEMENT_RETRY_RATE_LIMITED');
END;
