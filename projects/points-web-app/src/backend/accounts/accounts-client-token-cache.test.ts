import { describe, expect, it } from "vite-plus/test";

import {
  createCachedAccountsAccessTokenSource,
  type AccountsClientTokenStore,
  type StoredAccountsAccessToken,
} from "./accounts-client-token-cache";
import { importAccountsKeyEncryptionKey } from "./accounts-key-vault";

const connectionId = "acon_1";
const now = Date.parse("2026-09-26T00:00:00Z");

function createMemoryStore(): AccountsClientTokenStore & {
  rows: Map<string, StoredAccountsAccessToken>;
} {
  const rows = new Map<string, StoredAccountsAccessToken>();
  return {
    rows,
    async read(id) {
      return rows.get(id) ?? null;
    },
    async save(id, token) {
      rows.set(id, token);
    },
    async delete(id) {
      rows.delete(id);
    },
  };
}

async function setUp() {
  const kek = await importAccountsKeyEncryptionKey(
    btoa(String.fromCharCode(...new Uint8Array(32).fill(1))),
  );
  const store = createMemoryStore();
  const issued: string[] = [];
  const source = createCachedAccountsAccessTokenSource({
    connectionId,
    store,
    kek,
    now: () => now,
    requestToken: async () => {
      const accessToken = `token-${issued.length + 1}`;
      issued.push(accessToken);
      return { accessToken, expiresAt: now + 900_000 };
    },
  });
  return { store, issued, source };
}

describe("createCachedAccountsAccessTokenSource", () => {
  it("保存が無ければ取得し、暗号化して失効時刻と一緒に保存する", async () => {
    const { store, issued, source } = await setUp();

    await expect(source.get()).resolves.toBe("token-1");

    const row = store.rows.get(connectionId);
    expect(issued).toEqual(["token-1"]);
    expect(row?.expiresAt).toBe(now + 900_000);
    expect(row?.accessTokenCiphertext).toMatch(/^v1\./);
    expect(row?.accessTokenCiphertext).not.toContain("token-1");
  });

  it("失効まで60秒より長く残る保存済みのトークンを再利用する", async () => {
    const { store, issued, source } = await setUp();
    await source.get();
    store.rows.set(connectionId, { ...store.rows.get(connectionId)!, expiresAt: now + 60_001 });

    await expect(source.get()).resolves.toBe("token-1");
    expect(issued).toEqual(["token-1"]);
  });

  it("失効まで60秒以内なら取得し直して上書きする", async () => {
    const { store, issued, source } = await setUp();
    await source.get();
    store.rows.set(connectionId, { ...store.rows.get(connectionId)!, expiresAt: now + 60_000 });

    await expect(source.get()).resolves.toBe("token-2");
    expect(issued).toEqual(["token-1", "token-2"]);
    expect(store.rows.get(connectionId)?.expiresAt).toBe(now + 900_000);
  });

  it("破棄すると、次は取得し直す", async () => {
    const { store, issued, source } = await setUp();
    await source.get();

    await source.invalidate();

    expect(store.rows.has(connectionId)).toBe(false);
    await expect(source.get()).resolves.toBe("token-2");
    expect(issued).toEqual(["token-1", "token-2"]);
  });
});
