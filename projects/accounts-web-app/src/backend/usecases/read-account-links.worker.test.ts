import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

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
  externalAccountVisibility,
  oauthClient,
} from "../db/schema";
import { readAccountLinks } from "./read-account-links";
import { saveUnverifiedUrl } from "./save-unverified-url";

const accountsOrigin = "https://accounts.freeism.app";
const verifiedAt = new Date("2026-09-20T00:00:00.000Z");

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
            authAccountId: null,
            evidenceUrl: null,
            verifiedAt: verifiedAt.toISOString(),
            checkedAt: verifiedAt.toISOString(),
            result: "verified",
            failureCode: null,
            identifierIds: [expect.any(String)],
          },
        ],
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
      { userId, clientId: savedClientId, displayName: "Points", consented: true },
      { userId, clientId: disabledClientId, displayName: "Disabled", consented: true },
      { userId, clientId: "deleted-client", displayName: "Deleted", consented: true },
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
        consented: true,
        isConsentRequest: false,
      },
      {
        clientId: requestClientId,
        name: "Markets",
        uri: expect.any(String),
        consented: false,
        isConsentRequest: true,
      },
    ]);
  });

  it("認可要求の連携先が保存済みの提供先なら、その列を認可要求として示す", async () => {
    const userId = await createTestUser();
    const clientId = await createClient("Points");
    await testDb
      .insert(clientConsents)
      .values({ userId, clientId, displayName: "Points", consented: false });

    const links = await readAccountLinks(
      { db: testDb, accountsOrigin },
      { userId, consentClientId: clientId },
    );

    expect(links.clients).toEqual([
      expect.objectContaining({ clientId, consented: false, isConsentRequest: true }),
    ]);
  });
});
