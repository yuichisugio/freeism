import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import {
  createTestUser,
  createVerifiedUrlAccount,
  fillUrlIdentifiers,
  readIdentifierActivity,
  testDb,
  uniqueHost,
} from "../../../../test/external-account-test-helpers";
import { backupSchema, type Backup } from "../../../shared/schemas/backup-schema";
import { createRandomId } from "../../db/id";
import {
  clientConsents,
  externalAccounts,
  externalAccountVerifications,
  externalAccountVisibility,
  externalIdentifiers,
  oauthClient,
  oauthConsent,
  user,
} from "../../db/schema";
import { ProblemError } from "../../problem-details";
import { exportBackup } from "./export-backup";
import { restoreBackup } from "./restore-backup";

const verifiedAt = new Date("2026-09-01T00:00:00.000Z");
const now = new Date("2026-09-26T00:00:00.000Z");

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

/**
 * 登録済みのOAuthクライアント行を作り、Client IDを返す。
 */
async function createClient(name: string): Promise<string> {
  const clientId = createRandomId("client-");
  await testDb.insert(oauthClient).values({ id: createRandomId(), clientId, name, redirectUris: [] });
  return clientId;
}

/**
 * 証明済みの外部アカウント（URL 2件をリンク証明）と未検証のURLを持ち、登録済みクライアントと存在しないClient IDに同意したユーザーを作る。
 */
async function createUserWithBackupTargets() {
  const userId = await createTestUser();
  await testDb.update(user).set({ name: "バックアップ時の名前" }).where(eq(user.id, userId));
  const host = uniqueHost();
  const clientId = await createClient("Points");
  const missingClientId = createRandomId("deleted-client-");

  const verified = await createVerifiedUrlAccount(
    userId,
    [`https://${host}/alice`, `https://${host}/about`],
    "bidirectional_link",
    verifiedAt,
  );
  await testDb.update(externalAccounts).set({ isPublic: true }).where(eq(externalAccounts.id, verified.accountId));

  const unverifiedAccountId = createRandomId("eac_");
  await testDb.insert(externalAccounts).values({ id: unverifiedAccountId, userId });
  await testDb.insert(externalIdentifiers).values({
    id: createRandomId("eid_"),
    accountId: unverifiedAccountId,
    userId,
    kind: "url",
    value: `https://${host}/draft`,
    host,
  });

  await testDb.insert(clientConsents).values([
    { userId, clientId, displayName: "Points", consented: true },
    { userId, clientId: missingClientId, displayName: "Deleted client", consented: true },
  ]);
  await testDb.insert(externalAccountVisibility).values([
    { accountId: verified.accountId, clientId, isPublic: true },
    { accountId: verified.accountId, clientId: missingClientId, isPublic: true },
    { accountId: unverifiedAccountId, clientId, isPublic: false },
  ]);

  return { userId, host, clientId, missingClientId, verifiedAccountId: verified.accountId, unverifiedAccountId };
}

/**
 * 本人のバックアップJSONを出力し、復元の入力と同じく共有schemaで検査して読む。
 */
async function exportAndParse(userId: string): Promise<Backup> {
  const { json } = await exportBackup(
    { db: testDb, accountsOrigin: env.ACCOUNTS_ORIGIN, now },
    { userId },
  );
  return v.parse(backupSchema, JSON.parse(json));
}

function restore(userId: string, backup: Backup) {
  return restoreBackup({ db: testDb, now }, { userId, backup });
}

// --------------------------------------------------
// 状態の読取
// --------------------------------------------------

/**
 * 本人の表示名・外部アカウント・識別子・証明・公開選択・同意を、比較できる形で読む。
 */
async function readUserState(userId: string) {
  const [userRow] = await testDb.select({ name: user.name }).from(user).where(eq(user.id, userId));
  const accounts = await testDb
    .select()
    .from(externalAccounts)
    .where(eq(externalAccounts.userId, userId))
    .orderBy(externalAccounts.id);
  return {
    name: userRow?.name,
    accounts,
    identifiers: await testDb
      .select()
      .from(externalIdentifiers)
      .where(eq(externalIdentifiers.userId, userId))
      .orderBy(externalIdentifiers.id),
    verifications: await testDb
      .select({ verification: externalAccountVerifications })
      .from(externalAccountVerifications)
      .innerJoin(externalAccounts, eq(externalAccounts.id, externalAccountVerifications.accountId))
      .where(eq(externalAccounts.userId, userId))
      .orderBy(externalAccountVerifications.id),
    visibility: await testDb
      .select({ visibility: externalAccountVisibility })
      .from(externalAccountVisibility)
      .innerJoin(externalAccounts, eq(externalAccounts.id, externalAccountVisibility.accountId))
      .where(eq(externalAccounts.userId, userId))
      .orderBy(externalAccountVisibility.accountId, externalAccountVisibility.clientId),
    consents: await testDb
      .select()
      .from(clientConsents)
      .where(eq(clientConsents.userId, userId))
      .orderBy(clientConsents.clientId),
  };
}

