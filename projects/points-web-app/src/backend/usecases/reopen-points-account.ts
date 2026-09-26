import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";
import type { CreateAccountsRecipientResolver } from "../identity/accounts-recipient-resolver";
import {
  loadPointsAccountReopenPreview,
  PointsAccountReopenError,
} from "./preview-points-account-reopen";

const OPERATION = "ACCOUNT_REOPEN";

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
  if (row.payloadHash !== payloadHash) {
    throw new PointsAccountReopenError("IDEMPOTENCY_KEY_REUSED");
  }
  return {
    responseBody:
      typeof row.responseBody === "string" ? JSON.parse(row.responseBody) : row.responseBody,
    status: row.status,
  };
}

export async function reopenPointsAccount(
  db: D1Database,
  input: {
    authUserId: string;
    createResolver: CreateAccountsRecipientResolver;
    currentSessionId?: string;
    idempotencyKey: string;
    now?: Date;
    pointsUserId: string;
    reopenSetHash: string;
    requestId: string;
  },
): Promise<{ responseBody: unknown; status: number }> {
  const payloadHash = await hashCanonicalPayload({ reopenSetHash: input.reopenSetHash });
  const replay = await findReplay(db, input.pointsUserId, input.idempotencyKey, payloadHash);
  if (replay) return replay;

  const preview = await loadPointsAccountReopenPreview(
    db,
    input.pointsUserId,
    input.createResolver,
  );
  if (preview.reopenSetHash !== input.reopenSetHash) {
    throw new PointsAccountReopenError("REOPEN_SET_CHANGED");
  }
  const now = (input.now ?? new Date()).getTime();
  const accountRows = await Promise.all(
    preview.aggregates.map(async (aggregate) => {
      const current = await db
        .prepare(
          `SELECT balance, evaluation_total AS evaluationTotal
           FROM point_account WHERE points_user_id = ? AND evaluation_criterion_id = ?`,
        )
        .bind(input.pointsUserId, aggregate.evaluationCriterionId)
        .first<{ balance: number; evaluationTotal: number }>();
      const balance = (current?.balance ?? 0) + aggregate.netAmountScaled;
      const evaluationTotal = (current?.evaluationTotal ?? 0) + aggregate.netAmountScaled;
      if (!Number.isSafeInteger(balance) || !Number.isSafeInteger(evaluationTotal)) {
        throw new PointsAccountReopenError("SAFE_INTEGER_OVERFLOW");
      }
      return {
        balance,
        evaluationCriterionId: aggregate.evaluationCriterionId,
        evaluationTotal,
      };
    }),
  );
  const responseBody = {
    data: {
      claimedCount: preview.totalCount,
      pointsUserId: input.pointsUserId,
      status: "ACTIVE",
    },
    meta: { requestId: input.requestId },
  };
  const guardSql = `EXISTS (
    SELECT 1 FROM idempotency_results
    WHERE actor_points_user_id = ? AND operation = '${OPERATION}'
      AND idempotency_key = ? AND payload_hash = ?
  )`;
  const ledgerRows = preview.entries.map((entry) => ({
    ...entry,
    createdAt: now,
    id: `ledger_${crypto.randomUUID()}`,
    sourceUnclaimedFixEntryId: entry.id,
  }));
  const groupedEntries = new Map<string, typeof preview.entries>();
  for (const entry of preview.entries) {
    const linkKey = `${entry.accountsOrigin}\u0000${entry.accountsUserId}`;
    const grouped = groupedEntries.get(linkKey) ?? [];
    grouped.push(entry);
    groupedEntries.set(linkKey, grouped);
  }
  const claimGroups = await Promise.all(
    [...groupedEntries.values()].map(async (entries, index) => ({
      accountsOrigin: entries[0]!.accountsOrigin,
      accountsUserId: entries[0]!.accountsUserId,
      claimId: `fixclaim_${crypto.randomUUID()}`,
      claimSetHash: await hashCanonicalPayload({ entries }),
      commandId: `fixclaimcmd_${crypto.randomUUID()}`,
      entries,
      idempotencyKey: `${input.idempotencyKey}:${index}`,
    })),
  );
  const claimItems = claimGroups.flatMap((group) =>
    group.entries.map((entry) => ({
      createdAt: now,
      fixClaimId: group.claimId,
      id: `fixclaimitem_${crypto.randomUUID()}`,
      ledgerEntryId: ledgerRows.find((row) => row.sourceUnclaimedFixEntryId === entry.id)!.id,
      unclaimedFixEntryId: entry.id,
    })),
  );

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO idempotency_results
             (id, actor_points_user_id, operation, idempotency_key, payload_hash,
              status, response_body, created_at)
           SELECT ?, user.id, '${OPERATION}', ?, ?, 200, ?, ?
           FROM points_user user
           WHERE user.id = ? AND user.account_status = 'CLOSED'`,
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
          `INSERT INTO fix_claim_command
             (id, accounts_origin, accounts_user_id, actor_points_user_id,
              expected_entry_ids, claim_set_hash, created_at)
           SELECT json_extract(value, '$.commandId'),
                  json_extract(value, '$.accountsOrigin'),
                  json_extract(value, '$.accountsUserId'), ?,
                  json_extract(value, '$.expectedEntryIds'),
                  json_extract(value, '$.claimSetHash'), ?
           FROM json_each(?) WHERE ${guardSql}`,
        )
        .bind(
          input.pointsUserId,
          now,
          JSON.stringify(
            claimGroups.map((group) => ({
              ...group,
              entries: undefined,
              expectedEntryIds: group.entries.map(({ id }) => id),
            })),
          ),
          input.pointsUserId,
          input.idempotencyKey,
          payloadHash,
        ),
      db
        .prepare(
          `INSERT INTO fix_claim
             (id, command_id, accounts_origin, accounts_user_id, points_user_id, claim_set_hash,
              item_count, request_id, idempotency_key, claimed_at)
           SELECT json_extract(value, '$.claimId'), json_extract(value, '$.commandId'),
                  json_extract(value, '$.accountsOrigin'), json_extract(value, '$.accountsUserId'), ?,
                  json_extract(value, '$.claimSetHash'),
                  json_array_length(json_extract(value, '$.expectedEntryIds')), ?,
                  json_extract(value, '$.idempotencyKey'), ?
           FROM json_each(?) WHERE ${guardSql}`,
        )
        .bind(
          input.pointsUserId,
          input.requestId,
          now,
          JSON.stringify(
            claimGroups.map((group) => ({
              ...group,
              entries: undefined,
              expectedEntryIds: group.entries.map(({ id }) => id),
            })),
          ),
          input.pointsUserId,
          input.idempotencyKey,
          payloadHash,
        ),
      db
        .prepare(
          `INSERT INTO point_ledger_entry
             (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
              delta_amount_scaled, affects_evaluation_total, source_type, source_fix_revision_id,
              source_unclaimed_fix_entry_id, created_at)
           SELECT json_extract(value, '$.id'), ?,
                  json_extract(value, '$.evaluationCriterionId'),
                  json_extract(value, '$.evaluationCriterionRevisionId'),
                  json_extract(value, '$.deltaAmountScaled'), 1, 'FIX',
                  json_extract(value, '$.sourceFixRevisionId'),
                  json_extract(value, '$.sourceUnclaimedFixEntryId'),
                  json_extract(value, '$.createdAt')
           FROM json_each(?) WHERE ${guardSql}`,
        )
        .bind(
          input.pointsUserId,
          JSON.stringify(ledgerRows),
          input.pointsUserId,
          input.idempotencyKey,
          payloadHash,
        ),
      db
        .prepare(
          `INSERT INTO fix_claim_item
             (id, fix_claim_id, unclaimed_fix_entry_id, ledger_entry_id, created_at)
           SELECT json_extract(value, '$.id'), json_extract(value, '$.fixClaimId'),
                  json_extract(value, '$.unclaimedFixEntryId'),
                  json_extract(value, '$.ledgerEntryId'), json_extract(value, '$.createdAt')
           FROM json_each(?) WHERE ${guardSql}`,
        )
        .bind(JSON.stringify(claimItems), input.pointsUserId, input.idempotencyKey, payloadHash),
      db
        .prepare(
          `INSERT INTO point_account
             (points_user_id, evaluation_criterion_id, balance, evaluation_total, updated_at)
           SELECT ?, json_extract(value, '$.evaluationCriterionId'),
                  json_extract(value, '$.balance'), json_extract(value, '$.evaluationTotal'), ?
           FROM json_each(?) WHERE ${guardSql}
           ON CONFLICT(points_user_id, evaluation_criterion_id) DO UPDATE SET
             balance = excluded.balance,
             evaluation_total = excluded.evaluation_total,
             updated_at = excluded.updated_at`,
        )
        .bind(
          input.pointsUserId,
          now,
          JSON.stringify(accountRows),
          input.pointsUserId,
          input.idempotencyKey,
          payloadHash,
        ),
      db
        .prepare(
          `UPDATE points_user SET account_status = 'ACTIVE'
           WHERE id = ? AND account_status = 'CLOSED' AND ${guardSql}`,
        )
        .bind(input.pointsUserId, input.pointsUserId, input.idempotencyKey, payloadHash),
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
          `INSERT INTO audit_event
             (id, actor_points_user_id, action, target, request_id, result, created_at)
           SELECT ?, ?, 'ACCOUNT_REOPEN', ?, ?, 'SUCCESS', ? WHERE ${guardSql}`,
        )
        .bind(
          `audit_${crypto.randomUUID()}`,
          input.pointsUserId,
          input.pointsUserId,
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
  const latest = await loadPointsAccountReopenPreview(db, input.pointsUserId, input.createResolver);
  if (latest.reopenSetHash !== input.reopenSetHash) {
    throw new PointsAccountReopenError("REOPEN_SET_CHANGED");
  }
  throw new PointsAccountReopenError("ACCOUNT_NOT_CLOSED");
}
