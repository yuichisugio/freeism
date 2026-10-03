import { and, eq } from "drizzle-orm";

import { createDb } from "./client";
import { oauthClient } from "./schema/oauth-provider-standard";

/** Better Auth の更新 API が受け付けない公開鍵と紹介 URL の削除を保存する。 */
export async function updateOAuthClientManagedFields(
  database: D1Database,
  clientId: string,
  ownerAuthUserId: string,
  fields: { jwks: object; uri: string | null },
): Promise<boolean> {
  const updated = await createDb(database)
    .update(oauthClient)
    .set({ jwks: JSON.stringify(fields.jwks), uri: fields.uri, updatedAt: new Date() })
    .where(and(eq(oauthClient.clientId, clientId), eq(oauthClient.userId, ownerAuthUserId)))
    .returning({ clientId: oauthClient.clientId });
  return updated.length > 0;
}
