import { Hono } from "hono";

import { profileSchema, type Me } from "../../shared/schemas/profile-schema";
import { getAuth } from "../auth/auth";
import { buildAccountsProfileUrl } from "../domain/verification/accounts-profile-url";
import type { AppEnv } from "../hono-env";
import { requireSession } from "../middleware/session-middleware";
import { dataResponse, handleBffError, parseJsonBody } from "../problem-details";
import { updateDisplayName } from "../usecases/profile/update-display-name";

/**
 * セッション本人のAccountsプロフィール（`/api/me`）と表示名の更新（`/api/profile`）。
 * @see ../../shared/schemas/profile-schema.ts
 * @see ./external-account-routes.worker.test.ts
 * @see ./profile-routes.worker.test.ts
 */
export const profileRoutes = new Hono<AppEnv>()
  .onError(handleBffError)
  // 復元や別の端末で変わった表示名を返すため、cookie cacheではなくD1のセッションとユーザーを読む。
  .get("/me", requireSession({ fresh: true }), (c) => {
    const sessionUser = c.get("sessionUser");
    return dataResponse(c, toMe(c.env.ACCOUNTS_ORIGIN, sessionUser.id, sessionUser.name));
  })
  .patch("/profile", requireSession({ fresh: true }), async (c) => {
    const { displayName } = await parseJsonBody(c, profileSchema);
    const sessionUser = c.get("sessionUser");
    const { setCookies } = await updateDisplayName(
      { auth: getAuth(), headers: c.req.raw.headers },
      { userId: sessionUser.id, displayName },
    );
    for (const setCookie of setCookies) {
      c.header("Set-Cookie", setCookie, { append: true });
    }
    return dataResponse(c, toMe(c.env.ACCOUNTS_ORIGIN, sessionUser.id, displayName));
  });

/**
 * 本人のプロフィール応答を作る。
 */
function toMe(accountsOrigin: string, accountsUserId: string, displayName: string): Me {
  return {
    accountsUserId,
    displayName,
    profileUrl: buildAccountsProfileUrl({ accountsOrigin, accountsUserId }),
  };
}
