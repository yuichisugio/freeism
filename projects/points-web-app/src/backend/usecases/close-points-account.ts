import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";

const OPERATION = "ACCOUNT_CLOSE";

export class ClosePointsAccountError extends Error {
  constructor(
    readonly code:
      | "ACCOUNT_ALREADY_CLOSED"
      | "ACCOUNT_CLOSE_ACTIVE_RESERVATION"
      | "ACCOUNT_CLOSE_LAST_ADMIN"
      | "ACCOUNT_CLOSE_STATE_CHANGED"
      | "IDEMPOTENCY_KEY_REUSED",
  ) {
    super(code);
  }
}

async function findReplay(
  db: D1Database,
  pointsUserId: string,
  idempotencyKey: string,
  payloadHash: string,
): Promise<{ responseBody: unknown; status: number } | null> {
  const row = await db
    .prepare(
      `SELECT payload_hash AS payloadHash, status, response_body AS responseBody
       FROM idempotency_results
       WHERE actor_points_user_id = ? AND operation = ? AND idempotency_key = ?`,
    )
    .bind(pointsUserId, OPERATION, idempotencyKey)
    .first<{ payloadHash: string; responseBody: string | unknown; status: number }>();
  if (!row) return null;
  if (row.payloadHash !== payloadHash) throw new ClosePointsAccountError("IDEMPOTENCY_KEY_REUSED");
  return {
    responseBody:
      typeof row.responseBody === "string" ? JSON.parse(row.responseBody) : row.responseBody,
    status: row.status,
  };
}

async function assertCloseAllowed(db: D1Database, pointsUserId: string) {
  const account = await db
    .prepare("SELECT account_status AS accountStatus FROM points_user WHERE id = ?")
    .bind(pointsUserId)
    .first<{ accountStatus: string }>();
  if (!account || account.accountStatus !== "ACTIVE") {
    throw new ClosePointsAccountError("ACCOUNT_ALREADY_CLOSED");
  }
  const activeReservation = await db
    .prepare(
      `SELECT 1
       FROM point_reservation reservation
       JOIN point_reservation_state state ON state.point_reservation_id = reservation.id
       WHERE reservation.points_user_id = ? AND state.status = 'ACTIVE' LIMIT 1`,
    )
    .bind(pointsUserId)
    .first();
  if (activeReservation) {
    throw new ClosePointsAccountError("ACCOUNT_CLOSE_ACTIVE_RESERVATION");
  }
  const lastAdmin = await db
    .prepare(
      `SELECT 1
       FROM admin_membership own
       WHERE own.points_user_id = ?
         AND (SELECT count(*) FROM admin_membership) = 1`,
    )
    .bind(pointsUserId)
    .first();
  if (lastAdmin) throw new ClosePointsAccountError("ACCOUNT_CLOSE_LAST_ADMIN");
}

