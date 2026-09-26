import type { AccountsPublicJwk } from "../../accounts/accounts-key-vault";

/**
 * 接続先Accounts（`accounts_connections`表）の読み書き。
 * 状態は`PENDING_CLIENT_REGISTRATION` → `ACTIVE` → `WITHDRAWN`（終端）と遷移する。
 * 状態の変更は、監査と冪等結果を同じD1 batchで記録する。
 * @see ../../../../docs/v0.2/details-ja/profile-setting.md
 * @see ../../../../test/worker/accounts-connection.worker.test.ts
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

export type AccountsConnectionStatus = "PENDING_CLIENT_REGISTRATION" | "ACTIVE" | "WITHDRAWN";

/**
 * 運営者画面に表示する接続先。
 * 秘密鍵の暗号文は含めない。
 */
export type AccountsConnectionRecord = {
  id: string;
  accountsOrigin: string;
  displayName: string;
  clientId: string | null;
  status: AccountsConnectionStatus;
  clientPublicJwk: AccountsPublicJwk;
  createdAt: number;
  activatedAt: number | null;
  withdrawnAt: number | null;
};

/**
 * 暗号化した秘密鍵を含む接続先。
 * 暗号文は`WITHDRAWN`の時だけ`null`になる。
 */
export type AccountsConnectionWithKeys = AccountsConnectionRecord & {
  signingKeyCiphertext: string | null;
  dpopKeyCiphertext: string | null;
};

/**
 * Accountsへ要求できる（`ACTIVE`の）接続先。
 * `signingKeyCiphertext`はclient assertion用、`dpopKeyCiphertext`はDPoP用の秘密JWKの暗号文。
 */
export type ActiveAccountsConnection = {
  id: string;
  accountsOrigin: string;
  clientId: string;
  displayName: string;
  signingKeyCiphertext: string;
  dpopKeyCiphertext: string;
};

/**
 * 利用者・FIX画面に示す`ACTIVE`の接続先。
 */
export type ActiveAccountsConnectionSummary = Pick<
  ActiveAccountsConnection,
  "id" | "displayName" | "accountsOrigin"
>;

/**
 * 状態の変更と一緒に記録する監査。
 */
export type AccountsConnectionAudit = {
  actorPointsUserId: string;
  reason: string;
  requestId: string;
};

/**
 * 状態の変更と一緒に保存する冪等結果。
 */
export type AccountsConnectionIdempotency = {
  operation: string;
  idempotencyKey: string;
  payloadHash: string;
  status: number;
  responseBody: unknown;
};

type AccountsConnectionRow = Omit<AccountsConnectionWithKeys, "clientPublicJwk"> & {
  clientPublicJwk: string;
};

const selectColumns = `
  id, accounts_origin AS accountsOrigin, display_name AS displayName, client_id AS clientId,
  status, client_public_jwk AS clientPublicJwk, created_at AS createdAt,
  activated_at AS activatedAt, withdrawn_at AS withdrawnAt,
  client_private_jwk_ciphertext AS signingKeyCiphertext,
  dpop_private_jwk_ciphertext AS dpopKeyCiphertext`;

function toRecord(row: AccountsConnectionRow): AccountsConnectionRecord {
  return {
    id: row.id,
    accountsOrigin: row.accountsOrigin,
    displayName: row.displayName,
    clientId: row.clientId,
    status: row.status,
    clientPublicJwk: JSON.parse(row.clientPublicJwk) as AccountsPublicJwk,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
    withdrawnAt: row.withdrawnAt,
  };
}

// --------------------------------------------------
// 読み取り
// --------------------------------------------------

/**
 * `ACTIVE`の接続先を返す。
 * @returns 存在しない・`ACTIVE`でない場合は`null`
 */
export async function findActiveAccountsConnection(
  db: D1Database,
  connectionId: string,
): Promise<ActiveAccountsConnection | null> {
  const row = await db
    .prepare(`SELECT ${selectColumns} FROM accounts_connections WHERE id = ? AND status = 'ACTIVE'`)
    .bind(connectionId)
    .first<AccountsConnectionRow>();
  if (row === null) return null;
  return {
    id: row.id,
    accountsOrigin: row.accountsOrigin,
    clientId: row.clientId!,
    displayName: row.displayName,
    signingKeyCiphertext: row.signingKeyCiphertext!,
    dpopKeyCiphertext: row.dpopKeyCiphertext!,
  };
}

/**
 * 状態によらず接続先を返す。
 * @returns 存在しない場合は`null`
 */
