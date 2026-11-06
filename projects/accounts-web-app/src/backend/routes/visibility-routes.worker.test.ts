import { describe, expect, it } from "vitest";

import {
  createVerifiedUrlAccount,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import { loginAsNewUser } from "../../../test/oauth-client-test-helpers";
import {
  countOAuthConsents,
  fetchBff,
  insertOAuthConsent,
  registerTestClient,
  saveVisibility,
} from "../../../test/resource-api-test-helpers";
import type { AccountLinks } from "../../shared/schemas/account-link-schema";
import { createRandomId } from "../db/id";
import { externalAccounts } from "../db/schema";

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

// --------------------------------------------------
// PUT /api/visibility
// --------------------------------------------------

describe("PUT /api/visibility", () => {
  it("一般公開と外部アカウント別の公開選択をまとめて保存し、未検証の行の公開選択も受け付ける", async () => {
    const { headers, verifiedId, candidateId, clientId } = await setUpUser();

    const response = await saveVisibility(headers, {
      accounts: [
        { externalAccountId: verifiedId, isPublic: true },
        { externalAccountId: candidateId, isPublic: false },
      ],
      clients: [{ clientId, visibleAccountIds: [verifiedId, candidateId] }],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { ok: true } });
    const links = await readAccountLinks(headers);
    expect(links.clients).toEqual([
      { clientId, name: "Points", uri: null, isConsentRequest: false },
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

  it("チェックの無い組も非公開として保存し、すべて外したクライアントも一覧の列に残す", async () => {
    const { headers, verifiedId, candidateId, clientId } = await setUpUser();
    const { clientId: otherClientId } = await registerTestClient(headers, "Markets");

    const response = await saveVisibility(headers, {
      clients: [
        { clientId, visibleAccountIds: [] },
        { clientId: otherClientId, visibleAccountIds: [candidateId] },
      ],
    });

    expect(response.status).toBe(200);
    const links = await readAccountLinks(headers);
    expect(links.clients.map((client) => client.clientId).toSorted()).toEqual(
      [clientId, otherClientId].toSorted(),
    );
    expect(links.accounts.map(({ id, visibility }) => ({ id, visibility }))).toEqual(
      expect.arrayContaining([
        { id: verifiedId, visibility: { [clientId]: false, [otherClientId]: false } },
        { id: candidateId, visibility: { [clientId]: false, [otherClientId]: true } },
      ]),
    );
  });

  it("保存した列の公開選択を持つ外部アカウントをすべて連携解除すると、その列を一覧から除く", async () => {
    const { headers, verifiedId, candidateId, clientId } = await setUpUser();
    await saveVisibility(headers, { clients: [{ clientId, visibleAccountIds: [verifiedId] }] });

    for (const externalAccountId of [verifiedId, candidateId]) {
      const response = await fetchBff(headers, `/api/external-accounts/${externalAccountId}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(200);
    }

    expect((await readAccountLinks(headers)).clients).toEqual([]);
  });

  it("証明済みの公開選択を外して保存すると、公開選択の無いクライアントの標準oauthConsentを削除する", async () => {
    const { userId, headers, verifiedId, candidateId, clientId } = await setUpUser();
    const { clientId: otherClientId } = await registerTestClient(headers, "Markets");
    await saveVisibility(headers, {
      clients: [
        { clientId, visibleAccountIds: [verifiedId] },
        { clientId: otherClientId, visibleAccountIds: [verifiedId] },
      ],
    });
    await insertOAuthConsent(userId, clientId);
    await insertOAuthConsent(userId, otherClientId);

    const response = await saveVisibility(headers, {
      clients: [{ clientId, visibleAccountIds: [candidateId] }],
    });

    expect(response.status).toBe(200);
    expect(await countOAuthConsents(userId, clientId)).toBe(0);
    expect(await countOAuthConsents(userId, otherClientId)).toBe(1);
    const links = await readAccountLinks(headers);
    expect(links.accounts.find((account) => account.id === candidateId)?.visibility).toEqual({
      [clientId]: true,
      [otherClientId]: false,
    });
  });

  it("入力に無いクライアントでも、提供していない標準oauthConsentは保存時に削除する", async () => {
    const { userId, headers, verifiedId, clientId } = await setUpUser();
    const { clientId: otherClientId } = await registerTestClient(headers, "Markets");
    await insertOAuthConsent(userId, otherClientId);

    await saveVisibility(headers, { clients: [{ clientId, visibleAccountIds: [verifiedId] }] });

    expect(await countOAuthConsents(userId, otherClientId)).toBe(0);
  });

  it("同意画面のように1つのクライアントだけを送ると、ほかのクライアントの公開選択と一般公開を変えない", async () => {
    const { headers, verifiedId, candidateId, clientId } = await setUpUser();
    const { clientId: otherClientId } = await registerTestClient(headers, "Markets");
    await saveVisibility(headers, {
      accounts: [{ externalAccountId: verifiedId, isPublic: true }],
      clients: [
        { clientId, visibleAccountIds: [candidateId] },
        { clientId: otherClientId, visibleAccountIds: [verifiedId, candidateId] },
      ],
    });

    const response = await saveVisibility(headers, {
      clients: [{ clientId, visibleAccountIds: [verifiedId] }],
    });

    expect(response.status).toBe(200);
    const links = await readAccountLinks(headers);
    expect(
      links.accounts.map(({ id, isPublic, visibility }) => ({ id, isPublic, visibility })),
    ).toEqual(
      expect.arrayContaining([
        {
          id: verifiedId,
          isPublic: true,
          visibility: { [clientId]: true, [otherClientId]: true },
        },
        {
          id: candidateId,
          isPublic: false,
          visibility: { [clientId]: false, [otherClientId]: true },
        },
      ]),
    );
  });

  it("後から追加した外部アカウントは、既存のクライアントにも一般公開にも公開しない", async () => {
    const { userId, headers, verifiedId, clientId } = await setUpUser();
    await saveVisibility(headers, {
      accounts: [{ externalAccountId: verifiedId, isPublic: true }],
      clients: [{ clientId, visibleAccountIds: [verifiedId] }],
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
        { clientId, visibleAccountIds: [verifiedId, othersAccountId] },
        { clientId: "missing-client", visibleAccountIds: [] },
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
