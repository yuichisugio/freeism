import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../database";
import { clientConsents, oauthClient } from "../schema";

/**
 * 公開先の列にするOAuthクライアント。
 */
export type LinkedClientRow = {
  clientId: string;
  name: string | null;
  uri: string | null;
  consented: boolean;
};

/**
 * 情報提供同意（`client_consents`）と、提供先として有効なOAuthクライアントの読取。
 * 有効なクライアントは、標準`oauthClient`に存在し`disabled`でないものとする。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export class D1ClientConsentRepository {
  constructor(private readonly db: Database) {}

  /**
   * 本人の`client_consents`に対応する有効なクライアントを、保存済みの同意とともに読む。
   */
  async findLinkedClients(userId: string): Promise<LinkedClientRow[]> {
    return this.db
      .select({
        clientId: clientConsents.clientId,
        name: oauthClient.name,
        uri: oauthClient.uri,
        consented: clientConsents.consented,
      })
      .from(clientConsents)
      .innerJoin(oauthClient, eq(oauthClient.clientId, clientConsents.clientId))
      .where(and(eq(clientConsents.userId, userId), sql`coalesce(${oauthClient.disabled}, 0) = 0`))
      .orderBy(oauthClient.name, clientConsents.clientId);
  }

  /**
   * Client IDが有効なクライアントなら、その名前と紹介URLを読む。
   */
  async findActiveClient(
    clientId: string,
  ): Promise<{ clientId: string; name: string | null; uri: string | null } | undefined> {
    const [client] = await this.db
      .select({ clientId: oauthClient.clientId, name: oauthClient.name, uri: oauthClient.uri })
      .from(oauthClient)
      .where(and(eq(oauthClient.clientId, clientId), sql`coalesce(${oauthClient.disabled}, 0) = 0`))
      .limit(1);
    return client;
  }
}
