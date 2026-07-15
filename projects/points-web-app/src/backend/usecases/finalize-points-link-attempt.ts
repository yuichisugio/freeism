export interface FinalizePointsLinkAttemptInput {
  attemptPayloadHash: string;
  idempotencyKey: string;
  issuer?: string;
  linkAttemptId: string;
  marketsPointsConnectionId: string;
  m2mClientId: string;
  now?: Date;
  outcome: "CONFIRM" | "CANCEL";
  pointsSubject?: string;
  userClientId?: string;
}

interface AttemptRow {
  expiresAt: number;
  finalizedAt: number | null;
  finalizeIdempotencyKey: string | null;
  marketsPointsConnectionId: string | null;
  m2mClientId: string;
  payloadHash: string;
  status: "PENDING_MARKETS_CONFIRMATION" | "CONFIRMED" | "CANCELLED";
  userClientId: string;
}

interface ConnectionRow {
  grantVersion: number;
  grantedScopes: string;
  issuer: string;
  linkedAt: number;
  marketsPointsConnectionId: string;
  marketsUserId: string;
  m2mClientId: string;
  pointsConnectionId: string;
  pointsSubject: string;
  status: "ACTIVE" | "REAUTH_REQUIRED" | "UNLINKED";
  userClientId: string;
}

function connectionResult(row: ConnectionRow) {
  return {
    grantVersion: row.grantVersion,
    grantedScopes: JSON.parse(row.grantedScopes) as string[],
    issuer: row.issuer,
    linkedAt: new Date(row.linkedAt),
    marketsPointsConnectionId: row.marketsPointsConnectionId,
    marketsUserId: row.marketsUserId,
    m2mClientId: row.m2mClientId,
    pointsConnectionId: row.pointsConnectionId,
    pointsSubject: row.pointsSubject,
    status: row.status,
    userClientId: row.userClientId,
  };
}

async function findConnection(db: D1Database, linkAttemptId: string) {
  const row = await db
    .prepare(
      `SELECT id AS pointsConnectionId, markets_points_connection_id AS marketsPointsConnectionId,
              user_client_id AS userClientId, m2m_client_id AS m2mClientId,
              markets_user_id AS marketsUserId, issuer, points_subject AS pointsSubject,
              granted_scopes AS grantedScopes, status, grant_version AS grantVersion,
              linked_at AS linkedAt
       FROM points_oauth_connection WHERE link_attempt_id = ?`,
    )
    .bind(linkAttemptId)
    .first<ConnectionRow>();
  return row ? connectionResult(row) : null;
}

