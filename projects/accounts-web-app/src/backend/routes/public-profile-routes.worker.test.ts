import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestUser,
  createVerifiedUrlAccount,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import { PublicProfileEntrypoint } from "../../public-profile";
import { createRandomId } from "../db/id";
import { externalAccounts, externalIdentifiers, user } from "../db/schema";
import { purgeProfileCache } from "../infrastructure/cache/profile-cache-purger";

const origin = env.ACCOUNTS_ORIGIN;

/**
 * 匿名で公開プロフィールを取得する（キャッシュ無効の入口から専用エントリーポイントへ渡る経路）。
 */
function fetchProfile(path: string, headers?: HeadersInit) {
  return exports.default.fetch(`${origin}${path}`, { headers, redirect: "manual" });
}

/**
 * 成功したDNS TXT証明で有効なURLを持つ外部アカウントを作り、一般公開を設定する。
 */
async function createAccount(userId: string, { isPublic }: { isPublic: boolean }) {
  const url = `https://${uniqueHost()}/`;
  const { accountId } = await createVerifiedUrlAccount(
    userId,
    [url],
    "dns_txt",
    new Date("2026-09-01T00:00:00.000Z"),
  );
  await testDb
    .update(externalAccounts)
    .set({ isPublic })
    .where(eq(externalAccounts.id, accountId));
  return { accountId, url };
}

/**
 * 公開プロフィールのキャッシュ指示を確認する。
 */
function expectCacheHeaders(response: Response) {
  expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
    "max-age=86400, must-revalidate",
  );
  expect(response.headers.get("Cache-Control")).toBe("public, no-cache");
  expect(response.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
}

describe("GET /profiles/{accountsUserId}", () => {
  it("一般公開した外部アカウントのURLをrel=\"me\"付きで返し、非公開の行と候補は含めない", async () => {
    const userId = await createTestUser();
    const publicAccount = await createAccount(userId, { isPublic: true });
    const privateAccount = await createAccount(userId, { isPublic: false });
    const candidateUrl = `https://${uniqueHost()}/`;
    await testDb.insert(externalIdentifiers).values({
      id: createRandomId("eid_"),
      accountId: publicAccount.accountId,
      userId,
      kind: "url",
      value: candidateUrl,
      host: new URL(candidateUrl).hostname,
    });

    const response = await fetchProfile(`/profiles/${userId}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expectCacheHeaders(response);
    expect(response.headers.get("ETag")).toBeTruthy();
    expect(html).toContain(`<a href="${publicAccount.url}" rel="me">`);
    expect(html).toContain('<span class="badge">DNS TXT</span>');
    expect(html).toContain(`<code>${userId}</code>`);
    expect(html).not.toContain(privateAccount.url);
    expect(html).not.toContain(candidateUrl);
  });

  it("公開する外部アカウントが0件でも200でプロフィールを返す", async () => {
    const userId = await createTestUser();
    await createAccount(userId, { isPublic: false });

    const response = await fetchProfile(`/profiles/${userId}`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<h1>仮ユーザー</h1>");
  });

  it("ETagが一致する再取得は304を返す", async () => {
    const userId = await createTestUser();
    const first = await fetchProfile(`/profiles/${userId}`);

    const second = await fetchProfile(`/profiles/${userId}`, {
      "If-None-Match": first.headers.get("ETag") ?? "",
    });

    expect(second.status).toBe(304);
  });

  it("存在しないユーザーとbanされたユーザーは、同じキャッシュ指示の404を返す", async () => {
    const bannedUserId = await createTestUser();
    await createAccount(bannedUserId, { isPublic: true });
    await testDb.update(user).set({ banned: true }).where(eq(user.id, bannedUserId));

    for (const userId of [createRandomId("ausr_"), bannedUserId]) {
      const response = await fetchProfile(`/profiles/${userId}`);

      expect(response.status).toBe(404);
      expectCacheHeaders(response);
      expect(await response.text()).toContain("Profile not found");
    }
  });

  it("末尾slash付きのURLは正規のプロフィールURLへ転送する", async () => {
    const userId = await createTestUser();

    const response = await fetchProfile(`/profiles/${userId}/`);

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(`${origin}/profiles/${userId}`);
  });
});

describe("purgeProfileCache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("重複を除いたユーザーを、公開プロフィール専用エントリーポイントへ1回で渡す", async () => {
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");

    purgeProfileCache(["ausr_a", "ausr_b", "ausr_a"]);

    await vi.waitFor(() => expect(purge).toHaveBeenCalledTimes(1));
    expect(purge).toHaveBeenCalledWith(["ausr_a", "ausr_b"]);
  });

  it("purgeが受け付けられなかった場合は、失敗を監査ログへ残す", async () => {
    vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles").mockResolvedValue({
      success: false,
      errors: [{ code: 1134, message: "rate limited" }],
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    purgeProfileCache(["ausr_a"]);

    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({
      event: "profile_purge",
      outcome: "failure",
      errorCategory: "1134",
      count: 1,
    });
  });
});
