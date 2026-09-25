import { and, eq, sql } from "drizzle-orm";

import type { IdentifierKey } from "../../domain/identity/identifier-key";
import type { Database, DatabaseBatchItem } from "../database";
import {
  clientConsents,
  externalAccounts,
  externalAccountVisibility,
  externalIdentifiers,
  oauthClient,
  oauthConsent,
  user,
} from "../schema";

/**
 * JSONの出力・復元に使う読取と、復元をD1 batchへ渡す書込文の組立て。
 * 復元の書込は値の配列をJSON文字列の1バインド値で渡し、`json_each`で展開する`INSERT … SELECT`・`UPDATE … FROM`にする。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../usecases/backup/restore-backup.worker.test.ts
 * @see ./d1-backup-repository.test.ts
 */

// --------------------------------------------------
// バインド値
// --------------------------------------------------

/**
 * 1つのバインド値に入れるJSON文字列の上限（bytes）。
 * D1の文字列上限（2,000,000 bytes）より十分小さくする。
 * @see https://developers.cloudflare.com/d1/platform/limits/
 */
export const maxJsonBindBytes = 1_000_000;

const textEncoder = new TextEncoder();

/**
 * 行の配列を、1つあたり上限以内のJSON配列の文字列に分ける。
 * 通常は1つにまとまり、文の数は入力件数ではなく容量だけで増える。
 * 空配列なら文を作らないよう空の配列を返す。
 */
export function toJsonBinds(rows: readonly unknown[]): string[] {
  const binds: string[] = [];
  let current: string[] = [];
  let currentBytes = 2;
  for (const row of rows) {
    const json = JSON.stringify(row);
    const bytes = textEncoder.encode(json).length + 1;
    if (current.length > 0 && currentBytes + bytes > maxJsonBindBytes) {
      binds.push(`[${current.join(",")}]`);
      current = [];
      currentBytes = 2;
    }
    current.push(json);
    currentBytes += bytes;
  }
  if (current.length > 0) binds.push(`[${current.join(",")}]`);
  return binds;
}

// --------------------------------------------------
// 型
// --------------------------------------------------

/**
 * 復元で作成・更新する外部アカウント行。
 * `importedVerifications`はバックアップの過去の証明情報で、`null`なら既存の値を維持する。
 */
export type RestoredExternalAccount = {
  id: string;
  service: string | null;
  displayName: string | null;
  isPublic: boolean;
  importedVerifications: unknown[] | null;
};

/**
 * 復元で候補（`is_active=0`）として追加する識別子行。
 */
export type RestoredIdentifier = IdentifierKey & { id: string; accountId: string };

/**
 * 復元で上書きする、外部アカウント行ごとのクライアント向け公開選択。
 */
export type RestoredVisibility = { accountId: string; clientId: string; isPublic: boolean };

/**
 * 復元で上書きする情報提供同意。
 */
export type RestoredClientConsent = { clientId: string; displayName: string; consented: boolean };

// --------------------------------------------------
// リポジトリ
// --------------------------------------------------

/**
 * JSONの出力・復元に使う読取と書込文。
 */
export class D1BackupRepository {
  constructor(private readonly db: Database) {}

  // --------------------------------------------------
  // 読取
  // --------------------------------------------------

  /**
   * 本人の表示名を読む。
   * セッションのcookie cacheではなくDBの現在値を使う。
   */
  async findDisplayName(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.name ?? "";
  }

  /**
   * 本人の全`client_consents`行を読む。
   * 表示名は現存するクライアントの名前、無ければ保存時の値にする。
   */
  async findClientConsents(userId: string): Promise<RestoredClientConsent[]> {
    return this.db
      .select({
        clientId: clientConsents.clientId,
        displayName: sql<string>`coalesce(${oauthClient.name}, ${clientConsents.displayName})`,
        consented: clientConsents.consented,
      })
      .from(clientConsents)
      .leftJoin(oauthClient, eq(oauthClient.clientId, clientConsents.clientId))
      .where(eq(clientConsents.userId, userId))
      .orderBy(clientConsents.clientId);
  }

  /**
   * 本人の全識別子行（候補を含む）を、所属する外部アカウント行と有効性とともに読む。
   */
  async findIdentifiers(userId: string) {
    return this.db
      .select({
        accountId: externalIdentifiers.accountId,
        kind: externalIdentifiers.kind,
        provider: externalIdentifiers.provider,
        issuer: externalIdentifiers.issuer,
        value: externalIdentifiers.value,
        isActive: externalIdentifiers.isActive,
      })
      .from(externalIdentifiers)
      .where(eq(externalIdentifiers.userId, userId));
  }

  // --------------------------------------------------
  // 書込文
  // --------------------------------------------------

  /**
   * 本人の表示名を更新する。
   */
  updateDisplayName(userId: string, displayName: string, now: Date): DatabaseBatchItem[] {
    return [
      this.db.update(user).set({ name: displayName, updatedAt: now }).where(eq(user.id, userId)),
    ];
  }