/**
 * 外部アカウント行のクライアント別の公開選択を`clientId → isPublic`の形で読む。
 */
async function readVisibility(accountId: string) {
  const rows = await testDb
    .select()
    .from(externalAccountVisibility)
    .where(eq(externalAccountVisibility.accountId, accountId));
  return Object.fromEntries(rows.map((row) => [row.clientId, row.isPublic]));
}

/**
 * 本人の情報提供同意を`clientId → consented`の形で読む。
 */
async function readConsents(userId: string) {
  const rows = await testDb.select().from(clientConsents).where(eq(clientConsents.userId, userId));
  return Object.fromEntries(rows.map((row) => [row.clientId, row.consented]));
}

// --------------------------------------------------
// 出力→変更→復元
// --------------------------------------------------

describe("restoreBackup", () => {
  it("行全体を解除した外部アカウントを候補として取り込み、公開設定・同意・表示名をバックアップ時に戻す", async () => {
    const target = await createUserWithBackupTargets();
    const backup = await exportAndParse(target.userId);

    // 退会せずに一部を解除し、設定を変更する。
    await testDb.delete(externalAccounts).where(eq(externalAccounts.id, target.verifiedAccountId));
    await testDb
      .update(externalAccountVisibility)
      .set({ isPublic: true })
      .where(eq(externalAccountVisibility.accountId, target.unverifiedAccountId));
    await testDb.update(clientConsents).set({ consented: false }).where(eq(clientConsents.userId, target.userId));
    await testDb.update(user).set({ name: "変更後の名前" }).where(eq(user.id, target.userId));

    const result = await restore(target.userId, backup);

    expect(result).toEqual({
      updatedAccountCount: 1,
      addedCandidateCount: 1,
      clientConsentCount: 2,
      affectedUserIds: [target.userId],
    });
    const state = await readUserState(target.userId);
    expect(state.name).toBe("バックアップ時の名前");
    expect(await readConsents(target.userId)).toEqual({
      [target.clientId]: true,
      [target.missingClientId]: true,
    });
    // 出力は`clientConsents`の各Client IDを網羅するため、設定行が無かったクライアントも非公開として保存する。
    expect(await readVisibility(target.unverifiedAccountId)).toEqual({
      [target.clientId]: false,
      [target.missingClientId]: false,
    });

    // 解除した行は、過去の証明情報を参考として持つ候補になり、現在の証明にはならない。
    const candidate = state.accounts.find((account) => account.id !== target.unverifiedAccountId);
    expect(candidate).toEqual(
      expect.objectContaining({ isPublic: true, linkedAt: null, importedVerificationsJson: expect.any(String) }),
    );
    expect(JSON.parse(candidate?.importedVerificationsJson ?? "null")).toEqual([
      expect.objectContaining({ method: "bidirectional_link", verifiedAt: verifiedAt.toISOString() }),
    ]);
    expect(await readVisibility(candidate?.id ?? "")).toEqual({
      [target.clientId]: true,
      [target.missingClientId]: true,
    });
    expect(state.verifications).toEqual([]);
    expect(await readIdentifierActivity(target.userId)).toEqual({
      [`url:https://${target.host}/alice`]: false,
      [`url:https://${target.host}/about`]: false,
      [`url:https://${target.host}/draft`]: false,
    });
  });

  it("本人に有効な外部アカウントは証明・連携日時・検証日時を維持して公開選択だけを戻す", async () => {
    const target = await createUserWithBackupTargets();
    const backup = await exportAndParse(target.userId);
    await testDb
      .update(externalAccounts)
      .set({ isPublic: false })
      .where(eq(externalAccounts.id, target.verifiedAccountId));
    await testDb
      .delete(externalAccountVisibility)
      .where(eq(externalAccountVisibility.accountId, target.verifiedAccountId));
    const before = await readUserState(target.userId);

    await restore(target.userId, backup);

    const after = await readUserState(target.userId);
    expect(after.verifications).toEqual(before.verifications);
    expect(after.identifiers).toEqual(before.identifiers);
    expect(after.accounts.find((account) => account.id === target.verifiedAccountId)).toEqual(
      expect.objectContaining({ isPublic: true, linkedAt: verifiedAt, importedVerificationsJson: null }),
    );
    expect(await readVisibility(target.verifiedAccountId)).toEqual({
      [target.clientId]: true,
      [target.missingClientId]: true,
    });
  });

  it("2回目の復元は同じ状態を保つ（冪等）", async () => {
    const target = await createUserWithBackupTargets();
    const backup = await exportAndParse(target.userId);
    await testDb.delete(externalAccounts).where(eq(externalAccounts.id, target.verifiedAccountId));

    await restore(target.userId, backup);
    const first = await readUserState(target.userId);
    const second = await restore(target.userId, backup);

    expect(second).toEqual(expect.objectContaining({ updatedAccountCount: 2, addedCandidateCount: 0 }));
    expect(await readUserState(target.userId)).toEqual(first);
  });

  it("出力元のoriginとユーザーが異なるJSONも、同じ規則で本人へ復元する", async () => {
    const source = await createUserWithBackupTargets();
    const backup = await exportAndParse(source.userId);
    const destinationUserId = await createTestUser();

    const result = await restore(destinationUserId, {
      ...backup,
      accountsOrigin: "https://accounts.other.example",
    });

    expect(result).toEqual(expect.objectContaining({ updatedAccountCount: 0, addedCandidateCount: 2 }));
    // 出力元ユーザーが有効に保持する識別子は、復元先では候補になる。
    expect(await readIdentifierActivity(destinationUserId)).toEqual({
      [`url:https://${source.host}/alice`]: false,
      [`url:https://${source.host}/about`]: false,
      [`url:https://${source.host}/draft`]: false,
    });
    expect(await readIdentifierActivity(source.userId)).toEqual({
      [`url:https://${source.host}/alice`]: true,
      [`url:https://${source.host}/about`]: true,
      [`url:https://${source.host}/draft`]: false,
    });
  });

  it("同じ識別子を持つ複数のJSONアカウントを1行にまとめ、UNIQUE制約に違反しない", async () => {
    const userId = await createTestUser();
    const host = uniqueHost();
    const account = (urls: string[]) => ({
      metadata: {
        service: null,
        displayName: null,
        identifiers: urls.map((url) => ({ type: "url" as const, url })),
        linkedAt: null,
        verificationStatus: "unverified" as const,
        verifications: [],
      },
      isPublic: false,
      clientVisibility: [],
    });

    const result = await restore(userId, {
      schemaVersion: 1,
      accountsOrigin: env.ACCOUNTS_ORIGIN,
      accountsUserId: userId,
      exportedAt: now.toISOString(),
      profile: { displayName: "本人" },
      clientConsents: [],
      externalAccounts: [
        account([`https://${host}/a`, `https://${host}/b`]),
        account([`https://${host.toUpperCase()}/b`, `https://${host}/c`]),
      ],
    });

    expect(result).toEqual(expect.objectContaining({ addedCandidateCount: 1 }));
    const state = await readUserState(userId);
    expect(state.accounts).toHaveLength(1);
    expect(state.identifiers.map((identifier) => identifier.value).sort()).toEqual([
      `https://${host}/a`,
      `https://${host}/b`,
      `https://${host}/c`,
    ]);
  });

  it("バックアップのclientConsentsに無いクライアントの同意と公開選択を維持する", async () => {
    const target = await createUserWithBackupTargets();
    const backup = await exportAndParse(target.userId);
    const laterClientId = await createClient("Later");
    await testDb.insert(clientConsents).values({
      userId: target.userId,
      clientId: laterClientId,
      displayName: "Later",
      consented: true,
    });
    await testDb
      .insert(externalAccountVisibility)
      .values({ accountId: target.verifiedAccountId, clientId: laterClientId, isPublic: true });

    await restore(target.userId, backup);

    expect((await readConsents(target.userId))[laterClientId]).toBe(true);
    expect((await readVisibility(target.verifiedAccountId))[laterClientId]).toBe(true);
  });

  it("同意をOFFに戻すクライアントの標準`oauthConsent`を削除する", async () => {
    const target = await createUserWithBackupTargets();
    const backup = await exportAndParse(target.userId);
    await testDb.insert(oauthConsent).values({
      id: createRandomId(),
      clientId: target.clientId,
      userId: target.userId,
      scopes: ["openid"],
      createdAt: now,
      updatedAt: now,
    });

    await restore(target.userId, {
      ...backup,
      clientConsents: backup.clientConsents.map((consent) => ({ ...consent, consented: false })),
    });

    expect(
      await testDb
        .select()
        .from(oauthConsent)
        .where(and(eq(oauthConsent.userId, target.userId), eq(oauthConsent.clientId, target.clientId))),
    ).toEqual([]);
  });

  // --------------------------------------------------
  // 入力不備と上限
  // --------------------------------------------------

  it("復元後のURLが150件を超える場合は全体を止め、データを変更しない", async () => {
    const target = await createUserWithBackupTargets();
    const backup = await exportAndParse(target.userId);
    // 本人の`url`行を149件にしてから、新しいURLを2件含むJSONを復元する。
    await fillUrlIdentifiers(target.userId, 146);
    const [first] = backup.externalAccounts;
    if (!first) throw new Error("テストデータが不正です");
    const host = uniqueHost();
    const before = await readUserState(target.userId);

    const restoring = restore(target.userId, {
      ...backup,
      profile: { displayName: "反映されない名前" },
      externalAccounts: [
        ...backup.externalAccounts,
        {
          ...first,
          metadata: {
            ...first.metadata,
            identifiers: [
              { type: "url", url: `https://${host}/1` },
              { type: "url", url: `https://${host}/2` },
            ],
            verifications: [],
          },
        },
      ],
    });

    await expect(restoring).rejects.toThrow(ProblemError);
    await expect(restoring).rejects.toMatchObject({
      status: 400,
      issues: [expect.objectContaining({ code: "URL_LIMIT_REACHED", path: null })],
    });
    expect(await readUserState(target.userId)).toEqual(before);
  });

  it("件数上限いっぱいの入力（300件×20識別子）を1回のbatchで確定する", async () => {
    const userId = await createTestUser();
    const valueOf = (accountIndex: number, identifierIndex: number) =>
      `${String(accountIndex).padStart(3, "0")}-${String(identifierIndex).padStart(2, "0")}-${"x".repeat(200)}`;
    const identifiersOf = (accountIndex: number) =>
      Array.from({ length: 20 }, (_, identifierIndex) => ({
        type: "provider_username" as const,
        provider: "gitlab" as const,
        username: valueOf(accountIndex, identifierIndex),
      }));
    const backup: Backup = {
      schemaVersion: 1,
      accountsOrigin: env.ACCOUNTS_ORIGIN,
      accountsUserId: userId,
      exportedAt: now.toISOString(),
      profile: { displayName: "本人" },
      clientConsents: [{ clientId: "points-client", displayName: "Points", consented: true }],
      externalAccounts: Array.from({ length: 300 }, (_, accountIndex) => ({
        metadata: {
          service: "gitlab",
          displayName: `Account ${accountIndex}`,
          identifiers: identifiersOf(accountIndex),
          linkedAt: null,
          verificationStatus: "unverified",
          verifications: Array.from({ length: 2 }, () => ({
            method: "bidirectional_link" as const,
            identifiers: identifiersOf(accountIndex),
            verifiedAt: verifiedAt.toISOString(),
            checkedAt: verifiedAt.toISOString(),
            result: "verified" as const,
            evidenceUrl: "https://gitlab.com/example",
          })),
        },
        isPublic: true,
        clientVisibility: [{ clientId: "points-client", isPublic: true }],
      })),
    };
    const inputBytes = new TextEncoder().encode(JSON.stringify(backup)).length;
    expect(inputBytes).toBeGreaterThan(4_500_000);
    expect(inputBytes).toBeLessThanOrEqual(5_242_880);

    const startedAt = performance.now();
    const result = await restore(userId, backup);
    const durationMs = performance.now() - startedAt;
    console.log(JSON.stringify({ event: "backup_restore_max_input", inputBytes, durationMs }));

    expect(result).toEqual(expect.objectContaining({ addedCandidateCount: 300 }));
    const state = await readUserState(userId);
    expect(state.identifiers).toHaveLength(6000);
    expect(state.visibility).toHaveLength(300);
  });
});
