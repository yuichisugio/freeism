import { and, eq, inArray, sql } from "drizzle-orm";

import { jsonEachValues, type Database, type DatabaseBatchItem } from "../database";
import { externalAccounts, externalAccountVisibility, oauthClient } from "../schema";

/**
 * 一般公開・外部アカウント別の公開選択の読取と、D1 batchへ渡す書込文を組み立てる。
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
   * Client IDのうち、有効なクライアント（存在し`disabled`でない）を名前・紹介URLとともに、名前の順に読む。
   */
  async findActiveClients(
    clientIds: readonly string[],
  ): Promise<{ clientId: string; name: string | null; uri: string | null }[]> {
    if (clientIds.length === 0) {
      return [];
    }

    return this.db
      .select({ clientId: oauthClient.clientId, name: oauthClient.name, uri: oauthClient.uri })
      .from(oauthClient)
      .where(
        and(
          inArray(oauthClient.clientId, jsonEachValues(clientIds)),
          sql`coalesce(${oauthClient.disabled}, 0) = 0`,
        ),
      )
      .orderBy(oauthClient.name, oauthClient.clientId);
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
   * 指定クライアントについて、本人の全外部アカウント行の公開選択を、選択した組を公開（1）、それ以外を非公開（0）として書く文。
   * 非公開の組も行として残し、すべて外したクライアントも「アカウント連携」画面の列に残す。
   * 指定していないクライアントの行は変えない。
   */
  replaceClientVisibility(
    userId: string,
    clientIds: readonly string[],
    selections: readonly { accountId: string; clientId: string }[],
  ): DatabaseBatchItem {
    return this.db
      .insert(externalAccountVisibility)
      .select(
        sql`select ${externalAccounts.id}, client.value, (${externalAccounts.id}, client.value) in (select json_extract(selection.value, '$.accountId'), json_extract(selection.value, '$.clientId') from json_each(${JSON.stringify(selections)}) as selection) from ${externalAccounts}, json_each(${JSON.stringify(clientIds)}) as client where ${externalAccounts.userId} = ${userId}`,
      )
      .onConflictDoUpdate({
        target: [externalAccountVisibility.accountId, externalAccountVisibility.clientId],
        set: { isPublic: sql`excluded.is_public` },
      });
  }
}
