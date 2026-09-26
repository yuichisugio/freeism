export class PermanentOAuthSubjectConflictError extends Error {
  constructor() {
    super("OAUTH_SUBJECT_ALREADY_ASSIGNED");
  }
}

export interface PermanentOAuthSubject {
  accountId: string;
  pointsUserId: string;
  providerId: string;
}

export async function findPermanentOAuthSubject(
  db: D1Database,
  providerId: string,
  accountId: string,
): Promise<PermanentOAuthSubject | null> {
  return db
    .prepare(
      `SELECT provider_id AS providerId, account_id AS accountId, points_user_id AS pointsUserId
       FROM permanent_oauth_subject WHERE provider_id = ? AND account_id = ?`,
    )
    .bind(providerId, accountId)
    .first<PermanentOAuthSubject>();
}

export async function ensurePermanentOAuthSubject(
  db: D1Database,
  input: PermanentOAuthSubject,
): Promise<PermanentOAuthSubject> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO permanent_oauth_subject
         (id, provider_id, account_id, points_user_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      `oauthsub_${crypto.randomUUID()}`,
      input.providerId,
      input.accountId,
      input.pointsUserId,
      Date.now(),
    )
    .run();
  const stored = await findPermanentOAuthSubject(db, input.providerId, input.accountId);
  if (!stored || stored.pointsUserId !== input.pointsUserId) {
    throw new PermanentOAuthSubjectConflictError();
  }
  return stored;
}

export async function reconcilePermanentOAuthSubjects(
  db: D1Database,
  authUserId: string,
  pointsUserId: string,
): Promise<void> {
  const accounts = await db
    .prepare(
      `SELECT provider_id AS providerId, account_id AS accountId
       FROM account WHERE user_id = ? ORDER BY provider_id, account_id`,
    )
    .bind(authUserId)
    .all<{ accountId: string; providerId: string }>();
  for (const account of accounts.results) {
    await ensurePermanentOAuthSubject(db, { ...account, pointsUserId });
  }
}
