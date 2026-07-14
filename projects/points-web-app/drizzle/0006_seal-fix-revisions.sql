CREATE TABLE `fix_revision_seal` (
	`fix_revision_id` text PRIMARY KEY NOT NULL,
	`sealed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`fix_revision_id`) REFERENCES `fix_revision`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `fix_revision_seal` (`fix_revision_id`, `sealed_at`)
SELECT `id`, `created_at` FROM `fix_revision`;
--> statement-breakpoint
CREATE TRIGGER `fix_revision_entry_no_late_insert`
BEFORE INSERT ON `fix_revision_entry`
WHEN EXISTS (
  SELECT 1 FROM `fix_revision_seal`
  WHERE `fix_revision_id` = NEW.`fix_revision_id`
)
BEGIN SELECT RAISE(ABORT, 'SEALED_FIX_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `unclaimed_fix_entry_no_late_insert`
BEFORE INSERT ON `unclaimed_fix_entry`
WHEN EXISTS (
  SELECT 1 FROM `fix_revision_seal`
  WHERE `fix_revision_id` = NEW.`source_fix_revision_id`
)
BEGIN SELECT RAISE(ABORT, 'SEALED_FIX_REVISION'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_revision_seal_no_update`
BEFORE UPDATE ON `fix_revision_seal`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_REVISION_SEAL'); END;
--> statement-breakpoint
CREATE TRIGGER `fix_revision_seal_no_delete`
BEFORE DELETE ON `fix_revision_seal`
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_FIX_REVISION_SEAL'); END;
