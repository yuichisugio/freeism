import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { toAccountsProviderId } from "../../src/backend/accounts/accounts-provider-id";
import { completeVerifiedAccountsLink } from "../../src/backend/usecases/complete-accounts-link";
import {
  findAccountsLinkAttemptByVerifier,
  hashAccountsLinkSecret,
  insertAccountsLinkAttempt,
  setVerifiedAccountsLinkAttempt,
  consumeAccountsLinkAttempt,
} from "../../src/backend/infrastructure/db/d1-accounts-link-repository";
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
  const request = (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = body === undefined
      ? {}
      : { "Content-Type": "application/json" },
  ) =>
    app.fetch(
      new Request(`https://points.test${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
  return Object.assign(request, { user });
}

type UserClient = ReturnType<typeof createUserClient>;

/** 検証済みAccounts主体を既存の連携処理へ渡す。 */
async function link(request: UserClient, connection: TestConnection, sub: string) {
  return completeVerifiedAccountsLink(
    {
      db,
      kek: await importTestKek(env),
      fetch: network.fetch,
      reportFailure: async () => {},
    },
    {
      pointsUserId: request.user.pointsUserId,
      accountsConnectionId: connection.connectionId,
      accountsUserId: sub,
      requestId: `req_${crypto.randomUUID()}`,
    },
  );
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
  it("標準OAuthのcode verifierから未失効の連携試行を参照する", async () => {
    const connection = await createConnection();
    const user = await seedPointsUser(db);
    const codeVerifier = `verifier-${crypto.randomUUID()}`;
    const ticket = `ticket-${crypto.randomUUID()}`;
    const now = Date.now();
    await insertAccountsLinkAttempt(db, {
      stateHash: await hashAccountsLinkSecret(ticket),
      pointsUserId: user.pointsUserId,
      authSessionIdHash: await hashAccountsLinkSecret(user.sessionId),
      accountsConnectionId: connection.connectionId,
      nonce: "expected-nonce",
      codeVerifier,
      createdAt: now,
    });

    expect(
      await findAccountsLinkAttemptByVerifier(db, {
        codeVerifier,
        accountsConnectionId: connection.connectionId,
        now,
      }),
    ).toEqual({ nonce: "expected-nonce", codeVerifier });
    expect(
      await findAccountsLinkAttemptByVerifier(db, {
        codeVerifier,
        accountsConnectionId: "acon_other",
        now,
      }),
    ).toBeNull();
    expect(
      await findAccountsLinkAttemptByVerifier(db, {
        codeVerifier,
        accountsConnectionId: connection.connectionId,
        now: now + 600_000,
      }),
    ).toBeNull();

    expect(
      await setVerifiedAccountsLinkAttempt(db, {
        ticket,
        pointsUserId: user.pointsUserId,
        authSessionIdHash: await hashAccountsLinkSecret("other-session"),
        accountsConnectionId: connection.connectionId,
        accountsUserId: "ausr_wrong",
        now,
      }),
    ).toBe(false);

    expect(
      await setVerifiedAccountsLinkAttempt(db, {
        ticket,
        pointsUserId: user.pointsUserId,
        authSessionIdHash: await hashAccountsLinkSecret(user.sessionId),
        accountsConnectionId: connection.connectionId,
        accountsUserId: "ausr_verified",
        now,
      }),
    ).toBe(true);
    expect(
      await consumeAccountsLinkAttempt(db, {
        stateHash: await hashAccountsLinkSecret(ticket),
        pointsUserId: user.pointsUserId,
        authSessionIdHash: await hashAccountsLinkSecret(user.sessionId),
        now,
      }),
    ).toMatchObject({ verifiedAccountsUserId: "ausr_verified" });
  });

  it("検証済みのAccounts主体を既存の連携とsnapshotへ保存する", async () => {
    const connection = await createConnection();
    const user = await seedPointsUser(db);
    const accountsUserId = newAccountsUserId();
    const dependencies = {
      db,
      kek: await importTestKek(env),
      fetch: network.fetch,
      reportFailure: async () => {},
    };

    const saved = await completeVerifiedAccountsLink(dependencies, {
      pointsUserId: user.pointsUserId,
      accountsConnectionId: connection.connectionId,
      accountsUserId,
      requestId: `req_${crypto.randomUUID()}`,
    });

    expect(saved.status).toBe("CREATED");
    expect(await listLinks(createUserClient(user))).toEqual([
      expect.objectContaining({
        accountsUserId,
        provisionStatus: "PROVIDED",
        externalAccounts: sampleExternalAccounts(),
      }),
    ]);
  });

  it("検証済みの同じ主体は所有者の解除後に別のPointsユーザーへ連携できる", async () => {
    const connection = await createConnection();
    const firstUser = await seedPointsUser(db);
    const secondUser = await seedPointsUser(db);
    const accountsUserId = newAccountsUserId();
    const dependencies = {
      db,
      kek: await importTestKek(env),
      fetch: network.fetch,
      reportFailure: async () => {},
    };
    const input = {
      accountsConnectionId: connection.connectionId,
      accountsUserId,
      requestId: `req_${crypto.randomUUID()}`,
    };
    const first = await completeVerifiedAccountsLink(dependencies, {
      ...input,
      pointsUserId: firstUser.pointsUserId,
    });

    await expect(
      completeVerifiedAccountsLink(dependencies, {
        ...input,
        pointsUserId: secondUser.pointsUserId,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNTS_USER_LINKED_TO_OTHER_POINTS_USER" });
    expect(
      (await createUserClient(firstUser)("DELETE", `/api/accounts-links/${first.accountsLinkId}`))
        .status,
    ).toBe(204);

    const second = await completeVerifiedAccountsLink(dependencies, {
      ...input,
      pointsUserId: secondUser.pointsUserId,
    });
    expect(second.status).toBe("CREATED");
    expect(await listLinks(createUserClient(secondUser))).toEqual([
      expect.objectContaining({ accountsUserId }),
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
    expect((await link(request, connection, accountsUserId)).status).toBe("RENEWED");

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

    await expect(link(request, connection, accountsUserId)).rejects.toMatchObject({
      code: "ACCOUNTS_USER_LINKED_TO_OTHER_POINTS_USER",
    });
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

describe("標準OAuth後の連携完了", () => {
  it("開始したsessionだけがticketを消費し、検証済みsubを連携する", async () => {
    const connection = await createConnection();
    const user = await seedPointsUser(db);
    const firstSub = newAccountsUserId();
    const otherSub = newAccountsUserId();
    const ticket = `ticket-${crypto.randomUUID()}`;
    const now = Date.now();
    await insertAccountsLinkAttempt(db, {
      stateHash: await hashAccountsLinkSecret(ticket),
      pointsUserId: user.pointsUserId,
      authSessionIdHash: await hashAccountsLinkSecret(user.sessionId),
      accountsConnectionId: connection.connectionId,
      nonce: "nonce",
      codeVerifier: `verifier-${crypto.randomUUID()}`,
      createdAt: now,
    });
    await setVerifiedAccountsLinkAttempt(db, {
      ticket,
      pointsUserId: user.pointsUserId,
      authSessionIdHash: await hashAccountsLinkSecret(user.sessionId),
      accountsConnectionId: connection.connectionId,
      accountsUserId: firstSub,
      now,
    });
    const providerId = toAccountsProviderId(connection.connectionId);
    await db
      .prepare(
        `INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(`account-${crypto.randomUUID()}`, otherSub, providerId, user.authUserId, now, now)
      .run();

    const wrongSession = await createUserClient(user, "other-session")(
      "GET",
      `/api/accounts-links/finish?ticket=${ticket}`,
    );
    expect(
      new URL(wrongSession.headers.get("Location")!, env.APP_ORIGIN).searchParams.get(
        "accountsLinkError",
      ),
    ).toBe("ACCOUNTS_LINK_ATTEMPT_INVALID");

    const finished = await createUserClient(user)(
      "GET",
      `/api/accounts-links/finish?ticket=${ticket}`,
    );
    expect(finished.status).toBe(303);
    expect(
      new URL(finished.headers.get("Location")!, env.APP_ORIGIN).searchParams.get(
        "accountsLinkResult",
      ),
    ).toBe("LINKED");
    expect(await listLinks(createUserClient(user))).toEqual([
      expect.objectContaining({ accountsUserId: firstSub }),
    ]);
    const core = await db
      .prepare("SELECT account_id AS accountId FROM account WHERE user_id = ? AND provider_id = ?")
      .bind(user.authUserId, providerId)
      .all<{ accountId: string }>();
    expect(core.results).toEqual([{ accountId: otherSub }]);
  });
});

