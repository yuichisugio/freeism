import { and, count, eq, inArray } from "drizzle-orm";

import { jsonEachValues, type Database, type DatabaseBatchItem } from "../database";
import { account } from "../schema";

/**
 * 標準`account`（Better Authの認証連携）の読取と、D1 batchへ渡す削除文を組み立てる。
 * OAuthの証明の解除では、標準`account`行の削除を独自表の整理と同じbatchで確定する。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export class D1AuthAccountRepository {
  constructor(private readonly db: Database) {}

  /**
   * 本人の標準`account`行数（ログイン手段の数）を数える。
   */
  async countByUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(account)
      .where(eq(account.userId, userId));
    return row?.value ?? 0;
  }

  /**
   * 本人の標準`account`行を削除する文。
   * 行を参照する`oauth`証明と対象関連はCASCADEで削除される。
   */
  deleteOwnAuthAccounts(userId: string, authAccountIds: readonly string[]): DatabaseBatchItem {
    return this.db
      .delete(account)
      .where(and(inArray(account.id, jsonEachValues(authAccountIds)), eq(account.userId, userId)));
  }
}