  /**
   * 情報提供同意をClient IDで上書きする。
   * 存在しないClient IDも保存し、入力に無いClient IDの行は維持する。
   */
  upsertClientConsents(
    userId: string,
    consents: readonly RestoredClientConsent[],
  ): DatabaseBatchItem[] {
    // `INSERT … SELECT`とupsertの構文の曖昧さを避けるため、SELECTに`where true`を付ける。
    return toJsonBinds(consents).map((json) =>
      this.db
        .insert(clientConsents)
        .select(
          sql`select ${userId}, json_extract(value, '$.clientId'), json_extract(value, '$.displayName'), json_extract(value, '$.consented') from json_each(${json}) where true`,
        )
        .onConflictDoUpdate({
          target: [clientConsents.userId, clientConsents.clientId],
          set: {
            displayName: sql`excluded.display_name`,
            consented: sql`excluded.consented`,
          },
        }),
    );
  }

  /**
   * 同意をOFFにしたクライアントについて、標準`oauthConsent`行を削除する。
   * 次回の認可要求で同意画面を表示させる（公開設定の保存と同じ扱い）。
   */
  deleteOAuthConsents(userId: string, clientIds: readonly string[]): DatabaseBatchItem[] {
    return toJsonBinds(clientIds).map((json) =>
      this.db
        .delete(oauthConsent)
        .where(
          and(
            eq(oauthConsent.userId, userId),
            sql`${oauthConsent.clientId} in (select value from json_each(${json}))`,
          ),
        ),
    );
  }

  /**
   * 登録候補の外部アカウント行を作る。
   */
  insertExternalAccounts(
    userId: string,
    accounts: readonly RestoredExternalAccount[],
  ): DatabaseBatchItem[] {
    // 列はschemaの定義順（id, user_id, service, display_name, email, linked_at, is_public, imported_verifications_json）に並べる。
    return toJsonBinds(accounts).map((json) =>
      this.db
        .insert(externalAccounts)
        .select(
          sql`select json_extract(value, '$.id'), ${userId}, json_extract(value, '$.service'), json_extract(value, '$.displayName'), null, null, json_extract(value, '$.isPublic'), json_extract(value, '$.importedVerifications') from json_each(${json})`,
        ),
    );
  }

  /**
   * 既存の外部アカウント行の一般公開を戻し、過去の証明情報があれば保存する。
   * サービス・表示名・連携日時・証明は変更しない。
   */
  updateExternalAccounts(
    userId: string,
    accounts: readonly RestoredExternalAccount[],
  ): DatabaseBatchItem[] {
    return toJsonBinds(accounts).map((json) =>
      this.db
        .update(externalAccounts)
        .set({
          isPublic: sql`restored.is_public`,
          importedVerificationsJson: sql`coalesce(restored.imported_verifications_json, ${externalAccounts.importedVerificationsJson})`,
        })
        .from(
          sql`(select json_extract(value, '$.id') as id, json_extract(value, '$.isPublic') as is_public, json_extract(value, '$.importedVerifications') as imported_verifications_json from json_each(${json})) as restored`,
        )
        .where(
          and(sql`${externalAccounts.id} = restored.id`, eq(externalAccounts.userId, userId)),
        ),
    );
  }

  /**
   * 識別子行を候補（`is_active=0`）として追加する。
   */
  insertIdentifiers(
    userId: string,
    identifiers: readonly RestoredIdentifier[],
  ): DatabaseBatchItem[] {
    // 列はschemaの定義順（id, account_id, user_id, kind, provider, issuer, value, host, is_active）に並べる。
    return toJsonBinds(identifiers).map((json) =>
      this.db
        .insert(externalIdentifiers)
        .select(
          sql`select json_extract(value, '$.id'), json_extract(value, '$.accountId'), ${userId}, json_extract(value, '$.kind'), json_extract(value, '$.provider'), json_extract(value, '$.issuer'), json_extract(value, '$.value'), json_extract(value, '$.host'), 0 from json_each(${json})`,
        ),
    );
  }

  /**
   * 外部アカウント行ごとのクライアント向け公開選択をClient IDで上書きする。
   * 入力に無いClient IDの公開選択は維持する。
   */
  upsertVisibility(visibility: readonly RestoredVisibility[]): DatabaseBatchItem[] {
    return toJsonBinds(visibility).map((json) =>
      this.db
        .insert(externalAccountVisibility)
        .select(
          sql`select json_extract(value, '$.accountId'), json_extract(value, '$.clientId'), json_extract(value, '$.isPublic') from json_each(${json}) where true`,
        )
        .onConflictDoUpdate({
          target: [externalAccountVisibility.accountId, externalAccountVisibility.clientId],
          set: { isPublic: sql`excluded.is_public` },
        }),
    );
  }
}
