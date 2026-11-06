import {
  listAccountsLinksToRefresh,
  listOwnAccountsLinks,
  type OwnAccountsLink,
} from "../infrastructure/db/d1-accounts-link-repository";
import {
  refreshAccountsLinkSnapshots,
  type AccountsSnapshotDependencies,
} from "./refresh-accounts-link-snapshots";

/**
 * 本人のAccounts連携の一覧（設定画面）。
 * 表示のたびに、本人の有効な接続先の連携アカウント一覧を取得する。
 * @see ../../../test/worker/accounts-link.worker.test.ts
 */

// --------------------------------------------------
// 一覧
// --------------------------------------------------

export type AccountsLinkView = {
  id: string;
  accountsConnection: OwnAccountsLink["accountsConnection"];
  accountsUserId: string;
  accountsProfileUrl: string;
  accountsManagementUrl: string;
  linkedAt: string;
  relinkedAt: string | null;
  provisionStatus: OwnAccountsLink["provisionStatus"];
  fetchedAt: string | null;
  externalAccounts: OwnAccountsLink["externalAccounts"];
};

function toAccountsLinkView(link: OwnAccountsLink): AccountsLinkView {
  const { accountsOrigin } = link.accountsConnection;
  return {
    id: link.id,
    accountsConnection: link.accountsConnection,
    accountsUserId: link.accountsUserId,
    accountsProfileUrl: `${accountsOrigin}/profiles/${encodeURIComponent(link.accountsUserId)}`,
    accountsManagementUrl: `${accountsOrigin}/account-links`,
    linkedAt: new Date(link.linkedAt).toISOString(),
    relinkedAt: link.relinkedAt === null ? null : new Date(link.relinkedAt).toISOString(),
    provisionStatus: link.provisionStatus,
    fetchedAt: link.fetchedAt === null ? null : new Date(link.fetchedAt).toISOString(),
    externalAccounts: link.externalAccounts,
  };
}

/**
 * 本人の有効な接続先の連携アカウント一覧を取得してから、保存した連携情報を返す。
 */
export async function listAccountsLinks(
  dependencies: AccountsSnapshotDependencies,
  pointsUserId: string,
): Promise<AccountsLinkView[]> {
  const refreshTargets = await listAccountsLinksToRefresh(dependencies.db, pointsUserId);
  await refreshAccountsLinkSnapshots(dependencies, refreshTargets);
  const links = await listOwnAccountsLinks(dependencies.db, pointsUserId);
  return links.map(toAccountsLinkView);
}
