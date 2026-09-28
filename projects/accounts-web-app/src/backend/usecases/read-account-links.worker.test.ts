import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createUnsignedIdToken, getTestAuthContext } from "../../../test/auth-test-helpers";
import {
  createTestUser,
  createVerifiedUrlAccount,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import { createRandomId } from "../db/id";
import {
  clientConsents,
  externalAccounts,
  externalAccountVerifications,
  externalAccountVisibility,
  oauthClient,
} from "../db/schema";
import { createMockServer } from "../infrastructure/verification/mock-page-server";
import { createSafePageFetcher } from "../infrastructure/verification/safe-page-fetcher";
import { readAccountLinks } from "./read-account-links";
import { saveUnverifiedUrl } from "./save-unverified-url";
import { verifyUrl } from "./verify-url";

const accountsOrigin = "https://accounts.freeism.app";
const verifiedAt = new Date("2026-09-20T00:00:00.000Z");
const checkedAt = new Date("2026-09-26T00:00:00.000Z");

/**
 * OAuthクライアントを標準表へ直接作る。
 */
async function createClient(name: string, { disabled = false } = {}) {
  const clientId = createRandomId("client-");
  await testDb.insert(oauthClient).values({
    id: createRandomId(),
    clientId,
    name,
    uri: `https://${uniqueHost()}/`,
    disabled,
    redirectUris: ["https://client.example.com/callback"],
  });
  return clientId;
}

describe("readAccountLinks", () => {
  it("本人の外部アカウントを、識別子・方法別の証明・公開選択とともに返す", async () => {
    const userId = await createTestUser();
    const url = `https://${uniqueHost()}/`;
    const verified = await createVerifiedUrlAccount(userId, [url], "bidirectional_link", verifiedAt);
    const clientId = await createClient("Points");
    await testDb
      .update(externalAccounts)
      .set({ isPublic: true, importedVerificationsJson: "[]" })
      .where(eq(externalAccounts.id, verified.accountId));
    await testDb
      .insert(externalAccountVisibility)
      .values({ accountId: verified.accountId, clientId, isPublic: true });
    const candidate = await saveUnverifiedUrl(
      { db: testDb },
      { userId, url: `https://${uniqueHost()}/` },
    );
    await testDb
      .update(externalAccounts)
      .set({ importedVerificationsJson: "[]" })
      .where(eq(externalAccounts.id, candidate.externalAccountId));

    const links = await readAccountLinks({ db: testDb, accountsOrigin }, { userId });

    expect(links.profileUrl).toBe(`${accountsOrigin}/profiles/${userId}`);
    expect(links.accounts).toEqual([
      {
        id: verified.accountId,
        service: null,
        displayName: null,
        email: null,
        linkedAt: verifiedAt.toISOString(),
        isPublic: true,
        verificationStatus: "verified",
        identifiers: [
          { id: expect.any(String), type: "url", provider: null, value: url, isActive: true },
        ],
        verifications: [
          {
            id: verified.verificationId,
            method: "bidirectional_link",
            verifiedAt: verifiedAt.toISOString(),
            evidence: null,
            identifiers: [
              { id: expect.any(String), type: "url", provider: null, value: url, isActive: true },
            ],
          },
        ],
        latestAttempt: null,
        primaryUrl: url,
        visibility: { [clientId]: true },
        // 取り込んだ証明情報があっても、有効な識別子がある行は再証明待ちとして示さない。
        hasImportedVerifications: false,
      },
      expect.objectContaining({
        id: candidate.externalAccountId,
        linkedAt: null,
        verificationStatus: "unverified",
        hasImportedVerifications: true,
      }),
    ]);
  });

  it("成功した証明ごとに方法・証明日時・証拠・確認した識別子を返し、失敗した試行は含めない", async () => {
    const context = await getTestAuthContext();
    const { id: userId } = await context.test.saveUser(context.test.createUser());
    const subject = createRandomId("google-");
    await context.internalAdapter.createAccount({
      userId,
      providerId: "google",
      accountId: subject,
      idToken: createUnsignedIdToken({ sub: subject, name: "Google" }),
    });
    const linkUrl = `https://${uniqueHost()}/`;
    const link = await createVerifiedUrlAccount(userId, [linkUrl], "bidirectional_link", verifiedAt);
    await testDb
      .update(externalAccountVerifications)
      .set({ evidenceUrl: `${linkUrl}about` })
      .where(eq(externalAccountVerifications.id, link.verificationId));
    // 証明済みの行に、後日の失敗した試行を加える。
    await testDb.insert(externalAccountVerifications).values({
      id: createRandomId("evf_"),
      accountId: link.accountId,
      method: "dns_txt",
      evidenceKey: new URL(linkUrl).hostname,
      checkedAt,
      result: "not_verified",
      failureCode: "TXT_NOT_FOUND",
    });
    const dnsHost = uniqueHost();
    const dns = await createVerifiedUrlAccount(
      userId,
      [`https://${dnsHost}/`],
      "dns_txt",
      verifiedAt,
    );

    const { accounts } = await readAccountLinks({ db: testDb, accountsOrigin }, { userId });

    const oauthAccount = accounts.find((row) => row.service === "google");
    expect(oauthAccount).toMatchObject({
      verificationStatus: "verified",
      verifications: [
        {
          method: "oauth",
          evidence: null,
          identifiers: [expect.objectContaining({ type: "provider_account", value: subject })],
        },
      ],
      latestAttempt: null,
      primaryUrl: null,
    });
    expect(accounts.find((row) => row.id === link.accountId)).toMatchObject({
      verifications: [
        { id: link.verificationId, method: "bidirectional_link", evidence: `${linkUrl}about` },
      ],
      latestAttempt: null,
    });
    expect(accounts.find((row) => row.id === dns.accountId)).toMatchObject({
      verifications: [
        {
          id: dns.verificationId,
          method: "dns_txt",
          verifiedAt: verifiedAt.toISOString(),
          evidence: `_accounts.${dnsHost}`,
          identifiers: [expect.objectContaining({ value: `https://${dnsHost}/` })],
        },
      ],
    });
  });

  it("未検証の行には直近の試行を返し、試行の無い行はnullにする", async () => {
    const userId = await createTestUser();
    const retriedUrl = `https://${uniqueHost()}/`;
    const retried = await saveUnverifiedUrl({ db: testDb }, { userId, url: retriedUrl });
    const untriedUrl = `https://${uniqueHost()}/`;
    const untried = await saveUnverifiedUrl({ db: testDb }, { userId, url: untriedUrl });
    // 行のURLで再検証する（ページにリンクが無く、DNS TXTも無い）。
    const server = createMockServer({
      [retriedUrl]: () =>
        new Response("<p>no link</p>", { headers: { "content-type": "text/html" } }),
    });
    for (const now of [verifiedAt, checkedAt]) {
      await verifyUrl(
        {
          db: testDb,
          now,
          accountsOrigin,
          pageFetcher: createSafePageFetcher({ accountsOrigin, fetch: server.fetch }),
          dnsTxtLookup: {
            resolveTxt: async () => {
              throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
            },
          },
          rateLimiter: { limit: async () => ({ success: true }) },
        },
        { userId, url: retriedUrl },
      );
    }

    const { accounts } = await readAccountLinks({ db: testDb, accountsOrigin }, { userId });

    // 同じ要求のリンクとDNS TXTの試行は、先に確かめるリンクの結果を示す。
    expect(accounts.find((row) => row.id === retried.externalAccountId)).toMatchObject({
      verificationStatus: "unverified",
      verifications: [],
      latestAttempt: {
        checkedAt: checkedAt.toISOString(),
        result: "not_verified",
        failureCode: "LINK_NOT_FOUND",
      },
      primaryUrl: retriedUrl,
    });
    expect(accounts.find((row) => row.id === untried.externalAccountId)).toMatchObject({
      verifications: [],
      latestAttempt: null,
      primaryUrl: untriedUrl,
    });
  });

  it("他ユーザーの外部アカウントを含めない", async () => {
    const userId = await createTestUser();
    const otherUserId = await createTestUser();
    await saveUnverifiedUrl({ db: testDb }, { userId: otherUserId, url: `https://${uniqueHost()}/` });

    const links = await readAccountLinks({ db: testDb, accountsOrigin }, { userId });

    expect(links.accounts).toEqual([]);
  });

  it("保存済みの提供先は有効なクライアントだけを返し、認可要求の連携先を加える", async () => {
    const userId = await createTestUser();
    const savedClientId = await createClient("Points");
    const disabledClientId = await createClient("Disabled", { disabled: true });
    const requestClientId = await createClient("Markets");
    await testDb.insert(clientConsents).values([
      { userId, clientId: savedClientId, displayName: "Points" },
      { userId, clientId: disabledClientId, displayName: "Disabled" },
      { userId, clientId: "deleted-client", displayName: "Deleted" },
    ]);

    const links = await readAccountLinks(
      { db: testDb, accountsOrigin },
      { userId, consentClientId: requestClientId },
    );

    expect(links.clients).toEqual([
      {
        clientId: savedClientId,
        name: "Points",
        uri: expect.any(String),
        isConsentRequest: false,
      },
      {
        clientId: requestClientId,
        name: "Markets",
        uri: expect.any(String),
        isConsentRequest: true,
      },
    ]);
  });

  it("認可要求の連携先が保存済みの提供先なら、その列を認可要求として示す", async () => {
    const userId = await createTestUser();
    const clientId = await createClient("Points");
    await testDb
      .insert(clientConsents)
      .values({ userId, clientId, displayName: "Points" });

    const links = await readAccountLinks(
      { db: testDb, accountsOrigin },
      { userId, consentClientId: clientId },
    );

    expect(links.clients).toEqual([
      expect.objectContaining({ clientId, isConsentRequest: true }),
    ]);
  });
});
