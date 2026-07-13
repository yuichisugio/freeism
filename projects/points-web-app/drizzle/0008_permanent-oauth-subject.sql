CREATE TABLE `permanent_oauth_subject` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`account_id` text NOT NULL,
	`points_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "permanent_oauth_subject_provider_check" CHECK("permanent_oauth_subject"."provider_id" in ('google', 'github')),
	CONSTRAINT "permanent_oauth_subject_account_check" CHECK(length("permanent_oauth_subject"."account_id") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permanent_oauth_subject_provider_account_uidx` ON `permanent_oauth_subject` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_provider_account_uidx` ON `account` (`provider_id`,`account_id`);
--> statement-breakpoint
CREATE TRIGGER `permanent_oauth_subject_no_update`
BEFORE UPDATE ON `permanent_oauth_subject`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_PERMANENT_OAUTH_SUBJECT'); END;
--> statement-breakpoint
CREATE TRIGGER `permanent_oauth_subject_no_delete`
BEFORE DELETE ON `permanent_oauth_subject`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_PERMANENT_OAUTH_SUBJECT'); END;
