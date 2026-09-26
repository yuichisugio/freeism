import { createCachedAccountsAccessTokenSource } from "../accounts/accounts-client-token-cache";
import { openAccountsClient } from "../accounts/accounts-connection-context";
import { discoverAccounts } from "../accounts/accounts-discovery";
import { AccountsClientError, type AccountsEndpoint } from "../accounts/accounts-http";
import { generateAccountsSigningKey, sealAccountsSigningKey } from "../accounts/accounts-key-vault";
import { requestAccountsClientCredentialsToken } from "../accounts/accounts-oauth-client";
import { parseAccountsOrigin } from "../accounts/accounts-origin";
import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";
import { createD1AccountsClientTokenStore } from "../infrastructure/db/d1-accounts-client-token-store";
import * as connectionRepository from "../infrastructure/db/d1-accounts-connection-repository";
import { AccountsProblemError } from "./accounts-problem-error";
import { toAccountsConnectionView } from "./list-accounts-connections";
import { findProfileMutationReplay } from "./profile-mutation-idempotency";

/**
 * 運営者による接続先Accountsの作成・有効化・取り下げ。
 * どの操作も理由とIdempotency-Keyを受け、同じキーの再送には保存した応答を返す。
 * @see ../../../docs/v0.2/details-ja/profile-setting.md
 * @see ../../../test/worker/accounts-connection.worker.test.ts
 */

// --------------------------------------------------
// 共通
// --------------------------------------------------

/**
 * 運営者の操作に共通する入力。
 * `db`・`appOrigin`は環境から、それ以外は要求から受ける。
 */
export type AccountsConnectionCommand = {
  db: D1Database;
  appOrigin: string;
  actorPointsUserId: string;
  reason: unknown;
  idempotencyKey: string;
  requestId: string;
  now?: number;
};

/**
 * 操作の結果（HTTP statusと応答本文）。
 */
export type AccountsConnectionCommandResult = { status: 200 | 201; body: unknown };

const maxDisplayNameLength = 100;
const maxClientIdLength = 255;

/**
 * 理由を検査して前後の空白を除く。
 */
function requireReason(reason: unknown): string {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new AccountsProblemError(422, "ADMIN_REASON_REQUIRED");
  }
  return reason.trim();
}

/**
 * 同じIdempotency-Keyで保存済みの応答を返す。
 * 異なる内容で同じキーを使った場合は`IDEMPOTENCY_KEY_REUSED`になる。
 */
async function findReplay(
  command: AccountsConnectionCommand,
  operation: string,
  payload: unknown,
): Promise<{ payloadHash: string; replay: AccountsConnectionCommandResult | null }> {
  const payloadHash = await hashCanonicalPayload(payload);
  const replay = await findProfileMutationReplay(command.db, {
    pointsUserId: command.actorPointsUserId,
    operation,
    idempotencyKey: command.idempotencyKey,
    payloadHash,
  });
  return {
    payloadHash,
    replay: replay === null ? null : { status: replay.status as 200 | 201, body: replay.body },
  };
}

/**
 * 接続先を返す。
 * 存在しない場合は`ACCOUNTS_CONNECTION_NOT_FOUND`にする。
 */
async function requireConnection(db: D1Database, connectionId: string) {
  const connection = await connectionRepository.findAccountsConnection(db, connectionId);
  if (connection === null) throw new AccountsProblemError(404, "ACCOUNTS_CONNECTION_NOT_FOUND");
  return connection;
}

// --------------------------------------------------
// 作成
// --------------------------------------------------

/**
 * 接続先を作る。
 * originとメタデータを検査し、client assertion用とDPoP用のEd25519鍵を生成してKEKで暗号化保存する。
 * 応答には、Accountsへ登録する公開JWK SetとリダイレクトURLを含める。
 */
