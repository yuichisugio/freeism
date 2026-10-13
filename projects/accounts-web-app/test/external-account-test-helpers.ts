import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDatabase } from "../src/backend/db/database";
import { createRandomId } from "../src/backend/db/id";
import {
  externalAccounts,
  externalAccountVerifications,
  externalIdentifiers,
  user,
  verificationIdentifiers,
} from "../src/backend/db/schema";
import type { VerificationMethod } from "../src/backend/domain/identity/verification-method";

/**
 * 外部アカウント・識別子・証明を扱うWorkers結合テストの共通部品。
 * @see ../src/backend/usecases/verify-url.worker.test.ts
 */

export const testDb = createDatabase(env.DB);

// --------------------------------------------------
// テストデータ
// --------------------------------------------------

/**
 * 認証の標準処理を通さずに、ユーザー行だけを作る。
 */
export async function createTestUser(): Promise<string> {
  const userId = createRandomId("ausr_");
  await testDb
    .insert(user)
    .values({ id: userId, name: "仮ユーザー", email: `${userId}@example.com` });
  return userId;
}

/**
 * テストごとに重ならないhostを作る。
 */
export function uniqueHost(): string {
  return `${createRandomId().slice(0, 10).toLowerCase().replace(/[^a-z0-9]/g, "x")}.example.com`;
}

/**
 * 指定した方法の成功証明で、URLを有効に保持する外部アカウントを作る。
 */
export async function createVerifiedUrlAccount(
  userId: string,
  urls: string[],
  method: Exclude<VerificationMethod, "oauth">,
  verifiedAt: Date,
) {
  const accountId = createRandomId("eac_");
  const verificationId = createRandomId("evf_");
  const identifierIds = urls.map(() => createRandomId("eid_"));
  await testDb.insert(externalAccounts).values({ id: accountId, userId, linkedAt: verifiedAt });
  await testDb.insert(externalIdentifiers).values(
    urls.map((url, index) => ({
      id: identifierIds[index] ?? "",
      accountId,
      userId,
      kind: "url" as const,
      value: url,
      host: new URL(url).hostname,
      isActive: true,
    })),
  );
  await testDb.insert(externalAccountVerifications).values({
    id: verificationId,
    accountId,
    method,
    evidenceKey: method === "dns_txt" ? new URL(urls[0] ?? "").hostname : (urls[0] ?? ""),
    verifiedAt,
    checkedAt: verifiedAt,
    result: "verified",
  });
  await testDb
    .insert(verificationIdentifiers)
    .values(identifierIds.map((identifierId) => ({ verificationId, identifierId })));
  return { accountId, verificationId };
}

/**
 * 本人の`url`行を上限まで候補として作る。
 * D1の1文100バインド変数の上限に収まるよう、10行ずつ投入する。
 */
export async function fillUrlIdentifiers(userId: string, count: number): Promise<void> {
  const accountId = createRandomId("eac_");
  await testDb.insert(externalAccounts).values({ id: accountId, userId });
  for (let start = 0; start < count; start += 10) {
    await testDb.insert(externalIdentifiers).values(
      Array.from({ length: Math.min(10, count - start) }, (_, offset) => ({
        id: createRandomId("eid_"),
        accountId,
        userId,
        kind: "url" as const,
        value: `https://filler.example.com/${start + offset}`,
        host: "filler.example.com",
      })),
    );
  }
}

// --------------------------------------------------
// 状態の読取
// --------------------------------------------------

/**
 * ユーザーの識別子を`kind:value → is_active`の形で読む。
 */
export async function readIdentifierActivity(userId: string) {
  const identifiers = await testDb
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
 * 外部アカウント行の証明を、方法・証拠キーと確認した識別子の値とともに読む。
 */
export async function readVerifications(accountId: string) {
  const verifications = await testDb.query.externalAccountVerifications.findMany({
    where: eq(externalAccountVerifications.accountId, accountId),
    with: { verificationIdentifiers: { with: { identifier: true } } },
  });
  return verifications.map(({ verificationIdentifiers: covered, ...verification }) => ({
    ...verification,
    coveredValues: covered.map((row) => row.identifier.value).sort(),
  }));
}

/**
 * ユーザーの外部アカウント行を読む。
 */
export async function readExternalAccounts(userId: string) {
  return testDb.select().from(externalAccounts).where(eq(externalAccounts.userId, userId));
}
