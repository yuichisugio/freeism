import { sha256Hex } from "../csv/csv-validation-result";

export async function bindPointsLinkAttemptFromOAuthState(
  db: D1Database,
  input: {
    authUserId: string;
    now?: Date;
    rawState: string;
    userClientId: string;
  },
) {
  if (!input.authUserId || !input.rawState || !input.userClientId) {
    throw new Error("OAUTH_LINK_BINDING_INVALID");
  }
  const pointsUser = await db
    .prepare(
      `SELECT id FROM points_user
       WHERE auth_user_id = ? AND account_status = 'ACTIVE'`,
    )
    .bind(input.authUserId)
    .first<{ id: string }>();
  if (!pointsUser) throw new Error("POINTS_USER_NOT_FOUND");

  const stateHash = `sha256:${await sha256Hex(input.rawState)}`;
  const now = input.now ?? new Date();
  try {
    const updated = await db
      .prepare(
        `UPDATE points_oauth_link_attempt
         SET points_user_id = ?
         WHERE user_client_id = ? AND state_hash = ?
           AND status = 'PENDING_MARKETS_CONFIRMATION' AND expires_at > ?
           AND (points_user_id IS NULL OR points_user_id = ?)`,
      )
      .bind(pointsUser.id, input.userClientId, stateHash, now.getTime(), pointsUser.id)
      .run();
    if (updated.meta.changes !== 1) throw new Error("OAUTH_LINK_ATTEMPT_NOT_BINDABLE");
  } catch (error) {
    if (error instanceof Error && error.message === "OAUTH_LINK_ATTEMPT_NOT_BINDABLE") throw error;
    throw new Error("POINTS_CONNECTION_ALREADY_PENDING");
  }

  const attempt = await db
    .prepare(
      `SELECT id FROM points_oauth_link_attempt
       WHERE user_client_id = ? AND state_hash = ? AND points_user_id = ?
         AND status = 'PENDING_MARKETS_CONFIRMATION'`,
    )
    .bind(input.userClientId, stateHash, pointsUser.id)
    .first<{ id: string }>();
  if (!attempt) throw new Error("OAUTH_LINK_ATTEMPT_NOT_BINDABLE");
  return attempt.id;
}
