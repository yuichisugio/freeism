import { Hono } from "hono";

import { visibilitySchema } from "../../shared/schemas/visibility-schema";
import { createDatabase } from "../db/database";
import type { AppEnv } from "../hono-env";
import { purgeProfileCache } from "../infrastructure/cache/profile-cache-purger";
import { auditRequest } from "../logging/audit-request";
import { requireSession } from "../middleware/session-middleware";
import { dataResponse, handleBffError, parseJsonBody } from "../problem-details";
import { saveVisibilitySettings } from "../usecases/visibility/save-visibility-settings";

/**
 * 「アカウント連携」画面全体の公開設定の保存（`/api/visibility`）。
 * 同意画面の「同意して戻る」も、今回の連携先を同意ONにしてこの保存を先に行う。
 * @see ../../shared/schemas/visibility-schema.ts
 * @see ./visibility-routes.worker.test.ts
 */
export const visibilityRoutes = new Hono<AppEnv>()
  .onError(handleBffError)
  .put("/", auditRequest("visibility_saved"), requireSession({ fresh: true }), async (c) => {
    const settings = await parseJsonBody(c, visibilitySchema);
    const { affectedUserIds } = await saveVisibilitySettings(
      { db: createDatabase(c.env.DB) },
      { userId: c.get("sessionUser").id, settings },
    );
    purgeProfileCache(affectedUserIds);
    return dataResponse(c, { ok: true as const });
  });
