import { canonicalJson, sha256Hex } from "../csv/csv-validation-result";

interface DeactivationRow {
  deactivatedAt: number;
  grantVersion: number;
  id: string;
  payloadHash: string;
  pointsConnectionId: string;
  reason: string;
}

function result(row: DeactivationRow) {
  return {
    connectionDeactivationReceiptId: row.id,
    deactivatedAt: new Date(row.deactivatedAt),
    grantVersion: row.grantVersion,
    pointsConnectionId: row.pointsConnectionId,
    reason: row.reason,
    status: "UNLINKED" as const,
  };
}

async function findReplay(
  db: D1Database,
  input: {
    idempotencyKey: string;
    issuer: string;
    pointsSubject: string;
    userClientId: string;
  },
) {
  return db
    .prepare(
      `SELECT deactivation.id,
              deactivation.points_connection_id AS pointsConnectionId,
              deactivation.payload_hash AS payloadHash, deactivation.reason,
              deactivation.grant_version AS grantVersion,
              deactivation.deactivated_at AS deactivatedAt
       FROM points_oauth_connection_deactivation deactivation
       JOIN points_oauth_connection connection
         ON connection.id = deactivation.points_connection_id
       WHERE deactivation.user_client_id = ? AND deactivation.idempotency_key = ?
         AND connection.issuer = ? AND connection.points_subject = ?`,
    )
    .bind(input.userClientId, input.idempotencyKey, input.issuer, input.pointsSubject)
    .first<DeactivationRow>();
}

export async function deactivatePointsConnection(
  db: D1Database,
  input: {
    idempotencyKey: string;
    issuer: string;
    now?: Date;
    pointsConnectionId: string;
    pointsSubject: string;
    reason: string;
    requestId: string;
    userClientId: string;
  },
) {
  if (
    !input.idempotencyKey ||
    !input.issuer ||
    !input.pointsConnectionId ||
    !input.pointsSubject ||
    !input.reason ||
    input.reason.length > 1_000 ||
    !input.requestId ||
    !input.userClientId
  ) {
    throw new Error("VALIDATION_FAILED");
  }
  const payloadHash = `sha256:${await sha256Hex(
    canonicalJson({
      pointsConnectionId: input.pointsConnectionId,
      reason: input.reason,
      userClientId: input.userClientId,
    }),
  )}`;
  const replay = await findReplay(db, input);
  if (replay) {
    if (replay.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
    return result(replay);
  }

  const connection = await db
    .prepare(
      `SELECT id, points_user_id AS pointsUserId, m2m_client_id AS m2mClientId,
              status, grant_version AS grantVersion
       FROM points_oauth_connection
       WHERE id = ? AND issuer = ? AND user_client_id = ? AND points_subject = ?`,
    )
    .bind(input.pointsConnectionId, input.issuer, input.userClientId, input.pointsSubject)
    .first<{
      grantVersion: number;
      id: string;
      m2mClientId: string;
      pointsUserId: string;
      status: string;
    }>();
  if (!connection) throw new Error("RESOURCE_NOT_FOUND");
  if (connection.status !== "ACTIVE") throw new Error("LINK_ATTEMPT_ALREADY_FINALIZED");

  const now = input.now ?? new Date();
  const activeReservation = await db
    .prepare(
      `SELECT 1
       FROM point_reservation reservation
       JOIN point_reservation_state state ON state.point_reservation_id = reservation.id
       WHERE reservation.points_user_id = ? AND reservation.markets_client_id = ?
         AND state.status = 'ACTIVE' AND reservation.expires_at > ? LIMIT 1`,
    )
    .bind(connection.pointsUserId, connection.m2mClientId, now.getTime())
    .first();
  if (activeReservation) throw new Error("ACTIVE_RESERVATION_EXISTS");

  const grantVersion = connection.grantVersion + 1;
  const receiptId = `pcd_${crypto.randomUUID()}`;
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE points_oauth_connection
         SET status = 'UNLINKED', grant_version = ?, updated_at = ?
         WHERE id = ? AND status = 'ACTIVE' AND grant_version = ?
           AND NOT EXISTS (
             SELECT 1 FROM point_reservation reservation
             JOIN point_reservation_state state
               ON state.point_reservation_id = reservation.id
             WHERE reservation.points_user_id = ?
               AND reservation.markets_client_id = ? AND state.status = 'ACTIVE'
               AND reservation.expires_at > ?
           )`,
        )
        .bind(
          grantVersion,
          now.getTime(),
          connection.id,
          connection.grantVersion,
          connection.pointsUserId,
          connection.m2mClientId,
          now.getTime(),
        ),
      db
        .prepare(
          `INSERT INTO points_oauth_connection_deactivation
           (id, points_connection_id, user_client_id, idempotency_key, payload_hash,
            reason, grant_version, deactivated_at)
         SELECT ?, id, user_client_id, ?, ?, ?, grant_version, ?
         FROM points_oauth_connection
         WHERE id = ? AND status = 'UNLINKED' AND grant_version = ?`,
        )
        .bind(
          receiptId,
          input.idempotencyKey,
          payloadHash,
          input.reason,
          now.getTime(),
          connection.id,
          grantVersion,
        ),
      db
        .prepare(
          `INSERT INTO points_oauth_revocation_outbox
           (id, points_connection_id, action, status, attempts, created_at)
         SELECT ?, id, 'DELETE_CONSENT', 'PENDING', 0, ?
         FROM points_oauth_connection
         WHERE id = ? AND status = 'UNLINKED' AND grant_version = ?`,
        )
        .bind(`pro_${crypto.randomUUID()}`, now.getTime(), connection.id, grantVersion),
      db
        .prepare(
          `INSERT INTO audit_event
             (id, actor_points_user_id, action, target, reason, request_id, result, created_at)
           SELECT ?, connection.points_user_id, 'POINTS_CONNECTION_DEACTIVATE',
                  connection.id, deactivation.reason, ?, 'SUCCESS', ?
           FROM points_oauth_connection_deactivation deactivation
           JOIN points_oauth_connection connection
             ON connection.id = deactivation.points_connection_id
           WHERE deactivation.id = ?`,
        )
        .bind(`audit_${crypto.randomUUID()}`, input.requestId, now.getTime(), receiptId),
    ]);
  } catch (error) {
    const concurrentReplay = await findReplay(db, input);
    if (!concurrentReplay) throw error;
    if (concurrentReplay.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
    return result(concurrentReplay);
  }
  const stored = await db
    .prepare(
      `SELECT id, points_connection_id AS pointsConnectionId, payload_hash AS payloadHash,
              reason, grant_version AS grantVersion, deactivated_at AS deactivatedAt
       FROM points_oauth_connection_deactivation WHERE id = ?`,
    )
    .bind(receiptId)
    .first<DeactivationRow>();
  if (!stored) throw new Error("ACTIVE_RESERVATION_EXISTS");
  return result(stored);
}
