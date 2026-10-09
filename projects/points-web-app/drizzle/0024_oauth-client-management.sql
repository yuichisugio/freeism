CREATE TABLE `jwks` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`alg` text,
	`crv` text
);
--> statement-breakpoint
DROP TABLE `turnstile_token_replay`;--> statement-breakpoint
ALTER TABLE `oauth_client` ADD `client_discovery_id` text;--> statement-breakpoint
ALTER TABLE `oauth_client` ADD `client_credentials_scopes` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `oauth_client` ADD `application_type` text;--> statement-breakpoint
ALTER TABLE `oauth_client` DROP COLUMN `public`;--> statement-breakpoint
ALTER TABLE `oauth_client` DROP COLUMN `type`;--> statement-breakpoint
DELETE FROM `oauth_client` WHERE `user_id` IS NULL AND `token_endpoint_auth_method` = 'client_secret_basic';
