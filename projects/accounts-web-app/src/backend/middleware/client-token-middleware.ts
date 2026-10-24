import { createMiddleware } from "hono/factory";

import { getAuth } from "../auth/auth";
import { verifyClientAccessToken } from "../auth/verify-client-access-token";
import type { Bindings } from "../hono-env";
import { auditLog } from "../logging/audit-log";
import { requestError } from "../resource-api-response";

/**
 * `requireClientAccessToken`がrequest contextへ設定する値。
 */
export type ClientTokenVariables = {
  /** 認証済みのクライアントのClient ID。 */
  clientId: string;
};

/**
 * 資源APIの要求を、DPoPで送られたクライアント用Access Tokenで認証し、`clientId`へ設定する。
 * 失敗は紐付け・提供許可の照合へ進む前に拒否し、標準の`WWW-Authenticate`を付けて401 `UNAUTHORIZED`・403 `INSUFFICIENT_SCOPE`を返す。
 * @see ../auth/verify-client-access-token.ts
 * @see ../routes/resource-api-routes.worker.test.ts
 */
export const requireClientAccessToken = createMiddleware<{
  Bindings: Bindings;
  Variables: ClientTokenVariables;
}>(async (c, next) => {
  const result = await verifyClientAccessToken(c.req.raw, {
    auth: getAuth(),
    accountsOrigin: c.env.ACCOUNTS_ORIGIN,
  });
  if (!result.ok) {
    auditLog({
      event: "resource_api_rejected",
      outcome: "failure",
      errorCategory: String(result.status),
    });
    const headers = { "WWW-Authenticate": result.wwwAuthenticate };
    throw result.status === 403
      ? requestError(
          403,
          "INSUFFICIENT_SCOPE",
          "The access token does not have the required scope.",
          headers,
        )
      : requestError(401, "UNAUTHORIZED", "A valid client access token is required.", headers);
  }

  c.set("clientId", result.clientId);
  await next();
});
