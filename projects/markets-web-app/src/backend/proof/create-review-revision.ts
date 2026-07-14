export type ReviewDirection = "BUYER_TO_SELLER" | "SELLER_TO_BUYER";

export interface CreateReviewRevisionInput {
  actorMarketsUserId: string;
  comment: string;
  completionProofUrl: string | null;
  environment: string;
  idempotencyKey: string;
  proofId: string;
  rating: number;
  requestId: string;
}

export interface CreatedReviewRevision {
  comment: string;
  completionProofUrl: string | null;
  createdAt: string;
  direction: ReviewDirection;
  rating: number;
  replayed: boolean;
  revisionId: string;
  revisionNumber: number;
}

interface ProofPartiesRow {
  buyerMarketsUserId: string;
  sellerMarketsUserId: string;
}

interface ReviewRow {
  currentRevisionId: string;
  id: string;
  revisionNumber: number;
}

interface RevisionRow extends Omit<CreatedReviewRevision, "direction" | "replayed"> {
  direction: ReviewDirection;
  payloadHash: string;
}

const encoder = new TextEncoder();
const UNSAFE_PERCENT_ENCODING = /%(?![0-9a-fA-F]{2})/;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hasDisallowedControl(value: string, allowTabAndLf: boolean): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (allowTabAndLf && (codePoint === 9 || codePoint === 10)) return false;
    return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
  });
}

function normalizePercentEncoding(value: string): string {
  return value.replace(/%[0-9a-fA-F]{2}/g, (encoded) => {
    const octet = Number.parseInt(encoded.slice(1), 16);
    const unreserved =
      (octet >= 0x41 && octet <= 0x5a) ||
      (octet >= 0x61 && octet <= 0x7a) ||
      (octet >= 0x30 && octet <= 0x39) ||
      octet === 0x2d ||
      octet === 0x2e ||
      octet === 0x5f ||
      octet === 0x7e;
    return unreserved ? String.fromCharCode(octet) : `%${encoded.slice(1).toUpperCase()}`;
  });
}

export function normalizeReviewRevisionInput(input: {
  comment: string;
  completionProofUrl: string | null;
  rating: number;
}) {
  if (!Number.isSafeInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("PROOF_REVIEW_RATING_INVALID");
  }
  const comment = input.comment.replace(/\r\n?/g, "\n").normalize("NFC");
  if (
    [...comment].length > 2_000 ||
    encoder.encode(comment).byteLength > 8_000 ||
    hasDisallowedControl(comment, true)
  ) {
    throw new Error("PROOF_REVIEW_COMMENT_INVALID");
  }
  if (input.completionProofUrl === null || input.completionProofUrl === "") {
    return { comment, completionProofUrl: null, rating: input.rating };
  }
  if (
    hasDisallowedControl(input.completionProofUrl, false) ||
    UNSAFE_PERCENT_ENCODING.test(input.completionProofUrl)
  ) {
    throw new Error("PROOF_REVIEW_COMPLETION_URL_INVALID");
  }
  let url: URL;
  try {
    url = new URL(input.completionProofUrl);
  } catch {
    throw new Error("PROOF_REVIEW_COMPLETION_URL_INVALID");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname === "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) {
    throw new Error("PROOF_REVIEW_COMPLETION_URL_INVALID");
  }
  const completionProofUrl = normalizePercentEncoding(url.href);
  if (encoder.encode(completionProofUrl).byteLength > 2_048) {
    throw new Error("PROOF_REVIEW_COMPLETION_URL_INVALID");
  }
  return { comment, completionProofUrl, rating: input.rating };
}

