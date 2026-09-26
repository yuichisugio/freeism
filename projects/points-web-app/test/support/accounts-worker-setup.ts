import {
  generateAccountsSigningKey,
  importAccountsKeyEncryptionKey,
  sealAccountsSigningKey,
  toAccountsPublicJwks,
} from "../../src/backend/accounts/accounts-key-vault";
import {
  activateAccountsConnection,
  registerAccountsConnection,
} from "../../src/backend/infrastructure/db/d1-accounts-connection-repository";
import type { FakeAccounts } from "./fake-accounts";

/**
 * Accounts連携のWorkers結合テストで共通の準備（Pointsユーザーと、`ACTIVE`の接続先）。
 * @see ./fake-accounts.ts
 */

// --------------------------------------------------
// Pointsユーザー
// --------------------------------------------------

/**
 * テスト用のPointsユーザー。
 * `sessionId`は、`getSession`の差し替えで返すsession。
 */
export type TestPointsUser = {
  authUserId: string;
  pointsUserId: string;
  sessionId: string;
};

/**
 * Better AuthのユーザーとGoogleアカウント、Pointsユーザー、sessionを作る。
 */
export async function seedPointsUser(
  db: D1Database,
  { admin = false }: { admin?: boolean } = {},
): Promise<TestPointsUser> {
  const suffix = crypto.randomUUID();
  const now = Date.now();
  const user = {
    authUserId: `auth-${suffix}`,
    pointsUserId: `pusr_${suffix}`,
    sessionId: `session-${suffix}`,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
         VALUES (?, 'Test user', ?, 1, ?, ?)`,
      )
      .bind(user.authUserId, `${user.authUserId}@example.invalid`, now, now),
    db
      .prepare(
        `INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at)
         VALUES (?, ?, 'google', ?, ?, ?)`,
      )
      .bind(`account-${suffix}`, `google-${suffix}`, user.authUserId, now, now),
    db
      .prepare(
        `INSERT INTO points_user (id, auth_user_id, account_status, created_at)
         VALUES (?, ?, 'ACTIVE', ?)`,
      )
      .bind(user.pointsUserId, user.authUserId, now),
    db
      .prepare(
        `INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(user.sessionId, now + 3_600_000, `token-${suffix}`, now, now, user.authUserId),
    ...(admin
      ? [
          db
            .prepare(
              "INSERT INTO admin_membership (id, points_user_id, role) VALUES (?, ?, 'ADMIN')",
            )
            .bind(`admin-${suffix}`, user.pointsUserId),
        ]
      : []),
  ]);
  return user;
}

// --------------------------------------------------
// 接続先
// --------------------------------------------------

/**
 * Worker secretと同じKEK。
 */
export function importTestKek(env: { ACCOUNTS_KEY_ENCRYPTION_KEY: string }): Promise<CryptoKey> {
  return importAccountsKeyEncryptionKey(env.ACCOUNTS_KEY_ENCRYPTION_KEY);
}

/**
 * 鍵を生成して接続先を登録し、テスト用Accountsへクライアントを登録して`ACTIVE`にする。
 * 運営者画面を通さずに、FIX・連携のテストの前提を作る。
 */
export async function seedActiveAccountsConnection(
  db: D1Database,
  {
    kek,
    accounts,
    actorPointsUserId,
  }: { kek: CryptoKey; accounts: FakeAccounts; actorPointsUserId: string },
): Promise<{ connectionId: string; clientId: string }> {
  const connectionId = `acon_${crypto.randomUUID()}`;
  const clientId = `client_${crypto.randomUUID()}`;
  const [clientKey, dpopKey] = await Promise.all([
    generateAccountsSigningKey(),
    generateAccountsSigningKey(),
  ]);
  const now = Date.now();
  const audit = { actorPointsUserId, reason: "test", requestId: `req_${crypto.randomUUID()}` };
  const idempotency = (operation: string) => ({
    operation,
    idempotencyKey: crypto.randomUUID(),
    payloadHash: "0".repeat(64),
    status: 200,
    responseBody: {},
  });
  await registerAccountsConnection(db, {
    connection: {
      id: connectionId,
      accountsOrigin: accounts.origin,
      displayName: "Test Accounts",
      clientPublicJwk: clientKey.publicJwk,
      signingKeyCiphertext: await sealAccountsSigningKey(
        kek,
        { connectionId, purpose: "client-assertion" },
        clientKey,
      ),
      dpopKeyCiphertext: await sealAccountsSigningKey(
        kek,
        { connectionId, purpose: "dpop" },
        dpopKey,
      ),
      createdAt: now,
    },
    audit,
    idempotency: idempotency("ACCOUNTS_CONNECTION_CREATE"),
  });
  accounts.registerClient(clientId, toAccountsPublicJwks(clientKey.publicJwk));
  await activateAccountsConnection(db, {
    connectionId,
    clientId,
    now,
    audit,
    idempotency: idempotency("ACCOUNTS_CONNECTION_ACTIVATE"),
  });
  return { connectionId, clientId };
}

// --------------------------------------------------
// 複数のテスト用Accounts
// --------------------------------------------------

/**
 * 要求先のoriginで、登録したテスト用Accountsへ振り分ける`fetch`。
 * 1つのappから複数の接続先へ要求するテストで使う。
 */
export function createFakeAccountsNetwork() {
  const accountsByOrigin = new Map<string, FakeAccounts>();
  const fetch: typeof globalThis.fetch = (input, init) => {
    const { origin } = new URL(input instanceof Request ? input.url : String(input));
    const accounts = accountsByOrigin.get(origin);
    if (accounts === undefined) throw new TypeError(`Unexpected fetch: ${origin}`);
    return accounts.fetch(input, init);
  };
  return {
    fetch,
    add(accounts: FakeAccounts): FakeAccounts {
      accountsByOrigin.set(accounts.origin, accounts);
      return accounts;
    },
  };
}
