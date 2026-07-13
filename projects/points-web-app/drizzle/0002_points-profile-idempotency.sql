CREATE TABLE `idempotency_results` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_points_user_id` text NOT NULL,
	`operation` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`status` integer NOT NULL,
	`response_body` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`actor_points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "idempotency_results_key_check" CHECK(length("idempotency_results"."idempotency_key") > 0),
	CONSTRAINT "idempotency_results_payload_hash_check" CHECK(length("idempotency_results"."payload_hash") = 64),
	CONSTRAINT "idempotency_results_status_check" CHECK("idempotency_results"."status" between 100 and 599),
	CONSTRAINT "idempotency_results_response_body_check" CHECK(json_valid("idempotency_results"."response_body"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_results_actor_operation_key_uidx` ON `idempotency_results` (`actor_points_user_id`,`operation`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`points_user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`external_urls` text DEFAULT '[]' NOT NULL,
	`visibility` text DEFAULT 'PUBLIC' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`points_user_id`) REFERENCES `points_user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "profiles_display_name_length_check" CHECK(length("profiles"."display_name") between 1 and 100),
	CONSTRAINT "profiles_description_length_check" CHECK(length("profiles"."description") <= 500),
	CONSTRAINT "profiles_external_urls_check" CHECK(json_valid("profiles"."external_urls") and json_type("profiles"."external_urls") = 'array' and json_array_length("profiles"."external_urls") <= 30),
	CONSTRAINT "profiles_visibility_check" CHECK("profiles"."visibility" in ('PUBLIC', 'PRIVATE'))
);
