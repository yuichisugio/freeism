import type { AccountsProvidedExternalAccount } from "../../accounts/accounts-api-schema";
import type { AccountsExternalAccountListResult } from "../../accounts/accounts-resource-client";
import type { AccountsConnectionStatus } from "./d1-accounts-connection-repository";

/**
 * 利用者のAccounts連携（`accounts_links`表）と、連携の試行（`accounts_link_attempts`表）の読み書き。
 * 監査の`target`には連携IDまたは接続先IDだけを入れ、AccountsユーザーIDは入れない。
 * @see ../../../../docs/v0.2/details-ja/profile-setting.md
 * @see ../../../../test/worker/accounts-link.worker.test.ts
 */

// --------------------------------------------------
// 試行
// --------------------------------------------------

/**
 * 連携の試行の有効期間（Accountsの同意画面の署名付きqueryと同じ10分）。
 */
export const accountsLinkAttemptLifetimeMs = 600_000;

/**
 * state・session IDを保存用のhash（SHA-256のhex）にする。
 */
export async function hashAccountsLinkSecret(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * 戻り先の処理で照合する試行。
 */
export type AccountsLinkAttempt = {
  accountsConnectionId: string;
  nonce: string;
  codeVerifier: string;
};

/**
 * 試行を保存する。
 */
export async function insertAccountsLinkAttempt(
  db: D1Database,
  attempt: AccountsLinkAttempt & {
    stateHash: string;
    pointsUserId: string;
    authSessionIdHash: string;
    createdAt: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO accounts_link_attempts
         (state_hash, points_user_id, auth_session_id_hash, accounts_connection_id,
          nonce, code_verifier, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      attempt.stateHash,
      attempt.pointsUserId,
      attempt.authSessionIdHash,
      attempt.accountsConnectionId,
      attempt.nonce,
      attempt.codeVerifier,
      attempt.createdAt,
      attempt.createdAt + accountsLinkAttemptLifetimeMs,
    )
    .run();
}

/**
 * 同じ利用者・同じsessionの期限内の試行を、1回だけ取り出す。
 * @returns 該当しない（期限切れ・別session・使用済み）場合は`null`
 */
export async function consumeAccountsLinkAttempt(
  db: D1Database,
  {
    stateHash,
    pointsUserId,
    authSessionIdHash,
    now,
  }: { stateHash: string; pointsUserId: string; authSessionIdHash: string; now: number },
): Promise<AccountsLinkAttempt | null> {
  return db
    .prepare(
      `DELETE FROM accounts_link_attempts
       WHERE state_hash = ? AND points_user_id = ? AND auth_session_id_hash = ? AND expires_at > ?
       RETURNING accounts_connection_id AS accountsConnectionId, nonce,
                 code_verifier AS codeVerifier`,
    )
    .bind(stateHash, pointsUserId, authSessionIdHash, now)
    .first<AccountsLinkAttempt>();
}

/**
 * 期限切れの試行を消す（cron）。
 * @returns 消した件数
 */
export async function deleteExpiredAccountsLinkAttempts(
  db: D1Database,
  now: number,
): Promise<number> {
  const result = await db
    .prepare("DELETE FROM accounts_link_attempts WHERE expires_at <= ?")
    .bind(now)
    .run();
  return result.meta.changes;
}

// --------------------------------------------------
// 連携の保存・解除
// --------------------------------------------------

/**
 * 連携の保存結果。
 * - `CREATED`: 新しい連携
 * - `RENEWED`: 同じPointsユーザーの再連携（既存の行を維持する）
 * - `LINKED_TO_OTHER_POINTS_USER`: そのAccountsユーザーは別のPointsユーザーに連携済み（保存しない）
 */
export type SaveAccountsLinkResult =
  | { status: "CREATED" | "RENEWED"; accountsLinkId: string }
  | { status: "LINKED_TO_OTHER_POINTS_USER" };

/**
 * 連携を保存し、監査を同じbatchで記録する。
 * 一意性は`(accounts_origin, accounts_user_id)`で、別のPointsユーザーの行があれば何も変えない。
 */
export async function saveAccountsLink(
  db: D1Database,
  link: {
    pointsUserId: string;
    accountsConnectionId: string;
    accountsOrigin: string;
    accountsUserId: string;
    now: number;
    requestId: string;
  },
): Promise<SaveAccountsLinkResult> {
  const newLinkId = `alnk_${crypto.randomUUID()}`;
  const [saved] = await db.batch<{ id: string }>([
    db
      .prepare(
        `INSERT INTO accounts_links
           (id, points_user_id, accounts_connection_id, accounts_origin, accounts_user_id,
            linked_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(accounts_origin, accounts_user_id) DO UPDATE SET
           accounts_connection_id = excluded.accounts_connection_id,
           relinked_at = excluded.linked_at
         WHERE accounts_links.points_user_id = excluded.points_user_id
         RETURNING id`,
      )
      .bind(
        newLinkId,
        link.pointsUserId,
        link.accountsConnectionId,
        link.accountsOrigin,
        link.accountsUserId,
        link.now,
      ),
    db
      .prepare(
        `INSERT INTO audit_event
           (id, actor_points_user_id, action, target, request_id, result, created_at)
         SELECT ?, ?, CASE WHEN id = ? THEN 'ACCOUNTS_LINK_CREATED'
                           ELSE 'ACCOUNTS_LINK_RENEWED' END,
                id, ?, 'SUCCESS', ?
         FROM accounts_links
         WHERE accounts_origin = ? AND accounts_user_id = ? AND points_user_id = ?`,
      )
      .bind(
        `audit_${crypto.randomUUID()}`,
        link.pointsUserId,
        newLinkId,
        link.requestId,
        link.now,
        link.accountsOrigin,
        link.accountsUserId,
        link.pointsUserId,
      ),
  ]);
  const accountsLinkId = saved?.results[0]?.id;
  if (accountsLinkId === undefined) return { status: "LINKED_TO_OTHER_POINTS_USER" };
  return { status: accountsLinkId === newLinkId ? "CREATED" : "RENEWED", accountsLinkId };
}

/**
 * 保存しなかった連携（一意性違反・ID Tokenの不正）を監査に記録する。
 */
export async function recordAccountsLinkRejection(
  db: D1Database,
  {
    pointsUserId,
    accountsConnectionId,
    code,
    now,
    requestId,
  }: {
    pointsUserId: string;
    accountsConnectionId: string;
    code: string;
    now: number;
    requestId: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_event
         (id, actor_points_user_id, action, target, reason, request_id, result, created_at)
       VALUES (?, ?, 'ACCOUNTS_LINK_REJECTED', ?, ?, ?, 'REJECTED', ?)`,
    )
    .bind(`audit_${crypto.randomUUID()}`, pointsUserId, accountsConnectionId, code, requestId, now)
    .run();
}

/**
 * 本人の連携を解除し、監査を同じbatchで記録する。
 * Accountsへは何も要求しない。
 * @returns 本人の連携が無かった場合は`false`
 */
export async function deleteAccountsLink(
  db: D1Database,
  {
    accountsLinkId,
    pointsUserId,
    now,
    requestId,
  }: { accountsLinkId: string; pointsUserId: string; now: number; requestId: string },
): Promise<boolean> {
  const [, deleted] = await db.batch([
    db
      .prepare(
        `INSERT INTO audit_event
           (id, actor_points_user_id, action, target, request_id, result, created_at)
         SELECT ?, ?, 'ACCOUNTS_LINK_DELETED', id, ?, 'SUCCESS', ?
         FROM accounts_links WHERE id = ? AND points_user_id = ?`,
      )
      .bind(
        `audit_${crypto.randomUUID()}`,
        pointsUserId,
        requestId,
        now,
        accountsLinkId,
        pointsUserId,
      ),
    db
      .prepare("DELETE FROM accounts_links WHERE id = ? AND points_user_id = ?")
      .bind(accountsLinkId, pointsUserId),
  ]);
  return deleted?.meta.changes === 1;
}

// --------------------------------------------------
// 連携アカウント一覧のsnapshot
// --------------------------------------------------

/**
 * snapshotを取得し直す対象の連携。
 */
export type AccountsLinkRefreshTarget = {
  id: string;
  accountsConnectionId: string;
  accountsUserId: string;
};

/**
 * 最後の取得が`fetchedBefore`以前（または未取得）で、接続先が`ACTIVE`の連携を古い順に返す。
 * @param pointsUserId 指定した場合は本人の連携だけを返す
 */
export async function listAccountsLinksToRefresh(
  db: D1Database,
  {
    fetchedBefore,
    limit,
    pointsUserId = null,
  }: { fetchedBefore: number; limit: number; pointsUserId?: string | null },
): Promise<AccountsLinkRefreshTarget[]> {
  const { results } = await db
    .prepare(
      `SELECT link.id, link.accounts_connection_id AS accountsConnectionId,
              link.accounts_user_id AS accountsUserId
       FROM accounts_links link
       JOIN accounts_connections connection ON connection.id = link.accounts_connection_id
       WHERE connection.status = 'ACTIVE'
         AND (link.external_accounts_fetched_at IS NULL
              OR link.external_accounts_fetched_at <= ?)
         AND (? IS NULL OR link.points_user_id = ?)
       ORDER BY link.external_accounts_fetched_at IS NOT NULL,
                link.external_accounts_fetched_at, link.id
       LIMIT ?`,
    )
    .bind(fetchedBefore, pointsUserId, pointsUserId, limit)
    .all<AccountsLinkRefreshTarget>();
  return results;
}

/**
 * 一覧の取得結果を保存する。
 * `NOT_PROVIDED`（Accountsの404）はsnapshotを消して、公開表示を止める。
 */
export async function saveAccountsLinkSnapshot(
  db: D1Database,
  {
    accountsLinkId,
    result,
    fetchedAt,
  }: { accountsLinkId: string; result: AccountsExternalAccountListResult; fetchedAt: number },
): Promise<void> {
  await db
    .prepare(
      `UPDATE accounts_links
       SET provision_status = ?, external_accounts_json = ?, external_accounts_fetched_at = ?
       WHERE id = ?`,
    )
    .bind(
      result.status,
      result.status === "PROVIDED" ? JSON.stringify(result.externalAccounts) : null,
      fetchedAt,
      accountsLinkId,
    )
    .run();
}

// --------------------------------------------------
// 本人の連携一覧
// --------------------------------------------------

/**
 * 設定画面に表示する本人の連携。
 */
export type OwnAccountsLink = {
  id: string;
  accountsConnection: {
    id: string;
    displayName: string;
    accountsOrigin: string;
    status: AccountsConnectionStatus;
  };
  accountsUserId: string;
  linkedAt: number;
  relinkedAt: number | null;
  provisionStatus: "PROVIDED" | "NOT_PROVIDED" | null;
  externalAccounts: AccountsProvidedExternalAccount[] | null;
  fetchedAt: number | null;
};

/**
 * 本人の連携を連携した順に返す。
 */
export async function listOwnAccountsLinks(
  db: D1Database,
  pointsUserId: string,
): Promise<OwnAccountsLink[]> {
  const { results } = await db
    .prepare(
      `SELECT link.id, link.accounts_connection_id AS connectionId,
              connection.display_name AS connectionDisplayName,
              connection.status AS connectionStatus,
              link.accounts_origin AS accountsOrigin, link.accounts_user_id AS accountsUserId,
              link.linked_at AS linkedAt, link.relinked_at AS relinkedAt,
              link.provision_status AS provisionStatus,
              link.external_accounts_json AS externalAccountsJson,
              link.external_accounts_fetched_at AS fetchedAt
       FROM accounts_links link
       JOIN accounts_connections connection ON connection.id = link.accounts_connection_id
       WHERE link.points_user_id = ?
       ORDER BY link.linked_at, link.id`,
    )
    .bind(pointsUserId)
    .all<{
      id: string;
      connectionId: string;
      connectionDisplayName: string;
      connectionStatus: AccountsConnectionStatus;
      accountsOrigin: string;
      accountsUserId: string;
      linkedAt: number;
      relinkedAt: number | null;
      provisionStatus: "PROVIDED" | "NOT_PROVIDED" | null;
      externalAccountsJson: string | null;
      fetchedAt: number | null;
    }>();
  return results.map((row) => ({
    id: row.id,
    accountsConnection: {
      id: row.connectionId,
      displayName: row.connectionDisplayName,
      accountsOrigin: row.accountsOrigin,
      status: row.connectionStatus,
    },
    accountsUserId: row.accountsUserId,
    linkedAt: row.linkedAt,
    relinkedAt: row.relinkedAt,
    provisionStatus: row.provisionStatus,
    externalAccounts:
      row.externalAccountsJson === null
        ? null
        : (JSON.parse(row.externalAccountsJson) as AccountsProvidedExternalAccount[]),
    fetchedAt: row.fetchedAt,
  }));
}
