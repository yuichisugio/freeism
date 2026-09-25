import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createVerifiedUrlAccount, testDb, uniqueHost } from "../../../test/external-account-test-helpers";
import { loginAsNewUser } from "../../../test/oauth-client-test-helpers";
import { PublicProfileEntrypoint } from "../../public-profile";
import { externalAccounts, user } from "../db/schema";
import { isUserVisible } from "../usecases/profile/is-user-visible";

const origin = env.ACCOUNTS_ORIGIN;

// --------------------------------------------------
// テスト用の要求
// --------------------------------------------------

/**
 * 運営者（`appAdmin`）としてログインする。
 * 初回の任命と同じく、D1の`user.role`を`appAdmin`にしてからセッションを作る。
 */
async function loginAsAppAdmin() {
  const admin = await loginAsNewUser();
  await testDb.update(user).set({ role: "appAdmin" }).where(eq(user.id, admin.userId));
  return admin;
}

/**
 * Admin APIを呼ぶ。
 */
function callAdminApi(
  headers: Headers,
  path: string,
  { method = "POST", body }: { method?: "GET" | "POST"; body?: unknown } = {},
) {
  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  return exports.default.fetch(`${origin}/api/auth/admin${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * 一般公開した外部アカウントを持つユーザーを作ってログインする。
 */
async function createPublicUser() {
  const target = await loginAsNewUser();
  const url = `https://${uniqueHost()}/`;
  const { accountId } = await createVerifiedUrlAccount(target.userId, [url], "dns_txt", new Date());
  await testDb
    .update(externalAccounts)
    .set({ isPublic: true })
    .where(eq(externalAccounts.id, accountId));
  return { ...target, url };
}

// --------------------------------------------------
// テスト
// --------------------------------------------------

describe("appAdminの権限", () => {
  it("ユーザーの一覧・取得を実行できる", async () => {
    const { headers } = await loginAsAppAdmin();
    const target = await loginAsNewUser();

    const list = await callAdminApi(headers, "/list-users?limit=1", { method: "GET" });
    const detail = await callAdminApi(headers, `/get-user?id=${target.userId}`, { method: "GET" });

    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ id: target.userId });
  });

  it.each([
    ["/impersonate-user", (userId: string) => ({ userId })],
    ["/remove-user", (userId: string) => ({ userId })],
    ["/set-role", (userId: string) => ({ userId, role: "appAdmin" })],
    ["/create-user", () => ({ email: "new@example.com", name: "New" })],
    ["/update-user", (userId: string) => ({ userId, data: { name: "Changed" } })],
    ["/set-user-password", (userId: string) => ({ userId, newPassword: "password-12345" })],
    ["/list-user-sessions", (userId: string) => ({ userId })],
    ["/revoke-user-sessions", (userId: string) => ({ userId })],
  ])("%sは拒否する", async (path, createBody) => {
    const { headers } = await loginAsAppAdmin();
    const target = await loginAsNewUser();

    const response = await callAdminApi(headers, path, { body: createBody(target.userId) });

    expect(response.status).toBe(403);
    const [targetUser] = await testDb.select().from(user).where(eq(user.id, target.userId));
    expect(targetUser).toMatchObject({ name: "仮ユーザー", role: "user" });
  });

  it("appAdmin以外のユーザーは一覧・banを実行できない", async () => {
    const { headers } = await loginAsNewUser();
    const target = await loginAsNewUser();

    const list = await callAdminApi(headers, "/list-users", { method: "GET" });
    const ban = await callAdminApi(headers, "/ban-user", { body: { userId: target.userId } });

    expect(list.status).toBe(403);
    expect(ban.status).toBe(403);
  });
});

describe("ban・unban", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("banでセッションを失効させ、公開プロフィール・一覧と照合の対象から外し、purgeと監査を行う", async () => {
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");
    const log = vi.spyOn(console, "log");
    const { headers } = await loginAsAppAdmin();
    const target = await createPublicUser();

    const response = await callAdminApi(headers, "/ban-user", { body: { userId: target.userId } });

    expect(response.status).toBe(200);
    const me = await exports.default.fetch(`${origin}/api/me`, { headers: target.headers });
    expect(me.status).toBe(401);
    const profile = await exports.default.fetch(`${origin}/profiles/${target.userId}`);
    expect(profile.status).toBe(404);
    expect(await isUserVisible({ db: testDb }, { userId: target.userId })).toBe(false);
    await vi.waitFor(() => expect(purge).toHaveBeenCalledWith([target.userId]));
    expect(log.mock.calls.map(([line]) => String(line))).toContainEqual(
      expect.stringContaining('"event":"user_banned","outcome":"success"'),
    );
  });

  it("unbanで公開設定を変えずに公開プロフィールを戻し、purgeする", async () => {
    const { headers } = await loginAsAppAdmin();
    const target = await createPublicUser();
    await callAdminApi(headers, "/ban-user", { body: { userId: target.userId } });
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");

    const response = await callAdminApi(headers, "/unban-user", {
      body: { userId: target.userId },
    });

    expect(response.status).toBe(200);
    const profile = await exports.default.fetch(`${origin}/profiles/${target.userId}`);
    expect(profile.status).toBe(200);
    expect(await profile.text()).toContain(`<a href="${target.url}" rel="me">`);
    expect(await isUserVisible({ db: testDb }, { userId: target.userId })).toBe(true);
    await vi.waitFor(() => expect(purge).toHaveBeenCalledWith([target.userId]));
  });

  it("拒否されたbanは監査ログへ失敗として残し、purgeしない", async () => {
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");
    const warn = vi.spyOn(console, "warn");
    const { headers } = await loginAsNewUser();
    const target = await loginAsNewUser();

    await callAdminApi(headers, "/ban-user", { body: { userId: target.userId } });

    expect(warn.mock.calls.map(([line]) => String(line))).toContainEqual(
      expect.stringContaining('"event":"user_banned","outcome":"failure"'),
    );
    expect(purge).not.toHaveBeenCalled();
  });
});
