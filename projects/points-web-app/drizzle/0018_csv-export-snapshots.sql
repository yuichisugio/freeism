CREATE TABLE `csv_export_snapshot_row` (
	`export_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`encoded_row` text NOT NULL,
	`encoded_bytes` integer NOT NULL,
	PRIMARY KEY(`export_id`, `ordinal`),
	FOREIGN KEY (`export_id`) REFERENCES `csv_export_snapshot`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "csv_export_snapshot_row_ordinal_check" CHECK("csv_export_snapshot_row"."ordinal" >= 0),
	CONSTRAINT "csv_export_snapshot_row_bytes_check" CHECK("csv_export_snapshot_row"."encoded_bytes" between 1 and 8192)
);
--> statement-breakpoint
CREATE TABLE `csv_export_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_points_user_id` text NOT NULL,
	`target_points_user_id` text NOT NULL,
	`export_type` text NOT NULL,
	`filter_hash` text NOT NULL,
	`header_json` text NOT NULL,
	`page_size` integer NOT NULL,
	`snapshot_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`total_rows` integer NOT NULL,
	`total_encoded_bytes` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "csv_export_snapshot_page_size_check" CHECK("csv_export_snapshot"."page_size" between 1 and 1000),
	CONSTRAINT "csv_export_snapshot_total_rows_check" CHECK("csv_export_snapshot"."total_rows" between 0 and 50000),
	CONSTRAINT "csv_export_snapshot_total_bytes_check" CHECK("csv_export_snapshot"."total_encoded_bytes" between 0 and 52428800),
	CONSTRAINT "csv_export_snapshot_type_check" CHECK("csv_export_snapshot"."export_type" = 'PROFILE')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `csv_export_snapshot_actor_idempotency_uidx` ON `csv_export_snapshot` (`actor_points_user_id`,`idempotency_key`);