import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import {
  createFakeAccountsNetwork,
  importTestKek,
  seedActiveAccountsConnection,
  seedPointsUser,
  type TestPointsUser,
} from "../support/accounts-worker-setup";
import {
  createFakeAccounts,
  sampleExternalAccounts,
  type FakeAccounts,
  type FakeAuthorizationCodeInput,
} from "../support/fake-accounts";

const db = env.DB!;

// --------------------------------------------------
// 準備
// --------------------------------------------------

const network = createFakeAccountsNetwork();

type TestConnection = { accounts: FakeAccounts; connectionId: string; clientId: string };

/**
 * テスト用Accountsと、そのAccountsへの`ACTIVE`の接続先を作る。
 */
async function createConnection(): Promise<TestConnection> {
  const accounts = network.add(
    await createFakeAccounts({
      origin: `https://accounts-${crypto.randomUUID().slice(0, 8)}.test`,
    }),
  );
  accounts.setList(() => sampleExternalAccounts());
  const admin = await seedPointsUser(db, { admin: true });
  const { connectionId, clientId } = await seedActiveAccountsConnection(db, {
    kek: await importTestKek(env),
    accounts,
    actorPointsUserId: admin.pointsUserId,
  });
  return { accounts, connectionId, clientId };
}

/**
 * 利用者の要求を送るapp。
 */
