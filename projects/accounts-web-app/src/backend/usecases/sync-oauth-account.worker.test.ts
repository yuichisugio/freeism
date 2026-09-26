import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { fillUrlIdentifiers } from "../../../test/external-account-test-helpers";
import { urlIdentifierLimitPerUser } from "../../shared/constants";
import { createDatabase } from "../db/database";
import { createRandomId } from "../db/id";
import {
  account,
  externalAccounts,
  externalAccountVerifications,
  externalIdentifiers,
  user,
  verificationIdentifiers,
} from "../db/schema";
import { saveUnverifiedUrl } from "./save-unverified-url";
import { syncOAuthAccount, type OAuthProfile } from "./sync-oauth-account";

const db = createDatabase(env.DB);
const now = new Date("2026-09-26T00:00:00.000Z");

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

/**
 * ユーザーと、そのユーザーのGitHubの標準`account`行を作る。
 */
async function createUserWithGitHubAccount() {
  const userId = createRandomId("ausr_");
  const authAccountId = createRandomId();
  const githubId = createRandomId("gh-");
  await db.insert(user).values({ id: userId, name: "仮ユーザー", email: `${userId}@example.com` });
  await db.insert(account).values({
    id: authAccountId,
    userId,
    providerId: "github",
    accountId: githubId,
    updatedAt: now,
  });
  return { userId, authAccountId, githubId };
}

/**
 * GitHubの検証済みプロフィールを作る。
 */
function githubProfile(githubId: string, login: string): OAuthProfile {
  return {
    identity: { providerId: "github", accountId: githubId, username: login },
    displayName: login,
    email: `${login}@example.com`,
  };
}

/**
 * 他ユーザーが公開ページのリンク証明で有効に保持する外部アカウントを作る。
 */
async function createLinkVerifiedAccount(userId: string, urls: string[]) {
  const accountId = createRandomId("eac_");
  const verificationId = createRandomId("evf_");
  const identifierIds = urls.map(() => createRandomId("eid_"));
  await db.insert(externalAccounts).values({ id: accountId, userId, linkedAt: now });
  await db.insert(externalIdentifiers).values(
    urls.map((url, index) => ({
      id: identifierIds[index] ?? "",
      accountId,
      userId,
      kind: "url" as const,
      value: url,
      host: new URL(url).host,
      isActive: true,
    })),
  );
  await db.insert(externalAccountVerifications).values({
    id: verificationId,
    accountId,
    method: "bidirectional_link",
    evidenceKey: urls[0] ?? "",
    verifiedAt: now,
    checkedAt: now,
    result: "verified",
  });
  await db
    .insert(verificationIdentifiers)
    .values(identifierIds.map((identifierId) => ({ verificationId, identifierId })));
  return { accountId, verificationId };
}

/**
 * ユーザーの識別子を`kind:value → is_active`の形で読む。
 */
async function readIdentifierActivity(userId: string) {
  const identifiers = await db
    .select()
    .from(externalIdentifiers)
    .where(eq(externalIdentifiers.userId, userId));
  return Object.fromEntries(
    identifiers.map((identifier) => [
      `${identifier.kind}:${identifier.value}`,
      identifier.isActive,
    ]),
  );
}

/**
 * `oauth`証明が確認した識別子の値を読む。
 */
async function readOAuthCoveredValues(authAccountId: string) {
  const rows = await db
    .select({ value: externalIdentifiers.value })
    .from(verificationIdentifiers)
    .innerJoin(
      externalAccountVerifications,
      eq(externalAccountVerifications.id, verificationIdentifiers.verificationId),
    )
    .innerJoin(
      externalIdentifiers,
      eq(externalIdentifiers.id, verificationIdentifiers.identifierId),
    )
    .where(eq(externalAccountVerifications.authAccountId, authAccountId));
  return rows.map((row) => row.value).sort();
}

// --------------------------------------------------
// テスト
// --------------------------------------------------

