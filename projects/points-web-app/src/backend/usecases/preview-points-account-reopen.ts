import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";
import type { CreateAccountsRecipientResolver } from "../identity/accounts-recipient-resolver";
import {
  listClaimantAccountsLinks,
  loadEligibleUnclaimedFixes,
  type EligibleUnclaimedFix,
} from "../infrastructure/db/d1-unclaimed-fix-claim-repository";

export class PointsAccountReopenError extends Error {
  constructor(
    readonly code:
      | "ACCOUNT_NOT_CLOSED"
      | "IDEMPOTENCY_KEY_REUSED"
      | "REOPEN_SET_CHANGED"
      | "SAFE_INTEGER_OVERFLOW",
  ) {
    super(code);
  }
}

export interface ReopenFixAggregate {
  evaluationCriterionId: string;
  negativeCount: number;
  netAmountScaled: number;
  positiveCount: number;
  totalCount: number;
}

interface ReopenFixEntry extends EligibleUnclaimedFix {
  accountsOrigin: string;
  accountsUserId: string;
}

export interface PointsAccountReopenPreview {
  aggregates: ReopenFixAggregate[];
  reopenSetHash: string;
  totalCount: number;
}

export interface InternalPointsAccountReopenPreview extends PointsAccountReopenPreview {
  entries: ReopenFixEntry[];
}

/**
 * reopen で受領する未受領 FIX を集計する。
 * 受領資格は未受領 FIX の受領と同じ規則を、本人の現在の Accounts 連携に適用して決める。
 * close で連携を全解除するため、通常は空集合になる。
 * @see ../../../docs/v0.2/details-ja/unclaimed-fix-and-ownership.md
 */
export async function loadPointsAccountReopenPreview(
  db: D1Database,
  pointsUserId: string,
  createResolver: CreateAccountsRecipientResolver,
): Promise<InternalPointsAccountReopenPreview> {
  const account = await db
    .prepare("SELECT account_status AS accountStatus FROM points_user WHERE id = ?")
    .bind(pointsUserId)
    .first<{ accountStatus: string }>();
  if (!account || account.accountStatus !== "CLOSED") {
    throw new PointsAccountReopenError("ACCOUNT_NOT_CLOSED");
  }

  const entries: ReopenFixEntry[] = [];
  for (const link of await listClaimantAccountsLinks(db, pointsUserId)) {
    const eligible = await loadEligibleUnclaimedFixes(db, link, createResolver);
    entries.push(
      ...eligible.map((entry) => ({
        ...entry,
        accountsOrigin: link.accountsOrigin,
        accountsUserId: link.accountsUserId,
      })),
    );
  }

  const byCriterion = new Map<string, ReopenFixAggregate>();
  for (const entry of entries) {
    const aggregate = byCriterion.get(entry.evaluationCriterionId) ?? {
      evaluationCriterionId: entry.evaluationCriterionId,
      negativeCount: 0,
      netAmountScaled: 0,
      positiveCount: 0,
      totalCount: 0,
    };
    aggregate.netAmountScaled += entry.deltaAmountScaled;
    if (!Number.isSafeInteger(aggregate.netAmountScaled)) {
      throw new PointsAccountReopenError("SAFE_INTEGER_OVERFLOW");
    }
    aggregate.totalCount += 1;
    if (entry.deltaAmountScaled > 0) aggregate.positiveCount += 1;
    if (entry.deltaAmountScaled < 0) aggregate.negativeCount += 1;
    byCriterion.set(entry.evaluationCriterionId, aggregate);
  }

  return {
    aggregates: [...byCriterion.values()].sort((left, right) =>
      left.evaluationCriterionId.localeCompare(right.evaluationCriterionId),
    ),
    entries,
    reopenSetHash: await hashCanonicalPayload({ entries }),
    totalCount: entries.length,
  };
}

export async function previewPointsAccountReopen(
  db: D1Database,
  pointsUserId: string,
  createResolver: CreateAccountsRecipientResolver,
): Promise<PointsAccountReopenPreview> {
  const { entries: _entries, ...preview } = await loadPointsAccountReopenPreview(
    db,
    pointsUserId,
    createResolver,
  );
  return preview;
}
