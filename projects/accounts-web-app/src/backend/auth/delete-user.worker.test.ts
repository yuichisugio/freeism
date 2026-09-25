import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { testAuth } from "../../../test/auth-test-helpers";
import {
  createTestUser,
  createVerifiedUrlAccount,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import {
  createDpopProof,
  fetchOAuthClients,
  generateTestKeyPair,
  loginAsNewUser,
  requestClientAccessToken,
  testOrigin,
  toJwks,
} from "../../../test/oauth-client-test-helpers";
import {
  createResourceApiCaller,
  fetchResourceApi,
  registerTestClient,
  saveVisibility,
} from "../../../test/resource-api-test-helpers";
import { PublicProfileEntrypoint } from "../../public-profile";
import {
  clientConsents,
  externalAccounts,
  externalAccountVisibility,
  oauthClient,
  user,
} from "../db/schema";
import { verifyClientAccessToken } from "./verify-client-access-token";

const resourceUrl = `${testOrigin}/api/v1/external-accounts`;

/**
 * 退会するユーザー（一般公開した外部アカウントと登録OAuthクライアントを持つ）と、そのクライアントへ同意した別ユーザーを作る。
 */
async function setUpWithdrawingUser() {
  const withdrawing = await loginAsNewUser();
  const url = `https://${uniqueHost()}/`;
  const { accountId } = await createVerifiedUrlAccount(
    withdrawing.userId,
    [url],
    "dns_txt",
    new Date(),
  );
  await testDb
    .update(externalAccounts)
    .set({ isPublic: true })
    .where(eq(externalAccounts.id, accountId));

  const clientKey = await generateTestKeyPair("client-key");
  const registered = await fetchOAuthClients(withdrawing.headers, "", {
    method: "POST",
    body: {
      name: "Points",
      uri: null,
      description: null,
      redirectUris: ["https://points.example/callback"],
      jwks: toJwks(clientKey),
    },
  });
  const { data } = (await registered.json()) as { data: { clientId: string } };

  const otherUserId = await createTestUser();
  const other = await createVerifiedUrlAccount(otherUserId, [`https://${uniqueHost()}/`], "dns_txt", new Date());
  await testDb
    .insert(clientConsents)
    .values({ userId: otherUserId, clientId: data.clientId, displayName: "Points", consented: true });
  await testDb
    .insert(externalAccountVisibility)
    .values({ accountId: other.accountId, clientId: data.clientId, isPublic: true });

  return { ...withdrawing, clientId: data.clientId, clientKey, otherUserId };
}

describe("退会（標準deleteUser）", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("セッション・公開プロフィール・登録クライアントとトークンを終了し、他ユーザーの同意・公開選択は残す", async () => {
    const { userId, headers, clientId, clientKey, otherUserId } = await setUpWithdrawingUser();
    const dpopKey = await generateTestKeyPair("dpop-key");
    const tokenResponse = await requestClientAccessToken({ clientId, clientKey, dpopKey });
    const { access_token: accessToken } = (await tokenResponse.json()) as { access_token: string };
    const purge = vi.spyOn(PublicProfileEntrypoint.prototype, "purgeProfiles");

    const response = await exports.default.fetch(`${testOrigin}/api/auth/delete-user`, {
      method: "POST",
      headers: new Headers([...headers, ["Content-Type", "application/json"]]),
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    // セッション
    const me = await exports.default.fetch(`${testOrigin}/api/me`, { headers });
    expect(me.status).toBe(401);
    // 公開プロフィール
    const profile = await exports.default.fetch(`${testOrigin}/profiles/${userId}`);
    expect(profile.status).toBe(404);
    await vi.waitFor(() => expect(purge).toHaveBeenCalledWith([userId]));
    // 本人の独自表と登録クライアント
    expect(await testDb.select().from(user).where(eq(user.id, userId))).toEqual([]);
    expect(
      await testDb.select().from(externalAccounts).where(eq(externalAccounts.userId, userId)),
    ).toEqual([]);
    expect(
      await testDb.select().from(oauthClient).where(eq(oauthClient.clientId, clientId)),
    ).toEqual([]);
    // 発行済みトークンによる資源APIの利用と、新しいトークンの発行
    const verified = await verifyClientAccessToken(
      new Request(resourceUrl, {
        method: "POST",
        headers: {
          Authorization: `DPoP ${accessToken}`,
          DPoP: await createDpopProof(dpopKey, { method: "POST", url: resourceUrl, accessToken }),
        },
      }),
      { auth: testAuth, accountsOrigin: env.ACCOUNTS_ORIGIN },
    );
    expect(verified).toMatchObject({ ok: false, status: 401 });
    const retried = await requestClientAccessToken({ clientId, clientKey, dpopKey });
    expect(retried.status).toBeGreaterThanOrEqual(400);
    // 他ユーザーの同意・公開選択
    expect(
      await testDb.select().from(clientConsents).where(eq(clientConsents.userId, otherUserId)),
    ).toHaveLength(1);
    expect(
      await testDb
        .select()
        .from(externalAccountVisibility)
        .where(eq(externalAccountVisibility.clientId, clientId)),
    ).toHaveLength(1);
  });

  it("退会したユーザーは、同意していた連携先の資源APIで存在しないユーザーと同じ404になる", async () => {
    const developer = await loginAsNewUser();
    const { clientId, clientKey } = await registerTestClient(developer.headers);
    const caller = await createResourceApiCaller(clientId, clientKey);
    const { userId, headers } = await loginAsNewUser();
    const { accountId } = await createVerifiedUrlAccount(
      userId,
      [`https://${uniqueHost()}/`],
      "dns_txt",
      new Date(),
    );
    const saved = await saveVisibility(headers, {
      clients: [{ clientId, consented: true, visibleAccountIds: [accountId] }],
    });
    expect(saved.status).toBe(200);
    const listBody = { accountsUserId: userId };
    const before = await fetchResourceApi(caller, "/api/v1/external-accounts", { body: listBody });
    expect(before.status).toBe(200);

    await exports.default.fetch(`${testOrigin}/api/auth/delete-user`, {
      method: "POST",
      headers: new Headers([...headers, ["Content-Type", "application/json"]]),
      body: JSON.stringify({}),
    });

    const after = await fetchResourceApi(caller, "/api/v1/external-accounts", { body: listBody });
    expect(after.status).toBe(404);
  });

  it("セッションの無い退会要求は拒否する", async () => {
    const response = await exports.default.fetch(`${testOrigin}/api/auth/delete-user`, {
      method: "POST",
      headers: { Origin: testOrigin, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(401);
  });
});
