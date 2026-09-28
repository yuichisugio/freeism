import { and, eq, inArray, sql } from "drizzle-orm";

import { jsonEachValues, type Database, type DatabaseBatchItem } from "../database";
import {
  clientConsents,
  externalAccounts,
  externalAccountVisibility,
  oauthClient,
} from "../schema";

/**
 * 一般公開・提供先の記録・外部アカウント別の公開選択の読取と、D1 batchへ渡す書込文を組み立てる。
 * 複数の値は1つのバインド値にして`json_each`で展開し、文の数を件数によらず一定にする。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export class D1VisibilityRepository {
  constructor(private readonly db: Database) {}

  // --------------------------------------------------
  // 読取
  // --------------------------------------------------

  /**
   * 本人の外部アカウント行を、一般公開の現在値とともに読む。
   */
  async findOwnAccountStates(userId: string): Promise<{ id: string; isPublic: boolean }[]> {
    return this.db
      .select({ id: externalAccounts.id, isPublic: externalAccounts.isPublic })
      .from(externalAccounts)
      .where(eq(externalAccounts.userId, userId));
  }

  /**
   * Client IDのうち、有効なクライアント（存在し`disabled`でない）を名前とともに読む。
   */
  async findActiveClients(
    clientIds: readonly string[],
  ): Promise<{ clientId: string; name: string | null }[]> {
    if (clientIds.length === 0) {
      return [];
    }

    return this.db
      .select({ clientId: oauthClient.clientId, name: oauthClient.name })
      .from(oauthClient)
      .where(
        and(
          inArray(oauthClient.clientId, jsonEachValues(clientIds)),
          sql`coalesce(${oauthClient.disabled}, 0) = 0`,
        ),
      );
  }

  // --------------------------------------------------
  // 書込文
  // --------------------------------------------------

  /**
   * 本人の外部アカウント行の一般公開を更新する文。
   */
  updateAccountPublic(
    userId: string,
    { publicIds, privateIds }: { publicIds: readonly string[]; privateIds: readonly string[] },
  ): DatabaseBatchItem[] {
    return [
      this.db
        .update(externalAccounts)
        .set({ isPublic: true })
        .where(
          and(
            eq(externalAccounts.userId, userId),
            inArray(externalAccounts.id, jsonEachValues(publicIds)),
          ),
        ),
      this.db
        .update(externalAccounts)
        .set({ isPublic: false })
        .where(
          and(
            eq(externalAccounts.userId, userId),
            inArray(externalAccounts.id, jsonEachValues(privateIds)),
          ),
        ),
    ];
  }

  /**
   * 提供先の記録（`client_consents`）を、保存時のクライアント名とともに追加・更新する文。
   */
  upsertClientConsents(
    userId: string,
    consents: readonly { clientId: string; displayName: string }[],
  ): DatabaseBatchItem {
    // SQLiteの`INSERT … SELECT … ON CONFLICT`は、構文の曖昧さを避けるためSELECTに`where true`が必要。
    return this.db
      .insert(clientConsents)
      .select(
        sql`select ${userId}, json_extract(value, '$.clientId'), json_extract(value, '$.displayName') from json_each(${JSON.stringify(consents)}) where true`,
      )
      .onConflictDoUpdate({
        target: [clientConsents.userId, clientConsents.clientId],
        set: { displayName: sql`excluded.display_name` },
      });
  }

  /**
   * 指定クライアントについて、本人の全外部アカウント行の公開選択を、選択した組だけに置き換える文。
   * 行の無い組は非公開として扱う。
   */
  replaceClientVisibility(
    userId: string,
    clientIds: readonly string[],
    selections: readonly { accountId: string; clientId: string }[],
  ): DatabaseBatchItem[] {
    return [
      this.db
        .delete(externalAccountVisibility)
        .where(
          and(
            inArray(externalAccountVisibility.clientId, jsonEachValues(clientIds)),
            inArray(
              externalAccountVisibility.accountId,
              this.db
                .select({ id: externalAccounts.id })
                .from(externalAccounts)
                .where(eq(externalAccounts.userId, userId)),
            ),
          ),
        ),
      this.db
        .insert(externalAccountVisibility)
        .select(
          sql`select json_extract(value, '$.accountId'), json_extract(value, '$.clientId'), 1 from json_each(${JSON.stringify(selections)})`,
        ),
    ];
  }
}
