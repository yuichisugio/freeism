import { Hono, type Context } from "hono";

import { oauthClientSchema } from "../../shared/schemas/oauth-client-schema";
import { getAuth } from "../auth/auth";
import { createDatabase } from "../db/database";
import type { AppEnv } from "../hono-env";
import { auditRequest } from "../logging/audit-request";
import { requireSession, type SessionVariables } from "../middleware/session-middleware";
import { dataResponse, handleBffError, parseJsonBody } from "../problem-details";
import { deleteOAuthClient } from "../usecases/oauth-client/delete-oauth-client";
import { listOAuthClients } from "../usecases/oauth-client/list-oauth-clients";
import type { OAuthClientDeps } from "../usecases/oauth-client/oauth-client-fields";
import { readOAuthClient } from "../usecases/oauth-client/read-oauth-client";
import { registerOAuthClient } from "../usecases/oauth-client/register-oauth-client";
import { updateOAuthClient } from "../usecases/oauth-client/update-oauth-client";

/**
 * 「開発者向け」画面のOAuthクライアント管理（`/api/oauth-clients`）。
 * 成功は`{ data }`、失敗はRFC 9457の問題詳細で返す。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./oauth-client-routes.worker.test.ts
 */

type OAuthClientEnv = AppEnv & { Variables: SessionVariables };

/**
 * セッション本人の要求から、ユースケースの依存を作る。
 * Better Authの標準APIが所有者を確認するため、本人の要求ヘッダーを渡す。
 */
function createOAuthClientDeps(c: Context<OAuthClientEnv>): OAuthClientDeps {
  return {
    auth: getAuth(),
    db: createDatabase(c.env.DB),
    headers: c.req.raw.headers,
    userId: c.get("sessionUser").id,
  };
}

export const oauthClientRoutes = new Hono<OAuthClientEnv>()
  .onError(handleBffError)
  .get("/", requireSession({ fresh: false }), async (c) => {
    const clients = await listOAuthClients(createOAuthClientDeps(c));
    return dataResponse(c, { clients });
  })
  .post(
    "/",
    auditRequest("oauth_client_registered"),
    requireSession({ fresh: true }),
    async (c) => {
      const input = await parseJsonBody(c, oauthClientSchema);
      const client = await registerOAuthClient(createOAuthClientDeps(c), input);
      return c.json({ data: client }, 201, { "Cache-Control": "private, no-store" });
    },
  )
  .get("/:clientId", requireSession({ fresh: false }), async (c) => {
    const client = await readOAuthClient(createOAuthClientDeps(c), c.req.param("clientId"));
    return dataResponse(c, client);
  })
  .put(
    "/:clientId",
    auditRequest("oauth_client_updated"),
    requireSession({ fresh: true }),
    async (c) => {
      const input = await parseJsonBody(c, oauthClientSchema);
      const client = await updateOAuthClient(
        createOAuthClientDeps(c),
        c.req.param("clientId"),
        input,
      );
      return dataResponse(c, client);
    },
  )
  .delete(
    "/:clientId",
    auditRequest("oauth_client_deleted"),
    requireSession({ fresh: true }),
    async (c) => {
      await deleteOAuthClient(createOAuthClientDeps(c), c.req.param("clientId"));
      return dataResponse(c, { ok: true as const });
    },
  );
