import startHandler from "@tanstack/react-start/server-entry";
import { Hono } from "hono";

import { app } from "./backend/app";
import type { AppEnv } from "./backend/hono-env";

/**
 * Accounts Workerのエントリーポイント。
 * API・認証・公開プロフィールはHonoアプリで処理し、それ以外の画面と静的ファイルはassetsから返す。
 * assetsに無い画面は、ビルド時の事前生成と同じくTanStack Startで描画する。
 * @see https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
 */
const worker = new Hono<AppEnv>().route("/", app).all("*", async (c) => {
  const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
  if (assetResponse.status === 404) {
    return startHandler.fetch(c.req.raw);
  }

  // assetsの応答ヘッダーは変更できないため、共通ミドルウェアがヘッダーを付与できる応答へ複製する。
  return new Response(assetResponse.body, assetResponse);
});

export default worker;

export { PublicProfileEntrypoint } from "./public-profile";
