import { basicAuth } from "hono/basic-auth";
import { createMiddleware } from "hono/factory";

import { isProtocolPath } from "../../../../worker/spa-fallback";

/**
 * stagingの画面・静的ファイルを、環境別Secretの両方が設定されている場合にBasic認証で保護する。
 * APIとOAuthメタデータはそれぞれの認証方式を維持する。
 * @see ../../../../docs/operations/test-environment-basic-auth.ja.md
 * @see ../../../../worker/basic-auth.worker.test.ts
 */
export const basicAuthMiddleware = createMiddleware<{ Bindings: Env }>(async (context, next) => {
  const { APP_ENV, BASIC_AUTH_USERNAME: username, BASIC_AUTH_PASSWORD: password } = context.env;
  if (APP_ENV !== "staging" || !username || !password || isProtocolPath(context.req.path)) {
    await next();
    return;
  }

  return basicAuth({ username, password })(context, next);
});