export async function findAccountsConnection(
  db: D1Database,
  connectionId: string,
): Promise<AccountsConnectionWithKeys | null> {
  const row = await db
    .prepare(`SELECT ${selectColumns} FROM accounts_connections WHERE id = ?`)
    .bind(connectionId)
    .first<AccountsConnectionRow>();
  if (row === null) return null;
  return {
    ...toRecord(row),
    signingKeyCiphertext: row.signingKeyCiphertext,
    dpopKeyCiphertext: row.dpopKeyCiphertext,
  };
}

/**
 * 全接続先を新しい順に返す（運営者画面）。
 */
export async function listAccountsConnections(db: D1Database): Promise<AccountsConnectionRecord[]> {
  const { results } = await db
    .prepare(`SELECT ${selectColumns} FROM accounts_connections ORDER BY created_at DESC, id`)
    .all<AccountsConnectionRow>();
  return results.map(toRecord);
}

/**
 * `ACTIVE`の接続先を表示名の順に返す（利用者の連携・FIXの取込）。
 */
export async function listActiveAccountsConnections(
  db: D1Database,
): Promise<ActiveAccountsConnectionSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT id, display_name AS displayName, accounts_origin AS accountsOrigin
       FROM accounts_connections WHERE status = 'ACTIVE'
       ORDER BY display_name, id`,
    )
    .all<ActiveAccountsConnectionSummary>();
  return results;
}

// --------------------------------------------------
// 監査と冪等結果
// --------------------------------------------------

/**
 * SQLの断片と、その断片のplaceholderへbindする値。
 */
type SqlFragment = { sql: string; bindings: unknown[] };

/**
 * `condition`が成り立つ時だけ監査を記録する文。
 * `target`には接続先IDだけを入れる。
 * `reason`の既定値は運営者が入力した理由。
 */
function insertAuditWhen(
  db: D1Database,
  {
    action,
    connectionId,
    audit,
    now,
    reason = { sql: "?", bindings: [audit.reason] },
    condition,
  }: {
    action: string;
    connectionId: string;
    audit: AccountsConnectionAudit;
    now: number;
    reason?: SqlFragment;
    condition: SqlFragment;
  },
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_event
         (id, actor_points_user_id, action, target, reason, request_id, result, created_at)
       SELECT ?, ?, ?, ?, ${reason.sql}, ?, 'SUCCESS', ?
       WHERE ${condition.sql}`,
    )
    .bind(
      `audit_${crypto.randomUUID()}`,
      audit.actorPointsUserId,
      action,
      connectionId,
      ...reason.bindings,
      audit.requestId,
      now,
      ...condition.bindings,
    );
}

/**
 * `condition`が成り立つ時だけ冪等結果を保存する文。
 */
