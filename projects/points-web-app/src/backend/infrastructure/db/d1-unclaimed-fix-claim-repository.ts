import { hashCanonicalPayload } from "../../domain/idempotency/idempotency-result";
import {
  recipientIdentifierKey,
  type CreateAccountsRecipientResolver,
  type RecipientIdentifier,
} from "../../identity/accounts-recipient-resolver";

export class UnclaimedFixClaimError extends Error {
  constructor(
    readonly code:
      | "ACCOUNTS_LINK_NOT_FOUND"
      | "CLAIM_SET_CHANGED"
      | "IDEMPOTENCY_KEY_REUSED"
      | "NO_UNCLAIMED_FIXES",
  ) {
    super(code);
  }
}

/** 受領者の Accounts 連携。 */
export interface ClaimantAccountsLink {
  accountsConnectionId: string;
  accountsLinkId: string;
  accountsOrigin: string;
  accountsUserId: string;
}

export interface EligibleUnclaimedFix {
  deltaAmountScaled: number;
  evaluationAt: string;
  evaluationCriterionId: string;
  evaluationCriterionRevisionId: string;
  id: string;
  sourceFixRevisionId: string;
}

export interface ClaimPreviewAggregate {
  evaluationCriterionId: string;
  netAmountScaled: number;
  negativeCount: number;
  positiveCount: number;
  totalCount: number;
}

export interface UnclaimedFixClaimPreview {
  accountsLinkId: string;
  aggregates: ClaimPreviewAggregate[];
  claimSetHash: string;
  totalCount: number;
}

/** Accounts へ1回で照合を求める識別子の上限。 */
const RESOLVE_CHUNK_SIZE = 1_000;

// --------------------------------------------------
// 受領資格の判定
// --------------------------------------------------

/** 本人の Accounts 連携を1件読む。 */
export async function findClaimantAccountsLink(
  db: D1Database,
  accountsLinkId: string,
  pointsUserId: string,
): Promise<ClaimantAccountsLink> {
  const link = await db
    .prepare(
      `SELECT id AS accountsLinkId, accounts_connection_id AS accountsConnectionId,
              accounts_origin AS accountsOrigin, accounts_user_id AS accountsUserId
       FROM accounts_links WHERE id = ? AND points_user_id = ?`,
    )
    .bind(accountsLinkId, pointsUserId)
    .first<ClaimantAccountsLink>();
  if (!link) throw new UnclaimedFixClaimError("ACCOUNTS_LINK_NOT_FOUND");
  return link;
}

/** 本人の現在の Accounts 連携をすべて読む。 */
export async function listClaimantAccountsLinks(
  db: D1Database,
  pointsUserId: string,
): Promise<ClaimantAccountsLink[]> {
  const links = await db
    .prepare(
      `SELECT id AS accountsLinkId, accounts_connection_id AS accountsConnectionId,
              accounts_origin AS accountsOrigin, accounts_user_id AS accountsUserId
       FROM accounts_links WHERE points_user_id = ? ORDER BY id`,
    )
    .bind(pointsUserId)
    .all<ClaimantAccountsLink>();
  return links.results;
}

/**
 * 連携1件について、受領資格のある未受領エントリーを返す。
 * 同じ origin の未受領エントリーの識別子を Accounts で現在の状態として照合し、連携先の Accounts ユーザーに一致したものを返す。
 * @see ../../../../docs/v0.2/details-ja/unclaimed-fix-and-ownership.md
 */
