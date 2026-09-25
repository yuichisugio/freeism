import { exports } from "cloudflare:workers";
import { Hono, type Context } from "hono";
import { etag } from "hono/etag";
import { secureHeaders } from "hono/secure-headers";
import { trimTrailingSlash } from "hono/trailing-slash";

import { createDatabase } from "../db/database";
import type { AppEnv } from "../hono-env";
import { readPublicProfile } from "../usecases/profile/read-public-profile";
import {
  renderPublicProfileNotFoundPage,
  renderPublicProfilePage,
} from "../views/public-profile-page";

/**
 * 公開プロフィール（`GET /profiles/{accountsUserId}`）。
 * Workers Cacheを有効にした公開プロフィール専用のエントリーポイントで処理し、キャッシュミス時にD1からHTMLを生成する。
 * edgeには最長1日、ブラウザーには毎回の再検証を指示し、公開情報の更新後はpurgeで反映する。
 * 存在しない・banされたユーザーの404も同じ方針でキャッシュし、unban・復元などの後のpurgeで消す。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ../../../docs/implementation-plan/v0.1.md
 * @see ./public-profile-routes.worker.test.ts
 */

// --------------------------------------------------
// キャッシュ
// --------------------------------------------------

/**
 * 公開プロフィールのパス。
 * purgeはこのパスにAccountsユーザーIDを付けた接頭辞で行う（IDは固定長のため、ほかのユーザーのパスに一致しない）。
 */
export const publicProfilePathPrefix = "/profiles/";

/**
 * edge用のキャッシュ指示（TTLの上限1日、期限後は古い応答を返さない）。
 */
const edgeCacheControl = "max-age=86400, must-revalidate";

/**
 * ブラウザー用のキャッシュ指示（保存は許可し、利用のたびにETagで再検証する）。
 */
const browserCacheControl = "public, no-cache";

/**
 * 公開プロフィールのHTML応答にキャッシュ指示を付ける。
 */
function htmlResponse(c: Context<AppEnv>, html: string, status: 200 | 404) {
  return c.html(html, status, {
    "cloudflare-cdn-cache-control": edgeCacheControl,
    "Cache-Control": browserCacheControl,
  });
}

// --------------------------------------------------
// ルート
// --------------------------------------------------

/**
 * 公開プロフィール専用エントリーポイントのHonoアプリ。
 */
export const publicProfileRoutes = new Hono<AppEnv>()
  .use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'none'"],
        styleSrc: ["'unsafe-inline'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    }),
    trimTrailingSlash(),
    etag(),
  )
  .get(`${publicProfilePathPrefix}:accountsUserId`, async (c) => {
    const profile = await readPublicProfile(
      { db: createDatabase(c.env.DB) },
      { accountsUserId: c.req.param("accountsUserId") },
    );
    return profile === null
      ? htmlResponse(c, await renderPublicProfileNotFoundPage(), 404)
      : htmlResponse(c, await renderPublicProfilePage(profile), 200);
  })
  .notFound(async (c) => htmlResponse(c, await renderPublicProfileNotFoundPage(), 404));

/**
 * キャッシュ無効の入口（default）で受けた`/profiles/*`を、公開プロフィール専用エントリーポイントへ渡す。
 * エントリーポイント経由の`fetch()`にWorkers Cacheが適用される。
 * 応答ヘッダーを共通ミドルウェアが変更できるよう、応答を複製して返す。
 * @see https://developers.cloudflare.com/workers/cache/configuration/
 */
export async function forwardToPublicProfile(c: Context<AppEnv>): Promise<Response> {
  const response = await exports.PublicProfileEntrypoint.fetch(c.req.raw);
  return new Response(response.body, response);
}
