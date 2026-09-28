import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createUnsignedIdToken,
  getTestAuthContext,
  testAuth,
} from "../../../test/auth-test-helpers";
import {
  createTestUser,
  createVerifiedUrlAccount,
  readExternalAccounts,
  readIdentifierActivity,
  readVerifications,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import {
  countOAuthConsents,
  createConsentedClient,
} from "../../../test/resource-api-test-helpers";
import { createRandomId } from "../db/id";
import {
  account,
  externalAccounts,
  externalAccountVerifications,
  externalAccountVisibility,
  externalIdentifiers,
  verificationIdentifiers,
} from "../db/schema";
import { saveUnverifiedUrl } from "./save-unverified-url";
import { unlinkExternalAccount } from "./unlink-external-account";
import { unlinkVerification } from "./unlink-verification";

const now = new Date("2026-09-26T00:00:00.000Z");

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

/**
 * Better Authの標準処理でユーザーとGoogleのOAuth accountを作り、ログインしたセッションのヘッダーを返す。
 * accountの作成後のフックで、外部アカウント行と`oauth`証明が作られる。
 * `externalAccountIds`・`oauthVerificationIds`は`authAccounts`と同じ順に並べる。
 */
async function createLoggedInUserWithGoogleAccounts(accountCount: number) {
  const context = await getTestAuthContext();
  const createdUser = await context.test.saveUser(context.test.createUser());
  const authAccounts = [];
  for (let index = 0; index < accountCount; index += 1) {
    const subject = createRandomId("google-");
    authAccounts.push(
      await context.internalAdapter.createAccount({
        userId: createdUser.id,
        providerId: "google",
        accountId: subject,
        idToken: createUnsignedIdToken({ sub: subject, name: `Google ${index}` }),
      }),
    );
  }
  const { headers } = await context.test.login({ userId: createdUser.id });
  const oauthVerifications = await Promise.all(
    authAccounts.map(async (authAccount) => {
      const [verification] = await testDb
        .select({
          id: externalAccountVerifications.id,
          accountId: externalAccountVerifications.accountId,
        })
        .from(externalAccountVerifications)
        .where(eq(externalAccountVerifications.authAccountId, authAccount.id));
      return { id: verification?.id ?? "", accountId: verification?.accountId ?? "" };
    }),
  );
  return {
    userId: createdUser.id,
    headers,
    authAccounts,
    externalAccountIds: oauthVerifications.map((verification) => verification.accountId),
    oauthVerificationIds: oauthVerifications.map((verification) => verification.id),
  };
}

/**
 * 外部アカウント行へ、リンク証明が支える有効なURL識別子を加える。
 */
async function addLinkVerifiedUrl(userId: string, externalAccountId: string, url: string) {
  const identifierId = createRandomId("eid_");
  const verificationId = createRandomId("evf_");
  await testDb.insert(externalIdentifiers).values({
    id: identifierId,
    accountId: externalAccountId,
    userId,
    kind: "url",
    value: url,
    host: new URL(url).hostname,
    isActive: true,
  });
  await testDb.insert(externalAccountVerifications).values({
    id: verificationId,
    accountId: externalAccountId,
    method: "bidirectional_link",
    evidenceKey: url,
    verifiedAt: now,
    checkedAt: now,
    result: "verified",
  });
  await testDb.insert(verificationIdentifiers).values({ verificationId, identifierId });
  return verificationId;
}

/**
 * 標準`account`の行IDが残っているかを読む。
 */
async function authAccountExists(authAccountId: string): Promise<boolean> {
  const rows = await testDb.select().from(account).where(eq(account.id, authAccountId));
  return rows.length === 1;
}

// --------------------------------------------------
// テスト
// --------------------------------------------------

describe("unlinkExternalAccount", () => {
  it("OAuthを含む行は、標準の認証連携を解除してから行の識別子・証明を終了する", async () => {
    const { userId, headers, authAccounts, externalAccountIds } =
      await createLoggedInUserWithGoogleAccounts(2);
    const [target, remaining] = externalAccountIds;

    await unlinkExternalAccount(
      { db: testDb, auth: testAuth },
      { userId, headers, externalAccountId: target ?? "" },
    );

    expect((await readExternalAccounts(userId)).map((row) => row.id)).toEqual([remaining]);
    expect(await readVerifications(target ?? "")).toEqual([]);
    expect(await authAccountExists(authAccounts[0]?.id ?? "")).toBe(false);
    expect(await authAccountExists(authAccounts[1]?.id ?? "")).toBe(true);
  });

  it("解除で提供対象が0件になったクライアントだけ、標準oauthConsentを削除する", async () => {
    const { userId, headers, externalAccountIds } = await createLoggedInUserWithGoogleAccounts(2);
    const [target = "", remaining = ""] = externalAccountIds;
    const withdrawnClientId = await createConsentedClient(userId, [target]);
    const keptClientId = await createConsentedClient(userId, [target, remaining]);

    await unlinkExternalAccount(
      { db: testDb, auth: testAuth },
      { userId, headers, externalAccountId: target },
    );

    expect(await countOAuthConsents(userId, withdrawnClientId)).toBe(0);
    expect(await countOAuthConsents(userId, keptClientId)).toBe(1);
  });

  it("最後のログイン手段の解除が拒否された場合は、独自表を変更しない", async () => {
    const { userId, headers, authAccounts, externalAccountIds } =
      await createLoggedInUserWithGoogleAccounts(1);
    const before = await readIdentifierActivity(userId);

    await expect(
      unlinkExternalAccount(
        { db: testDb, auth: testAuth },
        { userId, headers, externalAccountId: externalAccountIds[0] ?? "" },
      ),
    ).rejects.toMatchObject({ status: 400, code: "LAST_LOGIN_METHOD" });

    expect(await readExternalAccounts(userId)).toHaveLength(1);
    expect(await readIdentifierActivity(userId)).toEqual(before);
    expect(await authAccountExists(authAccounts[0]?.id ?? "")).toBe(true);
  });

  it("OAuthを含まない行は、ログイン手段が1つでも解除できる", async () => {
    const { userId, headers } = await createLoggedInUserWithGoogleAccounts(1);
    const url = `https://${uniqueHost()}/`;
    const saved = await saveUnverifiedUrl({ db: testDb }, { userId, url });

    await unlinkExternalAccount(
      { db: testDb, auth: testAuth },
      { userId, headers, externalAccountId: saved.externalAccountId },
    );

    expect(await readIdentifierActivity(userId)).not.toHaveProperty(`url:${url}`);
  });

  it("本人の行でなければ404にする", async () => {
    const { headers, userId } = await createLoggedInUserWithGoogleAccounts(1);
    const otherUserId = await createTestUser();
    const saved = await saveUnverifiedUrl(
      { db: testDb },
      { userId: otherUserId, url: `https://${uniqueHost()}/` },
    );

    await expect(
      unlinkExternalAccount(
        { db: testDb, auth: testAuth },
        { userId, headers, externalAccountId: saved.externalAccountId },
      ),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(await readExternalAccounts(otherUserId)).toHaveLength(1);
  });
});


describe("unlinkVerification", () => {
  it("OAuthの証明は標準の認証連携を解除し、ほかの方法が支える識別子と外部アカウント行を残す", async () => {
    const { userId, headers, authAccounts, externalAccountIds, oauthVerificationIds } =
      await createLoggedInUserWithGoogleAccounts(2);
    const externalAccountId = externalAccountIds[0] ?? "";
    const authAccountId = authAccounts[0]?.id ?? "";
    const url = `https://${uniqueHost()}/`;
    await addLinkVerifiedUrl(userId, externalAccountId, url);

    await unlinkVerification(
      { db: testDb, auth: testAuth, now },
      { userId, headers, externalAccountId, verificationId: oauthVerificationIds[0] ?? "" },
    );

    expect(await authAccountExists(authAccountId)).toBe(false);
    expect((await readVerifications(externalAccountId)).map((row) => row.method)).toEqual([
      "bidirectional_link",
    ]);
    expect(await readIdentifierActivity(userId)).toMatchObject({
      [`provider_account:${authAccounts[0]?.accountId}`]: false,
      [`url:${url}`]: true,
    });
    expect((await readExternalAccounts(userId)).map((row) => row.id)).toContain(
      externalAccountId,
    );
  });

  it("OAuthだけの行でOAuthの証明を解除すると、行と公開選択を残して未検証にする", async () => {
    const { userId, headers, authAccounts, externalAccountIds, oauthVerificationIds } =
      await createLoggedInUserWithGoogleAccounts(2);
    const externalAccountId = externalAccountIds[0] ?? "";
    const clientId = createRandomId("client-");
    await testDb
      .update(externalAccounts)
      .set({ isPublic: true })
      .where(eq(externalAccounts.id, externalAccountId));
    await testDb
      .insert(externalAccountVisibility)
      .values({ accountId: externalAccountId, clientId, isPublic: true });

    await unlinkVerification(
      { db: testDb, auth: testAuth, now },
      { userId, headers, externalAccountId, verificationId: oauthVerificationIds[0] ?? "" },
    );

    expect(await readVerifications(externalAccountId)).toEqual([]);
    expect(await readIdentifierActivity(userId)).toMatchObject({
      [`provider_account:${authAccounts[0]?.accountId}`]: false,
      [`provider_account:${authAccounts[1]?.accountId}`]: true,
    });
    expect(await readExternalAccounts(userId)).toContainEqual(
      expect.objectContaining({ id: externalAccountId, isPublic: true }),
    );
    expect(
      await testDb
        .select()
        .from(externalAccountVisibility)
        .where(eq(externalAccountVisibility.accountId, externalAccountId)),
    ).toEqual([{ accountId: externalAccountId, clientId, isPublic: true }]);
  });

  it("リンク証明は証明行と対象関連だけを削除し、標準の認証連携とほかの方法が支える識別子を残す", async () => {
    const { userId, headers, authAccounts, externalAccountIds } =
      await createLoggedInUserWithGoogleAccounts(1);
    const externalAccountId = externalAccountIds[0] ?? "";
    const url = `https://${uniqueHost()}/`;
    const verificationId = await addLinkVerifiedUrl(userId, externalAccountId, url);

    await unlinkVerification(
      { db: testDb, auth: testAuth, now },
      { userId, headers, externalAccountId, verificationId },
    );

    expect(await authAccountExists(authAccounts[0]?.id ?? "")).toBe(true);
    expect((await readVerifications(externalAccountId)).map((row) => row.method)).toEqual([
      "oauth",
    ]);
    expect(await readIdentifierActivity(userId)).toEqual({
      [`provider_account:${authAccounts[0]?.accountId}`]: true,
      [`url:${url}`]: false,
    });
  });

  it("DNS TXTの証明は押した行だけを終了し、同じhostのほかの行の証明は残す", async () => {
    const { userId, headers } = await createLoggedInUserWithGoogleAccounts(1);
    const host = uniqueHost();
    const target = await createVerifiedUrlAccount(userId, [`https://${host}/a`], "dns_txt", now);
    const remaining = await createVerifiedUrlAccount(userId, [`https://${host}/b`], "dns_txt", now);

    await unlinkVerification(
      { db: testDb, auth: testAuth, now },
      {
        userId,
        headers,
        externalAccountId: target.accountId,
        verificationId: target.verificationId,
      },
    );

    expect(await readVerifications(target.accountId)).toEqual([]);
    expect(await readVerifications(remaining.accountId)).toEqual([
      expect.objectContaining({ id: remaining.verificationId, method: "dns_txt", evidenceKey: host }),
    ]);
    expect(await readIdentifierActivity(userId)).toMatchObject({
      [`url:https://${host}/a`]: false,
      [`url:https://${host}/b`]: true,
    });
    expect(await readExternalAccounts(userId)).toHaveLength(3);
  });

  it("最後の証明を解除して提供対象が0件になったクライアントだけ、標準oauthConsentを削除する", async () => {
    const { userId, headers } = await createLoggedInUserWithGoogleAccounts(1);
    const target = await createVerifiedUrlAccount(
      userId,
      [`https://${uniqueHost()}/`],
      "dns_txt",
      now,
    );
    const remaining = await createVerifiedUrlAccount(
      userId,
      [`https://${uniqueHost()}/`],
      "bidirectional_link",
      now,
    );
    const withdrawnClientId = await createConsentedClient(userId, [target.accountId]);
    const keptClientId = await createConsentedClient(userId, [
      target.accountId,
      remaining.accountId,
    ]);

    await unlinkVerification(
      { db: testDb, auth: testAuth, now },
      {
        userId,
        headers,
        externalAccountId: target.accountId,
        verificationId: target.verificationId,
      },
    );

    expect(await countOAuthConsents(userId, withdrawnClientId)).toBe(0);
    expect(await countOAuthConsents(userId, keptClientId)).toBe(1);
  });

  it("最後のログイン手段のOAuthの証明は解除を拒否し、何も変更しない", async () => {
    const { userId, headers, authAccounts, externalAccountIds, oauthVerificationIds } =
      await createLoggedInUserWithGoogleAccounts(1);

    await expect(
      unlinkVerification(
        { db: testDb, auth: testAuth, now },
        {
          userId,
          headers,
          externalAccountId: externalAccountIds[0] ?? "",
          verificationId: oauthVerificationIds[0] ?? "",
        },
      ),
    ).rejects.toMatchObject({ status: 400, code: "LAST_LOGIN_METHOD" });

    expect(await authAccountExists(authAccounts[0]?.id ?? "")).toBe(true);
    expect(await readIdentifierActivity(userId)).toEqual({
      [`provider_account:${authAccounts[0]?.accountId}`]: true,
    });
  });

  it("指定した行の成功した証明でなければ404にする", async () => {
    const { userId, headers, externalAccountIds, oauthVerificationIds } =
      await createLoggedInUserWithGoogleAccounts(2);
    const otherUserId = await createTestUser();
    const otherUsers = await createVerifiedUrlAccount(
      otherUserId,
      [`https://${uniqueHost()}/`],
      "dns_txt",
      now,
    );
    const failedAttemptId = createRandomId("evf_");
    await testDb.insert(externalAccountVerifications).values({
      id: failedAttemptId,
      accountId: externalAccountIds[0] ?? "",
      method: "bidirectional_link",
      evidenceKey: `https://${uniqueHost()}/`,
      checkedAt: now,
      result: "not_verified",
      failureCode: "LINK_NOT_FOUND",
    });

    for (const target of [
      // 別の行の証明
      { externalAccountId: externalAccountIds[0] ?? "", verificationId: oauthVerificationIds[1] ?? "" },
      // 他人の行の証明
      { externalAccountId: otherUsers.accountId, verificationId: otherUsers.verificationId },
      // 成功していない試行
      { externalAccountId: externalAccountIds[0] ?? "", verificationId: failedAttemptId },
    ]) {
      await expect(
        unlinkVerification({ db: testDb, auth: testAuth, now }, { userId, headers, ...target }),
      ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    }
    expect(await readVerifications(otherUsers.accountId)).toHaveLength(1);
    expect(await readVerifications(externalAccountIds[1] ?? "")).toHaveLength(1);
  });

  it("OAuthの証明を解除した行は、同じProviderアカウントの再連携で同じ行のまま再び有効になる", async () => {
    const { userId, headers, authAccounts, externalAccountIds, oauthVerificationIds } =
      await createLoggedInUserWithGoogleAccounts(2);
    const externalAccountId = externalAccountIds[0] ?? "";
    const subject = authAccounts[0]?.accountId ?? "";
    await unlinkVerification(
      { db: testDb, auth: testAuth, now },
      { userId, headers, externalAccountId, verificationId: oauthVerificationIds[0] ?? "" },
    );

    // `linkSocial`の再連携と同じく、解除済みのProviderアカウントの標準`account`を作り直す。
    const context = await getTestAuthContext();
    const relinked = await context.internalAdapter.createAccount({
      userId,
      providerId: "google",
      accountId: subject,
      idToken: createUnsignedIdToken({ sub: subject, name: "Google 0" }),
    });

    expect((await readExternalAccounts(userId)).map((row) => row.id).toSorted()).toEqual(
      [...externalAccountIds].toSorted(),
    );
    expect(await readVerifications(externalAccountId)).toEqual([
      expect.objectContaining({ method: "oauth", authAccountId: relinked.id }),
    ]);
    expect(await readIdentifierActivity(userId)).toMatchObject({
      [`provider_account:${subject}`]: true,
    });
  });
});
