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
 * 表示の前に、最後の取得から60秒以上たった連携のsnapshotを取得し直す。
 * @see ../../../test/worker/accounts-link.worker.test.ts
 */

// --------------------------------------------------
// 一覧
// --------------------------------------------------

/**
 * 本人の閲覧で取得し直すまでの間隔。
 */
const refreshOnViewAfterMs = 60_000;

/**
 * 本人の閲覧で取得し直す上限（1人の連携数として十分な値）。
 */
const refreshOnViewLimit = 20;

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
 * 本人の連携を、必要ならsnapshotを取得し直してから返す。
 */
export async function listAccountsLinks(
  dependencies: AccountsSnapshotDependencies,
  pointsUserId: string,
): Promise<AccountsLinkView[]> {
  const now = dependencies.now ?? Date.now;
  const staleLinks = await listAccountsLinksToRefresh(dependencies.db, {
    fetchedBefore: now() - refreshOnViewAfterMs,
    limit: refreshOnViewLimit,
    pointsUserId,
  });
  await refreshAccountsLinkSnapshots(dependencies, staleLinks);
  const links = await listOwnAccountsLinks(dependencies.db, pointsUserId);
  return links.map(toAccountsLinkView);
}
