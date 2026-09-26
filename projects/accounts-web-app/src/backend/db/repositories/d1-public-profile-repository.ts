import { and, eq, isNotNull, sql } from "drizzle-orm";

import type { Database } from "../database";
import { externalAccounts, externalAccountVerifications, externalIdentifiers, user } from "../schema";

/**
 * 公開プロフィールと公開プロフィールのpurge対象の判定に使う読取。
 * banされたユーザーは存在しないユーザーと同じ扱いにする。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export class D1PublicProfileRepository {
  constructor(private readonly db: Database) {}

  /**
   * 存在し、banされていないユーザーの表示名を読む。
   */
  async findVisibleUser(userId: string): Promise<{ id: string; name: string } | undefined> {
    return this.db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, userId), sql`coalesce(${user.banned}, 0) = 0`))
      .get();
  }

  /**
   * 一般公開を許可した外部アカウント行を、有効な識別子と成功したことのある証明とともに読む。
   * 有効な識別子を持たない行（候補だけの行）は呼出し側で除く。
   */
  async findPublicExternalAccounts(userId: string) {
    return this.db.query.externalAccounts.findMany({
      columns: { id: true, service: true, displayName: true, linkedAt: true },
      where: and(eq(externalAccounts.userId, userId), sql`${externalAccounts.isPublic} = 1`),
      orderBy: [sql`${externalAccounts.linkedAt} is null`, externalAccounts.linkedAt],
      with: {
        externalIdentifiers: {
          columns: { kind: true, provider: true, value: true },
          where: sql`${externalIdentifiers.isActive} = 1`,
          orderBy: [externalIdentifiers.kind, externalIdentifiers.value],
        },
        externalAccountVerifications: {
          columns: {
            method: true,
            verifiedAt: true,
            checkedAt: true,
            result: true,
            evidenceUrl: true,
          },
          where: isNotNull(externalAccountVerifications.verifiedAt),
          orderBy: [externalAccountVerifications.method],
        },
      },
    });
  }

  /**
   * 一般公開を許可した外部アカウント行を持つかを返す。
   */
  async hasPublicExternalAccount(userId: string): Promise<boolean> {
    const row = await this.db
      .select({ id: externalAccounts.id })
      .from(externalAccounts)
      .where(and(eq(externalAccounts.userId, userId), sql`${externalAccounts.isPublic} = 1`))
      .limit(1)
      .get();
    return row !== undefined;
  }
}
