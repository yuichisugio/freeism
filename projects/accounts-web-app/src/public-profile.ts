import { WorkerEntrypoint } from "cloudflare:workers";

import { publicProfilePathPrefix, publicProfileRoutes } from "./backend/routes/public-profile-routes";

/**
 * 公開プロフィール専用のエントリーポイント。
 * `wrangler.jsonc`でこのエントリーポイントだけWorkers Cacheを有効にし、認証・個人別APIの入口（default）はキャッシュしない。
 * Workers Cacheのpurgeは呼び出したエントリーポイントのキャッシュだけに効くため、purgeもこのエントリーポイントのRPCで行う。
 * @see ../docs/implementation-plan/v0.1.md
 * @see https://developers.cloudflare.com/workers/cache/purge/
 * @see ./backend/routes/public-profile-routes.worker.test.ts
 */
export class PublicProfileEntrypoint extends WorkerEntrypoint<CloudflareBindings> {
  override async fetch(request: Request): Promise<Response> {
    return publicProfileRoutes.fetch(request, this.env, this.ctx);
  }

  /**
   * 指定したユーザーの公開プロフィールのキャッシュを1回の要求でpurgeする。
   * キャッシュが無効な実行環境（ローカル・Preview・テスト）では`ctx.cache`が無く、消す対象も無い。
   */
  async purgeProfiles(accountsUserIds: string[]): Promise<CachePurgeResult> {
    if (this.ctx.cache === undefined) {
      return { success: true, errors: [] };
    }
    return this.ctx.cache.purge({
      pathPrefixes: accountsUserIds.map((accountsUserId) => publicProfilePathPrefix + accountsUserId),
    });
  }
}