export async function loadEligibleUnclaimedFixes(
  db: D1Database,
  link: ClaimantAccountsLink,
  createResolver: CreateAccountsRecipientResolver,
): Promise<EligibleUnclaimedFix[]> {
  const candidates = await db
    .prepare(
      `SELECT entry.id, entry.source_fix_revision_id AS sourceFixRevisionId,
              entry.evaluation_criterion_id AS evaluationCriterionId,
              entry.evaluation_criterion_revision_id AS evaluationCriterionRevisionId,
              entry.delta_amount_scaled AS deltaAmountScaled, entry.evaluation_at AS evaluationAt,
              entry.recipient_identifier_type AS type, entry.recipient_identifier_value AS value
       FROM unclaimed_fix_entry entry
       WHERE entry.accounts_origin = ?
         AND NOT EXISTS (
           SELECT 1 FROM fix_claim_item item WHERE item.unclaimed_fix_entry_id = entry.id
         )
       ORDER BY entry.id`,
    )
    .bind(link.accountsOrigin)
    .all<EligibleUnclaimedFix & RecipientIdentifier>();
  if (candidates.results.length === 0) return [];

  const identifiers = [
    ...new Map(
      candidates.results.map((candidate) => [
        recipientIdentifierKey(candidate),
        { type: candidate.type, value: candidate.value },
      ]),
    ).values(),
  ];
  const resolve = createResolver(link.accountsConnectionId);
  const matchedKeys = new Set<string>();
  for (let start = 0; start < identifiers.length; start += RESOLVE_CHUNK_SIZE) {
    const chunk = identifiers.slice(start, start + RESOLVE_CHUNK_SIZE);
    const { results } = await resolve(chunk);
    results.forEach((result, index) => {
      if (result.status === "matched" && result.accountsUserId === link.accountsUserId)
        matchedKeys.add(recipientIdentifierKey(chunk[index]!));
    });
  }
  return candidates.results
    .filter((candidate) => matchedKeys.has(recipientIdentifierKey(candidate)))
    .map(({ type: _type, value: _value, ...entry }) => entry);
}

// --------------------------------------------------
// 受領の preview と確定
// --------------------------------------------------

async function findClaimReplay(
  db: D1Database,
  pointsUserId: string,
  idempotencyKey: string,
  payloadHash: string,
): Promise<{ responseBody: unknown; status: number } | null> {
  const replay = await db
    .prepare(
      `SELECT payload_hash AS payloadHash, status, response_body AS responseBody
       FROM idempotency_results
       WHERE actor_points_user_id = ? AND operation = 'UNCLAIMED_FIX_CLAIM'
         AND idempotency_key = ?`,
    )
    .bind(pointsUserId, idempotencyKey)
    .first<{ payloadHash: string; responseBody: string | unknown; status: number }>();
  if (!replay) return null;
  if (replay.payloadHash !== payloadHash)
    throw new UnclaimedFixClaimError("IDEMPOTENCY_KEY_REUSED");
  return {
    responseBody:
      typeof replay.responseBody === "string"
        ? JSON.parse(replay.responseBody)
        : replay.responseBody,
    status: replay.status,
  };
}

interface InternalPreview extends UnclaimedFixClaimPreview {
  entries: EligibleUnclaimedFix[];
}

async function buildPreview(
  link: ClaimantAccountsLink,
  entries: EligibleUnclaimedFix[],
): Promise<InternalPreview> {
  const byCriterion = new Map<string, ClaimPreviewAggregate>();
  for (const entry of entries) {
    const aggregate = byCriterion.get(entry.evaluationCriterionId) ?? {
      evaluationCriterionId: entry.evaluationCriterionId,
      negativeCount: 0,
      netAmountScaled: 0,
      positiveCount: 0,
      totalCount: 0,
    };
    aggregate.netAmountScaled += entry.deltaAmountScaled;
    if (!Number.isSafeInteger(aggregate.netAmountScaled)) throw new Error("SAFE_INTEGER_OVERFLOW");
    aggregate.totalCount += 1;
    if (entry.deltaAmountScaled > 0) aggregate.positiveCount += 1;
    if (entry.deltaAmountScaled < 0) aggregate.negativeCount += 1;
    byCriterion.set(entry.evaluationCriterionId, aggregate);
  }
  const claimSetHash = await hashCanonicalPayload({
    accountsOrigin: link.accountsOrigin,
    accountsUserId: link.accountsUserId,
    entries,
  });
  return {
    accountsLinkId: link.accountsLinkId,
    aggregates: [...byCriterion.values()].sort((left, right) =>
      left.evaluationCriterionId.localeCompare(right.evaluationCriterionId),
    ),
    claimSetHash,
    entries,
    totalCount: entries.length,
  };
}

