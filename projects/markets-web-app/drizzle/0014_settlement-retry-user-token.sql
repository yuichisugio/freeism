DROP TABLE `settlement_retry_assertion_jtis`;--> statement-breakpoint
DROP TABLE `settlement_retry_authorizations`;--> statement-breakpoint
DROP TABLE `settlement_retry_rate_events`;--> statement-breakpoint
CREATE TABLE `settlement_retry_rate_events` (
	`id` text PRIMARY KEY NOT NULL,
	`markets_user_id` text NOT NULL,
	`auction_id` text NOT NULL,
	`settlement_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`reason_hash` text NOT NULL,
	`outbox_id` text NOT NULL,
	`workflow_attempt` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auction_id`) REFERENCES `auctions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_retry_rate_events_idempotency_uidx` ON `settlement_retry_rate_events` (`markets_user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `settlement_retry_rate_events_lookup_idx` ON `settlement_retry_rate_events` (`markets_user_id`,`auction_id`,`created_at`);--> statement-breakpoint
CREATE TRIGGER settlement_retry_rate_events_no_update
BEFORE UPDATE ON settlement_retry_rate_events BEGIN
  SELECT RAISE(ABORT, 'SETTLEMENT_RETRY_RATE_EVENT_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER settlement_retry_rate_events_no_delete
BEFORE DELETE ON settlement_retry_rate_events BEGIN
  SELECT RAISE(ABORT, 'SETTLEMENT_RETRY_RATE_EVENT_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER settlement_retry_rate_limit_guard
BEFORE INSERT ON settlement_retry_rate_events
WHEN (SELECT count(*) FROM settlement_retry_rate_events
      WHERE markets_user_id = NEW.markets_user_id
        AND auction_id = NEW.auction_id
        AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at, '-1 hour')) >= 5
BEGIN
  SELECT RAISE(ABORT, 'SETTLEMENT_RETRY_RATE_LIMITED');
END;
