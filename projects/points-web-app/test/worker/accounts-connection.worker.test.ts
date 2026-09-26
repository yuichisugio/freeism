import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import {
  createFakeAccountsNetwork,
  seedPointsUser,
  type TestPointsUser,
} from "../support/accounts-worker-setup";
import { createFakeAccounts, type FakeAccounts } from "../support/fake-accounts";

const db = env.DB!;

// --------------------------------------------------
// 準備
// --------------------------------------------------

type AccountsConnectionBody = {
  data: {
    id: string;
    accountsOrigin: string;
    displayName: string;
    status: string;
    clientId: string | null;
    registration: {
      applicationName: string;
      applicationUrl: string;
      redirectUri: string;
      jwks: { keys: JsonWebKey[] };
    } | null;
  };
};

/**
 * appの`accountsFetch`から届くテスト用Accounts。
 */
const network = createFakeAccountsNetwork();

async function createAccounts() {
  return network.add(
    await createFakeAccounts({
      origin: `https://accounts-${crypto.randomUUID().slice(0, 8)}.test`,
    }),
  );
}

/**
 * 運営者の要求を送るapp。
 * `sessionCreatedAt`を16分以上前にすると、Google freshでないsessionになる。
 */
function createAdminClient(user: TestPointsUser, sessionCreatedAt = new Date()) {
  const app = createPointsBackendApp({
    accountsFetch: network.fetch,
    getSession: async () => ({
      session: { createdAt: sessionCreatedAt, id: user.sessionId, userId: user.authUserId },
      user: { id: user.authUserId },
    }),
  });
  return (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = { "Idempotency-Key": crypto.randomUUID() },
  ) =>
    app.fetch(
      new Request(`https://points.test${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
}

async function setUp() {
  const accounts = await createAccounts();
  const admin = await seedPointsUser(db, { admin: true });
  return { accounts, admin, request: createAdminClient(admin) };
}

async function createConnection(
  request: ReturnType<typeof createAdminClient>,
  accounts: FakeAccounts,
) {
  const response = await request("POST", "/api/admin/accounts-connections", {
    accountsOrigin: accounts.origin,
    displayName: "Freeism Accounts",
    reason: "接続先を追加する",
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as AccountsConnectionBody).data;
}

async function activateConnection(
  request: ReturnType<typeof createAdminClient>,
  accounts: FakeAccounts,
  connection: AccountsConnectionBody["data"],
) {
  const clientId = `client_${crypto.randomUUID()}`;
  accounts.registerClient(clientId, connection.registration!.jwks);
  const response = await request(
    "POST",
    `/api/admin/accounts-connections/${connection.id}/activation`,
    { clientId, reason: "Accountsに登録した" },
  );
  expect(response.status).toBe(200);
  return clientId;
}

function readConnectionRow(connectionId: string) {
  return db
    .prepare(
      `SELECT status, client_id AS clientId,
              client_private_jwk_ciphertext AS signingKeyCiphertext,
              dpop_private_jwk_ciphertext AS dpopKeyCiphertext
       FROM accounts_connections WHERE id = ?`,
    )
    .bind(connectionId)
    .first<{
      status: string;
      clientId: string | null;
      signingKeyCiphertext: string | null;
      dpopKeyCiphertext: string | null;
    }>();
}

async function seedLink(connectionId: string, accountsOrigin: string) {
  const user = await seedPointsUser(db);
  const linkId = `alnk_${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO accounts_links
         (id, points_user_id, accounts_connection_id, accounts_origin, accounts_user_id, linked_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(linkId, user.pointsUserId, connectionId, accountsOrigin, `ausr_${linkId}`, Date.now())
    .run();
  return linkId;
}

// --------------------------------------------------
// 認可
// --------------------------------------------------

describe("接続先の管理の認可", () => {
  it("ADMINでない利用者を拒否する", async () => {
    const accounts = await createAccounts();
    const user = await seedPointsUser(db);
    const request = createAdminClient(user);

    expect((await request("GET", "/api/admin/accounts-connections")).status).toBe(403);
    const response = await request("POST", "/api/admin/accounts-connections", {
      accountsOrigin: accounts.origin,
      displayName: "Accounts",
      reason: "reason",
    });
    expect(response.status).toBe(403);
  });

  it("Google freshでないsession・理由無し・Idempotency-Key無しを拒否する", async () => {
    const { accounts, admin, request } = await setUp();
    const staleRequest = createAdminClient(admin, new Date(Date.now() - 16 * 60_000));
    const body = { accountsOrigin: accounts.origin, displayName: "Accounts", reason: "reason" };

    const stale = await staleRequest("POST", "/api/admin/accounts-connections", body);
    const withoutReason = await request("POST", "/api/admin/accounts-connections", {
      ...body,
      reason: " ",
    });
    const withoutKey = await request("POST", "/api/admin/accounts-connections", body, {});

    expect(stale.status).toBe(401);
    expect(await withoutReason.json()).toMatchObject({ code: "ADMIN_REASON_REQUIRED" });
    expect(await withoutKey.json()).toMatchObject({ code: "IDEMPOTENCY_KEY_REQUIRED" });
  });
});

// --------------------------------------------------
// 作成
// --------------------------------------------------

describe("接続先の作成", () => {
  it("鍵を生成し、Accountsへ登録する公開JWK Setとリダイレクト URLを返す", async () => {
    const { accounts, request } = await setUp();

    const connection = await createConnection(request, accounts);

    expect(connection).toMatchObject({
      accountsOrigin: accounts.origin,
      displayName: "Freeism Accounts",
      status: "PENDING_CLIENT_REGISTRATION",
      clientId: null,
      registration: {
        applicationName: "Freeism Points",
        applicationUrl: env.APP_ORIGIN,
        redirectUri: `${env.APP_ORIGIN}/api/accounts-links/callback`,
      },
    });
    expect(connection.registration!.jwks.keys).toEqual([
      {
        kty: "OKP",
        crv: "Ed25519",
        x: expect.any(String),
        kid: expect.any(String),
        alg: "EdDSA",
        use: "sig",
      },
    ]);
  });

  it("秘密鍵をD1には暗号文だけで保存し、応答・一覧に出さない", async () => {
    const { accounts, request } = await setUp();
    const connection = await createConnection(request, accounts);

    const row = await readConnectionRow(connection.id);
    const listed = await (await request("GET", "/api/admin/accounts-connections")).text();

    expect(row?.signingKeyCiphertext).toMatch(/^v1\./);
    expect(row?.dpopKeyCiphertext).toMatch(/^v1\./);
    expect(row?.signingKeyCiphertext).not.toContain('"d"');
    expect(listed).toContain(connection.id);
    expect(listed).not.toMatch(/"d"\s*:/);
    expect(listed).not.toContain("v1.");
  });

  it("同じIdempotency-Keyの再送には同じ応答を返し、接続先を増やさない", async () => {
    const { accounts, request } = await setUp();
    const headers = { "Idempotency-Key": crypto.randomUUID() };
    const body = { accountsOrigin: accounts.origin, displayName: "Accounts", reason: "reason" };

    const first = await request("POST", "/api/admin/accounts-connections", body, headers);
    const second = await request("POST", "/api/admin/accounts-connections", body, headers);

    expect(second.status).toBe(201);
    expect(await second.json()).toEqual(await first.json());
  });

  it("不正なorigin・同じoriginの2件目・メタデータを取得できないAccountsを拒否する", async () => {
    const { accounts, request } = await setUp();
    await createConnection(request, accounts);
    const create = (accountsOrigin: string) =>
      request("POST", "/api/admin/accounts-connections", {
        accountsOrigin,
        displayName: "Accounts",
        reason: "reason",
      });

    const invalidOrigin = await create(`${accounts.origin}/path`);
    const duplicated = await create(accounts.origin);
    const unreachable = await create("https://unreachable.example.test");

    expect(invalidOrigin.status).toBe(422);
    expect(await invalidOrigin.json()).toMatchObject({
      code: "ACCOUNTS_CONNECTION_ORIGIN_INVALID",
    });
    expect(duplicated.status).toBe(409);
    expect(await duplicated.json()).toMatchObject({
      code: "ACCOUNTS_CONNECTION_ORIGIN_DUPLICATED",
    });
    expect(unreachable.status).toBe(422);
    expect(await unreachable.json()).toMatchObject({ code: "ACCOUNTS_DISCOVERY_INVALID" });
  });
});

// --------------------------------------------------
// 有効化
// --------------------------------------------------

describe("接続先の有効化", () => {
  it("Client Credentialsのトークンを取得できた時だけACTIVEにし、トークンを暗号化してキャッシュする", async () => {
    const { accounts, request } = await setUp();
    const connection = await createConnection(request, accounts);

    const unregistered = await request(
      "POST",
      `/api/admin/accounts-connections/${connection.id}/activation`,
      { clientId: "client_unregistered", reason: "reason" },
    );
    expect(unregistered.status).toBe(422);
    expect(await unregistered.json()).toMatchObject({
      code: "ACCOUNTS_CLIENT_VERIFICATION_FAILED",
    });
    expect((await readConnectionRow(connection.id))?.status).toBe("PENDING_CLIENT_REGISTRATION");

    const clientId = await activateConnection(request, accounts, connection);

    expect(await readConnectionRow(connection.id)).toMatchObject({ status: "ACTIVE", clientId });
    const token = await db
      .prepare(
        "SELECT access_token_ciphertext AS ciphertext FROM accounts_client_tokens WHERE accounts_connection_id = ?",
      )
      .bind(connection.id)
      .first<{ ciphertext: string }>();
    expect(token?.ciphertext).toMatch(/^v1\./);
  });

  it("利用者にはACTIVEの接続先だけを返す", async () => {
    const { accounts, request } = await setUp();
    const pending = await createConnection(request, accounts);
    const otherAccounts = await createAccounts();
    const active = await createConnection(request, otherAccounts);
    await activateConnection(request, otherAccounts, active);

    const response = await request("GET", "/api/accounts-connections");
    const { data } = (await response.json()) as { data: { id: string }[] };

    expect(data).toContainEqual({
      id: active.id,
      displayName: "Freeism Accounts",
      accountsOrigin: otherAccounts.origin,
    });
    expect(data.map(({ id }) => id)).not.toContain(pending.id);
  });

  it("ACTIVEの接続先を再び有効化しない", async () => {
    const { accounts, request } = await setUp();
    const connection = await createConnection(request, accounts);
    const clientId = await activateConnection(request, accounts, connection);

    const response = await request(
      "POST",
      `/api/admin/accounts-connections/${connection.id}/activation`,
      { clientId, reason: "reason" },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ACCOUNTS_CONNECTION_NOT_PENDING" });
  });
});

// --------------------------------------------------
// 取り下げ
// --------------------------------------------------

describe("接続先の取り下げ", () => {
  it("全ユーザー連携・トークンキャッシュ・秘密鍵を消し、WITHDRAWNにする", async () => {
    const { accounts, admin, request } = await setUp();
    const connection = await createConnection(request, accounts);
    await activateConnection(request, accounts, connection);
    await seedLink(connection.id, accounts.origin);
    await seedLink(connection.id, accounts.origin);

    const response = await request(
      "POST",
      `/api/admin/accounts-connections/${connection.id}/withdrawal`,
      { reason: "接続先を廃止する" },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { id: connection.id, status: "WITHDRAWN", registration: null },
    });
    expect(await readConnectionRow(connection.id)).toMatchObject({
      status: "WITHDRAWN",
      signingKeyCiphertext: null,
      dpopKeyCiphertext: null,
    });
    const remaining = await db
      .prepare(
        `SELECT (SELECT count(*) FROM accounts_links WHERE accounts_connection_id = ?) AS links,
                (SELECT count(*) FROM accounts_client_tokens WHERE accounts_connection_id = ?)
                  AS tokens`,
      )
      .bind(connection.id, connection.id)
      .first<{ links: number; tokens: number }>();
    expect(remaining).toEqual({ links: 0, tokens: 0 });
    const audits = await db
      .prepare(
        `SELECT action, target, reason FROM audit_event
         WHERE actor_points_user_id = ? AND target = ? ORDER BY action`,
      )
      .bind(admin.pointsUserId, connection.id)
      .all<{ action: string; target: string; reason: string }>();
    expect(audits.results).toEqual([
      {
        action: "ACCOUNTS_CONNECTION_ACTIVATED",
        target: connection.id,
        reason: "Accountsに登録した",
      },
      { action: "ACCOUNTS_CONNECTION_CREATED", target: connection.id, reason: "接続先を追加する" },
      {
        action: "ACCOUNTS_CONNECTION_WITHDRAWN",
        target: connection.id,
        reason: "接続先を廃止する",
      },
      { action: "ACCOUNTS_LINKS_RELEASED", target: connection.id, reason: "releasedLinkCount=2" },
    ]);
  });

  it("別のURLの接続先を追加しても、旧接続先の連携は取り下げるまで維持し、取り下げ後は同じoriginを追加できる", async () => {
    const { accounts, request } = await setUp();
    const oldConnection = await createConnection(request, accounts);
    await activateConnection(request, accounts, oldConnection);
    const linkId = await seedLink(oldConnection.id, accounts.origin);

    await createConnection(request, await createAccounts());
    const kept = await db
      .prepare("SELECT id FROM accounts_links WHERE id = ?")
      .bind(linkId)
      .first();
    expect(kept).not.toBeNull();

    await request("POST", `/api/admin/accounts-connections/${oldConnection.id}/withdrawal`, {
      reason: "reason",
    });
    const recreated = await createConnection(request, accounts);
    expect(recreated.id).not.toBe(oldConnection.id);
  });

  it("取り下げ済みの接続先を再び取り下げない", async () => {
    const { accounts, request } = await setUp();
    const connection = await createConnection(request, accounts);
    const withdraw = () =>
      request("POST", `/api/admin/accounts-connections/${connection.id}/withdrawal`, {
        reason: "reason",
      });

    expect((await withdraw()).status).toBe(200);
    const second = await withdraw();
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ code: "ACCOUNTS_CONNECTION_WITHDRAWN" });
  });
});
