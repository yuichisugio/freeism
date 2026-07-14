CREATE TABLE `ops_alert_cleanup_leases` (
	`lease_key` text PRIMARY KEY NOT NULL,
	`lease_expires_at` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ops_alerts` (
	`dedupe_key` text PRIMARY KEY NOT NULL,
	`signal` text NOT NULL,
	`severity` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`resolved_at` text,
	`status` text NOT NULL,
	`delivery_attempt_count` integer DEFAULT 0 NOT NULL,
	`repeat_count` integer DEFAULT 1 NOT NULL,
	`safe_detail_code` text NOT NULL,
	CONSTRAINT "ops_alerts_severity_check" CHECK("__new_ops_alerts"."severity" in ('INFO', 'WARNING', 'CRITICAL')),
	CONSTRAINT "ops_alerts_status_check" CHECK("__new_ops_alerts"."status" in ('OPEN', 'RESOLVED')),
	CONSTRAINT "ops_alerts_delivery_attempt_check" CHECK("__new_ops_alerts"."delivery_attempt_count" >= 0),
	CONSTRAINT "ops_alerts_repeat_count_check" CHECK("__new_ops_alerts"."repeat_count" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_ops_alerts`("dedupe_key", "signal", "severity", "first_seen_at", "last_seen_at", "resolved_at", "status", "delivery_attempt_count", "safe_detail_code") SELECT "dedupe_key", "signal", "severity", "first_seen_at", "last_seen_at", "resolved_at", "status", "delivery_attempt_count", "safe_detail_code" FROM `ops_alerts`;--> statement-breakpoint
DROP TABLE `ops_alerts`;--> statement-breakpoint
ALTER TABLE `__new_ops_alerts` RENAME TO `ops_alerts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ops_alerts_status_seen_idx` ON `ops_alerts` (`status`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `ops_alerts_status_resolved_at_idx` ON `ops_alerts` (`status`,`resolved_at`);
--> statement-breakpoint
CREATE TRIGGER `settlement_rounds_delete_guard`
BEFORE DELETE ON `settlement_rounds`
BEGIN
	SELECT RAISE(ABORT, 'SETTLEMENT_ROUND_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `settlement_round_winners_delete_guard`
BEFORE DELETE ON `settlement_round_winners`
BEGIN
	SELECT RAISE(ABORT, 'SETTLEMENT_ROUND_WINNER_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `settlement_exclusions_delete_guard`
BEFORE DELETE ON `settlement_exclusions`
BEGIN
	SELECT RAISE(ABORT, 'SETTLEMENT_EXCLUSION_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER `settlement_round_winners_status_guard`
BEFORE UPDATE OF `status` ON `settlement_round_winners`
WHEN NOT (
	OLD.status = NEW.status
	OR (OLD.status = 'PENDING' AND NEW.status IN ('ACTIVE', 'REJECTED', 'UNKNOWN'))
	OR (OLD.status = 'UNKNOWN' AND NEW.status IN ('ACTIVE', 'REJECTED'))
	OR (OLD.status = 'REJECTED' AND NEW.status = 'ACTIVE')
	OR (OLD.status = 'ACTIVE' AND NEW.status IN ('RELEASED', 'EXPIRED', 'CAPTURED'))
)
BEGIN
	SELECT RAISE(ABORT, 'SETTLEMENT_ROUND_WINNER_INVALID_TRANSITION');
END;
