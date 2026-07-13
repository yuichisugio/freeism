import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";

export class ProfileMutationIdempotencyConflictError extends Error {
  constructor() {
    super("IDEMPOTENCY_KEY_REUSED");
  }
}

export async function profileMutationPayloadHash(payload: unknown): Promise<string> {
  return hashCanonicalPayload(payload);
}

export async function findProfileMutationReplay<T>(
  db: D1Database,
  input: {
    pointsUserId: string;
    operation: string;
    idempotencyKey: string;
    payloadHash: string;
  },
): Promise<{ status: number; body: T } | null> {
  const row = await db
    .prepare(
      `SELECT payload_hash AS payloadHash, status, response_body AS responseBody
       FROM idempotency_results
       WHERE actor_points_user_id = ? AND operation = ? AND idempotency_key = ?`,
    )
    .bind(input.pointsUserId, input.operation, input.idempotencyKey)
    .first<{ payloadHash: string; status: number; responseBody: string | T }>();
  if (!row) {
    return null;
  }
  if (row.payloadHash !== input.payloadHash) {
    throw new ProfileMutationIdempotencyConflictError();
  }
  return {
    status: row.status,
    body: (typeof row.responseBody === "string"
      ? JSON.parse(row.responseBody)
      : row.responseBody) as T,
  };
}
