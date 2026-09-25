import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createUnsignedIdToken,
  encryptTestOAuthToken,
  getTestAuthContext,
  testAuth,
} from "../../../test/auth-test-helpers";
import { createDatabase } from "../db/database";
import { createRandomId } from "../db/id";
import {
  externalAccounts,
  externalAccountVerifications,
  externalIdentifiers,
  session,
  verificationIdentifiers,
} from "../db/schema";

const db = createDatabase(env.DB);

/**
 * ログインから2日経ったセッションのヘッダーを作る。
 * `testUtils`は`createdAt`の指定を受け付けないため、作成後にD1の値を古くする。
 */
async function loginWithOldSession(userId: string) {
  const context = await getTestAuthContext();
  const { headers, token } = await context.test.login({ userId });
  await db
    .update(session)
    .set({ createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })
    .where(eq(session.token, token));
  return headers;
}

/**
 * Better Authの標準処理でユーザーを作り、GoogleのOAuth accountを指定数だけ紐付ける。
 */
async function createUserWithGoogleAccounts(accountCount: number) {
  const context = await getTestAuthContext();
  const user = await context.test.saveUser(context.test.createUser());
  const accounts = [];
  for (let index = 0; index < accountCount; index += 1) {
    const subject = createRandomId("google-");
    accounts.push(
      await context.internalAdapter.createAccount({
        userId: user.id,
        providerId: "google",
        accountId: subject,
        idToken: createUnsignedIdToken({
          sub: subject,
          name: `Google ${index}`,
          email: `${subject}@example.com`,
        }),
      }),
    );
  }
  return { context, user, accounts };
}

describe("Better Authのユーザー作成", () => {
  it("user.idをausr_形式で作り、表示名を「仮ユーザー」にする", async () => {
    const { user } = await createUserWithGoogleAccounts(0);

    expect(user.id).toMatch(/^ausr_[A-Za-z0-9_-]{22}$/);
    expect(user.name).toBe("仮ユーザー");
  });
});

describe("OAuthのaccount作成・更新後の独自表の同期", () => {
  it("外部アカウント行・固有IDの識別子・oauth証明を作り、公開選択をOFFにする", async () => {
    const { user, accounts } = await createUserWithGoogleAccounts(1);
    const [account] = accounts;

    const [externalAccount] = await db
      .select()
      .from(externalAccounts)
      .where(eq(externalAccounts.userId, user.id));
    expect(externalAccount).toMatchObject({
      service: "google",
      displayName: "Google 0",
      email: `${account?.accountId}@example.com`,
      isPublic: false,
    });
    expect(externalAccount?.linkedAt).toBeInstanceOf(Date);

    const identifiers = await db
      .select()
      .from(externalIdentifiers)
      .where(eq(externalIdentifiers.userId, user.id));
    expect(identifiers).toEqual([
      expect.objectContaining({
        kind: "provider_account",
        provider: "google",
        value: account?.accountId,
        isActive: true,
      }),
    ]);

    const [verification] = await db
      .select()
      .from(externalAccountVerifications)
      .where(eq(externalAccountVerifications.accountId, externalAccount?.id ?? ""));
    expect(verification).toMatchObject({
      method: "oauth",
      evidenceKey: account?.id,
      authAccountId: account?.id,
      result: "verified",
      failureCode: null,
    });
  });

  it("accountの更新で表示名・メールアドレスを最新の値にする", async () => {
    const { context, user, accounts } = await createUserWithGoogleAccounts(1);
    const [account] = accounts;

    await context.internalAdapter.updateAccount(account?.id ?? "", {
      idToken: createUnsignedIdToken({
        sub: account?.accountId,
        name: "Renamed",
        email: "renamed@example.com",
      }),
    });

    const [externalAccount] = await db
      .select()
      .from(externalAccounts)
      .where(eq(externalAccounts.userId, user.id));
    expect(externalAccount).toMatchObject({ displayName: "Renamed", email: "renamed@example.com" });
  });
});

