import { Hono } from "hono";

import { buildAccountsProfileUrl } from "../domain/verification/accounts-profile-url";
import type { AppEnv } from "../hono-env";
import { requireSession } from "../middleware/session-middleware";
import { dataResponse, handleBffError } from "../problem-details";

/**
 * セッション本人のAccountsプロフィール（`/api/me`）。
 * @see ../../shared/schemas/profile-schema.ts
 * @see ./external-account-routes.worker.test.ts
 */
export const profileRoutes = new Hono<AppEnv>()
  .onError(handleBffError)
  .get("/me", requireSession({ fresh: false }), (c) => {
    const sessionUser = c.get("sessionUser");
    return dataResponse(c, {
      accountsUserId: sessionUser.id,
      displayName: sessionUser.name,
      profileUrl: buildAccountsProfileUrl({
        accountsOrigin: c.env.ACCOUNTS_ORIGIN,
        accountsUserId: sessionUser.id,
      }),
    });
  });
