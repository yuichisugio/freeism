import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createAccountsResourceContext } from "../../src/backend/accounts/accounts-connection-context";
import { createD1AccountsClientTokenStore } from "../../src/backend/infrastructure/db/d1-accounts-client-token-store";
import {
  importTestKek,
  seedActiveAccountsConnection,
  seedPointsUser,
} from "../support/accounts-worker-setup";
import { createFakeAccounts, sampleExternalAccounts } from "../support/fake-accounts";

const db = env.DB!;

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
  return { accounts, kek, connectionId };
}

function countTokenRequests(accounts: { requests: { url: string }[] }) {
  return accounts.requests.filter(({ url }) => url.endsWith("/api/auth/oauth2/token")).length;
}

// --------------------------------------------------
// createAccountsResourceContext
// --------------------------------------------------

describe("createAccountsResourceContext", () => {
  it("ACTIVEの接続先の鍵を復号して資源APIへ要求し、トークンを暗号化してD1にキャッシュする", async () => {
    const { accounts, kek, connectionId } = await setUp();
    accounts.setList(() => sampleExternalAccounts());

    const context = await createAccountsResourceContext({
      db,
      kek,
      connectionId,
      fetch: accounts.fetch,
    });
    await expect(context!.resourceClient.listExternalAccounts("ausr_1")).resolves.toEqual({
      status: "PROVIDED",
      externalAccounts: sampleExternalAccounts(),
    });

    const cached = await createD1AccountsClientTokenStore(db).read(connectionId);
    expect(cached?.accessTokenCiphertext).toMatch(/^v1\./);
    expect(cached!.expiresAt).toBeGreaterThan(Date.now());

    const nextContext = await createAccountsResourceContext({
      db,
      kek,
      connectionId,
      fetch: accounts.fetch,
    });
    await nextContext!.resourceClient.listExternalAccounts("ausr_1");
    expect(countTokenRequests(accounts)).toBe(1);
  });

  it("キャッシュしたトークンが401になった場合は、D1のキャッシュを捨てて1回だけ取得し直す", async () => {
    const { accounts, kek, connectionId } = await setUp();
    const context = await createAccountsResourceContext({
      db,
      kek,
      connectionId,
      fetch: accounts.fetch,
    });
    await context!.resourceClient.resolveIdentifiers([]);
    accounts.revokeAccessTokens();

    await expect(context!.resourceClient.resolveIdentifiers([])).resolves.toEqual([]);
    expect(countTokenRequests(accounts)).toBe(2);
  });

  it("存在しない・ACTIVEでない接続先ではnullを返す", async () => {
    const { accounts, kek, connectionId } = await setUp();
    await db
      .prepare(
        "UPDATE accounts_connections SET status = 'PENDING_CLIENT_REGISTRATION' WHERE id = ?",
      )
      .bind(connectionId)
      .run();

    await expect(
      createAccountsResourceContext({ db, kek, connectionId, fetch: accounts.fetch }),
    ).resolves.toBeNull();
    await expect(
      createAccountsResourceContext({
        db,
        kek,
        connectionId: "acon_missing",
        fetch: accounts.fetch,
      }),
    ).resolves.toBeNull();
  });
});