// --------------------------------------------------
// 開始の制限
// --------------------------------------------------

describe("連携の開始", () => {
  it("JSON以外のContent-Typeを415で拒否する", async () => {
    const connection = await createConnection();
    const request = createUserClient(await seedPointsUser(db));

    const response = await request(
      "POST",
      "/api/accounts-links/attempts",
      { accountsConnectionId: connection.connectionId },
      { "Content-Type": "text/plain" },
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ code: "JSON_CONTENT_TYPE_REQUIRED" });
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

  it("本人の解除でACCOUNTS_LINK_DELETEDの監査を残す", async () => {
    const connection = await createConnection();
    const user = await seedPointsUser(db);
    const request = createUserClient(user);
    await link(request, connection, newAccountsUserId());
    const [linked] = await listLinks(request);

    const response = await request("DELETE", `/api/accounts-links/${linked!.id}`);

    expect(response.status).toBe(204);
    const audit = await db
      .prepare(
        `SELECT action, target, result FROM audit_event
         WHERE actor_points_user_id = ? AND action = 'ACCOUNTS_LINK_DELETED'`,
      )
      .bind(user.pointsUserId)
      .all();
    expect(audit.results).toEqual([
      { action: "ACCOUNTS_LINK_DELETED", target: linked!.id, result: "SUCCESS" },
    ]);
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

    expect((await link(request, connection, newAccountsUserId())).status).toBe("CREATED");
    const [linked] = await listLinks(request);
    expect(linked).toMatchObject({ provisionStatus: "PROVIDED" });
  });
});
