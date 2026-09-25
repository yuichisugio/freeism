import { and, eq, isNotNull, sql } from "drizzle-orm";

import type { IdentifierKey } from "../../domain/identity/identifier-key";
import type { Database } from "../database";
import {
  clientConsents,
  externalAccounts,
  externalAccountVerifications,
  externalAccountVisibility,
  externalIdentifiers,
  user,
  verificationIdentifiers,
} from "../schema";

/**
 * 資源APIの読取。
 * 提供の条件は、ユーザーが存在してbanされておらず、問い合わせ元への情報提供同意がONで、
 * 外部アカウントを問い合わせ元へ公開選択し、識別子が現在有効で成功した証明の対象に含まれることとする。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */

/**
 * 照合1件の該当。
 * `inputIndex`は照合に渡した配列での位置。
 */
export type ResolvedRow = { inputIndex: number; userId: string };

/**
 * 識別子と照合する値。
 */
export type ResolveKey = Pick<IdentifierKey, "kind" | "provider" | "value">;

export class D1ResourceApiRepository {
  constructor(private readonly db: Database) {}

  // --------------------------------------------------
  // 一覧取得
  // --------------------------------------------------

  /**
   * ユーザーが存在してbanされておらず、クライアントへの情報提供同意がONか確認する。
   */
  async hasConsentedUser(userId: string, clientId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: user.id })
      .from(user)
      .innerJoin(
        clientConsents,
        and(
          eq(clientConsents.userId, user.id),
          eq(clientConsents.clientId, clientId),
          eq(clientConsents.consented, true),
        ),
      )
      .where(and(eq(user.id, userId), sql`coalesce(${user.banned}, 0) = 0`))
      .limit(1);
    return row !== undefined;
  }

  /**
   * クライアントへの公開を選択した本人の外部アカウント行を、有効な識別子と成功した証明とともに読む。
   * 有効な識別子の無い行（候補だけの行）の除外と、証明が確認した識別子の絞込みは呼出し側で行う。
   */
  async findVisibleExternalAccounts(userId: string, clientId: string) {
    return this.db.query.externalAccounts.findMany({
      where: eq(externalAccounts.userId, userId),
      orderBy: [sql`${externalAccounts.linkedAt} is null`, externalAccounts.linkedAt],
      with: {
        externalAccountVisibility: {
          columns: { clientId: true },
          where: and(
            eq(externalAccountVisibility.clientId, clientId),
            eq(externalAccountVisibility.isPublic, true),
          ),
        },
        externalIdentifiers: { where: eq(externalIdentifiers.isActive, true) },
        externalAccountVerifications: {
          where: isNotNull(externalAccountVerifications.verifiedAt),
          with: { verificationIdentifiers: { with: { identifier: true } } },
        },
      },
    });
  }

  // --------------------------------------------------
  // 照合
  // --------------------------------------------------

  /**
   * 識別子キーの配列を1つのバインド値で渡し、クライアントへの提供条件を満たす現在の所有者を読む。
   * 有効な識別子は部分UNIQUEで所有者が最大1人のため、入力1件に該当は最大1行になる。
   */
  async resolveIdentifierKeys(
    clientId: string,
    keys: readonly ResolveKey[],
  ): Promise<ResolvedRow[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.db.all<ResolvedRow>(sql`
      select j.key as inputIndex, ei.user_id as userId
      from json_each(${JSON.stringify(keys)}) j
      inner join ${externalIdentifiers} ei
        on ei.kind = json_extract(j.value, '$.kind')
        and ei.provider = json_extract(j.value, '$.provider')
        and ei.issuer = ''
        and ei.value = json_extract(j.value, '$.value')
        and ei.is_active = 1
      inner join ${user} u on u.id = ei.user_id and coalesce(u.banned, 0) = 0
      inner join ${clientConsents} cc
        on cc.user_id = ei.user_id and cc.client_id = ${clientId} and cc.consented = 1
      inner join ${externalAccountVisibility} v
        on v.account_id = ei.account_id and v.client_id = ${clientId} and v.is_public = 1
      where exists (
        select 1 from ${verificationIdentifiers} vi
        inner join ${externalAccountVerifications} ev on ev.id = vi.verification_id
        where vi.identifier_id = ei.id and ev.verified_at is not null
      )
    `);
  }

  /**
   * AccountsユーザーIDの配列を1つのバインド値で渡し、存在してbanされておらず、クライアントへの情報提供同意がONのユーザーを読む。
   */
  async resolveAccountsUsers(clientId: string, userIds: readonly string[]): Promise<ResolvedRow[]> {
    if (userIds.length === 0) {
      return [];
    }

    return this.db.all<ResolvedRow>(sql`
      select j.key as inputIndex, u.id as userId
      from json_each(${JSON.stringify(userIds)}) j
      inner join ${user} u on u.id = j.value and coalesce(u.banned, 0) = 0
      inner join ${clientConsents} cc
        on cc.user_id = u.id and cc.client_id = ${clientId} and cc.consented = 1
    `);
  }
}
