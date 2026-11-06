import { basicAuth } from "hono/basic-auth";
import { createMiddleware } from "hono/factory";

/**
 * stagingの画面と静的ファイルを環境別SecretのBasic認証で保護する。
 * ビルド時のSPA shell生成はSecretを持たないため通常どおり描画する。
 * @see ../../../../wrangler.jsonc
 * @see ../../../../worker/basic-auth.worker.test.ts
 */
export const basicAuthMiddleware = createMiddleware<{ Bindings: Env }>(async (context, next) => {
  const { APP_ENV, BASIC_AUTH_USERNAME: username, BASIC_AUTH_PASSWORD: password } = context.env;
  if (APP_ENV !== "staging" || !username || !password) {
    await next();
    return;
  }

  return basicAuth({ username, password })(context, next);
});
