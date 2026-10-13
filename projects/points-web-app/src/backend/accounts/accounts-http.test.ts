import { describe, expect, it } from "vite-plus/test";

import { createFakeAccounts } from "../../../test/support/fake-accounts";
import { discoverAccounts } from "./accounts-discovery";

/**
 * Workersのglobal `fetch`は、`this`がglobal以外のobjectだとIllegal invocationになる。
 * テスト環境（Node.js・vitest-pool-workers）のglobal `fetch`はこの性質を持たないため、同じ検査をする`fetch`で確かめる。
 * @see ./accounts-http.ts
 */
describe("toAccountsRequestOptions", () => {
  it("渡されたfetchを、endpointをthisにせずに呼ぶ", async () => {
    const accounts = await createFakeAccounts();
    function fetchLikeWorkers(this: unknown, ...args: Parameters<typeof fetch>) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      return accounts.fetch(...args);
    }

    await expect(
      discoverAccounts({ accountsOrigin: accounts.origin, fetch: fetchLikeWorkers }),
    ).resolves.toMatchObject({ issuer: accounts.origin });
  });
});
