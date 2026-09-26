import { toAccountsPublicJwks, type AccountsPublicJwk } from "../accounts/accounts-key-vault";
import {
  listAccountsConnections,
  type AccountsConnectionRecord,
  type AccountsConnectionStatus,
} from "../infrastructure/db/d1-accounts-connection-repository";

/**
 * 運営者画面に表示する接続先。
 * `WITHDRAWN`以外には、Accountsの開発者向け画面へ登録する情報を付ける。
 * @see ../../../test/worker/accounts-connection.worker.test.ts
 */

// --------------------------------------------------
// 表示
// --------------------------------------------------

/**
 * Accountsの開発者向け画面へ運営者が登録する情報。
 * 同意画面に表示されるアプリ名・紹介URLは、ここに示す推奨値を運営者がAccounts側で登録する。
 */
export type AccountsClientRegistration = {
  applicationName: string;
  applicationUrl: string;
  redirectUri: string;
  jwks: { keys: [AccountsPublicJwk] };
};

export type AccountsConnectionView = {
  id: string;
  displayName: string;
  accountsOrigin: string;
  status: AccountsConnectionStatus;
  clientId: string | null;
  createdAt: string;
  activatedAt: string | null;
  withdrawnAt: string | null;
  registration: AccountsClientRegistration | null;
};

/**
 * 連携の戻り先。
 * Accountsへ登録するリダイレクトURLと完全に一致させる。
 */
export function toAccountsLinkRedirectUri(appOrigin: string): string {
  return `${appOrigin}/api/accounts-links/callback`;
}

function toIsoString(time: number | null): string | null {
  return time === null ? null : new Date(time).toISOString();
}

/**
 * 保存した接続先を運営者画面の表示にする。
 */
export function toAccountsConnectionView(
  connection: AccountsConnectionRecord,
  appOrigin: string,
): AccountsConnectionView {
  return {
    id: connection.id,
    displayName: connection.displayName,
    accountsOrigin: connection.accountsOrigin,
    status: connection.status,
    clientId: connection.clientId,
    createdAt: new Date(connection.createdAt).toISOString(),
    activatedAt: toIsoString(connection.activatedAt),
    withdrawnAt: toIsoString(connection.withdrawnAt),
    registration:
      connection.status === "WITHDRAWN"
        ? null
        : {
            applicationName: "Freeism Points",
            applicationUrl: appOrigin,
            redirectUri: toAccountsLinkRedirectUri(appOrigin),
            jwks: toAccountsPublicJwks(connection.clientPublicJwk),
          },
  };
}

/**
 * 全接続先を運営者画面の表示にして返す。
 */
export async function listAccountsConnectionViews(
  db: D1Database,
  appOrigin: string,
): Promise<AccountsConnectionView[]> {
  const connections = await listAccountsConnections(db);
  return connections.map((connection) => toAccountsConnectionView(connection, appOrigin));
}
