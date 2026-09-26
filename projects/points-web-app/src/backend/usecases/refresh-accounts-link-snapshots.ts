import { createAccountsResourceContext } from "../accounts/accounts-connection-context";
import type { AccountsFailureReporter } from "../accounts/accounts-failure-reporter";
import { AccountsClientError } from "../accounts/accounts-http";
import {
  listAccountsLinksToRefresh,
  saveAccountsLinkSnapshot,
  type AccountsLinkRefreshTarget,
} from "../infrastructure/db/d1-accounts-link-repository";

/**
 * 連携アカウント一覧（`QUERY /api/v1/external-accounts`）を取得し、公開表示用のsnapshotとして保存する。
 * 取得の失敗は記録するだけで、前回のsnapshotを維持する。
 * @see ../../../docs/v0.2/details-ja/profile-setting.md
 * @see ../../../test/worker/accounts-snapshot-refresh.worker.test.ts
 */

// --------------------------------------------------
// 取得と保存
// --------------------------------------------------

/**
 * Accountsへ要求するための依存。
 */
export type AccountsSnapshotDependencies = {
  db: D1Database;
  kek: CryptoKey;
  fetch: typeof globalThis.fetch;
  reportFailure: AccountsFailureReporter;
  now?: () => number;
};

/**
 * 指定した連携のsnapshotを取得し直す。
 * 接続先ごとに資源APIクライアントを1つ作り、トークンを共有する。
 * 応答の不正（`INVALID_RESPONSE`）はその連携だけの失敗として次の連携へ進む。
 * それ以外の失敗は接続先全体の失敗なので、その接続先の残りの連携は取得しない。
 */
export async function refreshAccountsLinkSnapshots(
  { db, kek, fetch, reportFailure, now = Date.now }: AccountsSnapshotDependencies,
  links: readonly AccountsLinkRefreshTarget[],
): Promise<void> {
  const linksByConnection = Map.groupBy(links, (link) => link.accountsConnectionId);
  for (const [connectionId, connectionLinks] of linksByConnection) {
    const context = await createAccountsResourceContext({ db, kek, connectionId, fetch });
    if (context === null) continue;
    for (const link of connectionLinks) {
      try {
        const result = await context.resourceClient.listExternalAccounts(link.accountsUserId);
        await saveAccountsLinkSnapshot(db, { accountsLinkId: link.id, result, fetchedAt: now() });
      } catch (error) {
        if (!(error instanceof AccountsClientError)) throw error;
        await reportFailure({ operation: "accounts_list", code: error.code, connectionId });
        if (error.code !== "INVALID_RESPONSE") break;
      }
    }
  }
}

// --------------------------------------------------
// 定期更新
// --------------------------------------------------

/**
 * 定期更新の間隔（最後の取得からの経過時間）。
 */
const staleAfterMs = 24 * 60 * 60 * 1000;

/**
 * 1回の定期更新で取得する上限。
 */
const refreshLimit = 50;

/**
 * 最後の取得から24時間以上たった連携を、古い順に最大50件取得し直す（cron）。
 * Accounts側の同意の取り消しを公開表示へ反映するため。
 */
export async function refreshStaleAccountsLinkSnapshots(
  dependencies: AccountsSnapshotDependencies,
): Promise<void> {
  const now = dependencies.now ?? Date.now;
  const links = await listAccountsLinksToRefresh(dependencies.db, {
    fetchedBefore: now() - staleAfterMs,
    limit: refreshLimit,
  });
  await refreshAccountsLinkSnapshots(dependencies, links);
}