export async function finalizePointsLinkAttempt(
  db: D1Database,
  input: FinalizePointsLinkAttemptInput,
) {
  if (
    [
      input.attemptPayloadHash,
      input.idempotencyKey,
      input.linkAttemptId,
      input.marketsPointsConnectionId,
      input.m2mClientId,
    ].some((value) => value.length === 0)
  ) {
    throw new Error("LINK_ATTEMPT_FINALIZATION_INVALID");
  }
  const attempt = await db
    .prepare(
      `SELECT payload_hash AS payloadHash, user_client_id AS userClientId,
              m2m_client_id AS m2mClientId, status,
              expires_at AS expiresAt, finalized_at AS finalizedAt,
              markets_points_connection_id AS marketsPointsConnectionId,
              finalize_idempotency_key AS finalizeIdempotencyKey
       FROM points_oauth_link_attempt WHERE id = ?`,
    )
    .bind(input.linkAttemptId)
    .first<AttemptRow>();
  if (!attempt) throw new Error("LINK_ATTEMPT_NOT_FOUND");
  if (
    attempt.payloadHash !== input.attemptPayloadHash ||
    attempt.m2mClientId !== input.m2mClientId
  ) {
    throw new Error("LINK_ATTEMPT_MISMATCH");
  }
  if (attempt.status === "CONFIRMED") {
    if (attempt.finalizeIdempotencyKey !== input.idempotencyKey || input.outcome !== "CONFIRM") {
      throw new Error("LINK_ATTEMPT_ALREADY_FINALIZED");
    }
    const replay = await findConnection(db, input.linkAttemptId);
    if (!replay) throw new Error("LINK_ATTEMPT_FINALIZATION_INCOMPLETE");
    if (
      replay.marketsPointsConnectionId !== input.marketsPointsConnectionId ||
      replay.issuer !== input.issuer ||
      replay.pointsSubject !== input.pointsSubject ||
      replay.userClientId !== input.userClientId
    ) {
      throw new Error("LINK_ATTEMPT_MISMATCH");
    }
    return replay;
  }
  if (attempt.status === "CANCELLED") {
    if (
      attempt.finalizeIdempotencyKey !== input.idempotencyKey ||
      attempt.marketsPointsConnectionId !== input.marketsPointsConnectionId ||
      input.outcome !== "CANCEL" ||
      attempt.finalizedAt === null
    ) {
      throw new Error("LINK_ATTEMPT_ALREADY_FINALIZED");
    }
    return {
      finalizedAt: new Date(attempt.finalizedAt),
      marketsPointsConnectionId: attempt.marketsPointsConnectionId,
      status: "CANCELLED" as const,
    };
  }

  const now = input.now ?? new Date();
  if (now.getTime() >= attempt.expiresAt) {
    await db
      .prepare(
        `UPDATE points_oauth_link_attempt
         SET status = 'CANCELLED', finalized_at = ?, finalize_idempotency_key = ?,
             markets_points_connection_id = ?
         WHERE id = ? AND status = 'PENDING_MARKETS_CONFIRMATION'`,
      )
      .bind(
        now.getTime(),
        input.idempotencyKey,
        input.marketsPointsConnectionId,
        input.linkAttemptId,
      )
      .run();
    throw new Error("LINK_ATTEMPT_EXPIRED");
  }
  if (input.outcome === "CANCEL") {
    const updated = await db
      .prepare(
        `UPDATE points_oauth_link_attempt
         SET status = 'CANCELLED', finalized_at = ?, finalize_idempotency_key = ?,
             markets_points_connection_id = ?
         WHERE id = ? AND status = 'PENDING_MARKETS_CONFIRMATION'`,
      )
      .bind(
        now.getTime(),
        input.idempotencyKey,
        input.marketsPointsConnectionId,
        input.linkAttemptId,
      )
      .run();
    if (updated.meta.changes !== 1) throw new Error("LINK_ATTEMPT_ALREADY_FINALIZED");
    return {
      finalizedAt: now,
      marketsPointsConnectionId: input.marketsPointsConnectionId,
      status: "CANCELLED" as const,
    };
  }
  if (!input.issuer || !input.pointsSubject || !input.userClientId) {
    throw new Error("LINK_ATTEMPT_FINALIZATION_INVALID");
  }
  if (attempt.userClientId !== input.userClientId) throw new Error("LINK_ATTEMPT_MISMATCH");

  const pointsConnectionId = `pcn_${crypto.randomUUID()}`;
  await db.batch([
    db
      .prepare(
        `INSERT INTO points_oauth_connection
           (id, link_attempt_id, markets_points_connection_id, user_client_id, m2m_client_id,
            markets_user_id, points_user_id, issuer, points_subject, granted_scopes,
            status, grant_version, linked_at, updated_at)
         SELECT ?, id, ?, user_client_id, m2m_client_id, markets_user_id, points_user_id,
                ?, ?, requested_scopes, 'ACTIVE', 1, ?, ?
         FROM points_oauth_link_attempt
         WHERE id = ? AND status = 'PENDING_MARKETS_CONFIRMATION' AND expires_at > ?`,
      )
      .bind(
        pointsConnectionId,
        input.marketsPointsConnectionId,
        input.issuer,
        input.pointsSubject,
        now.getTime(),
        now.getTime(),
        input.linkAttemptId,
        now.getTime(),
      ),
    db
      .prepare(
        `UPDATE points_oauth_link_attempt
         SET status = 'CONFIRMED', issuer = ?, points_subject = ?,
             markets_points_connection_id = ?, finalize_idempotency_key = ?, finalized_at = ?
         WHERE id = ? AND status = 'PENDING_MARKETS_CONFIRMATION' AND expires_at > ?`,
      )
      .bind(
        input.issuer,
        input.pointsSubject,
        input.marketsPointsConnectionId,
        input.idempotencyKey,
        now.getTime(),
        input.linkAttemptId,
        now.getTime(),
      ),
  ]);
  const connection = await findConnection(db, input.linkAttemptId);
  if (!connection) throw new Error("LINK_ATTEMPT_FINALIZATION_INCOMPLETE");
  return connection;
}