describe("OAuthの同期の失敗とProvider別の取得", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Providerからプロフィールを取得できなくても、標準accountの作成は成功する", async () => {
    const context = await getTestAuthContext();
    const user = await context.test.saveUser(context.test.createUser());
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const account = await context.internalAdapter.createAccount({
      userId: user.id,
      providerId: "google",
      accountId: createRandomId("google-"),
    });

    expect(account.userId).toBe(user.id);
    expect(
      await db.select().from(externalAccounts).where(eq(externalAccounts.userId, user.id)),
    ).toEqual([]);
  });

  it("GitHubは暗号化して保存したAccess Tokenを復号し、/userと/user/emailsから同期する", async () => {
    const context = await getTestAuthContext();
    const user = await context.test.saveUser(context.test.createUser());
    const login = `Octo-${createRandomId().slice(0, 8)}`;
    const authorizations: (string | null)[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      authorizations.push(request.headers.get("authorization"));
      if (request.url === "https://api.github.com/user") {
        return Response.json({ id: 4242, login, name: null, email: null });
      }
      if (request.url === "https://api.github.com/user/emails") {
        return Response.json([{ email: "octo@example.com", primary: true, verified: true }]);
      }
      throw new Error(`Unexpected fetch: ${request.url}`);
    });

    await context.internalAdapter.createAccount({
      userId: user.id,
      providerId: "github",
      accountId: createRandomId("gh-"),
      accessToken: await encryptTestOAuthToken("gho_plain_access_token"),
    });

    expect(authorizations).toEqual([
      "Bearer gho_plain_access_token",
      "Bearer gho_plain_access_token",
    ]);
    const [externalAccount] = await db
      .select()
      .from(externalAccounts)
      .where(eq(externalAccounts.userId, user.id));
    expect(externalAccount).toMatchObject({
      service: "github",
      displayName: login,
      email: "octo@example.com",
    });
    const identifiers = await db
      .select({ kind: externalIdentifiers.kind, value: externalIdentifiers.value })
      .from(externalIdentifiers)
      .where(eq(externalIdentifiers.userId, user.id));
    expect(identifiers).toEqual(
      expect.arrayContaining([
        { kind: "provider_username", value: login.toLowerCase() },
        { kind: "url", value: `https://github.com/${login}` },
      ]),
    );
  });
});

describe("標準の解除・退会と独自表", () => {
  it("unlinkAccountでは、ログインから時間が経ったセッションでも解除でき、CASCADEでoauth証明と関連だけが消える", async () => {
    const { user, accounts } = await createUserWithGoogleAccounts(2);
    const [unlinkedAccount, remainingAccount] = accounts;
    const headers = await loginWithOldSession(user.id);

    await testAuth.api.unlinkAccount({ headers, body: { accountId: unlinkedAccount?.id ?? "" } });

    const verifications = await db
      .select({ authAccountId: externalAccountVerifications.authAccountId })
      .from(externalAccountVerifications)
      .innerJoin(externalAccounts, eq(externalAccounts.id, externalAccountVerifications.accountId))
      .where(eq(externalAccounts.userId, user.id));
    expect(verifications).toEqual([{ authAccountId: remainingAccount?.id }]);

    // 外部アカウント行と識別子は残り、支えを失った識別子の候補化は後続のbatchで行う。
    expect(
      await db.select().from(externalAccounts).where(eq(externalAccounts.userId, user.id)),
    ).toHaveLength(2);
    expect(
      await db.select().from(externalIdentifiers).where(eq(externalIdentifiers.userId, user.id)),
    ).toHaveLength(2);
  });

  it("deleteUserでは、ログインから時間が経ったセッションでも退会でき、本人の独自表データが消える", async () => {
    const { user } = await createUserWithGoogleAccounts(1);
    const [identifier] = await db
      .select()
      .from(externalIdentifiers)
      .where(eq(externalIdentifiers.userId, user.id));
    const headers = await loginWithOldSession(user.id);

    await testAuth.api.deleteUser({ headers, body: {} });

    expect(
      await db.select().from(externalAccounts).where(eq(externalAccounts.userId, user.id)),
    ).toEqual([]);
    expect(
      await db.select().from(externalIdentifiers).where(eq(externalIdentifiers.userId, user.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(verificationIdentifiers)
        .where(eq(verificationIdentifiers.identifierId, identifier?.id ?? "")),
    ).toEqual([]);
  });
});
