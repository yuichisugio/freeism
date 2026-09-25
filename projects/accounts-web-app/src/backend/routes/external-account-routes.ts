import { Hono } from "hono";

import { getAuth } from "../auth/auth";
import { createDatabase } from "../db/database";
import type { AppEnv } from "../hono-env";
import { requireSession } from "../middleware/session-middleware";
import { dataResponse, handleBffError } from "../problem-details";
import { unlinkExternalAccount } from "../usecases/unlink-external-account";
import { unlinkOAuthOnly } from "../usecases/unlink-oauth-only";

/**
 * 外部アカウントの「連携解除」（行全体）と「OAuthの認証連携だけ解除する」（`/api/external-accounts`）。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./external-account-routes.worker.test.ts
 */
export const externalAccountRoutes = new Hono<AppEnv>()
  .onError(handleBffError)
  .delete("/:externalAccountId", requireSession({ fresh: true }), async (c) => {
    await unlinkExternalAccount(
      { db: createDatabase(c.env.DB), auth: getAuth() },
      {
        userId: c.get("sessionUser").id,
        headers: c.req.raw.headers,
        externalAccountId: c.req.param("externalAccountId"),
      },
    );
    return dataResponse(c, { ok: true as const });
  })
  .delete(
    "/:externalAccountId/oauth/:authAccountId",
    requireSession({ fresh: true }),
    async (c) => {
      await unlinkOAuthOnly(
        { db: createDatabase(c.env.DB), auth: getAuth(), now: new Date() },
        {
          userId: c.get("sessionUser").id,
          headers: c.req.raw.headers,
          externalAccountId: c.req.param("externalAccountId"),
          authAccountId: c.req.param("authAccountId"),
        },
      );
      return dataResponse(c, { ok: true as const });
    },
  );