function createUserClient(user: TestPointsUser, sessionId = user.sessionId) {
  const app = createPointsBackendApp({
    accountsFetch: network.fetch,
    getSession: async () => ({
      session: { createdAt: new Date(), id: sessionId, userId: user.authUserId },
      user: { id: user.authUserId },
    }),
  });
  return (method: string, path: string, body?: unknown) =>
    app.fetch(
      new Request(`https://points.test${path}`, {
        method,
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
}

type UserClient = ReturnType<typeof createUserClient>;

/**
 * 連携を開始し、認可URLのqueryを返す。
 */
async function startLink(request: UserClient, connection: TestConnection) {
  const response = await request("POST", "/api/accounts-links/attempts", {
    accountsConnectionId: connection.connectionId,
  });
  expect(response.status).toBe(201);
  const { data } = (await response.json()) as { data: { authorizationUrl: string } };
  return new URL(data.authorizationUrl);
}

/**
 * 同意画面で同意した後の戻り先のqueryを作る。
 */
function consent(
  connection: TestConnection,
  authorizationUrl: URL,
  sub: string,
  overrides: Partial<FakeAuthorizationCodeInput> = {},
) {
  const query = authorizationUrl.searchParams;
  const code = connection.accounts.issueCode({
    clientId: connection.clientId,
    sub,
    nonce: query.get("nonce")!,
    codeChallenge: query.get("code_challenge")!,
    redirectUri: query.get("redirect_uri")!,
    ...overrides,
  });
  return new URLSearchParams({
    code,
    state: query.get("state")!,
    iss: connection.accounts.origin,
  });
}

async function callback(request: UserClient, parameters: URLSearchParams) {
  const response = await request("GET", `/api/accounts-links/callback?${parameters.toString()}`);
  expect(response.status).toBe(303);
  return new URL(response.headers.get("Location")!, "https://points.test").searchParams;
}

/**
 * 開始から戻り先までを通し、戻り先の結果を返す。
 */
async function link(request: UserClient, connection: TestConnection, sub: string) {
  const authorizationUrl = await startLink(request, connection);
  return callback(request, consent(connection, authorizationUrl, sub));
}

type AccountsLinkBody = {
  data: {
    id: string;
    accountsConnection: { id: string; displayName: string; accountsOrigin: string };
    accountsUserId: string;
    accountsProfileUrl: string;
    accountsManagementUrl: string;
    relinkedAt: string | null;
    provisionStatus: string | null;
    externalAccounts: unknown[] | null;
  }[];
};

async function listLinks(request: UserClient) {
  const response = await request("GET", "/api/accounts-links");
  expect(response.status).toBe(200);
  return ((await response.json()) as AccountsLinkBody).data;
}

function newAccountsUserId() {
  return `ausr_${crypto.randomUUID()}`;
}

// --------------------------------------------------
// 連携
// --------------------------------------------------

describe("Accountsとの連携", () => {
  it("同意画面を必ず表示する認可URLを返し、戻り先で連携と一覧を保存する", async () => {
    const connection = await createConnection();
    const user = await seedPointsUser(db);
    const request = createUserClient(user);
    const accountsUserId = newAccountsUserId();

    const authorizationUrl = await startLink(request, connection);
    expect(Object.fromEntries(authorizationUrl.searchParams)).toMatchObject({
      response_type: "code",
      client_id: connection.clientId,
      redirect_uri: `${env.APP_ORIGIN}/api/accounts-links/callback`,
      scope: "openid",
      code_challenge_method: "S256",
      prompt: "consent",
    });
    const response = await request(
      "GET",
      `/api/accounts-links/callback?${consent(connection, authorizationUrl, accountsUserId).toString()}`,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "/settings/connections?accountsLinkResult=LINKED",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(await listLinks(request)).toEqual([
      expect.objectContaining({
        accountsConnection: expect.objectContaining({
          id: connection.connectionId,
          accountsOrigin: connection.accounts.origin,
        }),
        accountsUserId,
        accountsProfileUrl: `${connection.accounts.origin}/profiles/${accountsUserId}`,
        accountsManagementUrl: `${connection.accounts.origin}/account-links`,
        provisionStatus: "PROVIDED",
        externalAccounts: sampleExternalAccounts(),
      }),
    ]);
  });

  it("公開プロフィールはsnapshotだけを読み、Accountsへ要求しない", async () => {
    const connection = await createConnection();
    const user = await seedPointsUser(db);
    const accountsUserId = newAccountsUserId();
    await link(createUserClient(user), connection, accountsUserId);
    const requestCount = connection.accounts.requests.length;

    const response = await createPointsBackendApp({
      accountsFetch: network.fetch,
      getSession: async () => null,
    }).fetch(new Request(`https://points.test/api/v1/profiles/${user.pointsUserId}`), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        accountsLinks: [
          {
            accountsOrigin: connection.accounts.origin,
            accountsUserId,
            externalAccounts: sampleExternalAccounts(),
          },
        ],
      },
    });
    expect(connection.accounts.requests).toHaveLength(requestCount);
  });

  it("同じ・異なる接続先で複数の連携を持ち、同じAccountsユーザーの再連携はRENEWEDにする", async () => {
    const connection = await createConnection();
    const otherConnection = await createConnection();
    const user = await seedPointsUser(db);
    const request = createUserClient(user);
    const accountsUserId = newAccountsUserId();

    await link(request, connection, accountsUserId);
    await link(request, connection, newAccountsUserId());
    await link(request, otherConnection, newAccountsUserId());
    expect(await link(request, connection, accountsUserId)).toEqual(
      new URLSearchParams({ accountsLinkResult: "LINKED" }),
    );

    const links = await listLinks(request);
    expect(links).toHaveLength(3);
    expect(links.find((item) => item.accountsUserId === accountsUserId)?.relinkedAt).not.toBeNull();
    const audits = await db
      .prepare(
        "SELECT action FROM audit_event WHERE actor_points_user_id = ? ORDER BY created_at, action",
      )
      .bind(user.pointsUserId)
      .all<{ action: string }>();
    expect(audits.results.map(({ action }) => action)).toEqual([
      "ACCOUNTS_LINK_CREATED",
      "ACCOUNTS_LINK_CREATED",
      "ACCOUNTS_LINK_CREATED",
      "ACCOUNTS_LINK_RENEWED",
    ]);
  });

  it("別のPointsユーザーに連携済みのAccountsユーザーは保存せずに案内する", async () => {
    const connection = await createConnection();
    const accountsUserId = newAccountsUserId();
    await link(createUserClient(await seedPointsUser(db)), connection, accountsUserId);
    const user = await seedPointsUser(db);
    const request = createUserClient(user);

    const result = await link(request, connection, accountsUserId);

    expect(result.get("accountsLinkError")).toBe("ACCOUNTS_USER_LINKED_TO_OTHER_POINTS_USER");
    expect(await listLinks(request)).toEqual([]);
    const audit = await db
      .prepare("SELECT action, target, reason FROM audit_event WHERE actor_points_user_id = ?")
      .bind(user.pointsUserId)
      .first();
    expect(audit).toEqual({
      action: "ACCOUNTS_LINK_REJECTED",
      target: connection.connectionId,
      reason: "ACCOUNTS_USER_LINKED_TO_OTHER_POINTS_USER",
    });
  });

  it("連携・解除でPointsのsessionとログイン手段を変えない", async () => {
    const connection = await createConnection();
    const user = await seedPointsUser(db);
    const request = createUserClient(user);
    const countLoginState = () =>
      db
        .prepare(
          `SELECT (SELECT count(*) FROM session WHERE user_id = ?) AS sessions,
                  (SELECT count(*) FROM account WHERE user_id = ?) AS accounts`,
        )
        .bind(user.authUserId, user.authUserId)
        .first();
    const before = await countLoginState();

    await link(request, connection, newAccountsUserId());
    const [linked] = await listLinks(request);
    await request("DELETE", `/api/accounts-links/${linked!.id}`);

    expect(await countLoginState()).toEqual(before);
  });
});

// --------------------------------------------------
// 戻り先の拒否
// --------------------------------------------------

describe("連携の戻り先", () => {
  it("改ざん・再使用・別session・期限切れの試行を拒否する", async () => {
    const connection = await createConnection();
    const user = await seedPointsUser(db);
    const request = createUserClient(user);

    const tampered = consent(connection, await startLink(request, connection), newAccountsUserId());
    tampered.set("state", "tampered");
    expect((await callback(request, tampered)).get("accountsLinkError")).toBe(
      "ACCOUNTS_LINK_ATTEMPT_INVALID",
    );

    const reused = consent(connection, await startLink(request, connection), newAccountsUserId());
    await callback(request, reused);
    expect((await callback(request, reused)).get("accountsLinkError")).toBe(
      "ACCOUNTS_LINK_ATTEMPT_INVALID",
    );

    const otherSession = consent(
      connection,
      await startLink(request, connection),
      newAccountsUserId(),
    );
    const otherSessionRequest = createUserClient(user, `session-other-${crypto.randomUUID()}`);
    expect((await callback(otherSessionRequest, otherSession)).get("accountsLinkError")).toBe(
      "ACCOUNTS_LINK_ATTEMPT_INVALID",
    );

    const expired = consent(connection, await startLink(request, connection), newAccountsUserId());
    await db
      .prepare(
        `UPDATE accounts_link_attempts
         SET created_at = created_at - 600000, expires_at = expires_at - 600000
         WHERE points_user_id = ?`,
      )
      .bind(user.pointsUserId)
      .run();
    expect((await callback(request, expired)).get("accountsLinkError")).toBe(
      "ACCOUNTS_LINK_ATTEMPT_INVALID",
    );
  });

  it("同意の拒否とissの不一致を区別して案内する", async () => {
    const connection = await createConnection();
    const request = createUserClient(await seedPointsUser(db));

    const denied = new URLSearchParams({
      error: "access_denied",
      state: (await startLink(request, connection)).searchParams.get("state")!,
      iss: connection.accounts.origin,
    });
    const mixedUp = consent(connection, await startLink(request, connection), newAccountsUserId());
    mixedUp.set("iss", "https://other-accounts.example.test");

    expect((await callback(request, denied)).get("accountsLinkError")).toBe(
      "ACCOUNTS_AUTHORIZATION_DENIED",
    );
    expect((await callback(request, mixedUp)).get("accountsLinkError")).toBe(
      "ACCOUNTS_LINK_ATTEMPT_INVALID",
    );
  });

  it.each([
    ["署名", { signIdTokenWithUnknownKey: true }],
    ["aud", { idTokenClaims: { aud: "other-client" } }],
    ["nonce", { nonce: "other-nonce" }],
    ["exp", { idTokenClaims: { exp: Math.floor(Date.now() / 1000) - 600 } }],
  ] satisfies [string, Partial<FakeAuthorizationCodeInput>][])(
    "ID Tokenの%sが不正なら保存しない",
    async (_name, overrides) => {
      const connection = await createConnection();
      const user = await seedPointsUser(db);
      const request = createUserClient(user);

      const parameters = consent(
        connection,
        await startLink(request, connection),
        newAccountsUserId(),
        overrides,
      );

      expect((await callback(request, parameters)).get("accountsLinkError")).toBe(
        "ACCOUNTS_ID_TOKEN_INVALID",
      );
      expect(await listLinks(request)).toEqual([]);
    },
  );
});

// --------------------------------------------------
// 開始の制限
// --------------------------------------------------

describe("連携の開始", () => {
  it("ACTIVEでない接続先を拒否し、利用者ごとに1時間10回までにする", async () => {
    const connection = await createConnection();
    const request = createUserClient(await seedPointsUser(db));

    const inactive = await request("POST", "/api/accounts-links/attempts", {
      accountsConnectionId: "acon_missing",
    });
    expect(inactive.status).toBe(409);
    expect(await inactive.json()).toMatchObject({ code: "ACCOUNTS_CONNECTION_NOT_ACTIVE" });

    for (let count = 2; count <= 10; count += 1) await startLink(request, connection);
    const limited = await request("POST", "/api/accounts-links/attempts", {
      accountsConnectionId: connection.connectionId,
    });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

// --------------------------------------------------
// 情報提供の停止と解除
// --------------------------------------------------

describe("情報提供の停止と解除", () => {
  it("Accountsの404で情報提供停止にして公開表示から外し、本人は解除できる", async () => {
    const connection = await createConnection();
    const user = await seedPointsUser(db);
    const request = createUserClient(user);
    const accountsUserId = newAccountsUserId();
    connection.accounts.setList(() => null);

    await link(request, connection, accountsUserId);
    const [stopped] = await listLinks(request);
    const profile = await request("GET", `/api/v1/profiles/${user.pointsUserId}`);

    expect(stopped).toMatchObject({ provisionStatus: "NOT_PROVIDED", externalAccounts: null });
    expect(await profile.json()).toMatchObject({ data: { accountsLinks: [] } });

    const deleted = await request("DELETE", `/api/accounts-links/${stopped!.id}`);
    expect(deleted.status).toBe(204);
    expect(await listLinks(request)).toEqual([]);
  });

  it("他人の連携は解除できない", async () => {
    const connection = await createConnection();
    const owner = createUserClient(await seedPointsUser(db));
    await link(owner, connection, newAccountsUserId());
    const [ownerLink] = await listLinks(owner);
    const other = createUserClient(await seedPointsUser(db));

    const response = await other("DELETE", `/api/accounts-links/${ownerLink!.id}`);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "ACCOUNTS_LINK_NOT_FOUND" });
    expect(await listLinks(owner)).toHaveLength(1);
  });

  it("一覧の取得に失敗しても連携を成立させ、次の閲覧で取得し直す", async () => {
    const connection = await createConnection();
    const request = createUserClient(await seedPointsUser(db));
    connection.accounts.interceptNext("/api/v1/external-accounts", "network");

    expect(await link(request, connection, newAccountsUserId())).toEqual(
      new URLSearchParams({ accountsLinkResult: "LINKED" }),
    );
    const [linked] = await listLinks(request);
    expect(linked).toMatchObject({ provisionStatus: "PROVIDED" });
  });
});
