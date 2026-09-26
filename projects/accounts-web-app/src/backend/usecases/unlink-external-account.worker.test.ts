import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createUnsignedIdToken,
  getTestAuthContext,
  testAuth,
} from "../../../test/auth-test-helpers";
import {
  createTestUser,
  readExternalAccounts,
  readIdentifierActivity,
  readVerifications,
  testDb,
  uniqueHost,
} from "../../../test/external-account-test-helpers";
import { createRandomId } from "../db/id";
import {
  account,
  externalAccountVerifications,
  externalIdentifiers,
  verificationIdentifiers,
} from "../db/schema";
import { saveUnverifiedUrl } from "./save-unverified-url";
import { unlinkExternalAccount } from "./unlink-external-account";
import { unlinkOAuthOnly } from "./unlink-oauth-only";

const now = new Date("2026-09-26T00:00:00.000Z");

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

/**
 * Better Authの標準処理でユーザーとGoogleのOAuth accountを作り、ログインしたセッションのヘッダーを返す。
 * accountの作成後のフックで、外部アカウント行と`oauth`証明が作られる。
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
  const externalAccountIds = await Promise.all(
    authAccounts.map(async (authAccount) => {
      const [verification] = await testDb
        .select({ accountId: externalAccountVerifications.accountId })
        .from(externalAccountVerifications)
        .where(eq(externalAccountVerifications.authAccountId, authAccount.id));
      return verification?.accountId ?? "";
    }),
  );
  return { userId: createdUser.id, headers, authAccounts, externalAccountIds };
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

describe("unlinkOAuthOnly", () => {
  it("oauth証明と対象関連だけを終了し、ほかの方法が支える識別子と外部アカウント行を残す", async () => {
    const { userId, headers, authAccounts, externalAccountIds } =
      await createLoggedInUserWithGoogleAccounts(2);
    const externalAccountId = externalAccountIds[0] ?? "";
    const authAccountId = authAccounts[0]?.id ?? "";
    const url = `https://${uniqueHost()}/`;
    await addLinkVerifiedUrl(userId, externalAccountId, url);

    await unlinkOAuthOnly(
      { db: testDb, auth: testAuth, now },
      { userId, headers, externalAccountId, authAccountId },
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

  it("最後のログイン手段の解除が拒否された場合は、何も変更しない", async () => {
    const { userId, headers, authAccounts, externalAccountIds } =
      await createLoggedInUserWithGoogleAccounts(1);

    await expect(
      unlinkOAuthOnly(
        { db: testDb, auth: testAuth, now },
        {
          userId,
          headers,
          externalAccountId: externalAccountIds[0] ?? "",
          authAccountId: authAccounts[0]?.id ?? "",
        },
      ),
    ).rejects.toMatchObject({ status: 400, code: "LAST_LOGIN_METHOD" });

    expect(await readIdentifierActivity(userId)).toEqual({
      [`provider_account:${authAccounts[0]?.accountId}`]: true,
    });
  });

  it("行のoauth証明に属さない標準accountは404にする", async () => {
    const { userId, headers, authAccounts, externalAccountIds } =
      await createLoggedInUserWithGoogleAccounts(2);

    await expect(
      unlinkOAuthOnly(
        { db: testDb, auth: testAuth, now },
        {
          userId,
          headers,
          externalAccountId: externalAccountIds[0] ?? "",
          authAccountId: authAccounts[1]?.id ?? "",
        },
      ),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(await authAccountExists(authAccounts[1]?.id ?? "")).toBe(true);
  });
});