export async function createReviewRevision(
  dependencies: { db: D1Database; now(): Date },
  input: CreateReviewRevisionInput,
): Promise<CreatedReviewRevision> {
  const normalized = normalizeReviewRevisionInput(input);
  const parties = await dependencies.db
    .prepare(
      `SELECT a.seller_markets_user_id AS sellerMarketsUserId,
              p.buyer_markets_user_id AS buyerMarketsUserId
       FROM proofs p JOIN auctions a ON a.id = p.auction_id
       WHERE p.id = ? LIMIT 1`,
    )
    .bind(input.proofId)
    .first<ProofPartiesRow>();
  if (!parties) throw new Error("PROOF_NOT_FOUND");

  let direction: ReviewDirection;
  let revieweeMarketsUserId: string;
  if (input.actorMarketsUserId === parties.sellerMarketsUserId) {
    direction = "SELLER_TO_BUYER";
    revieweeMarketsUserId = parties.buyerMarketsUserId;
  } else if (input.actorMarketsUserId === parties.buyerMarketsUserId) {
    direction = "BUYER_TO_SELLER";
    revieweeMarketsUserId = parties.sellerMarketsUserId;
  } else {
    throw new Error("PROOF_REVIEW_FORBIDDEN");
  }

  const payloadHash = await sha256(
    canonicalJson({
      comment: normalized.comment,
      completionProofUrl: normalized.completionProofUrl,
      proofId: input.proofId,
      rating: normalized.rating,
    }),
  );
  const replay = await dependencies.db
    .prepare(
      `SELECT r.id AS revisionId, r.revision_number AS revisionNumber,
              r.rating, r.comment, r.completion_proof_url AS completionProofUrl,
              r.created_at AS createdAt, r.payload_hash AS payloadHash,
              v.direction
       FROM proof_review_revisions r
       JOIN proof_reviews v ON v.id = r.review_id
       WHERE r.reviewer_markets_user_id = ? AND r.idempotency_key = ? LIMIT 1`,
    )
    .bind(input.actorMarketsUserId, input.idempotencyKey)
    .first<RevisionRow>();
  if (replay) {
    if (replay.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
    return { ...replay, replayed: true };
  }

  const current = await dependencies.db
    .prepare(
      `SELECT id, current_revision_id AS currentRevisionId,
              revision_number AS revisionNumber
       FROM proof_reviews WHERE proof_id = ? AND direction = ? LIMIT 1`,
    )
    .bind(input.proofId, direction)
    .first<ReviewRow>();
  const revisionNumber = (current?.revisionNumber ?? 0) + 1;
  const reviewId = current?.id ?? `proof-review_${crypto.randomUUID()}`;
  const revisionId = `proof-review-revision_${crypto.randomUUID()}`;
  const createdAt = dependencies.now().toISOString();
  const statements: D1PreparedStatement[] = [];
  if (!current) {
    statements.push(
      dependencies.db
        .prepare(
          `INSERT INTO proof_reviews
           (id, proof_id, direction, reviewer_markets_user_id,
            reviewee_markets_user_id, current_revision_id, revision_number,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .bind(
          reviewId,
          input.proofId,
          direction,
          input.actorMarketsUserId,
          revieweeMarketsUserId,
          revisionId,
          createdAt,
          createdAt,
        ),
    );
  }
  statements.push(
    dependencies.db
      .prepare(
        `INSERT INTO proof_review_revisions
         (id, review_id, revision_number, reviewer_markets_user_id,
          rating, comment, completion_proof_url, idempotency_key,
          payload_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        revisionId,
        reviewId,
        revisionNumber,
        input.actorMarketsUserId,
        normalized.rating,
        normalized.comment,
        normalized.completionProofUrl,
        input.idempotencyKey,
        payloadHash,
        createdAt,
      ),
  );
  if (current) {
    statements.push(
      dependencies.db
        .prepare(
          `UPDATE proof_reviews
           SET current_revision_id = ?, revision_number = ?, updated_at = ?
           WHERE id = ? AND current_revision_id = ? AND revision_number = ?`,
        )
        .bind(
          revisionId,
          revisionNumber,
          createdAt,
          reviewId,
          current.currentRevisionId,
          current.revisionNumber,
        ),
    );
  }
  statements.push(
    dependencies.db
      .prepare(
        `INSERT INTO audit_events
         (id, actor_markets_user_id, event_code, target_type, target_id,
          before_json, after_json, request_id, environment, result, created_at)
         VALUES (?, ?, 'PROOF_REVIEW_REVISION_CREATED', 'PROOF_REVIEW', ?, ?, ?, ?, ?, 'SUCCESS', ?)`,
      )
      .bind(
        `audit_${crypto.randomUUID()}`,
        input.actorMarketsUserId,
        input.proofId,
        current ? JSON.stringify({ currentRevisionId: current.currentRevisionId }) : null,
        JSON.stringify({ currentRevisionId: revisionId, direction, revisionNumber }),
        input.requestId,
        input.environment,
        createdAt,
      ),
  );
  await dependencies.db.batch(statements);
  return {
    comment: normalized.comment,
    completionProofUrl: normalized.completionProofUrl,
    createdAt,
    direction,
    rating: normalized.rating,
    replayed: false,
    revisionId,
    revisionNumber,
  };
}
