import { and, eq } from "drizzle-orm";

import type { Database, DatabaseBatchItem } from "../database";
import { clientConsents, externalAccountVisibility, oauthClient } from "../schema";

/**
 * OAuthクライアントについて、Better Authの標準APIで扱えない書込（承認済みの公開鍵更新）と、独自表の後始末を行う。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export class D1OAuthClientRepository {
  constructor(private readonly db: Database) {}

  /**
   * 本人が所有するクライアントの、標準の更新APIで保存できない項目を更新する。
   * 公開鍵は標準の登録と同じくJWK SetのJSON文字列で保存し、未入力の紹介URLはNULLにする。
   * @returns 更新した行があればtrue
   */
  async updateAccountsManagedFields(
    clientId: string,
    userId: string,
    { jwksJson, uri }: { jwksJson: string; uri: string | null },
  ): Promise<boolean> {
    const updated = await this.db
      .update(oauthClient)
      .set({ jwks: jwksJson, uri, updatedAt: new Date() })
      .where(and(eq(oauthClient.clientId, clientId), eq(oauthClient.userId, userId)))
      .returning({ clientId: oauthClient.clientId });
    return updated.length > 0;
  }

  /**
   * Client IDに対する全ユーザーの情報提供同意と公開選択を削除する文。
   */
  deleteClientSettings(clientId: string): DatabaseBatchItem[] {
    return [
      this.db.delete(clientConsents).where(eq(clientConsents.clientId, clientId)),
      this.db
        .delete(externalAccountVisibility)
        .where(eq(externalAccountVisibility.clientId, clientId)),
    ];
  }
}
