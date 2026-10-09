import { env, waitUntil } from "cloudflare:workers";

import { purgeProfileCache } from "../infrastructure/cache/profile-cache-purger";
import { createAuth, type Auth } from "./create-auth";

/**
 * ORCIDのdiscoveryに失敗して登録できなかったインスタンスを、作り直すまでの間隔。
 * ORCIDの停止中に、要求ごとの作り直しとdiscoveryの取得が起きないよう間隔を空ける。
 */
const orcidRetryIntervalMs = 60_000;

let auth: Auth | undefined;
let expiresAt = Number.POSITIVE_INFINITY;

/**
 * Workerの環境変数から構成したBetter Authを返す。
 * 設定とプラグインの初期化を要求ごとに繰り返さないよう、isolate内で1つを共有する。
 * 初期化に失敗したインスタンスは捨て、ORCIDを登録できなかったインスタンスは作成から一定時間後に作り直す。
 * @see ./auth.worker.test.ts
 */
export function getAuth(): Auth {
  if (auth !== undefined && Date.now() < expiresAt) {
    return auth;
  }

  const created = createAuth(env, { waitUntil, purgeProfiles: purgeProfileCache });
  const createdAt = Date.now();
  auth = created;
  expiresAt = Number.POSITIVE_INFINITY;
  void created.$context.then(
    (context) => {
      const hasOrcid = context.socialProviders.some((provider) => provider.id === "orcid");
      if (auth === created && !hasOrcid) {
        expiresAt = createdAt + orcidRetryIntervalMs;
      }
    },
    () => {
      if (auth === created) {
        auth = undefined;
      }
    },
  );
  return created;
}
