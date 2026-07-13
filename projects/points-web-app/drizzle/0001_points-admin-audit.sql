CREATE TABLE `admin_membership` (
	`id` text PRIMARY KEY NOT NULL,
	`points_user_id` text NOT NULL,
	`role` text DEFAULT 'ADMIN' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "admin_membership_role_check" CHECK("admin_membership"."role" = 'ADMIN')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_membership_points_user_id_uidx` ON `admin_membership` (`points_user_id`);--> statement-breakpoint
CREATE TABLE `audit_event` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_points_user_id` text,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`reason` text,
	`request_id` text NOT NULL,
	`result` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`actor_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `points_user` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_user_auth_user_id_uidx` ON `points_user` (`auth_user_id`);