async function loadPreview(
  db: D1Database,
  input: {
    accountsLinkId: string;
    createResolver: CreateAccountsRecipientResolver;
    pointsUserId: string;
  },
): Promise<{ link: ClaimantAccountsLink; preview: InternalPreview }> {
  const link = await findClaimantAccountsLink(db, input.accountsLinkId, input.pointsUserId);
  const entries = await loadEligibleUnclaimedFixes(db, link, input.createResolver);
  return { link, preview: await buildPreview(link, entries) };
}

/** 連携1件について、受領できる未受領 FIX の集計を返す。 */
export async function previewUnclaimedFixes(
  db: D1Database,
  input: {
    accountsLinkId: string;
    createResolver: CreateAccountsRecipientResolver;
    pointsUserId: string;
  },
): Promise<UnclaimedFixClaimPreview> {
  const { entries: _entries, ...preview } = (await loadPreview(db, input)).preview;
  return preview;
}

/** preview と同じ集合であることを確かめて、未受領 FIX をまとめて受領する。 */
export async function claimUnclaimedFixes(
  db: D1Database,
  input: {
    accountsLinkId: string;
    claimSetHash: string;
    createResolver: CreateAccountsRecipientResolver;
    idempotencyKey: string;
    now: Date;
    pointsUserId: string;
    requestId: string;
  },
): Promise<{ responseBody: unknown; status: number }> {
  const payloadHash = await hashCanonicalPayload({
    accountsLinkId: input.accountsLinkId,
    claimSetHash: input.claimSetHash,
  });
  const replay = await findClaimReplay(db, input.pointsUserId, input.idempotencyKey, payloadHash);
  if (replay) return replay;

  const { link, preview } = await loadPreview(db, input);
  if (preview.claimSetHash !== input.claimSetHash)
    throw new UnclaimedFixClaimError("CLAIM_SET_CHANGED");
  if (preview.entries.length === 0) throw new UnclaimedFixClaimError("NO_UNCLAIMED_FIXES");

  const claimId = `fixclaim_${crypto.randomUUID()}`;
  const commandId = `fixclaimcmd_${crypto.randomUUID()}`;
  const claimedAt = input.now.getTime();
  const expectedEntryIds = JSON.stringify(preview.entries.map((entry) => entry.id));
  const responseBody = {
    data: {
      claimId,
      claimedCount: preview.entries.length,
      claimSetHash: preview.claimSetHash,
    },
    meta: { requestId: input.requestId },
  };
  const ledgerRows = preview.entries.map((entry) => ({
    ...entry,
    createdAt: claimedAt,
    id: `ledger_${crypto.randomUUID()}`,
  }));
  const claimItems = ledgerRows.map((entry, index) => ({
    createdAt: claimedAt,
    fixClaimId: claimId,
    id: `fixclaimitem_${crypto.randomUUID()}`,
    ledgerEntryId: entry.id,
    unclaimedFixEntryId: preview.entries[index]!.id,
  }));

  const guard = db
    .prepare(
      `INSERT INTO fix_claim_command
         (id, accounts_origin, accounts_user_id, actor_points_user_id,
          expected_entry_ids, claim_set_hash, created_at)
       SELECT ?, link.accounts_origin, link.accounts_user_id, link.points_user_id, ?, ?, ?
       FROM accounts_links link
       WHERE link.id = ? AND link.points_user_id = ?
         AND link.accounts_origin = ? AND link.accounts_user_id = ?`,
    )
    .bind(
      commandId,
      expectedEntryIds,
      preview.claimSetHash,
      claimedAt,
      link.accountsLinkId,
      input.pointsUserId,
      link.accountsOrigin,
      link.accountsUserId,
    );
  const claim = db
    .prepare(
      `INSERT INTO fix_claim
         (id, command_id, accounts_origin, accounts_user_id, points_user_id, claim_set_hash,
          item_count, request_id, idempotency_key, claimed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      claimId,
      commandId,
      link.accountsOrigin,
      link.accountsUserId,
      input.pointsUserId,
      preview.claimSetHash,
      preview.entries.length,
      input.requestId,
      input.idempotencyKey,
      claimedAt,
    );
  const ledger = db
    .prepare(
      `INSERT INTO point_ledger_entry
         (id, points_user_id, evaluation_criterion_id, evaluation_criterion_revision_id,
          delta_amount_scaled, affects_evaluation_total, source_type, source_fix_revision_id,
          source_unclaimed_fix_entry_id, created_at)
       SELECT json_extract(value, '$.id'), ?, json_extract(value, '$.evaluationCriterionId'),
              json_extract(value, '$.evaluationCriterionRevisionId'),
              json_extract(value, '$.deltaAmountScaled'), 1, 'FIX',
              json_extract(value, '$.sourceFixRevisionId'),
              json_extract(value, '$.sourceUnclaimedFixEntryId'), json_extract(value, '$.createdAt')
       FROM json_each(?)`,
    )
    .bind(
      input.pointsUserId,
      JSON.stringify(
        ledgerRows.map((row, index) => ({
          ...row,
          sourceUnclaimedFixEntryId: preview.entries[index]!.id,
        })),
      ),
    );
  const items = db
    .prepare(
      `INSERT INTO fix_claim_item
         (id, fix_claim_id, unclaimed_fix_entry_id, ledger_entry_id, created_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.fixClaimId'),
              json_extract(value, '$.unclaimedFixEntryId'), json_extract(value, '$.ledgerEntryId'),
              json_extract(value, '$.createdAt') FROM json_each(?)`,
    )
    .bind(JSON.stringify(claimItems));
  const idempotency = db
    .prepare(
      `INSERT INTO idempotency_results
         (id, actor_points_user_id, operation, idempotency_key, payload_hash,
          status, response_body, created_at)
       VALUES (?, ?, 'UNCLAIMED_FIX_CLAIM', ?, ?, 201, ?, ?)`,
    )
    .bind(
      `idem_${crypto.randomUUID()}`,
      input.pointsUserId,
      input.idempotencyKey,
      payloadHash,
      JSON.stringify(responseBody),
      claimedAt,
    );
  const audit = db
    .prepare(
      `INSERT INTO audit_event
         (id, actor_points_user_id, action, target, request_id, result, created_at)
       VALUES (?, ?, 'UNCLAIMED_FIX_CLAIM', ?, ?, 'SUCCESS', ?)`,
    )
    .bind(
      `audit_${crypto.randomUUID()}`,
      input.pointsUserId,
      link.accountsLinkId,
      input.requestId,
      claimedAt,
    );
  try {
    await db.batch([guard, claim, ledger, items, idempotency, audit]);
  } catch (error) {
    const isForeignKeyConflict =
      error instanceof Error && error.message.includes("FOREIGN KEY constraint failed");
    const isIdempotencyConflict =
      error instanceof Error &&
      error.message.includes(
        "UNIQUE constraint failed: fix_claim.points_user_id, fix_claim.idempotency_key",
      );
    if (isForeignKeyConflict || isIdempotencyConflict) {
      const concurrentReplay = await findClaimReplay(
        db,
        input.pointsUserId,
        input.idempotencyKey,
        payloadHash,
      );
      if (concurrentReplay) return concurrentReplay;
      if (isForeignKeyConflict) throw new UnclaimedFixClaimError("CLAIM_SET_CHANGED");
    }
    throw error;
  }
  return { responseBody, status: 201 };
}
