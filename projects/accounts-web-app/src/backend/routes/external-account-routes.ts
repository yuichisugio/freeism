import { Hono } from "hono";

import { createDatabase } from "../db/database";
import type { AppEnv } from "../hono-env";
import { purgeProfileCache } from "../infrastructure/cache/profile-cache-purger";
import { auditRequest } from "../logging/audit-request";
import { requireSession } from "../middleware/session-middleware";
import { dataResponse, handleBffError } from "../problem-details";
import { selectProfilePurgeTargets } from "../usecases/profile/select-profile-purge-targets";
import { unlinkExternalAccount } from "../usecases/unlink-external-account";
import { unlinkVerification } from "../usecases/unlink-verification";

/**
 * 外部アカウントの「すべての連携解除」（行全体）と「この証明を解除」（証明行1件）（`/api/external-accounts`）。
 * 解除で行が消えると公開状態を判定できないため、purge対象は解除の前に選ぶ。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./external-account-routes.worker.test.ts
 */
export const externalAccountRoutes = new Hono<AppEnv>()
  .onError(handleBffError)
  .delete(
    "/:externalAccountId",
    auditRequest("external_account_unlinked"),
    requireSession({ fresh: true }),
    async (c) => {
      const db = createDatabase(c.env.DB);
      const userId = c.get("sessionUser").id;
      const purgeTargets = await selectProfilePurgeTargets(
        { db },
        { actorUserId: userId, affectedUserIds: [userId] },
      );
      await unlinkExternalAccount(
        { db },
        { userId, externalAccountId: c.req.param("externalAccountId") },
      );
      purgeProfileCache(purgeTargets);
      return dataResponse(c, { ok: true as const });
    },
  )
  .delete(
    "/:externalAccountId/verifications/:verificationId",
    auditRequest("verification_unlinked"),
    requireSession({ fresh: true }),
    async (c) => {
      const db = createDatabase(c.env.DB);
      const userId = c.get("sessionUser").id;
      const purgeTargets = await selectProfilePurgeTargets(
        { db },
        { actorUserId: userId, affectedUserIds: [userId] },
      );
      await unlinkVerification(
        { db, now: new Date() },
        {
          userId,
          externalAccountId: c.req.param("externalAccountId"),
          verificationId: c.req.param("verificationId"),
        },
      );
      purgeProfileCache(purgeTargets);
      return dataResponse(c, { ok: true as const });
    },
  );
