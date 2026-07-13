export async function lapseWebOwnership(
  db: D1Database,
  identityOwnershipId: string,
  ownershipEpochId: string,
  now: number,
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `UPDATE ownership_epoch SET ended_at = ?
         WHERE id = ? AND identity_ownership_id = ? AND ended_at IS NULL`,
      )
      .bind(now, ownershipEpochId, identityOwnershipId),
    db
      .prepare(
        `UPDATE identity_ownership
         SET status = 'LAPSED', next_verification_at = NULL
         WHERE id = ? AND identity_type = 'WEB_URL'`,
      )
      .bind(identityOwnershipId),
  ]);
}
