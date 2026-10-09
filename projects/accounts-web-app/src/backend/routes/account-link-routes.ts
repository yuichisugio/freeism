import { Hono } from "hono";

import { createDatabase } from "../db/database";
import type { AppEnv } from "../hono-env";
import { requireSession } from "../middleware/session-middleware";
import { dataResponse, handleBffError } from "../problem-details";
import { readAccountLinks } from "../usecases/read-account-links";

/**
 * 「アカウント連携」画面の本人向け一覧（`/api/account-links`）。
 * 同意画面では`consentClientId`に今回の認可要求のClient IDを付け、その連携先を公開先の列に含める。
 * @see ../../shared/schemas/account-link-schema.ts
 * @see ./external-account-routes.worker.test.ts
 */
export const accountLinkRoutes = new Hono<AppEnv>()
  .onError(handleBffError)
  .get("/", requireSession({ fresh: false }), async (c) => {
    const links = await readAccountLinks(
      { db: createDatabase(c.env.DB), accountsOrigin: c.env.ACCOUNTS_ORIGIN },
      { userId: c.get("sessionUser").id, consentClientId: c.req.query("consentClientId") },
    );
    return dataResponse(c, links);
  });