export async function createAccountsConnection(
  command: AccountsConnectionCommand & {
    kek: CryptoKey;
    fetch: typeof globalThis.fetch;
    allowLoopbackHttp: boolean;
    accountsOrigin: unknown;
    displayName: unknown;
  },
): Promise<AccountsConnectionCommandResult> {
  const reason = requireReason(command.reason);
  const displayName = typeof command.displayName === "string" ? command.displayName.trim() : "";
  if (displayName.length === 0 || [...displayName].length > maxDisplayNameLength) {
    throw new AccountsProblemError(422, "ACCOUNTS_CONNECTION_DISPLAY_NAME_INVALID");
  }
  const accountsOrigin =
    typeof command.accountsOrigin === "string"
      ? parseAccountsOrigin(command.accountsOrigin, {
          allowLoopbackHttp: command.allowLoopbackHttp,
        })
      : null;
  if (accountsOrigin === null) {
    throw new AccountsProblemError(422, "ACCOUNTS_CONNECTION_ORIGIN_INVALID");
  }

  const operation = "ACCOUNTS_CONNECTION_CREATE";
  const { payloadHash, replay } = await findReplay(command, operation, {
    accountsOrigin,
    displayName,
    reason,
  });
  if (replay !== null) return replay;

  try {
    await discoverAccounts({ accountsOrigin, fetch: command.fetch });
  } catch (error) {
    if (error instanceof AccountsClientError) {
      throw new AccountsProblemError(422, "ACCOUNTS_DISCOVERY_INVALID");
    }
    throw error;
  }

  const connectionId = `acon_${crypto.randomUUID()}`;
  const now = command.now ?? Date.now();
  const [clientKey, dpopKey] = await Promise.all([
    generateAccountsSigningKey(),
    generateAccountsSigningKey(),
  ]);
  const connection = {
    id: connectionId,
    accountsOrigin,
    displayName,
    clientPublicJwk: clientKey.publicJwk,
    signingKeyCiphertext: await sealAccountsSigningKey(
      command.kek,
      { connectionId, purpose: "client-assertion" },
      clientKey,
    ),
    dpopKeyCiphertext: await sealAccountsSigningKey(
      command.kek,
      { connectionId, purpose: "dpop" },
      dpopKey,
    ),
    createdAt: now,
  };
  const body = {
    data: toAccountsConnectionView(
      {
        ...connection,
        clientId: null,
        status: "PENDING_CLIENT_REGISTRATION",
        activatedAt: null,
        withdrawnAt: null,
      },
      command.appOrigin,
    ),
    meta: { requestId: command.requestId },
  };
  const result = await connectionRepository.registerAccountsConnection(command.db, {
    connection,
    audit: { actorPointsUserId: command.actorPointsUserId, reason, requestId: command.requestId },
    idempotency: {
      operation,
      idempotencyKey: command.idempotencyKey,
      payloadHash,
      status: 201,
      responseBody: body,
    },
  });
  if (result === "ORIGIN_DUPLICATED") {
    throw new AccountsProblemError(409, "ACCOUNTS_CONNECTION_ORIGIN_DUPLICATED");
  }
  return { status: 201, body };
}

// --------------------------------------------------
// 有効化
// --------------------------------------------------

/**
 * Accountsで登録したClient IDを保存し、`ACTIVE`にする。
 * Client Credentialsのトークンを実際に取得できた時だけ有効にし、取得したトークンはキャッシュする。
 */
export async function activateAccountsConnection(
  command: AccountsConnectionCommand & {
    kek: CryptoKey;
    fetch: typeof globalThis.fetch;
    connectionId: string;
    clientId: unknown;
  },
): Promise<AccountsConnectionCommandResult> {
  const reason = requireReason(command.reason);
  const clientId = typeof command.clientId === "string" ? command.clientId.trim() : "";
  if (clientId.length === 0 || clientId.length > maxClientIdLength) {
    throw new AccountsProblemError(422, "ACCOUNTS_CLIENT_ID_INVALID");
  }

  const operation = "ACCOUNTS_CONNECTION_ACTIVATE";
  const { connectionId } = command;
  const { payloadHash, replay } = await findReplay(command, operation, {
    connectionId,
    clientId,
    reason,
  });
  if (replay !== null) return replay;

  const connection = await requireConnection(command.db, connectionId);
  if (connection.status !== "PENDING_CLIENT_REGISTRATION") {
    throw new AccountsProblemError(409, "ACCOUNTS_CONNECTION_NOT_PENDING");
  }
  await verifyAccountsClient(command, {
    connectionId,
    clientId,
    accountsOrigin: connection.accountsOrigin,
    signingKeyCiphertext: connection.signingKeyCiphertext!,
    dpopKeyCiphertext: connection.dpopKeyCiphertext!,
  });

  const now = command.now ?? Date.now();
  const body = {
    data: toAccountsConnectionView(
      { ...connection, clientId, status: "ACTIVE", activatedAt: now },
      command.appOrigin,
    ),
    meta: { requestId: command.requestId },
  };
  const isActivated = await connectionRepository.activateAccountsConnection(command.db, {
    connectionId,
    clientId,
    now,
    audit: { actorPointsUserId: command.actorPointsUserId, reason, requestId: command.requestId },
    idempotency: {
      operation,
      idempotencyKey: command.idempotencyKey,
      payloadHash,
      status: 200,
      responseBody: body,
    },
  });
  if (!isActivated) throw new AccountsProblemError(409, "ACCOUNTS_CONNECTION_NOT_PENDING");
  return { status: 200, body };
}

