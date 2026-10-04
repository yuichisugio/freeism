import { findActiveAccountsConnection } from "../infrastructure/db/d1-accounts-connection-repository";
import {
  recordAccountsLinkRejection,
  saveAccountsLink,
} from "../infrastructure/db/d1-accounts-link-repository";
import { AccountsProblemError } from "./accounts-problem-error";
import {
  refreshAccountsLinkSnapshots,
  type AccountsSnapshotDependencies,
} from "./refresh-accounts-link-snapshots";

/**
 * 検証済みのAccounts主体をPoints本人へ連携し、公開表示用snapshotを取得する。
 * 呼び出し側は認可試行と現在のPoints sessionを照合済みであること。
 * @see ../../../test/worker/accounts-link.worker.test.ts
 */
export async function completeVerifiedAccountsLink(
  dependencies: AccountsSnapshotDependencies,
  {
    pointsUserId,
    accountsConnectionId,
    accountsUserId,
    requestId,
  }: {
    pointsUserId: string;
    accountsConnectionId: string;
    accountsUserId: string;
    requestId: string;
  },
): Promise<{ accountsLinkId: string; status: "CREATED" | "RENEWED" }> {
  const { db } = dependencies;
  const now = (dependencies.now ?? Date.now)();
  const connection = await findActiveAccountsConnection(db, accountsConnectionId);
  if (connection === null) throw new AccountsProblemError(409, "ACCOUNTS_CONNECTION_NOT_ACTIVE");

  const saved = await saveAccountsLink(db, {
    pointsUserId,
    accountsConnectionId,
    accountsOrigin: connection.accountsOrigin,
    accountsUserId,
    now,
    requestId,
    environment: dependencies.environment,
  });
  if (saved.status === "LINKED_TO_OTHER_POINTS_USER") {
    const code = "ACCOUNTS_USER_LINKED_TO_OTHER_POINTS_USER";
    recordAccountsLinkRejection({ code, requestId, environment: dependencies.environment });
    throw new AccountsProblemError(409, code);
  }

  await refreshAccountsLinkSnapshots(dependencies, [
    { id: saved.accountsLinkId, accountsConnectionId, accountsUserId },
  ]);
  return saved;
}
