import { createD1AccountsClientTokenStore } from "../infrastructure/db/d1-accounts-client-token-store";
import {
  findActiveAccountsConnection,
  type ActiveAccountsConnection,
} from "../infrastructure/db/d1-accounts-connection-repository";
import { createCachedAccountsAccessTokenSource } from "./accounts-client-token-cache";
import { discoverAccounts } from "./accounts-discovery";
import type { AccountsEndpoint } from "./accounts-http";
import { openAccountsSigningKey } from "./accounts-key-vault";
import {
  requestAccountsClientCredentialsToken,
  type AccountsClient,
} from "./accounts-oauth-client";
import {
  createAccountsResourceClient,
  type AccountsResourceClient,
} from "./accounts-resource-client";

/**
 * 保存済みの接続先から、Accountsへ要求するための部品を組み立てる。
 * 秘密鍵はKEKで復号して取り出せない形で読み込み、資源API用のトークンはD1にキャッシュする。
 * @see ../../../test/worker/accounts-resource-context.worker.test.ts
 */

// --------------------------------------------------
// クライアント
// --------------------------------------------------

/**
 * 接続先の2つの秘密鍵を復号し、OAuthクライアントとして読み込む。
 * 有効化の前（`PENDING_CLIENT_REGISTRATION`）でも、入力されたClient IDで使えるようにIDを引数で受ける。
 */
export async function openAccountsClient(
  kek: CryptoKey,
  {
    connectionId,
    clientId,
    signingKeyCiphertext,
    dpopKeyCiphertext,
  }: {
    connectionId: string;
    clientId: string;
    signingKeyCiphertext: string;
    dpopKeyCiphertext: string;
  },
): Promise<AccountsClient> {
  const [clientKey, dpopKey] = await Promise.all([
    openAccountsSigningKey(
      kek,
      { connectionId, purpose: "client-assertion" },
      signingKeyCiphertext,
    ),
    openAccountsSigningKey(kek, { connectionId, purpose: "dpop" }, dpopKeyCiphertext),
  ]);
  return { clientId, clientKey, dpopKey };
}

// --------------------------------------------------
// 資源API
// --------------------------------------------------

/**
 * `ACTIVE`の接続先と、その接続先の資源APIクライアント。
 */
export type AccountsResourceContext = {
  connection: ActiveAccountsConnection;
  resourceClient: AccountsResourceClient;
};

/**
 * `ACTIVE`の接続先の資源APIクライアントを作る。
 * メタデータはトークンを取得し直す時にだけ取得する。
 * @param fetch Accountsへの要求に使う`fetch`（テストではテスト用Accountsへ差し替える）
 * @returns 接続先が存在しない・`ACTIVE`でない場合は`null`
 */
export async function createAccountsResourceContext({
  db,
  kek,
  connectionId,
  fetch,
}: {
  db: D1Database;
  kek: CryptoKey;
  connectionId: string;
  fetch: typeof globalThis.fetch;
}): Promise<AccountsResourceContext | null> {
  const connection = await findActiveAccountsConnection(db, connectionId);
  if (connection === null) return null;

  const endpoint: AccountsEndpoint = { accountsOrigin: connection.accountsOrigin, fetch };
  const client = await openAccountsClient(kek, { ...connection, connectionId });
  const accessTokenSource = createCachedAccountsAccessTokenSource({
    connectionId,
    store: createD1AccountsClientTokenStore(db),
    kek,
    requestToken: async () =>
      requestAccountsClientCredentialsToken({
        endpoint,
        authorizationServer: await discoverAccounts(endpoint),
        client,
      }),
  });
  return {
    connection,
    resourceClient: createAccountsResourceClient({
      endpoint,
      dpopKey: client.dpopKey,
      accessTokenSource,
    }),
  };
}