describe("syncOAuthAccount", () => {
  it("初回の連携で、公開OFFの外部アカウント行・有効な識別子・oauth証明を作る", async () => {
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();
    const login = `Alice-${createRandomId().slice(0, 8)}`;

    const result = await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, login) },
    );

    expect(result.affectedUserIds).toEqual([userId]);
    expect(
      await db
        .select()
        .from(externalAccounts)
        .where(eq(externalAccounts.id, result.externalAccountId)),
    ).toEqual([
      expect.objectContaining({
        userId,
        service: "github",
        displayName: login,
        isPublic: false,
        linkedAt: now,
      }),
    ]);
    expect(await readIdentifierActivity(userId)).toEqual({
      [`provider_account:${githubId}`]: true,
      [`provider_username:${login.toLowerCase()}`]: true,
      [`url:https://github.com/${login}`]: true,
    });
    expect(await readOAuthCoveredValues(authAccountId)).toEqual(
      [githubId, login.toLowerCase(), `https://github.com/${login}`].sort(),
    );
  });

  it("同じ内容で2回実行しても、行・識別子・証明を増やさない", async () => {
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();
    const profile = githubProfile(githubId, `Bob-${createRandomId().slice(0, 8)}`);

    const first = await syncOAuthAccount({ db, now }, { userId, authAccountId, profile });
    const second = await syncOAuthAccount({ db, now }, { userId, authAccountId, profile });

    expect(second.externalAccountId).toBe(first.externalAccountId);
    expect(
      await db.select().from(externalAccounts).where(eq(externalAccounts.userId, userId)),
    ).toHaveLength(1);
    expect(
      await db.select().from(externalIdentifiers).where(eq(externalIdentifiers.userId, userId)),
    ).toHaveLength(3);
    expect(
      await db
        .select()
        .from(externalAccountVerifications)
        .where(eq(externalAccountVerifications.accountId, first.externalAccountId)),
    ).toHaveLength(1);
  });

  it("ユーザー名の変更で、同じ外部アカウントの旧ユーザー名・旧プロフィールURLを新しい値へ置き換える", async () => {
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();
    const suffix = createRandomId().slice(0, 8).toLowerCase();
    await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, `old-${suffix}`) },
    );

    await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, `new-${suffix}`) },
    );

    expect(await readIdentifierActivity(userId)).toEqual({
      [`provider_account:${githubId}`]: true,
      [`provider_username:new-${suffix}`]: true,
      [`url:https://github.com/new-${suffix}`]: true,
    });
    expect(await readOAuthCoveredValues(authAccountId)).toEqual(
      [githubId, `new-${suffix}`, `https://github.com/new-${suffix}`].sort(),
    );
  });

  it("改名後のプロフィールURLを本人が別の行に候補として保存していても、OAuthの行へ移して有効にする", async () => {
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();
    const suffix = createRandomId().slice(0, 8).toLowerCase();
    const first = await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, `old-${suffix}`) },
    );
    const candidate = await saveUnverifiedUrl(
      { db },
      { userId, url: `https://github.com/new-${suffix}` },
    );

    await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, `new-${suffix}`) },
    );

    expect(await readIdentifierActivity(userId)).toEqual({
      [`provider_account:${githubId}`]: true,
      [`provider_username:new-${suffix}`]: true,
      [`url:https://github.com/new-${suffix}`]: true,
    });
    expect(await readOAuthCoveredValues(authAccountId)).toEqual(
      [githubId, `new-${suffix}`, `https://github.com/new-${suffix}`].sort(),
    );
    expect(
      await db.select({ id: externalAccounts.id }).from(externalAccounts).where(eq(externalAccounts.userId, userId)),
    ).toEqual([{ id: first.externalAccountId }]);
    expect(candidate.externalAccountId).not.toBe(first.externalAccountId);
  });

  it("URLが上限に達していても、本人の別の行から移すプロフィールURLはOAuthの行へ移す", async () => {
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();
    const suffix = createRandomId().slice(0, 8).toLowerCase();
    await fillUrlIdentifiers(userId, urlIdentifierLimitPerUser - 1);
    await saveUnverifiedUrl({ db }, { userId, url: `https://github.com/new-${suffix}` });
    // 上限に達しているため、改名前のOAuthの行はプロフィールURLを持たない。
    await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, `old-${suffix}`) },
    );

    await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, `new-${suffix}`) },
    );

    expect(await readOAuthCoveredValues(authAccountId)).toEqual(
      [githubId, `new-${suffix}`, `https://github.com/new-${suffix}`].sort(),
    );
    expect(await readIdentifierActivity(userId)).toMatchObject({
      [`url:https://github.com/new-${suffix}`]: true,
    });
  });

  it("改名で置き換えた旧プロフィールURLを証拠とするリンク証明も削除する", async () => {
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();
    const suffix = createRandomId().slice(0, 8).toLowerCase();
    const oldUrl = `https://github.com/old-${suffix}`;
    const { externalAccountId } = await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, `old-${suffix}`) },
    );
    const [oldIdentifier] = await db
      .select({ id: externalIdentifiers.id })
      .from(externalIdentifiers)
      .where(and(eq(externalIdentifiers.userId, userId), eq(externalIdentifiers.value, oldUrl)));
    const linkVerificationId = createRandomId("evf_");
    await db.insert(externalAccountVerifications).values({
      id: linkVerificationId,
      accountId: externalAccountId,
      method: "bidirectional_link",
      evidenceKey: oldUrl,
      verifiedAt: now,
      checkedAt: now,
      result: "verified",
    });
    await db
      .insert(verificationIdentifiers)
      .values({ verificationId: linkVerificationId, identifierId: oldIdentifier?.id ?? "" });

    await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, `new-${suffix}`) },
    );

    expect(
      await db
        .select()
        .from(externalAccountVerifications)
        .where(eq(externalAccountVerifications.id, linkVerificationId)),
    ).toEqual([]);
    expect(await readIdentifierActivity(userId)).not.toHaveProperty(`url:${oldUrl}`);
  });

  it("他ユーザーが有効に保持するプロフィールURLを本人へ移動し、旧所有者の他の識別子と証明は残す", async () => {
    const login = `Carol-${createRandomId().slice(0, 8)}`;
    const previousOwner = await createUserWithGitHubAccount();
    const otherUrl = `https://${login.toLowerCase()}.example/`;
    const sharedAccount = await createLinkVerifiedAccount(previousOwner.userId, [
      `https://github.com/${login}`,
      otherUrl,
    ]);
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();

    const result = await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, login) },
    );

    expect(result.affectedUserIds).toEqual([userId, previousOwner.userId]);
    expect(await readIdentifierActivity(userId)).toMatchObject({
      [`url:https://github.com/${login}`]: true,
    });
    expect(await readIdentifierActivity(previousOwner.userId)).toEqual({
      [`url:${otherUrl}`]: true,
    });
    expect(
      await db
        .select({ id: externalAccountVerifications.id })
        .from(externalAccountVerifications)
        .where(eq(externalAccountVerifications.id, sharedAccount.verificationId)),
    ).toHaveLength(1);
  });

  it("移動で識別子が無くなった旧所有者の証明と外部アカウント行を削除する", async () => {
    const login = `Dave-${createRandomId().slice(0, 8)}`;
    const previousOwner = await createUserWithGitHubAccount();
    const movedAccount = await createLinkVerifiedAccount(previousOwner.userId, [
      `https://github.com/${login}`,
    ]);
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();

    await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, login) },
    );

    expect(
      await db
        .select()
        .from(externalAccounts)
        .where(eq(externalAccounts.id, movedAccount.accountId)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(externalAccountVerifications)
        .where(eq(externalAccountVerifications.id, movedAccount.verificationId)),
    ).toEqual([]);
  });

  it("本人のURLが上限に達している場合は、URL識別子だけを追加しない", async () => {
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();
    const fillerAccountId = createRandomId("eac_");
    await db.insert(externalAccounts).values({ id: fillerAccountId, userId });
    // D1の1文100バインド変数の上限に収まるよう、10行ずつ投入する。
    for (let start = 0; start < urlIdentifierLimitPerUser; start += 10) {
      await db.insert(externalIdentifiers).values(
        Array.from({ length: 10 }, (_, offset) => ({
          id: createRandomId("eid_"),
          accountId: fillerAccountId,
          userId,
          kind: "url" as const,
          value: `https://filler.example/${start + offset}`,
          host: "filler.example",
        })),
      );
    }
    const login = `Erin-${createRandomId().slice(0, 8)}`;

    await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, login) },
    );

    const oauthIdentifiers = await db
      .select({ kind: externalIdentifiers.kind })
      .from(externalIdentifiers)
      .where(
        and(eq(externalIdentifiers.userId, userId), eq(externalIdentifiers.host, "github.com")),
      );
    expect(oauthIdentifiers).toEqual([]);
    expect(await readIdentifierActivity(userId)).toMatchObject({
      [`provider_account:${githubId}`]: true,
      [`provider_username:${login.toLowerCase()}`]: true,
    });
  });
  it("同じプロフィールURLを先に登録した本人の行へ、OAuthの証明と識別子を加える", async () => {
    const login = `frank-${createRandomId().slice(0, 8).toLowerCase()}`;
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();
    const registered = await createLinkVerifiedAccount(userId, [`https://github.com/${login}`]);

    const result = await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: githubProfile(githubId, login) },
    );

    expect(result.externalAccountId).toBe(registered.accountId);
    expect(
      await db.select().from(externalAccounts).where(eq(externalAccounts.userId, userId)),
    ).toHaveLength(1);
    expect(await readOAuthCoveredValues(authAccountId)).toEqual(
      [githubId, login, `https://github.com/${login}`].sort(),
    );
  });

  it("復元した候補の行をOAuthで有効にするとき、Providerが表示名を返さなくてもJSONの表示名を採用しない", async () => {
    const login = `ivan-${createRandomId().slice(0, 8).toLowerCase()}`;
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();
    const candidate = await saveUnverifiedUrl({ db }, { userId, url: `https://github.com/${login}` });
    await db
      .update(externalAccounts)
      .set({ service: "orcid", displayName: "JSON名" })
      .where(eq(externalAccounts.id, candidate.externalAccountId));

    await syncOAuthAccount(
      { db, now },
      { userId, authAccountId, profile: { ...githubProfile(githubId, login), displayName: null } },
    );

    expect(
      await db.select().from(externalAccounts).where(eq(externalAccounts.userId, userId)),
    ).toEqual([
      expect.objectContaining({
        id: candidate.externalAccountId,
        service: "github",
        displayName: null,
      }),
    ]);
  });

  it("他ユーザーに支えを失った固有IDが有効なまま残っていても、本人の固有IDを有効にする", async () => {
    const { userId, authAccountId, githubId } = await createUserWithGitHubAccount();
    const previousOwner = await createUserWithGitHubAccount();
    const staleAccountId = createRandomId("eac_");
    await db.insert(externalAccounts).values({ id: staleAccountId, userId: previousOwner.userId });
    await db.insert(externalIdentifiers).values({
      id: createRandomId("eid_"),
      accountId: staleAccountId,
      userId: previousOwner.userId,
      kind: "provider_account",
      provider: "github",
      value: githubId,
      isActive: true,
    });

    await syncOAuthAccount(
      { db, now },
      {
        userId,
        authAccountId,
        profile: githubProfile(githubId, `grace-${createRandomId().slice(0, 8)}`),
      },
    );

    expect(await readIdentifierActivity(userId)).toMatchObject({
      [`provider_account:${githubId}`]: true,
    });
    expect(await readIdentifierActivity(previousOwner.userId)).toEqual({
      [`provider_account:${githubId}`]: false,
    });
  });
});
