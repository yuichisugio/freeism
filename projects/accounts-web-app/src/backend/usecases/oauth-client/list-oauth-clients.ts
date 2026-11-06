import type { OAuthClientDetail } from "../../../shared/schemas/oauth-client-schema";
import { toOAuthClientDetail, type OAuthClientDeps } from "./oauth-client-fields";

/**
 * 本人が登録したOAuthクライアントの一覧を、Better Authの標準APIで読む。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../routes/oauth-client-routes.worker.test.ts
 */
export async function listOAuthClients(
  deps: Pick<OAuthClientDeps, "auth" | "headers">,
): Promise<OAuthClientDetail[]> {
  const clients = await deps.auth.api.getOAuthClients({ headers: deps.headers });
  return (clients ?? []).map(toOAuthClientDetail);
}
