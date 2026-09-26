import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createTestUser,
  createVerifiedUrlAccount,
  fillUrlIdentifiers,
  readExternalAccounts,
  readIdentifierActivity,
  readVerifications,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import { urlIdentifierLimitPerUser } from "../../shared/constants";
import { createRandomId } from "../db/id";
import {
  externalAccounts,
  externalAccountVerifications,
  externalIdentifiers,
  verificationIdentifiers,
} from "../db/schema";
import {
  createMockServer,
  type MockPageHandler,
} from "../infrastructure/verification/mock-page-server";
import { createSafePageFetcher } from "../infrastructure/verification/safe-page-fetcher";
import type { ResolveTxt } from "../infrastructure/verification/verify-dns-txt-evidence";
import { ProblemError } from "../problem-details";
import { saveUnverifiedUrl } from "./save-unverified-url";
import { verifyUrl, type VerifyUrlDeps, type VerifyUrlOutput } from "./verify-url";

const accountsOrigin = "https://accounts.freeism.app";
const firstCheck = new Date("2026-09-20T00:00:00.000Z");
const now = new Date("2026-09-26T00:00:00.000Z");

// --------------------------------------------------
// テスト用の外部通信
// --------------------------------------------------

/**
 * 公開プロフィールURLへのリンクを持つHTMLを返す処理を作る。
 */
function linkPage(accountsUserId: string): MockPageHandler {
  return () =>
    new Response(`<a rel="me" href="${accountsOrigin}/profiles/${accountsUserId}">Accounts</a>`, {
      headers: { "content-type": "text/html" },
    });
}

/**
 * リンクを持たないHTMLを返す処理。
 */
const pageWithoutLink: MockPageHandler = () =>
  new Response("<p>no link</p>", { headers: { "content-type": "text/html" } });

/**
 * 公開プロフィールURLのTXTだけを返すDNS照会を作る。
 */
function txtRecords(accountsUserId: string): ResolveTxt {
  return async () => [[`${accountsOrigin}/profiles/${accountsUserId}`]];
}

/**
 * NXDOMAINを返すDNS照会。
 */
const txtNotFound: ResolveTxt = async () => {
  throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
};

/**
 * モックの外部ページ・DNSと、上限に掛からないレート制限でユースケースの依存を作る。
 * `requests`は外部ページへの要求の記録。
 */
function createDeps(
  pages: Record<string, MockPageHandler>,
  resolveTxt: ResolveTxt = txtNotFound,
  { rateLimited = false, checkedAt = now } = {},
) {
  const server = createMockServer(pages);
  const deps: VerifyUrlDeps = {
    db: testDb,
    now: checkedAt,
    accountsOrigin,
    pageFetcher: createSafePageFetcher({ accountsOrigin, fetch: server.fetch }),
    dnsTxtLookup: { resolveTxt },
    rateLimiter: { limit: async () => ({ success: !rateLimited }) },
  };
  return { deps, requests: server.requests };
}

/**
 * 検証結果から登録した外部アカウント行のIDを読む。
 * 未登録の結果は、登録を期待するテストの失敗にする。
 */
function savedAccountId(result: VerifyUrlOutput): string {
  if (result.externalAccountId === null) {
    throw new Error("The URL was not registered.");
  }
  return result.externalAccountId;
}

// --------------------------------------------------
// テスト
// --------------------------------------------------

