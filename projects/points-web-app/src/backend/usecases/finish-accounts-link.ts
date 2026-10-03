import {
  consumeAccountsLinkAttempt,
  hashAccountsLinkSecret,
} from "../infrastructure/db/d1-accounts-link-repository";
import { AccountsProblemError } from "./accounts-problem-error";
import { completeVerifiedAccountsLink } from "./complete-accounts-link";
import type { AccountsSnapshotDependencies } from "./refresh-accounts-link-snapshots";

/**
 * 標準OAuth callback後のticketを本人sessionで1回だけ消費して連携を完了する。
 * Accountsのcore accountは認証callbackで削除済みのため、ticketの検証済み主体を保存する。
 */
export async function finishAccountsLink(
  dependencies: AccountsSnapshotDependencies,
  {
    ticket,
    pointsUserId,
    authSessionId,
    requestId,
  }: {
    ticket: string;
    pointsUserId: string;
    authSessionId: string;
    requestId: string;
  },
): Promise<void> {
  const { db } = dependencies;
  const now = (dependencies.now ?? Date.now)();
  const attempt = await consumeAccountsLinkAttempt(db, {
    stateHash: await hashAccountsLinkSecret(ticket),
    pointsUserId,
    authSessionIdHash: await hashAccountsLinkSecret(authSessionId),
    now,
  });
  if (attempt?.verifiedAccountsUserId == null) {
    throw new AccountsProblemError(400, "ACCOUNTS_LINK_ATTEMPT_INVALID");
  }

  await completeVerifiedAccountsLink(dependencies, {
    pointsUserId,
    accountsConnectionId: attempt.accountsConnectionId,
    accountsUserId: attempt.verifiedAccountsUserId,
    requestId,
  });
}
