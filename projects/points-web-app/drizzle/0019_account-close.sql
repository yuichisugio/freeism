CREATE TABLE `account_close_ownership_suspension` (
	`id` text PRIMARY KEY NOT NULL,
	`close_receipt_id` text NOT NULL,
	`points_user_id` text NOT NULL,
	`identity_ownership_id` text NOT NULL,
	`suspended_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`restored_at` integer,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`identity_ownership_id`) REFERENCES `identity_ownership`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_close_suspension_receipt_ownership_uidx` ON `account_close_ownership_suspension` (`close_receipt_id`,`identity_ownership_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_close_suspension_unrestored_ownership_uidx` ON `account_close_ownership_suspension` (`identity_ownership_id`) WHERE "account_close_ownership_suspension"."restored_at" is null;--> statement-breakpoint
CREATE INDEX `account_close_suspension_user_idx` ON `account_close_ownership_suspension` (`points_user_id`,`restored_at`);