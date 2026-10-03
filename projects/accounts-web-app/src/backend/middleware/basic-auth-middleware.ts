import { basicAuth } from "hono/basic-auth";
import { createMiddleware } from "hono/factory";

import type { AppEnv } from "../hono-env";

/**
 * staging・Previewの画面と静的ファイルをBasic認証で保護する。
 * 資格情報は環境別のSecretから取得し、Secretを登録した環境だけに適用する。
 * stagingとPreviewは`secrets.required`で登録をデプロイ時に検証する。
 * ビルド時のSPA shell事前生成はSecretを持たないローカル実行のため、認証を通さずに描画できる。
 * @see ../../../wrangler.jsonc
 * @see ../../../docs/implementation-plan/v0.1.md
 */
export const basicAuthMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const { BASIC_AUTH_USERNAME: username, BASIC_AUTH_PASSWORD: password } = c.env;
  if (!username || !password) {
    await next();
    return;
  }

  return basicAuth({ username, password })(c, next);
});
