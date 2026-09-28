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
import {
  externalAccounts,
  externalAccountVerifications,
  externalIdentifiers,
  user,
} from "../db/schema";
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
  const host = uniqueHost();
  const url = `https://${host}/`;
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
  return { accountId, url, host };
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
  it("一般公開した証明済みの外部アカウントをrel=\"me\"付きの新しいタブのリンクで返し、表示名とIDを表示し、非公開の行・候補・外部アカウントの表示名・メールアドレスは含めない", async () => {
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

    await testDb
      .update(externalAccounts)
      .set({ displayName: "外部の表示名", email: "external@example.com" })
      .where(eq(externalAccounts.id, publicAccount.accountId));

    const response = await fetchProfile(`/profiles/${userId}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expectCacheHeaders(response);
    expect(response.headers.get("ETag")).toBeTruthy();
    expect(html).toContain(`<a href="${publicAccount.url}" rel="me noopener" target="_blank">Web：${publicAccount.host}</a>`);
    expect(html).toContain("証明方法: DNS TXT");
    expect(html).toContain(`<h1>仮ユーザー</h1><span class="mono">${userId}</span>`);
    expect(html).not.toContain("外部の表示名");
    expect(html).not.toContain("external@example.com");
    expect(html).not.toContain(privateAccount.url);
    expect(html).not.toContain(candidateUrl);
  });

  it("証明日時は現在有効な証明のうち最も古い日時にし、成功していない試行は数えない", async () => {
    const userId = await createTestUser();
    const { accountId, url } = await createAccount(userId, { isPublic: true });
    await testDb.insert(externalAccountVerifications).values([
      {
        id: createRandomId("evf_"),
        accountId,
        method: "bidirectional_link",
        evidenceKey: url,
        verifiedAt: new Date("2026-08-15T12:34:56.000Z"),
        checkedAt: new Date("2026-09-10T00:00:00.000Z"),
        result: "not_verified",
      },
      {
        id: createRandomId("evf_"),
        accountId,
        method: "oauth",
        evidenceKey: "auth-account",
        verifiedAt: null,
        checkedAt: new Date("2026-07-01T00:00:00.000Z"),
        result: "not_verified",
      },
    ]);

    const html = await (await fetchProfile(`/profiles/${userId}`)).text();

    expect(html).toContain("証明方法: 双方向リンク・DNS TXT");
    expect(html).toContain(
      '証明日時: <time datetime="2026-08-15T12:34:56.000Z">2026/08/15 12:34 (UTC)</time>',
    );
  });

  it("?lang=enでは英語だけの文言と<html lang=\"en\">で返す", async () => {
    const userId = await createTestUser();
    const { url, host } = await createAccount(userId, { isPublic: true });

    const response = await fetchProfile(`/profiles/${userId}?lang=en`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<h2>Verified external accounts</h2>");
    expect(html).toContain(`<a href="${url}" rel="me noopener" target="_blank">Web: ${host}</a>`);
    expect(html).toContain("Method: DNS TXT");
    expect(html).toContain("Verified: <time");
    expect(html).not.toContain("証明済みのアカウント");
  });

  it("langが無い・未知の値は日本語で返し、両言語のalternateリンクを付ける", async () => {
    const userId = await createTestUser();
    await createAccount(userId, { isPublic: true });

    for (const query of ["", "?lang=fr"]) {
      const html = await (await fetchProfile(`/profiles/${userId}${query}`)).text();

      expect(html).toContain('<html lang="ja">');
      expect(html).toContain("<h2>証明済みのアカウント</h2>");
      for (const language of ["ja", "en"]) {
        const href = `${origin}/profiles/${userId}?lang=${language}`;
        expect(html).toContain(`<link rel="alternate" hreflang="${language}" href="${href}"/>`);
      }
    }
  });

  it("CSPで同じoriginとfaviconの配信元の画像だけを許可する", async () => {
    const userId = await createTestUser();
    await createAccount(userId, { isPublic: true });

    const response = await fetchProfile(`/profiles/${userId}`);

    const contentSecurityPolicy = response.headers.get("Content-Security-Policy") ?? "";
    expect(contentSecurityPolicy).toContain("default-src 'none'");
    expect(contentSecurityPolicy).toContain(
      "img-src 'self' https://www.google.com https://*.gstatic.com",
    );
  });

  it("一般公開した証明済みの外部アカウントが0件なら、存在しないユーザーと同じ404を返す", async () => {
    const userId = await createTestUser();
    await createAccount(userId, { isPublic: false });
    const candidateOnly = createRandomId("eac_");
    await testDb.insert(externalAccounts).values({ id: candidateOnly, userId, isPublic: true });
    const candidateUrl = `https://${uniqueHost()}/`;
    await testDb.insert(externalIdentifiers).values({
      id: createRandomId("eid_"),
      accountId: candidateOnly,
      userId,
      kind: "url",
      value: candidateUrl,
      host: new URL(candidateUrl).hostname,
    });

    const response = await fetchProfile(`/profiles/${userId}`);
    const html = await response.text();

    expect(response.status).toBe(404);
    expectCacheHeaders(response);
    expect(html).toContain("<h1>このプロフィールは存在しません</h1>");
    expect(html).not.toContain(candidateUrl);
  });

  it("ETagが一致する再取得は304を返す", async () => {
    const userId = await createTestUser();
    await createAccount(userId, { isPublic: true });
    const first = await fetchProfile(`/profiles/${userId}`);

    const second = await fetchProfile(`/profiles/${userId}`, {
      "If-None-Match": first.headers.get("ETag") ?? "",
    });

    expect(second.status).toBe(304);
  });

  it("存在しないユーザーとbanされたユーザーは、同じキャッシュ指示の404を言語ごとに返す", async () => {
    const bannedUserId = await createTestUser();
    await createAccount(bannedUserId, { isPublic: true });
    await testDb.update(user).set({ banned: true }).where(eq(user.id, bannedUserId));

    for (const userId of [createRandomId("ausr_"), bannedUserId]) {
      const response = await fetchProfile(`/profiles/${userId}`);
      const english = await fetchProfile(`/profiles/${userId}?lang=en`);

      expect(response.status).toBe(404);
      expectCacheHeaders(response);
      expect(await response.text()).toContain("<h1>このプロフィールは存在しません</h1>");
      expect(english.status).toBe(404);
      expect(await english.text()).toContain("<h1>Profile not found</h1>");
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
