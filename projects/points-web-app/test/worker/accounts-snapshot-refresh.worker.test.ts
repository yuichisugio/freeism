import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import type { AccountsFailure } from "../../src/backend/accounts/accounts-failure-reporter";
import type { AccountsLinkRefreshTarget } from "../../src/backend/infrastructure/db/d1-accounts-link-repository";
import { listAccountsLinks } from "../../src/backend/usecases/list-accounts-links";
import { refreshAccountsLinkSnapshots } from "../../src/backend/usecases/refresh-accounts-link-snapshots";
import {
  importTestKek,
  seedActiveAccountsConnection,
  seedPointsUser,
} from "../support/accounts-worker-setup";
import { createFakeAccounts, sampleExternalAccounts } from "../support/fake-accounts";

const db = env.DB!;
const hourMs = 60 * 60 * 1000;

// --------------------------------------------------
// 準備
// --------------------------------------------------

async function setUp() {
  const accounts = await createFakeAccounts({
    origin: `https://accounts-${crypto.randomUUID().slice(0, 8)}.test`,
  });
  const kek = await importTestKek(env);
  const admin = await seedPointsUser(db, { admin: true });
  const { connectionId } = await seedActiveAccountsConnection(db, {
    kek,
    accounts,
    actorPointsUserId: admin.pointsUserId,
  });
  const failures: AccountsFailure[] = [];
  const dependencies = (now: number) => ({
    db,
    kek,
    fetch: accounts.fetch,
    reportFailure: async (failure: AccountsFailure) => {
      failures.push(failure);
    },
    now: () => now,
  });
  const refreshTargets: AccountsLinkRefreshTarget[] = [];
  const refresh = (now: number) => refreshAccountsLinkSnapshots(dependencies(now), refreshTargets);

  /**
   * 最後の取得時刻を指定して、情報提供中の連携を作る。
   */
  async function seedLink(fetchedAt: number | null, pointsUserId?: string) {
    const user = pointsUserId === undefined ? await seedPointsUser(db) : { pointsUserId };
    const id = `alnk_${crypto.randomUUID()}`;
    await db
      .prepare(
        `INSERT INTO accounts_links
           (id, points_user_id, accounts_connection_id, accounts_origin, accounts_user_id,
            linked_at, provision_status, external_accounts_json, external_accounts_fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        user.pointsUserId,
        connectionId,
        accounts.origin,
        `ausr_${id}`,
        0,
        fetchedAt === null ? null : "PROVIDED",
        fetchedAt === null ? null : "[]",
        fetchedAt,
      )
      .run();
    refreshTargets.push({ id, accountsConnectionId: connectionId, accountsUserId: `ausr_${id}` });
    return id;
  }

  return { accounts, connectionId, dependencies, failures, refresh, seedLink };
}

function readLink(id: string) {
  return db
    .prepare(
      `SELECT provision_status AS provisionStatus, external_accounts_json AS externalAccountsJson,
              external_accounts_fetched_at AS fetchedAt
       FROM accounts_links WHERE id = ?`,
    )
    .bind(id)
    .first<{
      provisionStatus: string | null;
      externalAccountsJson: string | null;
      fetchedAt: number | null;
    }>();
}

// --------------------------------------------------
// 指定した連携の取得
// --------------------------------------------------

describe("指定した連携アカウント一覧の取得", () => {
  it("404で情報提供停止にしてsnapshotを消す", async () => {
    const now = Date.now();
    const { accounts, failures, refresh, seedLink } = await setUp();
    const stopped = await seedLink(now - 25 * hourMs);
    accounts.setList(() => null);

    await refresh(now);

    expect(await readLink(stopped)).toEqual({
      provisionStatus: "NOT_PROVIDED",
      externalAccountsJson: null,
      fetchedAt: now,
    });
    expect(failures).toEqual([]);
  });

  it("接続先全体の失敗では、その接続先の残りの連携を取得せずに1回だけ記録し、前回のsnapshotを維持する", async () => {
    const now = Date.now();
    const { accounts, failures, refresh, seedLink } = await setUp();
    const unreachable = await seedLink(now - 26 * hourMs);
    const skipped = await seedLink(now - 25 * hourMs);
    accounts.setList(() => sampleExternalAccounts());
    accounts.interceptNext("/api/v1/external-accounts", "network");

    await refresh(now);

    for (const [id, fetchedAt] of [
      [unreachable, now - 26 * hourMs],
      [skipped, now - 25 * hourMs],
    ] as const) {
      expect(await readLink(id)).toEqual({
        provisionStatus: "PROVIDED",
        externalAccountsJson: "[]",
        fetchedAt,
      });
    }
    expect(accounts.requests.filter(({ url }) => url.endsWith("/external-accounts"))).toHaveLength(
      1,
    );
    expect(failures).toEqual([{ operation: "accounts_list", code: "NETWORK_ERROR" }]);
  });

  it("1件の応答が不正な場合は記録して、同じ接続先の次の連携を取得する", async () => {
    const now = Date.now();
    const { accounts, failures, refresh, seedLink } = await setUp();
    const invalid = await seedLink(now - 26 * hourMs);
    const valid = await seedLink(now - 25 * hourMs);
    accounts.setList((accountsUserId) =>
      accountsUserId === `ausr_${invalid}` ? [{ unexpected: true }] : sampleExternalAccounts(),
    );

    await refresh(now);

    expect((await readLink(invalid))?.fetchedAt).toBe(now - 26 * hourMs);
    expect(await readLink(valid)).toEqual({
      provisionStatus: "PROVIDED",
      externalAccountsJson: JSON.stringify(sampleExternalAccounts()),
      fetchedAt: now,
    });
    expect(failures).toEqual([{ operation: "accounts_list", code: "INVALID_RESPONSE" }]);
  });
});

// --------------------------------------------------
// 本人の閲覧
// --------------------------------------------------

describe("本人の閲覧での取得し直し", () => {
  it("閲覧のたびに本人の有効な連携を21件すべて取得し、別人や取り下げ済み接続先は取得しない", async () => {
    const now = Date.now();
    const { accounts, dependencies, seedLink } = await setUp();
    const user = await seedPointsUser(db);
    const ownLinks: string[] = [];
    for (let index = 0; index < 21; index += 1) {
      ownLinks.push(await seedLink(now - 1000, user.pointsUserId));
    }
    const otherLink = await seedLink(now - 1000);
    const withdrawn = await setUp();
    const withdrawnLink = await withdrawn.seedLink(now - 1000, user.pointsUserId);
    await db
      .prepare(
        `UPDATE accounts_connections SET status = 'WITHDRAWN',
                client_private_jwk_ciphertext = NULL, dpop_private_jwk_ciphertext = NULL
         WHERE id = ?`,
      )
      .bind(withdrawn.connectionId)
      .run();
    accounts.setList(() => sampleExternalAccounts());

    for (const viewedAt of [now, now + 1]) {
      const links = await listAccountsLinks(dependencies(viewedAt), user.pointsUserId);

      expect(links).toHaveLength(22);
      for (const id of ownLinks) {
        expect(await readLink(id)).toEqual({
          provisionStatus: "PROVIDED",
          externalAccountsJson: JSON.stringify(sampleExternalAccounts()),
          fetchedAt: viewedAt,
        });
      }
    }
    expect(accounts.requests.filter(({ url }) => url.endsWith("/external-accounts"))).toHaveLength(
      42,
    );
    expect(
      withdrawn.accounts.requests.filter(({ url }) => url.endsWith("/external-accounts")),
    ).toHaveLength(0);
    expect((await readLink(otherLink))?.fetchedAt).toBe(now - 1000);
    expect((await readLink(withdrawnLink))?.fetchedAt).toBe(now - 1000);
  });

  it("接続先全体の失敗では、同じ接続先の残りの連携を取得せずに1回だけ記録する", async () => {
    const now = Date.now();
    const { accounts, dependencies, failures, seedLink } = await setUp();
    const user = await seedPointsUser(db);
    await seedLink(now - 2 * hourMs, user.pointsUserId);
    await seedLink(now - hourMs, user.pointsUserId);
    accounts.interceptNext("/api/v1/external-accounts", "network");

    const links = await listAccountsLinks(dependencies(now), user.pointsUserId);

    expect(links).toHaveLength(2);
    expect(accounts.requests.filter(({ url }) => url.endsWith("/external-accounts"))).toHaveLength(
      1,
    );
    expect(failures).toEqual([{ operation: "accounts_list", code: "NETWORK_ERROR" }]);
  });
});