describe("verifyUrl", () => {
  it("未登録URLのリンク証明が成功すると、入力URLを登録して有効な紐付けにする", async () => {
    const userId = await createTestUser();
    const url = `https://${uniqueHost()}/about`;
    const { deps } = createDeps({ [url]: linkPage(userId) });

    const result = await verifyUrl(deps, { userId, url });

    expect(result).toMatchObject({
      status: "verified",
      link: { result: "verified", failureCode: null, evidenceUrl: url },
      dns: null,
      affectedUserIds: [userId],
    });
    expect(await readIdentifierActivity(userId)).toEqual({ [`url:${url}`]: true });
    expect(await readExternalAccounts(userId)).toEqual([
      expect.objectContaining({ id: savedAccountId(result), service: null, linkedAt: now }),
    ]);
    expect(await readVerifications(savedAccountId(result))).toEqual([
      expect.objectContaining({
        method: "bidirectional_link",
        evidenceKey: url,
        evidenceUrl: url,
        verifiedAt: now,
        checkedAt: now,
        result: "verified",
        failureCode: null,
        coveredValues: [url],
      }),
    ]);
  });

  it("プロフィールURLのリンク証明では、最終取得URLのユーザー名・プロフィールURLにも同じ証明を適用する", async () => {
    const userId = await createTestUser();
    const suffix = uniqueHost().slice(0, 8);
    const oldUrl = `https://github.com/old-${suffix}`;
    const newUrl = `https://github.com/New-${suffix}`;
    const { deps } = createDeps({
      [oldUrl]: () => new Response(null, { status: 301, headers: { location: newUrl } }),
      [newUrl]: linkPage(userId),
    });

    const result = await verifyUrl(deps, { userId, url: oldUrl });

    expect(result.link).toEqual({ result: "verified", failureCode: null, evidenceUrl: newUrl });
    expect(await readIdentifierActivity(userId)).toEqual({
      [`url:${oldUrl}`]: true,
      [`provider_username:old-${suffix}`]: false,
      [`provider_username:new-${suffix}`]: true,
      [`url:${newUrl}`]: true,
    });
    expect(await readVerifications(savedAccountId(result))).toEqual([
      expect.objectContaining({
        evidenceKey: oldUrl,
        evidenceUrl: newUrl,
        coveredValues: [`new-${suffix}`, newUrl, oldUrl].sort(),
      }),
    ]);
    expect(await readExternalAccounts(userId)).toEqual([
      expect.objectContaining({ service: "github" }),
    ]);
  });

  it("コンテンツURLのリンク証明は入力URL単独に適用する", async () => {
    const userId = await createTestUser();
    const url = `https://github.com/alice-${uniqueHost().slice(0, 8)}/repository`;
    const { deps } = createDeps({ [url]: linkPage(userId) });

    await verifyUrl(deps, { userId, url });

    expect(await readIdentifierActivity(userId)).toEqual({ [`url:${url}`]: true });
  });

  it("リンクが不一致ならDNS TXTを確認し、同じhostの登録済みURLへ外部アカウントを統合せずに証明を作る", async () => {
    const userId = await createTestUser();
    const host = uniqueHost();
    const registeredUrl = `https://${host}/`;
    const url = `https://${host}/about`;
    const registered = await saveUnverifiedUrl({ db: testDb }, { userId, url: registeredUrl });
    const { deps } = createDeps({ [url]: pageWithoutLink }, txtRecords(userId));

    const result = await verifyUrl(deps, { userId, url });

    expect(result).toMatchObject({
      status: "verified",
      link: { result: "not_verified", failureCode: "LINK_NOT_FOUND", evidenceUrl: null },
      dns: { result: "verified", failureCode: null },
    });
    expect(result.externalAccountId).not.toBe(registered.externalAccountId);
    expect(await readIdentifierActivity(userId)).toEqual({
      [`url:${registeredUrl}`]: true,
      [`url:${url}`]: true,
    });
    expect(await readVerifications(savedAccountId(result))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "bidirectional_link",
          verifiedAt: null,
          result: "not_verified",
          failureCode: "LINK_NOT_FOUND",
          coveredValues: [],
        }),
        expect.objectContaining({
          method: "dns_txt",
          evidenceKey: host,
          verifiedAt: now,
          coveredValues: [url],
        }),
      ]),
    );
    expect(await readVerifications(registered.externalAccountId)).toEqual([
      expect.objectContaining({ method: "dns_txt", evidenceKey: host, coveredValues: [registeredUrl] }),
    ]);
  });

  it("未登録URLのリンクとDNS TXTの両方が不成立なら、登録せずに方法別の結果だけを返す", async () => {
    const userId = await createTestUser();
    const url = `https://${uniqueHost()}/`;
    const { deps } = createDeps({});

    const result = await verifyUrl(deps, { userId, url });

    expect(result).toEqual({
      externalAccountId: null,
      status: "unverified",
      link: { result: "not_verified", failureCode: "PAGE_NOT_FOUND", evidenceUrl: null },
      dns: { result: "not_verified", failureCode: "TXT_NOT_FOUND" },
      affectedUserIds: [],
    });
    expect(await readExternalAccounts(userId)).toEqual([]);
    expect(await readIdentifierActivity(userId)).toEqual({});
  });

  it("未検証で登録済みのURLの検証が不成立なら、登録を維持して方法別の直近結果を保存する", async () => {
    const userId = await createTestUser();
    const url = `https://${uniqueHost()}/`;
    const saved = await saveUnverifiedUrl({ db: testDb }, { userId, url });
    const { deps } = createDeps({});

    const result = await verifyUrl(deps, { userId, url });

    expect(result).toMatchObject({
      externalAccountId: saved.externalAccountId,
      status: "unverified",
      link: { result: "not_verified", failureCode: "PAGE_NOT_FOUND" },
      dns: { result: "not_verified", failureCode: "TXT_NOT_FOUND" },
    });
    expect(await readIdentifierActivity(userId)).toEqual({ [`url:${url}`]: false });
    expect(await readVerifications(saved.externalAccountId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "bidirectional_link",
          verifiedAt: null,
          checkedAt: now,
          result: "not_verified",
          failureCode: "PAGE_NOT_FOUND",
        }),
        expect.objectContaining({
          method: "dns_txt",
          verifiedAt: null,
          checkedAt: now,
          result: "not_verified",
          failureCode: "TXT_NOT_FOUND",
        }),
      ]),
    );
  });

  it("再検証が失敗しても、既存の成功証明の対象と日時、有効な紐付けを維持する", async () => {
    const userId = await createTestUser();
    const url = `https://${uniqueHost()}/`;
    const first = createDeps({ [url]: linkPage(userId) }, txtNotFound, { checkedAt: firstCheck });
    await verifyUrl(first.deps, { userId, url });

    const { deps } = createDeps({ [url]: pageWithoutLink });
    const result = await verifyUrl(deps, { userId, url });

    expect(result).toMatchObject({
      status: "verified",
      link: { result: "not_verified", failureCode: "LINK_NOT_FOUND" },
    });
    expect(await readIdentifierActivity(userId)).toEqual({ [`url:${url}`]: true });
    expect(await readVerifications(savedAccountId(result))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "bidirectional_link",
          verifiedAt: firstCheck,
          checkedAt: now,
          result: "not_verified",
          failureCode: "LINK_NOT_FOUND",
          coveredValues: [url],
        }),
      ]),
    );
  });

  it("異なるAccountsユーザーのURLが併存するページは判断不能とし、DNS TXTへ進む", async () => {
    const userId = await createTestUser();
    const url = `https://${uniqueHost()}/`;
    const { deps } = createDeps({
      [url]: () =>
        new Response(
          `<p>${accountsOrigin}/profiles/${userId}</p><pre>${accountsOrigin}/profiles/ausr_other</pre>`,
          { headers: { "content-type": "text/html" } },
        ),
    });

    const result = await verifyUrl(deps, { userId, url });

    expect(result).toMatchObject({
      externalAccountId: null,
      status: "unverified",
      link: { result: "indeterminate", failureCode: "MULTIPLE_ACCOUNTS_PROFILES" },
      dns: { result: "not_verified", failureCode: "TXT_NOT_FOUND" },
    });
  });

  describe("他ユーザーが有効に保持するURL", () => {
    it("リンク証明だけが支える識別子は、リンク証明の成功で本人へ移動する", async () => {
      const previousOwner = await createTestUser();
      const host = uniqueHost();
      const url = `https://${host}/`;
      const otherUrl = `https://${host}/other`;
      await createVerifiedUrlAccount(previousOwner, [url, otherUrl], "bidirectional_link", firstCheck);
      const userId = await createTestUser();
      const { deps } = createDeps({ [url]: linkPage(userId) });

      const result = await verifyUrl(deps, { userId, url });

      expect(result).toMatchObject({
        status: "verified",
        affectedUserIds: [userId, previousOwner],
      });
      expect(await readIdentifierActivity(userId)).toEqual({ [`url:${url}`]: true });
      expect(await readIdentifierActivity(previousOwner)).toEqual({ [`url:${otherUrl}`]: true });
    });

    it("DNS TXTが支える識別子は、リンク証明単独では移動せずHELD_BY_STRONGER_PROOFとする", async () => {
      const previousOwner = await createTestUser();
      const url = `https://${uniqueHost()}/`;
      await createVerifiedUrlAccount(previousOwner, [url], "dns_txt", firstCheck);
      const userId = await createTestUser();
      const saved = await saveUnverifiedUrl({ db: testDb }, { userId, url });
      const { deps } = createDeps({ [url]: linkPage(userId) });

      const result = await verifyUrl(deps, { userId, url });

      expect(result).toMatchObject({
        status: "unverified",
        link: { result: "indeterminate", failureCode: "HELD_BY_STRONGER_PROOF", evidenceUrl: null },
        dns: { result: "not_verified", failureCode: "TXT_NOT_FOUND" },
        affectedUserIds: [userId],
      });
      expect(await readIdentifierActivity(userId)).toEqual({ [`url:${url}`]: false });
      expect(await readIdentifierActivity(previousOwner)).toEqual({ [`url:${url}`]: true });
      expect(await readVerifications(saved.externalAccountId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: "bidirectional_link",
            verifiedAt: null,
            result: "indeterminate",
            failureCode: "HELD_BY_STRONGER_PROOF",
          }),
        ]),
      );
    });

    it("対象の一部だけがOAuthに支えられている場合も、リンク証明全体をHELD_BY_STRONGER_PROOFとし所有を変更しない", async () => {
      const previousOwner = await createTestUser();
      const username = `held-${uniqueHost().slice(0, 8)}`;
      const url = `https://github.com/${username}`;
      const heldAccountId = createRandomId("eac_");
      const heldIdentifierId = createRandomId("eid_");
      const oauthVerificationId = createRandomId("evf_");
      await testDb.insert(externalAccounts).values({ id: heldAccountId, userId: previousOwner });
      await testDb.insert(externalIdentifiers).values({
        id: heldIdentifierId,
        accountId: heldAccountId,
        userId: previousOwner,
        kind: "provider_username",
        provider: "github",
        value: username,
        isActive: true,
      });
      await testDb.insert(externalAccountVerifications).values({
        id: oauthVerificationId,
        accountId: heldAccountId,
        method: "oauth",
        evidenceKey: createRandomId(),
        verifiedAt: firstCheck,
        checkedAt: firstCheck,
        result: "verified",
      });
      await testDb
        .insert(verificationIdentifiers)
        .values({ verificationId: oauthVerificationId, identifierId: heldIdentifierId });
      const userId = await createTestUser();
      const { deps } = createDeps({ [url]: linkPage(userId) });

      const result = await verifyUrl(deps, { userId, url });

      expect(result).toMatchObject({
        externalAccountId: null,
        status: "unverified",
        link: { result: "indeterminate", failureCode: "HELD_BY_STRONGER_PROOF" },
      });
      expect(await readIdentifierActivity(userId)).toEqual({});
      expect(await readIdentifierActivity(previousOwner)).toEqual({
        [`provider_username:${username}`]: true,
      });
    });

    it("リンク証明で移動できない識別子も、同じ要求のDNS TXTの成功で本人へ移動する", async () => {
      const previousOwner = await createTestUser();
      const url = `https://${uniqueHost()}/`;
      await createVerifiedUrlAccount(previousOwner, [url], "dns_txt", firstCheck);
      const userId = await createTestUser();
      const { deps } = createDeps({ [url]: linkPage(userId) }, txtRecords(userId));

      const result = await verifyUrl(deps, { userId, url });

      expect(result).toMatchObject({
        status: "verified",
        link: { result: "indeterminate", failureCode: "HELD_BY_STRONGER_PROOF" },
        dns: { result: "verified", failureCode: null },
        affectedUserIds: [userId, previousOwner],
      });
      expect(await readIdentifierActivity(userId)).toEqual({ [`url:${url}`]: true });
      expect(await readIdentifierActivity(previousOwner)).toEqual({});
    });
  });

  describe("復元した候補の再証明", () => {
    /**
     * JSONの`service`・`displayName`を持つ、復元した候補行を作る。
     */
    async function createRestoredCandidate(userId: string, url: string) {
      const { externalAccountId } = await saveUnverifiedUrl({ db: testDb }, { userId, url });
      await testDb
        .update(externalAccounts)
        .set({ service: "github", displayName: "JSON名" })
        .where(eq(externalAccounts.id, externalAccountId));
      return externalAccountId;
    }

    it("リンク証明で有効にすると、サービス種別を判定し直し、JSONの表示名を採用しない", async () => {
      const userId = await createTestUser();
      const url = `https://${uniqueHost()}/`;
      const externalAccountId = await createRestoredCandidate(userId, url);
      const { deps } = createDeps({ [url]: linkPage(userId) });

      await verifyUrl(deps, { userId, url });

      expect(await readExternalAccounts(userId)).toEqual([
        expect.objectContaining({ id: externalAccountId, service: null, displayName: null }),
      ]);
    });

    it("DNS TXTで有効にすると、同じhostの登録済みの行もサービス種別を判定し直し、JSONの表示名を採用しない", async () => {
      const userId = await createTestUser();
      const host = uniqueHost();
      const registeredUrl = `https://${host}/`;
      const url = `https://${host}/about`;
      await createRestoredCandidate(userId, registeredUrl);
      await createRestoredCandidate(userId, url);
      const { deps } = createDeps({ [url]: pageWithoutLink }, txtRecords(userId));

      await verifyUrl(deps, { userId, url });

      expect(await readExternalAccounts(userId)).toEqual([
        expect.objectContaining({ service: null, displayName: null }),
        expect.objectContaining({ service: null, displayName: null }),
      ]);
    });

    it("すでに有効になった行を再検証しても、表示名を変更しない", async () => {
      const userId = await createTestUser();
      const url = `https://${uniqueHost()}/`;
      const verified = await createVerifiedUrlAccount(userId, [url], "bidirectional_link", firstCheck);
      await testDb
        .update(externalAccounts)
        .set({ displayName: "Alice" })
        .where(eq(externalAccounts.id, verified.accountId));
      const { deps } = createDeps({ [url]: linkPage(userId) });

      await verifyUrl(deps, { userId, url });

      expect(await readExternalAccounts(userId)).toEqual([
        expect.objectContaining({ id: verified.accountId, displayName: "Alice" }),
      ]);
    });
  });

  describe("取得前の拒否", () => {
    it("本人のURLが上限に達していれば、未登録URLは外部通信の前に409で拒否する", async () => {
      const userId = await createTestUser();
      await fillUrlIdentifiers(userId, urlIdentifierLimitPerUser);
      const url = `https://${uniqueHost()}/`;
      const { deps, requests } = createDeps({ [url]: linkPage(userId) }, txtNotFound, {
        rateLimited: true,
      });

      await expect(verifyUrl(deps, { userId, url })).rejects.toMatchObject({
        status: 409,
        code: "URL_LIMIT_REACHED",
      });
      expect(requests).toEqual([]);
      expect(await readIdentifierActivity(userId)).not.toHaveProperty(`url:${url}`);
    });

    it("本人のURLが上限に達していても、登録済みURLは再検証できる", async () => {
      const userId = await createTestUser();
      await fillUrlIdentifiers(userId, urlIdentifierLimitPerUser - 1);
      const url = `https://${uniqueHost()}/`;
      await saveUnverifiedUrl({ db: testDb }, { userId, url });
      const { deps } = createDeps({ [url]: linkPage(userId) });

      await expect(verifyUrl(deps, { userId, url })).resolves.toMatchObject({
        status: "verified",
      });
    });

    it("レート制限を超えた要求は、外部通信の前に429で拒否する", async () => {
      const userId = await createTestUser();
      const url = `https://${uniqueHost()}/`;
      const { deps, requests } = createDeps({ [url]: linkPage(userId) }, txtNotFound, {
        rateLimited: true,
      });

      await expect(verifyUrl(deps, { userId, url })).rejects.toMatchObject({
        status: 429,
        code: "RATE_LIMITED",
      });
      expect(requests).toEqual([]);
      expect(await readExternalAccounts(userId)).toEqual([]);
    });

    it("入力URLの不備はurlの入力エラーにする", async () => {
      const userId = await createTestUser();
      const { deps } = createDeps({});

      const error = await verifyUrl(deps, { userId, url: "http://example.com/" }).catch(
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(ProblemError);
      expect(error).toMatchObject({
        status: 400,
        code: "UNSUPPORTED_SCHEME",
        issues: [{ code: "UNSUPPORTED_SCHEME", path: ["url"] }],
      });
    });
  });
});
