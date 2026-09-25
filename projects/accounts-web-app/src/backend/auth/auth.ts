import { env, waitUntil } from "cloudflare:workers";

import { createAuth, type Auth } from "./create-auth";

let auth: Auth | undefined;

/**
 * Workerの環境変数から構成したBetter Authを返す。
 * 設定とプラグインの初期化を要求ごとに繰り返さないよう、isolate内で1つを共有する。
 */
export function getAuth(): Auth {
  auth ??= createAuth(env, { waitUntil });
  return auth;
}
