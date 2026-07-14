import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { marketsUsers } from "./markets-user";
import { proofs } from "./proof";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const safeInteger = sql.raw("9007199254740991");

export const proofReviews = sqliteTable(
  "proof_reviews",
  {
    id: text("id").primaryKey(),
    proofId: text("proof_id")
      .notNull()
      .references(() => proofs.id),
    direction: text("direction", { enum: ["SELLER_TO_BUYER", "BUYER_TO_SELLER"] }).notNull(),
    reviewerMarketsUserId: text("reviewer_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    revieweeMarketsUserId: text("reviewee_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    // 0009's pointer guard binds this to an existing revision for this review and number.
    currentRevisionId: text("current_revision_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    createdAt: text("created_at").default(now).notNull(),
    updatedAt: text("updated_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("proof_reviews_proof_direction_uidx").on(table.proofId, table.direction),
    uniqueIndex("proof_reviews_current_revision_uidx").on(table.currentRevisionId),
    check(
      "proof_reviews_direction_check",
      sql`${table.direction} in ('SELLER_TO_BUYER', 'BUYER_TO_SELLER')`,
    ),
    check(
      "proof_reviews_revision_check",
      sql`${table.revisionNumber} between 1 and ${safeInteger}`,
    ),
    check(
      "proof_reviews_distinct_parties_check",
      sql`${table.reviewerMarketsUserId} <> ${table.revieweeMarketsUserId}`,
    ),
  ],
);

export const proofReviewRevisions = sqliteTable(
  "proof_review_revisions",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => proofReviews.id),
    revisionNumber: integer("revision_number").notNull(),
    reviewerMarketsUserId: text("reviewer_markets_user_id")
      .notNull()
      .references(() => marketsUsers.id),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    completionProofUrl: text("completion_proof_url"),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    createdAt: text("created_at").default(now).notNull(),
  },
  (table) => [
    uniqueIndex("proof_review_revisions_review_number_uidx").on(
      table.reviewId,
      table.revisionNumber,
    ),
    uniqueIndex("proof_review_revisions_actor_key_uidx").on(
      table.reviewerMarketsUserId,
      table.idempotencyKey,
    ),
    index("proof_review_revisions_history_idx").on(table.reviewId, table.createdAt, table.id),
    check("proof_review_revisions_revision_check", sql`${table.revisionNumber} >= 1`),
    check("proof_review_revisions_rating_check", sql`${table.rating} between 1 and 5`),
    check(
      "proof_review_revisions_idempotency_key_check",
      sql`length(${table.idempotencyKey}) between 1 and 200`,
    ),
    check("proof_review_revisions_payload_hash_check", sql`length(${table.payloadHash}) = 64`),
  ],
);
