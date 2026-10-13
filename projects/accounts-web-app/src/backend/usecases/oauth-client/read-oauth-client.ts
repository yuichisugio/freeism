import type { OAuthClientDetail } from "../../../shared/schemas/oauth-client-schema";
import { toOAuthClientError } from "./oauth-client-error";
import { toOAuthClientDetail, type OAuthClientDeps } from "./oauth-client-fields";

/**
 * 本人が登録したOAuthクライアント1件を、Better Authの標準APIで読む。
 * 他人のクライアントは未登録と同じ`CLIENT_NOT_FOUND`にする。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../routes/oauth-client-routes.worker.test.ts
 */
export async function readOAuthClient(
  deps: Pick<OAuthClientDeps, "auth" | "headers">,
  clientId: string,
): Promise<OAuthClientDetail> {
  try {
    const client = await deps.auth.api.getOAuthClient({
      headers: deps.headers,
      query: { client_id: clientId },
    });
    return toOAuthClientDetail(client);
  } catch (error) {
    throw toOAuthClientError(error);
  }
}
