CREATE TABLE `ops_alert` (
	`alert_key` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`resource_id_hash` text NOT NULL,
	`status` text NOT NULL,
	`first_observed_at` integer NOT NULL,
	`last_observed_at` integer NOT NULL,
	`resolved_at` integer,
	`repeat_count` integer NOT NULL,
	`safe_detail_code` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ownership_revalidation_job` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_ownership_id` text NOT NULL,
	`ownership_epoch_id` text NOT NULL,
	`verification_cycle_id` text NOT NULL,
	`attempt` integer NOT NULL,
	`due_at` integer NOT NULL,
	`cycle_started_at` integer,
	`status` text NOT NULL,
	`lease_until` integer,
	`completed_at` integer,
	`error_code` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`identity_ownership_id`) REFERENCES `identity_ownership`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`ownership_epoch_id`) REFERENCES `ownership_epoch`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ownership_revalidation_attempt_check" CHECK("ownership_revalidation_job"."attempt" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ownership_revalidation_cycle_attempt_uidx` ON `ownership_revalidation_job` (`ownership_epoch_id`,`verification_cycle_id`,`attempt`);--> statement-breakpoint
CREATE INDEX `ownership_revalidation_due_idx` ON `ownership_revalidation_job` (`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `web_reownership_candidate` (
	`identity_ownership_id` text PRIMARY KEY NOT NULL,
	`candidate_points_user_id` text NOT NULL,
	`first_success_at` integer NOT NULL,
	`last_success_at` integer NOT NULL,
	`next_eligible_at` integer NOT NULL,
	`success_count` integer NOT NULL,
	`evidence_hash` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`identity_ownership_id`) REFERENCES `identity_ownership`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`candidate_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict
);
