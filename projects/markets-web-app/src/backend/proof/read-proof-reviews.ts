import type { ReviewDirection } from "./create-review-revision";

const encoder = new TextEncoder();

export interface PublicCurrentReview {
  comment: string;
  completionProofUrl: string | null;
  currentRevisionId: string;
  direction: ReviewDirection;
  rating: number;
  updatedAt: string;
}

export interface PublicReviewRevision {
  comment: string;
  completionProofUrl: string | null;
  createdAt: string;
  direction: ReviewDirection;
  rating: number;
  revisionId: string;
  revisionNumber: number;
}

interface CurrentRow {
  comment: string;
  completionProofUrl: string | null;
  currentRevisionId: string;
  direction: ReviewDirection;
  rating: number;
  updatedAt: string;
}

interface RevisionRow {
  comment: string;
  completionProofUrl: string | null;
  createdAt: string;
  direction: ReviewDirection;
  rating: number;
  revisionId: string;
  revisionNumber: number;
}

async function ensureProof(db: D1Database, proofId: string) {
  const exists = await db
    .prepare("SELECT 1 AS found FROM proofs WHERE id = ? LIMIT 1")
    .bind(proofId)
    .first<number>("found");
  if (exists !== 1) throw new Error("PROOF_NOT_FOUND");
}

async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encodeCursor(row: Pick<RevisionRow, "createdAt" | "revisionId">): string {
  return btoa(JSON.stringify([row.createdAt, row.revisionId]))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeCursor(value: string): [string, string] {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 2 ||
      typeof decoded[0] !== "string" ||
      typeof decoded[1] !== "string"
    ) {
      throw new Error();
    }
    return [decoded[0], decoded[1]];
  } catch {
    throw new Error("PROOF_REVIEW_CURSOR_INVALID");
  }
}

export async function readProofReviews(db: D1Database, proofId: string) {
  await ensureProof(db, proofId);
  const rows = await db
    .prepare(
      `SELECT v.direction, v.current_revision_id AS currentRevisionId,
              v.updated_at AS updatedAt, r.rating, r.comment,
              r.completion_proof_url AS completionProofUrl
       FROM proof_reviews v
       JOIN proof_review_revisions r ON r.id = v.current_revision_id
       WHERE v.proof_id = ? ORDER BY v.direction`,
    )
    .bind(proofId)
    .all<CurrentRow>();
  const data = { reviews: rows.results satisfies PublicCurrentReview[] };
  return { contentHash: await sha256(data), data };
}

export async function readProofReviewRevisions(
  db: D1Database,
  input: { cursor?: string; limit: number; proofId: string },
) {
  await ensureProof(db, input.proofId);
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 50) {
    throw new Error("PROOF_REVIEW_LIMIT_INVALID");
  }
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;
  const statement = cursor
    ? db
        .prepare(
          `SELECT r.id AS revisionId, r.revision_number AS revisionNumber,
                  v.direction, r.rating, r.comment,
                  r.completion_proof_url AS completionProofUrl,
                  r.created_at AS createdAt
           FROM proof_review_revisions r
           JOIN proof_reviews v ON v.id = r.review_id
           WHERE v.proof_id = ?
             AND (r.created_at < ? OR (r.created_at = ? AND r.id < ?))
           ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
        )
        .bind(input.proofId, cursor[0], cursor[0], cursor[1], input.limit + 1)
    : db
        .prepare(
          `SELECT r.id AS revisionId, r.revision_number AS revisionNumber,
                  v.direction, r.rating, r.comment,
                  r.completion_proof_url AS completionProofUrl,
                  r.created_at AS createdAt
           FROM proof_review_revisions r
           JOIN proof_reviews v ON v.id = r.review_id
           WHERE v.proof_id = ?
           ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
        )
        .bind(input.proofId, input.limit + 1);
  const rows = await statement.all<RevisionRow>();
  const hasMore = rows.results.length > input.limit;
  const items = rows.results.slice(0, input.limit) satisfies PublicReviewRevision[];
  const data = {
    items,
    nextCursor: hasMore ? encodeCursor(items.at(-1)!) : null,
  };
  return { contentHash: await sha256(data), data };
}