function insertIdempotencyWhen(
  db: D1Database,
  {
    actorPointsUserId,
    idempotency,
    now,
    condition,
  }: {
    actorPointsUserId: string;
    idempotency: AccountsConnectionIdempotency;
    now: number;
    condition: SqlFragment;
  },
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO idempotency_results
         (id, actor_points_user_id, operation, idempotency_key, payload_hash,
          status, response_body, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?
       WHERE ${condition.sql}`,
    )
    .bind(
      `idem_${crypto.randomUUID()}`,
      actorPointsUserId,
      idempotency.operation,
      idempotency.idempotencyKey,
      idempotency.payloadHash,
      idempotency.status,
      JSON.stringify(idempotency.responseBody),
      now,
      ...condition.bindings,
    );
}

// --------------------------------------------------
// 登録
// --------------------------------------------------

/**
 * `PENDING_CLIENT_REGISTRATION`の接続先を登録する。
 * @returns 同じoriginで`WITHDRAWN`以外の接続先がある場合は`ORIGIN_DUPLICATED`
 */
export async function registerAccountsConnection(
  db: D1Database,
  {
    connection,
    audit,
    idempotency,
  }: {
    connection: {
      id: string;
      accountsOrigin: string;
      displayName: string;
      clientPublicJwk: AccountsPublicJwk;
      signingKeyCiphertext: string;
      dpopKeyCiphertext: string;
      createdAt: number;
    };
    audit: AccountsConnectionAudit;
    idempotency: AccountsConnectionIdempotency;
  },
): Promise<"REGISTERED" | "ORIGIN_DUPLICATED"> {
  const always: SqlFragment = { sql: "1 = 1", bindings: [] };
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO accounts_connections
             (id, accounts_origin, display_name, status, client_key_id, client_public_jwk,
              client_private_jwk_ciphertext, dpop_private_jwk_ciphertext,
              created_by_points_user_id, created_at)
           VALUES (?, ?, ?, 'PENDING_CLIENT_REGISTRATION', ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          connection.id,
          connection.accountsOrigin,
          connection.displayName,
          connection.clientPublicJwk.kid,
          JSON.stringify(connection.clientPublicJwk),
          connection.signingKeyCiphertext,
          connection.dpopKeyCiphertext,
          audit.actorPointsUserId,
          connection.createdAt,
        ),
      insertAuditWhen(db, {
        action: "ACCOUNTS_CONNECTION_CREATED",
        connectionId: connection.id,
        audit,
        now: connection.createdAt,
        condition: always,
      }),
      insertIdempotencyWhen(db, {
        actorPointsUserId: audit.actorPointsUserId,
        idempotency,
        now: connection.createdAt,
        condition: always,
      }),
    ]);
  } catch (error) {
    if (String(error).includes("accounts_connections.accounts_origin")) return "ORIGIN_DUPLICATED";
    throw error;
  }
  return "REGISTERED";
}

// --------------------------------------------------
// 有効化
// --------------------------------------------------

/**
 * Client IDを登録して`ACTIVE`にする。
 * @returns `PENDING_CLIENT_REGISTRATION`でなかった場合は`false`
 */
export async function activateAccountsConnection(
  db: D1Database,
  {
    connectionId,
    clientId,
    now,
    audit,
    idempotency,
  }: {
    connectionId: string;
    clientId: string;
    now: number;
    audit: AccountsConnectionAudit;
    idempotency: AccountsConnectionIdempotency;
  },
): Promise<boolean> {
  const isPending: SqlFragment = {
    sql: `EXISTS (SELECT 1 FROM accounts_connections
                  WHERE id = ? AND status = 'PENDING_CLIENT_REGISTRATION')`,
    bindings: [connectionId],
  };
  const [, , activation] = await db.batch([
    insertAuditWhen(db, {
      action: "ACCOUNTS_CONNECTION_ACTIVATED",
      connectionId,
      audit,
      now,
      condition: isPending,
    }),
    insertIdempotencyWhen(db, {
      actorPointsUserId: audit.actorPointsUserId,
      idempotency,
      now,
      condition: isPending,
    }),
    db
      .prepare(
        `UPDATE accounts_connections
         SET status = 'ACTIVE', client_id = ?, activated_at = ?
         WHERE id = ? AND status = 'PENDING_CLIENT_REGISTRATION'`,
      )
      .bind(clientId, now, connectionId),
  ]);
  return activation?.meta.changes === 1;
}

// --------------------------------------------------
// 取り下げ
// --------------------------------------------------

/**
 * 接続先を取り下げる。
 * 同じbatchで、その接続先への全連携・連携の試行・トークンキャッシュを削除し、秘密鍵の暗号文を消す。
 * 解除した連携の件数は、監査`ACCOUNTS_LINKS_RELEASED`の`reason`に`releasedLinkCount=N`として残す。
 * FIX・claimに保存した`accounts_origin`のsnapshotは残す。
 * @returns 既に`WITHDRAWN`だった場合は`false`
 */
export async function withdrawAccountsConnection(
  db: D1Database,
  {
    connectionId,
    now,
    audit,
    idempotency,
  }: {
    connectionId: string;
    now: number;
    audit: AccountsConnectionAudit;
    idempotency: AccountsConnectionIdempotency;
  },
): Promise<boolean> {
  const isLive: SqlFragment = {
    sql: `EXISTS (SELECT 1 FROM accounts_connections WHERE id = ? AND status <> 'WITHDRAWN')`,
    bindings: [connectionId],
  };
  const results = await db.batch([
    insertAuditWhen(db, {
      action: "ACCOUNTS_CONNECTION_WITHDRAWN",
      connectionId,
      audit,
      now,
      condition: isLive,
    }),
    insertAuditWhen(db, {
      action: "ACCOUNTS_LINKS_RELEASED",
      connectionId,
      audit,
      now,
      reason: {
        sql: `'releasedLinkCount=' ||
              (SELECT count(*) FROM accounts_links WHERE accounts_connection_id = ?)`,
        bindings: [connectionId],
      },
      condition: isLive,
    }),
    insertIdempotencyWhen(db, {
      actorPointsUserId: audit.actorPointsUserId,
      idempotency,
      now,
      condition: isLive,
    }),
    db.prepare("DELETE FROM accounts_links WHERE accounts_connection_id = ?").bind(connectionId),
    db
      .prepare("DELETE FROM accounts_link_attempts WHERE accounts_connection_id = ?")
      .bind(connectionId),
    db
      .prepare("DELETE FROM accounts_client_tokens WHERE accounts_connection_id = ?")
      .bind(connectionId),
    db
      .prepare(
        `UPDATE accounts_connections
         SET status = 'WITHDRAWN', withdrawn_at = ?,
             client_private_jwk_ciphertext = NULL, dpop_private_jwk_ciphertext = NULL
         WHERE id = ? AND status <> 'WITHDRAWN'`,
      )
      .bind(now, connectionId),
  ]);
  return results.at(-1)?.meta.changes === 1;
}
