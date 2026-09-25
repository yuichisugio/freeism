import { and, eq, inArray, sql } from "drizzle-orm";

import { jsonEachValues, type Database, type DatabaseBatchItem } from "../database";
import {
  clientConsents,
  externalAccounts,
  externalAccountVisibility,
  externalIdentifiers,
  oauthClient,
  oauthConsent,
} from "../schema";

/**
 * 一般公開・情報提供同意・外部アカウント別の公開選択の読取と、D1 batchへ渡す書込文を組み立てる。
 * 複数の値は1つのバインド値にして`json_each`で展開し、文の数を件数によらず一定にする。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export class D1VisibilityRepository {
  constructor(private readonly db: Database) {}

  // --------------------------------------------------
  // 読取
  // --------------------------------------------------

  /**
   * 本人の外部アカウント行を、一般公開の現在値と証明済み（有効識別子を持つ）かとともに読む。
   */
  async findOwnAccountStates(
    userId: string,
  ): Promise<{ id: string; isPublic: boolean; isVerified: boolean }[]> {
    const [accounts, verifiedAccounts] = await Promise.all([
      this.db
        .select({ id: externalAccounts.id, isPublic: externalAccounts.isPublic })
        .from(externalAccounts)
        .where(eq(externalAccounts.userId, userId)),
      this.db
        .selectDistinct({ accountId: externalIdentifiers.accountId })
        .from(externalIdentifiers)
        .where(
          and(eq(externalIdentifiers.userId, userId), sql`${externalIdentifiers.isActive} = 1`),
        ),
    ]);
    const verifiedAccountIds = new Set(verifiedAccounts.map((row) => row.accountId));
    return accounts.map((account) => ({
      ...account,
      isVerified: verifiedAccountIds.has(account.id),
    }));
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
   * 情報提供同意を、保存時のクライアント名とともに追加・更新する文。
   */
  upsertClientConsents(
    userId: string,
    consents: readonly { clientId: string; displayName: string; consented: boolean }[],
  ): DatabaseBatchItem {
    // SQLiteの`INSERT … SELECT … ON CONFLICT`は、構文の曖昧さを避けるためSELECTに`where true`が必要。
    return this.db
      .insert(clientConsents)
      .select(
        sql`select ${userId}, json_extract(value, '$.clientId'), json_extract(value, '$.displayName'), json_extract(value, '$.consented') from json_each(${JSON.stringify(consents)}) where true`,
      )
      .onConflictDoUpdate({
        target: [clientConsents.userId, clientConsents.clientId],
        set: {
          displayName: sql`excluded.display_name`,
          consented: sql`excluded.consented`,
        },
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

  /**
   * 本人と指定クライアントの標準`oauthConsent`行を削除する文。
   * 次にそのクライアントから連携を開始したとき、`prompt`の有無によらず同意画面を表示させる。
   */
  deleteOAuthConsents(userId: string, clientIds: readonly string[]): DatabaseBatchItem {
    return this.db
      .delete(oauthConsent)
      .where(
        and(
          eq(oauthConsent.userId, userId),
          inArray(oauthConsent.clientId, jsonEachValues(clientIds)),
        ),
      );
  }
}
