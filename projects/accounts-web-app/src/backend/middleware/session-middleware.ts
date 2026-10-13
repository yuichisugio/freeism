import { createMiddleware } from "hono/factory";

import { getAuth } from "../auth/auth";
import type { Bindings } from "../hono-env";
import { ProblemError, problemResponse } from "../problem-details";

/**
 * セッション本人の情報。
 */
export type SessionUser = {
  id: string;
  name: string;
};

/**
 * `requireSession`がrequest contextへ設定する値。
 */
export type SessionVariables = {
  sessionUser: SessionUser;
};

/**
 * Better Authのセッションから操作主体を確定し、`sessionUser`へ設定する。
 * セッションが無ければ401 `UNAUTHORIZED`を返す。
 * 状態変更APIと`/api/me`では`fresh: true`とし、標準の`disableCookieCache`でcookie cacheを使わずDBのセッションを読む。
 * @param options.fresh cookie cacheを使わずにDBのセッションを読むか。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ../routes/external-account-routes.worker.test.ts
 */
export function requireSession({ fresh }: { fresh: boolean }) {
  return createMiddleware<{ Bindings: Bindings; Variables: SessionVariables }>(async (c, next) => {
    const session = await getAuth().api.getSession({
      headers: c.req.raw.headers,
      query: { disableCookieCache: fresh },
    });
    if (session === null) {
      return problemResponse(c, new ProblemError(401, "UNAUTHORIZED"));
    }

    c.set("sessionUser", { id: session.user.id, name: session.user.name });
    await next();
  });
}
