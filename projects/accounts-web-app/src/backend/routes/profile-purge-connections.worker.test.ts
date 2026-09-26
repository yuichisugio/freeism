import { exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestUser,
  createVerifiedUrlAccount,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import { loginAsNewUser, testOrigin } from "../../../test/oauth-client-test-helpers";
import { PublicProfileEntrypoint } from "../../public-profile";
import { externalAccounts } from "../db/schema";
import { selectProfilePurgeTargets } from "../usecases/profile/select-profile-purge-targets";

/**
 * 成功したDNS TXT証明で有効なURLを持つ外部アカウントを作り、一般公開を設定する。
 */
async function createAccount(userId: string, { isPublic }: { isPublic: boolean }) {
  const { accountId } = await createVerifiedUrlAccount(
    userId,
    [`https://${uniqueHost()}/`],
    "dns_txt",
    new Date(),
  );
  await testDb.update(externalAccounts).set({ isPublic }).where(eq(externalAccounts.id, accountId));
  return accountId;
}

describe("selectProfilePurgeTargets", () => {
  it("本人は一般公開中の行がある場合だけ、ほかのユーザーは常に対象にする", async () => {
    const publicUserId = await createTestUser();
    await createAccount(publicUserId, { isPublic: true });
    const privateUserId = await createTestUser();
    await createAccount(privateUserId, { isPublic: false });
    const previousOwnerId = await createTestUser();

    expect(
      await selectProfilePurgeTargets(
        { db: testDb },
        { actorUserId: publicUserId, affectedUserIds: [publicUserId, previousOwnerId] },
      ),
    ).toEqual([publicUserId, previousOwnerId]);
    expect(
      await selectProfilePurgeTargets(
        { db: testDb },
        { actorUserId: privateUserId, affectedUserIds: [privateUserId, previousOwnerId] },
      ),
    ).toEqual([previousOwnerId]);
  });

  it("本人が影響を受けるユーザーに含まれなければ、一般公開中の行があっても対象にしない", async () => {
    const publicUserId = await createTestUser();
    await createAccount(publicUserId, { isPublic: true });

    expect(
      await selectProfilePurgeTargets(
        { db: testDb },
        { actorUserId: publicUserId, affectedUserIds: [] },
      ),
    ).toEqual([]);
  });
});

describe("連携解除後の公開プロフィールのpurge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("一般公開中の行を持つ本人の解除では、解除後にpurgeする", async () => {
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");
    const { userId, headers } = await loginAsNewUser();
    const accountId = await createAccount(userId, { isPublic: true });

    const response = await exports.default.fetch(
      `${testOrigin}/api/external-accounts/${accountId}`,
      { method: "DELETE", headers },
    );

    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(purge).toHaveBeenCalledWith([userId]));
    const profile = await exports.default.fetch(`${testOrigin}/profiles/${userId}`);
    expect(await profile.text()).not.toContain('rel="me"');
  });

  it("一般公開中の行が無い本人の解除ではpurgeしない", async () => {
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");
    const { userId, headers } = await loginAsNewUser();
    const accountId = await createAccount(userId, { isPublic: false });

    const response = await exports.default.fetch(
      `${testOrigin}/api/external-accounts/${accountId}`,
      { method: "DELETE", headers },
    );

    expect(response.status).toBe(200);
    expect(purge).not.toHaveBeenCalled();
  });
});

describe("URL検証後の公開プロフィールのpurge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 外部ページの取得とDNS TXTの照会を、どちらも証拠の無い応答にする。
   */
  function mockNoEvidence() {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("<p>no link</p>", { headers: { "content-type": "text/html" } }),
    );
  }

  /**
   * 外部URLの「保存して検証する」「未検証で保存」を要求する。
   */
  function postExternalUrl(headers: Headers, url: string, mode: "verify" | "unverified") {
    return exports.default.fetch(`${testOrigin}/api/external-urls`, {
      method: "POST",
      headers: new Headers([...headers, ["Content-Type", "application/json"]]),
      body: JSON.stringify({ url, mode }),
    });
  }

  it("一般公開中の行を持つ本人が登録済みURLを再検証すると、不成立でも本人の公開プロフィールをpurgeする", async () => {
    const { userId, headers } = await loginAsNewUser();
    await createAccount(userId, { isPublic: true });
    const url = `https://${uniqueHost()}/`;
    expect((await postExternalUrl(headers, url, "unverified")).status).toBe(200);
    mockNoEvidence();
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");

    const response = await postExternalUrl(headers, url, "verify");

    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(purge).toHaveBeenCalledWith([userId]));
  });

  it("未登録URLの検証が不成立で何も保存しなければ、一般公開中の行を持つ本人でもpurgeしない", async () => {
    const { userId, headers } = await loginAsNewUser();
    await createAccount(userId, { isPublic: true });
    mockNoEvidence();
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");

    const response = await postExternalUrl(headers, `https://${uniqueHost()}/`, "verify");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { externalAccountId: null } });
    expect(purge).not.toHaveBeenCalled();
  });
});

describe("復元後の公開プロフィールのpurge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("出力したファイルの復元後に、本人の公開プロフィールをpurgeする", async () => {
    const { userId, headers } = await loginAsNewUser();
    const exported = await exports.default.fetch(`${testOrigin}/api/backup`, { headers });
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");

    const response = await exports.default.fetch(`${testOrigin}/api/backup/restore`, {
      method: "POST",
      headers: new Headers([...headers, ["Content-Type", "application/json"]]),
      body: await exported.text(),
    });

    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(purge).toHaveBeenCalledWith([userId]));
  });
});

describe("公開設定の保存後の公開プロフィールのpurge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("一般公開を変えた保存の後に、本人の公開プロフィールをpurgeする", async () => {
    const { userId, headers } = await loginAsNewUser();
    const accountId = await createAccount(userId, { isPublic: false });
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");

    const response = await exports.default.fetch(`${testOrigin}/api/visibility`, {
      method: "PUT",
      headers: new Headers([...headers, ["Content-Type", "application/json"]]),
      body: JSON.stringify({ accounts: [{ externalAccountId: accountId, isPublic: true }], clients: [] }),
    });

    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(purge).toHaveBeenCalledWith([userId]));
    const profile = await exports.default.fetch(`${testOrigin}/profiles/${userId}`);
    expect(await profile.text()).toContain('rel="me"');
  });
});
