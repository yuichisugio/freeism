import { and, eq, inArray, not, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { jsonEachValues, type Database, type DatabaseBatchItem } from "../database";
import { externalAccountVisibility, externalIdentifiers, oauthConsent, user } from "../schema";

/**
 * OAuthクライアントへの提供の判定と、提供していない組の標準`oauthConsent`の整理。
 * ユーザーがクライアントへ提供しているとは、そのクライアントへの公開を選択した外部アカウントのうち、有効な識別子（成功した証明の対象）を持つものが1件以上あることとする。
 * 資源APIの一覧・照合、同意画面の同意の受付、`oauthConsent`の整理で同じ条件を使う。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../routes/resource-api-routes.worker.test.ts
 * @see ../../routes/consent-flow.worker.test.ts
 */

// --------------------------------------------------
// 提供の条件
// --------------------------------------------------

/**
 * ユーザーがクライアントへ提供している条件（`exists`副問合せ）。
 * 列やSQL断片を渡すと相関副問合せになり、文字列はバインド値になる。
 * 本人の識別子を`user_id`の索引で読み、公開選択を主キー`(account_id, client_id)`で確認する。
 */
export function providedToClient(
  userId: SQLWrapper | string,
  clientId: SQLWrapper | string,
): SQL {
  return sql`exists (select 1 from ${externalIdentifiers} provided_identifier inner join ${externalAccountVisibility} provided_visibility on provided_visibility.account_id = provided_identifier.account_id and provided_visibility.client_id = ${clientId} and provided_visibility.is_public = 1 where provided_identifier.user_id = ${userId} and provided_identifier.is_active = 1)`;
}

// --------------------------------------------------
// リポジトリ
// --------------------------------------------------

export class D1ClientProvisionRepository {
  constructor(private readonly db: Database) {}

  /**
   * ユーザーがクライアントへ提供しているか確認する。
   */
  async isProvided(userId: string, clientId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, userId), providedToClient(user.id, clientId)))
      .limit(1);
    return row !== undefined;
  }

  /**
   * 指定ユーザーの標準`oauthConsent`のうち、クライアントへ提供していない組の行を削除する文。
   * 次にそのクライアントから連携を開始したとき、`prompt`の有無によらず同意画面を表示させる。
   * 公開設定・識別子の有効性を変える文の後に置き、同じbatchで更新後の状態から判定する。
   */
  reconcileOAuthConsents(userIds: readonly string[]): DatabaseBatchItem {
    return this.db
      .delete(oauthConsent)
      .where(
        and(
          inArray(oauthConsent.userId, jsonEachValues(userIds)),
          not(providedToClient(oauthConsent.userId, oauthConsent.clientId)),
        ),
      );
  }
}
