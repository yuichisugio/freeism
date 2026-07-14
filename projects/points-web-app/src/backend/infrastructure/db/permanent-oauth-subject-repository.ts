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

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureGitHubOwnership(
  db: D1Database,
  accountId: string,
  pointsUserId: string,
): Promise<void> {
  const key = `github:${accountId}`;
  const digest = await sha256(key);
  const ownershipId = `ownership_github_${digest}`;
  const epochId = `epoch_github_${digest}`;
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO identity_ownership
           (id, identity_type, normalized_identity_key, points_user_id, status,
            current_ownership_epoch_id, verified_at, permanent_correspondence)
         VALUES (?, 'GITHUB_OAUTH', ?, ?, 'ACTIVE', ?, ?, 1)`,
      )
      .bind(ownershipId, key, pointsUserId, epochId, now),
    db
      .prepare(
        `INSERT OR IGNORE INTO ownership_epoch
           (id, identity_ownership_id, owner_points_user_id, effective_at,
            verification_method, evidence_hash, success_count, request_id, created_at)
         VALUES (?, ?, ?, ?, 'GITHUB_OAUTH', ?, 1, ?, ?)`,
      )
      .bind(epochId, ownershipId, pointsUserId, now, digest, `req_${crypto.randomUUID()}`, now),
  ]);
  const ownership = await db
    .prepare(
      `SELECT points_user_id AS pointsUserId
       FROM identity_ownership
       WHERE identity_type = 'GITHUB_OAUTH' AND normalized_identity_key = ?`,
    )
    .bind(key)
    .first<{ pointsUserId: string }>();
  if (!ownership || ownership.pointsUserId !== pointsUserId) {
    throw new PermanentOAuthSubjectConflictError();
  }
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
  if (stored.providerId === "github") {
    await ensureGitHubOwnership(db, stored.accountId, stored.pointsUserId);
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
