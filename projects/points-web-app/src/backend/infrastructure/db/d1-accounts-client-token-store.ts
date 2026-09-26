import type {
  AccountsClientTokenStore,
  StoredAccountsAccessToken,
} from "../../accounts/accounts-client-token-cache";

/**
 * 資源API用Access Tokenのキャッシュ（`accounts_client_tokens`表）。
 * トークンは`createCachedAccountsAccessTokenSource`が暗号化した値だけを保存する。
 * @see ../../accounts/accounts-client-token-cache.ts
 * @see ../../../../test/worker/accounts-resource-context.worker.test.ts
 */

// --------------------------------------------------
// 保存先
// --------------------------------------------------

/**
 * D1を保存先にする。
 * 接続先ごとに1行で、保存は上書きする。
 */
export function createD1AccountsClientTokenStore(db: D1Database): AccountsClientTokenStore {
  return {
    read(connectionId) {
      return db
        .prepare(
          `SELECT access_token_ciphertext AS accessTokenCiphertext, expires_at AS expiresAt
           FROM accounts_client_tokens WHERE accounts_connection_id = ?`,
        )
        .bind(connectionId)
        .first<StoredAccountsAccessToken>();
    },

    async save(connectionId, { accessTokenCiphertext, expiresAt }) {
      await db
        .prepare(
          `INSERT INTO accounts_client_tokens
             (accounts_connection_id, access_token_ciphertext, expires_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(accounts_connection_id) DO UPDATE SET
             access_token_ciphertext = excluded.access_token_ciphertext,
             expires_at = excluded.expires_at,
             updated_at = excluded.updated_at`,
        )
        .bind(connectionId, accessTokenCiphertext, expiresAt, Date.now())
        .run();
    },

    async delete(connectionId) {
      await db
        .prepare("DELETE FROM accounts_client_tokens WHERE accounts_connection_id = ?")
        .bind(connectionId)
        .run();
    },
  };
}
