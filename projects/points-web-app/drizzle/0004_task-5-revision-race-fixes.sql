CREATE TABLE `evaluation_criterion_revision_seal` (
	`evaluation_criterion_revision_id` text PRIMARY KEY NOT NULL,
	`sealed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`evaluation_criterion_revision_id`) REFERENCES `evaluation_criterion_revision`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `point_package_revision_seal` (
	`point_package_revision_id` text PRIMARY KEY NOT NULL,
	`sealed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`point_package_revision_id`) REFERENCES `point_package_revision`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TRIGGER `evaluation_criterion_related_url_no_late_insert`
BEFORE INSERT ON `evaluation_criterion_related_url`
WHEN EXISTS (
  SELECT 1 FROM `evaluation_criterion_revision_seal`
  WHERE `evaluation_criterion_revision_id` = NEW.`evaluation_criterion_revision_id`
)
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_EVALUATION_CRITERION_RELATED_URL');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_component_no_late_insert`
BEFORE INSERT ON `point_package_component`
WHEN EXISTS (
  SELECT 1 FROM `point_package_revision_seal`
  WHERE `point_package_revision_id` = NEW.`point_package_revision_id`
)
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_POINT_PACKAGE_COMPONENT');
END;
--> statement-breakpoint
CREATE TRIGGER `evaluation_criterion_revision_seal_no_update`
BEFORE UPDATE ON `evaluation_criterion_revision_seal`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_EVALUATION_CRITERION_REVISION_SEAL');
END;
--> statement-breakpoint
CREATE TRIGGER `evaluation_criterion_revision_seal_no_delete`
BEFORE DELETE ON `evaluation_criterion_revision_seal`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_EVALUATION_CRITERION_REVISION_SEAL');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_revision_seal_no_update`
BEFORE UPDATE ON `point_package_revision_seal`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_POINT_PACKAGE_REVISION_SEAL');
END;
--> statement-breakpoint
CREATE TRIGGER `point_package_revision_seal_no_delete`
BEFORE DELETE ON `point_package_revision_seal`
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_POINT_PACKAGE_REVISION_SEAL');
END;
