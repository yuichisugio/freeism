import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import type { AccountsFailure } from "../../src/backend/accounts/accounts-failure-reporter";
import { deleteExpiredAccountsLinkAttempts } from "../../src/backend/infrastructure/db/d1-accounts-link-repository";
import { refreshStaleAccountsLinkSnapshots } from "../../src/backend/usecases/refresh-accounts-link-snapshots";
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
  const refresh = (now: number) =>
    refreshStaleAccountsLinkSnapshots({
      db,
      kek,
      fetch: accounts.fetch,
      reportFailure: async (failure) => {
        failures.push(failure);
      },
      now: () => now,
    });

  /**
   * 最後の取得時刻を指定して、情報提供中の連携を作る。
   */
  async function seedLink(fetchedAt: number | null) {
    const user = await seedPointsUser(db);
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
    return id;
  }

  return { accounts, connectionId, failures, refresh, seedLink };
}

/**
 * 他のテストの連携を、定期更新の対象から外す。
 */
async function markOtherLinksFresh(now: number, ids: string[]) {
  await db
    .prepare(
      `UPDATE accounts_links SET external_accounts_fetched_at = ?
       WHERE id NOT IN (SELECT value FROM json_each(?))`,
    )
    .bind(now, JSON.stringify(ids))
    .run();
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
// 定期更新
// --------------------------------------------------

describe("連携アカウント一覧の定期更新", () => {
  it("未取得と24時間以上古い連携だけを取得し直す", async () => {
    const now = Date.now();
    const { accounts, refresh, seedLink } = await setUp();
    accounts.setList(() => sampleExternalAccounts());
    const stale = await seedLink(now - 25 * hourMs);
    const unfetched = await seedLink(null);
    const fresh = await seedLink(now - hourMs);
    await markOtherLinksFresh(now, [stale, unfetched, fresh]);

    await refresh(now);

    for (const id of [stale, unfetched]) {
      expect(await readLink(id)).toEqual({
        provisionStatus: "PROVIDED",
        externalAccountsJson: JSON.stringify(sampleExternalAccounts()),
        fetchedAt: now,
      });
    }
    expect(await readLink(fresh)).toMatchObject({
      externalAccountsJson: "[]",
      fetchedAt: now - hourMs,
    });
  });

  it("1回の更新で最大50件を古い順に取得する", async () => {
    const now = Date.now();
    const { accounts, refresh, seedLink } = await setUp();
    const ids: string[] = [];
    for (let index = 0; index < 55; index += 1) {
      ids.push(await seedLink(now - 25 * hourMs - (55 - index) * 1000));
    }
    await markOtherLinksFresh(now, ids);

    await refresh(now);

    const listRequests = accounts.requests.filter(({ url }) => url.endsWith("/external-accounts"));
    expect(listRequests).toHaveLength(50);
    expect((await readLink(ids[49]!))?.fetchedAt).toBe(now);
    expect((await readLink(ids[50]!))?.fetchedAt).toBe(now - 25 * hourMs - 5000);
  });

  it("404で情報提供停止にしてsnapshotを消し、通信失敗では前回のsnapshotを維持する", async () => {
    const now = Date.now();
    const { accounts, failures, refresh, seedLink } = await setUp();
    const stopped = await seedLink(now - 25 * hourMs);
    const unreachable = await seedLink(now - 26 * hourMs);
    await markOtherLinksFresh(now, [stopped, unreachable]);
    accounts.setList(() => null);
    accounts.interceptNext("/api/v1/external-accounts", "network");

    await refresh(now);

    expect(await readLink(unreachable)).toEqual({
      provisionStatus: "PROVIDED",
      externalAccountsJson: "[]",
      fetchedAt: now - 26 * hourMs,
    });
    expect(await readLink(stopped)).toEqual({
      provisionStatus: "NOT_PROVIDED",
      externalAccountsJson: null,
      fetchedAt: now,
    });
    expect(failures).toEqual([
      { operation: "accounts_list", code: "NETWORK_ERROR", connectionId: expect.any(String) },
    ]);
  });
});

// --------------------------------------------------
// 期限切れの試行
// --------------------------------------------------

describe("期限切れの連携の試行の削除", () => {
  it("期限を過ぎた試行だけを消す", async () => {
    const now = Date.now();
    const { connectionId } = await setUp();
    const user = await seedPointsUser(db);
    const insert = (stateHash: string, createdAt: number) =>
      db
        .prepare(
          `INSERT INTO accounts_link_attempts
             (state_hash, points_user_id, auth_session_id_hash, accounts_connection_id,
              nonce, code_verifier, created_at, expires_at)
           VALUES (?, ?, 'session', ?, 'nonce', 'verifier', ?, ?)`,
        )
        .bind(stateHash, user.pointsUserId, connectionId, createdAt, createdAt + 600_000)
        .run();
    await insert(`expired-${crypto.randomUUID()}`, now - 700_000);
    const liveStateHash = `live-${crypto.randomUUID()}`;
    await insert(liveStateHash, now);

    expect(await deleteExpiredAccountsLinkAttempts(db, now)).toBeGreaterThanOrEqual(1);
    const remaining = await db
      .prepare(
        "SELECT state_hash AS stateHash FROM accounts_link_attempts WHERE points_user_id = ?",
      )
      .bind(user.pointsUserId)
      .all();
    expect(remaining.results).toEqual([{ stateHash: liveStateHash }]);
  });
});
