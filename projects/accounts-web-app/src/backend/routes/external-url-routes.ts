import { Hono } from "hono";

import { externalUrlSchema } from "../../shared/schemas/external-url-schema";
import { createDatabase } from "../db/database";
import type { AppEnv } from "../hono-env";
import { purgeProfileCache } from "../infrastructure/cache/profile-cache-purger";
import { createSafePageFetcher } from "../infrastructure/verification/safe-page-fetcher";
import { requireSession } from "../middleware/session-middleware";
import { dataResponse, handleBffError, parseJsonBody } from "../problem-details";
import { selectProfilePurgeTargets } from "../usecases/profile/select-profile-purge-targets";
import { saveUnverifiedUrl } from "../usecases/save-unverified-url";
import { verifyUrl } from "../usecases/verify-url";

/**
 * 外部URLの「保存して検証する」（`mode: "verify"`）と「未検証で保存」（`mode: "unverified"`）（`/api/external-urls`）。
 * 登録済みURLの再検証も、同じURLを`mode: "verify"`で送る。
 * @see ../../shared/schemas/external-url-schema.ts
 * @see ../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./external-account-routes.worker.test.ts
 */
export const externalUrlRoutes = new Hono<AppEnv>()
  .onError(handleBffError)
  .post("/", requireSession({ fresh: true }), async (c) => {
    const { url, mode } = await parseJsonBody(c, externalUrlSchema);
    const db = createDatabase(c.env.DB);
    const userId = c.get("sessionUser").id;

    if (mode === "unverified") {
      return dataResponse(c, await saveUnverifiedUrl({ db }, { userId, url }));
    }

    const { externalAccountId, status, link, dns, affectedUserIds } = await verifyUrl(
      {
        db,
        now: new Date(),
        accountsOrigin: c.env.ACCOUNTS_ORIGIN,
        pageFetcher: createSafePageFetcher({ accountsOrigin: c.env.ACCOUNTS_ORIGIN }),
        rateLimiter: c.env.URL_VERIFICATION_RATE_LIMITER,
      },
      { userId, url },
    );
    purgeProfileCache(
      await selectProfilePurgeTargets({ db }, { actorUserId: userId, affectedUserIds }),
    );
    return dataResponse(c, { externalAccountId, status, link, dns });
  });
