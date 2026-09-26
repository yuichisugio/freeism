import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createVerifiedUrlAccount,
  readExternalAccounts,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import { loginAsNewUser } from "../../../test/oauth-client-test-helpers";
import {
  fetchBff,
  registerTestClient,
  saveVisibility,
} from "../../../test/resource-api-test-helpers";
import type { AccountLinks } from "../../shared/schemas/account-link-schema";
import { createRandomId } from "../db/id";
import { clientConsents, externalAccounts, oauthConsent } from "../db/schema";

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

/**
 * ログインし、証明済みの外部アカウント・候補の外部アカウント・OAuthクライアントを用意する。
 */
async function setUpUser() {
  const { userId, headers } = await loginAsNewUser();
  const { accountId: verifiedId } = await createVerifiedUrlAccount(
    userId,
    [`https://${uniqueHost()}/alice`],
    "bidirectional_link",
    new Date("2026-09-01T00:00:00Z"),
  );
  const candidateId = createRandomId("eac_");
  await testDb.insert(externalAccounts).values({ id: candidateId, userId });
  const { clientId } = await registerTestClient(headers);
  return { userId, headers, verifiedId, candidateId, clientId };
}

async function readAccountLinks(headers: Headers): Promise<AccountLinks> {
  const response = await fetchBff(headers, "/api/account-links");
  return ((await response.json()) as { data: AccountLinks }).data;
}

/**
 * 本人とクライアントの標準`oauthConsent`行を作る。
 */
async function insertOAuthConsent(userId: string, clientId: string) {
  const now = new Date();
  await testDb.insert(oauthConsent).values({
    id: createRandomId(),
    userId,
    clientId,
    scopes: JSON.stringify(["openid"]),
    createdAt: now,
    updatedAt: now,
  });
}

async function countOAuthConsents(userId: string, clientId: string) {
  const rows = await testDb
    .select()
    .from(oauthConsent)
    .where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)));
  return rows.length;
}

// --------------------------------------------------
// PUT /api/visibility
// --------------------------------------------------

describe("PUT /api/visibility", () => {
  it("一般公開・情報提供同意・外部アカウント別の公開選択をまとめて保存する", async () => {
    const { headers, verifiedId, candidateId, clientId } = await setUpUser();

    const response = await saveVisibility(headers, {
      accounts: [
        { externalAccountId: verifiedId, isPublic: true },
        { externalAccountId: candidateId, isPublic: false },
      ],
      clients: [{ clientId, consented: true, visibleAccountIds: [verifiedId, candidateId] }],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { ok: true } });
    const links = await readAccountLinks(headers);
    expect(links.clients).toEqual([
      { clientId, name: "Points", uri: null, consented: true, isConsentRequest: false },
    ]);
    expect(
      links.accounts.map(({ id, isPublic, visibility }) => ({ id, isPublic, visibility })),
    ).toEqual(
      expect.arrayContaining([
        { id: verifiedId, isPublic: true, visibility: { [clientId]: true } },
        { id: candidateId, isPublic: false, visibility: { [clientId]: true } },
      ]),
    );
  });

  it("同意ONのクライアントに証明済みの選択が無ければ全体を400にし、保存済みの状態を変えない", async () => {
    const { userId, headers, verifiedId, candidateId, clientId } = await setUpUser();
    const { clientId: otherClientId } = await registerTestClient(headers, "Markets");

    const response = await saveVisibility(headers, {
      accounts: [{ externalAccountId: verifiedId, isPublic: true }],
      clients: [
        { clientId, consented: true, visibleAccountIds: [verifiedId] },
        { clientId: otherClientId, consented: true, visibleAccountIds: [candidateId] },
      ],
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "CONSENT_REQUIRES_VERIFIED_ACCOUNT",
      errors: [{ code: "CONSENT_REQUIRES_VERIFIED_ACCOUNT", path: ["clients", 1] }],
    });
    expect((await readExternalAccounts(userId)).every((row) => !row.isPublic)).toBe(true);
    expect(
      await testDb.select().from(clientConsents).where(eq(clientConsents.userId, userId)),
    ).toEqual([]);
  });

  it("同意だけをOFFで保存すると公開選択を保持し、標準のoauthConsentを削除する", async () => {
    const { userId, headers, verifiedId, clientId } = await setUpUser();
    await saveVisibility(headers, {
      clients: [{ clientId, consented: true, visibleAccountIds: [verifiedId] }],
    });
    await insertOAuthConsent(userId, clientId);

    const response = await saveVisibility(headers, {
      clients: [{ clientId, consented: false, visibleAccountIds: [verifiedId] }],
    });

    expect(response.status).toBe(200);
    expect(await countOAuthConsents(userId, clientId)).toBe(0);
    const links = await readAccountLinks(headers);
    expect(links.clients).toEqual([expect.objectContaining({ clientId, consented: false })]);
    expect(links.accounts.find((account) => account.id === verifiedId)?.visibility).toEqual({
      [clientId]: true,
    });
  });

  it("同意ONのまま保存しても標準のoauthConsentは残す", async () => {
    const { userId, headers, verifiedId, clientId } = await setUpUser();
    await insertOAuthConsent(userId, clientId);

    await saveVisibility(headers, {
      clients: [{ clientId, consented: true, visibleAccountIds: [verifiedId] }],
    });

    expect(await countOAuthConsents(userId, clientId)).toBe(1);
  });

  it("後から追加した外部アカウントは、既存のクライアントにも一般公開にも公開しない", async () => {
    const { userId, headers, verifiedId, clientId } = await setUpUser();
    await saveVisibility(headers, {
      accounts: [{ externalAccountId: verifiedId, isPublic: true }],
      clients: [{ clientId, consented: true, visibleAccountIds: [verifiedId] }],
    });

    const { accountId: addedId } = await createVerifiedUrlAccount(
      userId,
      [`https://${uniqueHost()}/alice`],
      "dns_txt",
      new Date(),
    );

    const added = (await readAccountLinks(headers)).accounts.find(
      (account) => account.id === addedId,
    );
    expect(added).toMatchObject({ isPublic: false, visibility: {} });
  });

  it("本人の行でない外部アカウント・有効でないクライアントは項目の位置付きで400にする", async () => {
    const { headers, verifiedId, clientId } = await setUpUser();
    const { accountId: othersAccountId } = await createVerifiedUrlAccount(
      (await loginAsNewUser()).userId,
      [`https://${uniqueHost()}/bob`],
      "dns_txt",
      new Date(),
    );

    const response = await saveVisibility(headers, {
      accounts: [{ externalAccountId: othersAccountId, isPublic: true }],
      clients: [
        { clientId, consented: true, visibleAccountIds: [verifiedId, othersAccountId] },
        { clientId: "missing-client", consented: false, visibleAccountIds: [] },
      ],
    });

    expect(response.status).toBe(400);
    const problem = (await response.json()) as { code: string; errors: { path: unknown[] }[] };
    expect(problem.code).toBe("INVALID_VALUE");
    expect(problem.errors.map((error) => error.path)).toEqual([
      ["accounts", 0, "externalAccountId"],
      ["clients", 0, "visibleAccountIds", 1],
      ["clients", 1, "clientId"],
    ]);
  });

  it("ログインしていない要求は401にする", async () => {
    const response = await saveVisibility(new Headers({ Origin: "http://localhost:5173" }), {});

    expect(response.status).toBe(401);
  });
});