/**
 * 入力されたClient IDと保存した鍵で、Client Credentialsのトークンを取得できることを確かめる。
 * 以前の試行で保存したトークンを使わないよう、キャッシュを消してから取得する。
 */
async function verifyAccountsClient(
  command: { db: D1Database; kek: CryptoKey; fetch: typeof globalThis.fetch },
  connection: {
    connectionId: string;
    clientId: string;
    accountsOrigin: string;
    signingKeyCiphertext: string;
    dpopKeyCiphertext: string;
  },
): Promise<void> {
  const endpoint: AccountsEndpoint = {
    accountsOrigin: connection.accountsOrigin,
    fetch: command.fetch,
  };
  const client = await openAccountsClient(command.kek, connection);
  const store = createD1AccountsClientTokenStore(command.db);
  const tokenSource = createCachedAccountsAccessTokenSource({
    connectionId: connection.connectionId,
    store,
    kek: command.kek,
    requestToken: async () =>
      requestAccountsClientCredentialsToken({
        endpoint,
        authorizationServer: await discoverAccounts(endpoint),
        client,
      }),
  });
  await tokenSource.invalidate();
  try {
    await tokenSource.get();
  } catch (error) {
    if (!(error instanceof AccountsClientError)) throw error;
    throw new AccountsProblemError(
      422,
      error.code === "DISCOVERY_INVALID"
        ? "ACCOUNTS_DISCOVERY_INVALID"
        : "ACCOUNTS_CLIENT_VERIFICATION_FAILED",
    );
  }
}

// --------------------------------------------------
// 取り下げ
// --------------------------------------------------

/**
 * 接続先を取り下げる（終端）。
 * その接続先への全ユーザー連携・トークンキャッシュ・秘密鍵を消す。
 * Accounts側の同意・公開設定には触れない。
 */
export async function withdrawAccountsConnection(
  command: AccountsConnectionCommand & { connectionId: string },
): Promise<AccountsConnectionCommandResult> {
  const reason = requireReason(command.reason);
  const operation = "ACCOUNTS_CONNECTION_WITHDRAW";
  const { connectionId } = command;
  const { payloadHash, replay } = await findReplay(command, operation, { connectionId, reason });
  if (replay !== null) return replay;

  const connection = await requireConnection(command.db, connectionId);
  if (connection.status === "WITHDRAWN") {
    throw new AccountsProblemError(409, "ACCOUNTS_CONNECTION_WITHDRAWN");
  }
  const now = command.now ?? Date.now();
  const body = {
    data: toAccountsConnectionView(
      { ...connection, status: "WITHDRAWN", withdrawnAt: now },
      command.appOrigin,
    ),
    meta: { requestId: command.requestId },
  };
  const isWithdrawn = await connectionRepository.withdrawAccountsConnection(command.db, {
    connectionId,
    now,
    audit: { actorPointsUserId: command.actorPointsUserId, reason, requestId: command.requestId },
    idempotency: {
      operation,
      idempotencyKey: command.idempotencyKey,
      payloadHash,
      status: 200,
      responseBody: body,
    },
  });
  if (!isWithdrawn) throw new AccountsProblemError(409, "ACCOUNTS_CONNECTION_WITHDRAWN");
  return { status: 200, body };
}
