import { decryptAccountsSecret, encryptAccountsSecret } from "./accounts-key-vault";
import type { AccountsAccessToken } from "./accounts-oauth-client";
import type { AccountsAccessTokenSource } from "./accounts-resource-client";

/**
 * 資源API用Access Token（有効期間15分）のキャッシュ。
 * 失効の60秒前までは保存済みのトークンを使い、それ以降は取得し直して上書きする。
 * 同時に取得した場合は後勝ちとする（どちらのトークンも有効なため排他しない）。
 * @see ./accounts-client-token-cache.test.ts
 */

// --------------------------------------------------
// 保存先
// --------------------------------------------------

/**
 * 保存するトークン。
 * `expiresAt`はUNIX時刻（ミリ秒）。
 */
export type StoredAccountsAccessToken = {
  accessTokenCiphertext: string;
  expiresAt: number;
};

/**
 * 接続先ごとのトークンの保存先（`accounts_client_tokens`表）。
 */
export interface AccountsClientTokenStore {
  read(connectionId: string): Promise<StoredAccountsAccessToken | null>;
  save(connectionId: string, token: StoredAccountsAccessToken): Promise<void>;
  delete(connectionId: string): Promise<void>;
}

// --------------------------------------------------
// キャッシュ
// --------------------------------------------------

/**
 * 失効までの残りがこれ以下なら取得し直す。
 */
const refreshMarginMs = 60_000;

/**
 * 保存先を使うtoken sourceを作る。
 * トークンはKEKで暗号化して保存する（AADの用途は`access-token`）。
 */
export function createCachedAccountsAccessTokenSource({
  connectionId,
  store,
  kek,
  requestToken,
  now = Date.now,
}: {
  connectionId: string;
  store: AccountsClientTokenStore;
  kek: CryptoKey;
  requestToken: () => Promise<AccountsAccessToken>;
  now?: () => number;
}): AccountsAccessTokenSource {
  const context = { connectionId, purpose: "access-token" } as const;
  return {
    async get() {
      const stored = await store.read(connectionId);
      if (stored !== null && stored.expiresAt > now() + refreshMarginMs) {
        return decryptAccountsSecret(kek, context, stored.accessTokenCiphertext);
      }
      const { accessToken, expiresAt } = await requestToken();
      await store.save(connectionId, {
        accessTokenCiphertext: await encryptAccountsSecret(kek, context, accessToken),
        expiresAt,
      });
      return accessToken;
    },
    invalidate() {
      return store.delete(connectionId);
    },
  };
}
