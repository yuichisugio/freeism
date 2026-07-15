CREATE TABLE `proof_review_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`reviewer_markets_user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`completion_proof_url` text,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `proof_reviews`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "proof_review_revisions_revision_check" CHECK("proof_review_revisions"."revision_number" >= 1),
	CONSTRAINT "proof_review_revisions_rating_check" CHECK("proof_review_revisions"."rating" between 1 and 5),
	CONSTRAINT "proof_review_revisions_idempotency_key_check" CHECK(length("proof_review_revisions"."idempotency_key") between 1 and 200),
	CONSTRAINT "proof_review_revisions_payload_hash_check" CHECK(length("proof_review_revisions"."payload_hash") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proof_review_revisions_review_number_uidx` ON `proof_review_revisions` (`review_id`,`revision_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `proof_review_revisions_actor_key_uidx` ON `proof_review_revisions` (`reviewer_markets_user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `proof_review_revisions_history_idx` ON `proof_review_revisions` (`review_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `proof_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`proof_id` text NOT NULL,
	`direction` text NOT NULL,
	`reviewer_markets_user_id` text NOT NULL,
	`reviewee_markets_user_id` text NOT NULL,
	`current_revision_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`proof_id`) REFERENCES `proofs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewee_markets_user_id`) REFERENCES `markets_user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "proof_reviews_direction_check" CHECK("proof_reviews"."direction" in ('SELLER_TO_BUYER', 'BUYER_TO_SELLER')),
	CONSTRAINT "proof_reviews_revision_check" CHECK("proof_reviews"."revision_number" between 1 and 9007199254740991),
	CONSTRAINT "proof_reviews_distinct_parties_check" CHECK("proof_reviews"."reviewer_markets_user_id" <> "proof_reviews"."reviewee_markets_user_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proof_reviews_proof_direction_uidx` ON `proof_reviews` (`proof_id`,`direction`);--> statement-breakpoint
CREATE UNIQUE INDEX `proof_reviews_current_revision_uidx` ON `proof_reviews` (`current_revision_id`);--> statement-breakpoint
CREATE TRIGGER proof_review_revisions_no_update
BEFORE UPDATE ON proof_review_revisions BEGIN
  SELECT RAISE(ABORT, 'PROOF_REVIEW_REVISION_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER proof_review_revisions_no_delete
BEFORE DELETE ON proof_review_revisions BEGIN
  SELECT RAISE(ABORT, 'PROOF_REVIEW_REVISION_IMMUTABLE');
END;--> statement-breakpoint
CREATE TRIGGER proof_reviews_current_pointer_guard
BEFORE UPDATE ON proof_reviews
WHEN NOT (
  NEW.id = OLD.id
  AND NEW.proof_id = OLD.proof_id
  AND NEW.direction = OLD.direction
  AND NEW.reviewer_markets_user_id = OLD.reviewer_markets_user_id
  AND NEW.reviewee_markets_user_id = OLD.reviewee_markets_user_id
  AND NEW.current_revision_id <> OLD.current_revision_id
  AND NEW.revision_number = OLD.revision_number + 1
  AND NEW.created_at = OLD.created_at
  AND NEW.updated_at >= OLD.updated_at
  AND EXISTS (
    SELECT 1 FROM proof_review_revisions revision
    WHERE revision.id = NEW.current_revision_id
      AND revision.review_id = NEW.id
      AND revision.revision_number = NEW.revision_number
  )
)
BEGIN
  SELECT RAISE(ABORT, 'PROOF_REVIEW_CURRENT_POINTER_INVALID');
END;
