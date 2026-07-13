import { pointsOAuthScopes } from "../auth/points-oauth-provider";

export interface CreatePointsLinkAttemptInput {
  expiresAt: Date;
  idempotencyKey: string;
  marketsUserId: string;
  m2mClientId: string;
  now?: Date;
  payloadHash: string;
  pointsUserId?: string;
  requestedScopes: string[];
  stateHash: string;
  userClientId: string;
}

interface LinkAttemptRow {
  createdAt: number;
  expiresAt: number;
  linkAttemptId: string;
  payloadHash: string;
  requestedScopes: string;
  status: "PENDING_MARKETS_CONFIRMATION" | "CONFIRMED" | "CANCELLED";
}

function result(row: LinkAttemptRow) {
  return {
    createdAt: new Date(row.createdAt),
    expiresAt: new Date(row.expiresAt),
    linkAttemptId: row.linkAttemptId,
    requestedScopes: JSON.parse(row.requestedScopes) as string[],
    status: row.status,
  };
}

export async function createPointsLinkAttempt(db: D1Database, input: CreatePointsLinkAttemptInput) {
  const now = input.now ?? new Date();
  const scopes = [...new Set(input.requestedScopes)].sort();
  if (
    [
      input.idempotencyKey,
      input.marketsUserId,
      input.m2mClientId,
      input.payloadHash,
      input.stateHash,
      input.userClientId,
    ].some((value) => value.length === 0) ||
    scopes.length !== input.requestedScopes.length ||
    scopes.some((scope) => !(pointsOAuthScopes.USER as readonly string[]).includes(scope)) ||
    input.expiresAt.getTime() <= now.getTime() ||
    input.expiresAt.getTime() > now.getTime() + 600_000
  ) {
    throw new Error("LINK_ATTEMPT_INVALID");
  }

  const replay = await db
    .prepare(
      `SELECT id AS linkAttemptId, payload_hash AS payloadHash,
              requested_scopes AS requestedScopes, status,
              created_at AS createdAt, expires_at AS expiresAt
       FROM points_oauth_link_attempt
       WHERE m2m_client_id = ? AND idempotency_key = ?`,
    )
    .bind(input.m2mClientId, input.idempotencyKey)
    .first<LinkAttemptRow>();
  if (replay) {
    if (replay.payloadHash !== input.payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
    return result(replay);
  }

  const linkAttemptId = `pla_${crypto.randomUUID()}`;
  try {
    await db
      .prepare(
        `INSERT INTO points_oauth_link_attempt
           (id, idempotency_key, payload_hash, state_hash, user_client_id, m2m_client_id,
            markets_user_id, points_user_id, requested_scopes, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_MARKETS_CONFIRMATION', ?, ?)`,
      )
      .bind(
        linkAttemptId,
        input.idempotencyKey,
        input.payloadHash,
        input.stateHash,
        input.userClientId,
        input.m2mClientId,
        input.marketsUserId,
        input.pointsUserId ?? null,
        JSON.stringify(scopes),
        now.getTime(),
        input.expiresAt.getTime(),
      )
      .run();
  } catch (error) {
    const concurrent = await db
      .prepare(
        `SELECT id AS linkAttemptId, payload_hash AS payloadHash,
                requested_scopes AS requestedScopes, status,
                created_at AS createdAt, expires_at AS expiresAt
         FROM points_oauth_link_attempt
         WHERE m2m_client_id = ? AND idempotency_key = ?`,
      )
      .bind(input.m2mClientId, input.idempotencyKey)
      .first<LinkAttemptRow>();
    if (!concurrent) throw error;
    if (concurrent.payloadHash !== input.payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
    return result(concurrent);
  }
  return result({
    createdAt: now.getTime(),
    expiresAt: input.expiresAt.getTime(),
    linkAttemptId,
    payloadHash: input.payloadHash,
    requestedScopes: JSON.stringify(scopes),
    status: "PENDING_MARKETS_CONFIRMATION",
  });
}