export async function closePointsAccount(
  db: D1Database,
  input: {
    authUserId: string;
    currentSessionId?: string;
    idempotencyKey: string;
    now?: Date;
    pointsUserId: string;
    requestId: string;
  },
): Promise<{ responseBody: unknown; status: number }> {
  const payloadHash = await hashCanonicalPayload({ action: "close" });
  const replay = await findReplay(db, input.pointsUserId, input.idempotencyKey, payloadHash);
  if (replay) return replay;

  const now = (input.now ?? new Date()).getTime();
  await assertCloseAllowed(db, input.pointsUserId);
  const closeReceiptId = `aclose_${crypto.randomUUID()}`;
  const responseBody = {
    data: {
      closeReceiptId,
      closedAt: new Date(now).toISOString(),
      pointsUserId: input.pointsUserId,
      status: "CLOSED",
    },
    meta: { requestId: input.requestId },
  };
  const guardSql = `EXISTS (
    SELECT 1 FROM idempotency_results
    WHERE actor_points_user_id = ? AND operation = '${OPERATION}'
      AND idempotency_key = ? AND payload_hash = ?
  )`;

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO idempotency_results
             (id, actor_points_user_id, operation, idempotency_key, payload_hash,
              status, response_body, created_at)
           SELECT ?, user.id, '${OPERATION}', ?, ?, 200, ?, ?
           FROM points_user user
           WHERE user.id = ? AND user.account_status = 'ACTIVE'
             AND NOT EXISTS (
               SELECT 1 FROM point_reservation reservation
               JOIN point_reservation_state state
                 ON state.point_reservation_id = reservation.id
               WHERE reservation.points_user_id = user.id AND state.status = 'ACTIVE'
             )
             AND NOT EXISTS (
               SELECT 1 FROM admin_membership own
               WHERE own.points_user_id = user.id
                 AND (SELECT count(*) FROM admin_membership) = 1
             )`,
        )
        .bind(
          `idem_${crypto.randomUUID()}`,
          input.idempotencyKey,
          payloadHash,
          JSON.stringify(responseBody),
          now,
          input.pointsUserId,
        ),
      db
        .prepare(
          `INSERT INTO account_close_ownership_suspension
             (id, close_receipt_id, points_user_id, identity_ownership_id, suspended_at)
           SELECT 'acos_' || lower(hex(randomblob(16))), ?, ?, ownership.id, ?
           FROM identity_ownership ownership
           WHERE ownership.points_user_id = ? AND ownership.permanent_correspondence = 1
             AND ownership.status = 'ACTIVE' AND ${guardSql}`,
        )
        .bind(
          closeReceiptId,
          input.pointsUserId,
          now,
          input.pointsUserId,
          input.pointsUserId,
          input.idempotencyKey,
          payloadHash,
        ),
      db
        .prepare(
          `UPDATE identity_ownership SET status = 'INACTIVE'
           WHERE points_user_id = ? AND permanent_correspondence = 1 AND status = 'ACTIVE'
             AND ${guardSql}`,
        )
        .bind(input.pointsUserId, input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(
          `UPDATE ownership_epoch SET ended_at = ?
           WHERE ended_at IS NULL AND id IN (
             SELECT current_ownership_epoch_id FROM identity_ownership
             WHERE points_user_id = ? AND identity_type = 'WEB_URL' AND status = 'ACTIVE'
           ) AND ${guardSql}`,
        )
        .bind(now, input.pointsUserId, input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(
          `UPDATE identity_ownership SET status = 'INACTIVE'
           WHERE points_user_id = ? AND identity_type = 'WEB_URL' AND status = 'ACTIVE'
             AND ${guardSql}`,
        )
        .bind(input.pointsUserId, input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(
          `UPDATE profiles
           SET display_name = 'Closed account', description = '', external_urls = '[]',
               visibility = 'PRIVATE', updated_at = ?
           WHERE points_user_id = ? AND ${guardSql}`,
        )
        .bind(now, input.pointsUserId, input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(
          `UPDATE oauth_access_token SET revoked = ?
           WHERE user_id = ? AND revoked IS NULL AND ${guardSql}`,
        )
        .bind(now, input.authUserId, input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(
          `UPDATE oauth_refresh_token SET revoked = ?
           WHERE user_id = ? AND revoked IS NULL AND ${guardSql}`,
        )
        .bind(now, input.authUserId, input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(`DELETE FROM oauth_consent WHERE user_id = ? AND ${guardSql}`)
        .bind(input.authUserId, input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(
          `UPDATE points_oauth_connection
           SET status = 'UNLINKED', grant_version = grant_version + 1, updated_at = ?
           WHERE points_user_id = ? AND status IN ('ACTIVE', 'REAUTH_REQUIRED')
             AND ${guardSql}`,
        )
        .bind(now, input.pointsUserId, input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(
          `INSERT INTO points_oauth_revocation_outbox
             (id, points_connection_id, action, status, attempts, created_at)
           SELECT 'pro_' || lower(hex(randomblob(16))), id, 'DELETE_CONSENT', 'PENDING', 0, ?
           FROM points_oauth_connection
           WHERE points_user_id = ? AND status = 'UNLINKED' AND updated_at = ?
             AND ${guardSql}
           ON CONFLICT(points_connection_id, action) DO UPDATE SET
             status = 'PENDING', attempts = 0, created_at = excluded.created_at,
             delivered_at = NULL`,
        )
        .bind(now, input.pointsUserId, now, input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(
          `DELETE FROM session
           WHERE user_id = ? AND ? IS NOT NULL AND id <> ? AND ${guardSql}`,
        )
        .bind(
          input.authUserId,
          input.currentSessionId ?? null,
          input.currentSessionId ?? null,
          input.pointsUserId,
          input.idempotencyKey,
          payloadHash,
        ),
      db
        .prepare(
          `UPDATE points_user SET account_status = 'CLOSED'
           WHERE id = ? AND account_status = 'ACTIVE' AND ${guardSql}`,
        )
        .bind(input.pointsUserId, input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(`DELETE FROM admin_membership WHERE points_user_id = ? AND ${guardSql}`)
        .bind(input.pointsUserId, input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(
          `INSERT INTO audit_event
             (id, actor_points_user_id, action, target, request_id, result, created_at)
           SELECT ?, ?, 'ACCOUNT_CLOSE', ?, ?, 'SUCCESS', ?
           WHERE ${guardSql}`,
        )
        .bind(
          `audit_${crypto.randomUUID()}`,
          input.pointsUserId,
          closeReceiptId,
          input.requestId,
          now,
          input.pointsUserId,
          input.idempotencyKey,
          payloadHash,
        ),
    ]);
  } catch (error) {
    const concurrentReplay = await findReplay(
      db,
      input.pointsUserId,
      input.idempotencyKey,
      payloadHash,
    );
    if (concurrentReplay) return concurrentReplay;
    throw error;
  }

  const stored = await findReplay(db, input.pointsUserId, input.idempotencyKey, payloadHash);
  if (stored) return stored;
  await assertCloseAllowed(db, input.pointsUserId);
  throw new ClosePointsAccountError("ACCOUNT_CLOSE_STATE_CHANGED");
}
