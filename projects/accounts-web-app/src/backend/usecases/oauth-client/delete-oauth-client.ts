import { runBatch } from "../../db/database";
import { D1OAuthClientRepository } from "../../db/repositories/d1-oauth-client-repository";
import { toOAuthClientError } from "./oauth-client-error";
import type { OAuthClientDeps } from "./oauth-client-fields";

/**
 * 本人のOAuthクライアントを削除する。
 * Better Authの標準の削除APIで所有者を確認してクライアントを削除し、認可・トークン・同意をCASCADEで終了する。
 * 続く1回のD1 batchで、そのClient IDへの全ユーザーの情報提供同意と公開選択を削除する。
 * 標準の削除はBetter Authのadapterで確定するため、独自表の削除と同じbatchにはできない。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../routes/oauth-client-routes.worker.test.ts
 */
export async function deleteOAuthClient(
  deps: Pick<OAuthClientDeps, "auth" | "db" | "headers">,
  clientId: string,
): Promise<void> {
  try {
    await deps.auth.api.deleteOAuthClient({ headers: deps.headers, body: { client_id: clientId } });
  } catch (error) {
    throw toOAuthClientError(error);
  }
  await runBatch(deps.db, new D1OAuthClientRepository(deps.db).deleteClientSettings(clientId));
}
