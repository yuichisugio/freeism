export async function lapseWebOwnership(
  db: D1Database,
  identityOwnershipId: string,
  ownershipEpochId: string,
  now: number,
): Promise<boolean> {
  const results = await db.batch([
    db
      .prepare(
        `UPDATE ownership_epoch SET ended_at = ?
         WHERE id = ? AND identity_ownership_id = ? AND ended_at IS NULL
           AND EXISTS (
             SELECT 1 FROM identity_ownership ownership
             WHERE ownership.id = ? AND ownership.identity_type = 'WEB_URL'
               AND ownership.current_ownership_epoch_id = ?
               AND ownership.status = 'REVERIFYING'
           )`,
      )
      .bind(now, ownershipEpochId, identityOwnershipId, identityOwnershipId, ownershipEpochId),
    db
      .prepare(
        `UPDATE identity_ownership
         SET status = 'LAPSED', next_verification_at = NULL
         WHERE id = ? AND identity_type = 'WEB_URL'
           AND current_ownership_epoch_id = ? AND status = 'REVERIFYING'`,
      )
      .bind(identityOwnershipId, ownershipEpochId),
  ]);
  return results.every((result) => (result.meta.changes ?? 0) === 1);
}
