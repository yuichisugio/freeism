import { emitOpsMetric, hashOpsResourceId } from "../observability/ops-metrics";
import { writeStructuredLog } from "../observability/structured-logger";

/**
 * Accountsとのやり取りの失敗を、構造化ログとメトリクスへ出す。
 * 出すのはoperation・code・接続先IDのhashだけで、識別子・トークン・応答本文は出さない。
 * @see ../observability/structured-logger.ts
 */

// --------------------------------------------------
// 失敗の記録
// --------------------------------------------------

export type AccountsOperation =
  | "accounts_discovery"
  | "accounts_token"
  | "accounts_resolve"
  | "accounts_list"
  | "accounts_link_callback";

export type AccountsFailure = {
  operation: AccountsOperation;
  code: string;
  connectionId: string;
};

/**
 * 失敗を記録する関数。
 * 記録の完了を待ってから応答してよい（外部への要求は無い）。
 */
export type AccountsFailureReporter = (failure: AccountsFailure) => Promise<void>;

/**
 * Workerの環境変数を使う記録先を作る。
 */
export function createAccountsFailureReporter(env: {
  APP_ENV: string;
  OPS_RESOURCE_HASH_SALT: string;
  OPS_METRICS: AnalyticsEngineDataset;
}): AccountsFailureReporter {
  return async ({ operation, code, connectionId }) => {
    const resourceIdHash = await hashOpsResourceId(connectionId, env.OPS_RESOURCE_HASH_SALT);
    writeStructuredLog({
      app: "points",
      code,
      environment: env.APP_ENV,
      event: "accounts_request",
      level: "warn",
      operation,
      outcome: "FAILED",
      resourceIdHash,
      resourceType: "accounts_connection",
    });
    emitOpsMetric(env.OPS_METRICS, {
      app: "points",
      attempt: 1,
      code,
      count: 1,
      durationMs: 0,
      environment: env.APP_ENV,
      event: "accounts_request",
      lagSeconds: 0,
      outcome: "FAILED",
      resourceIdHash,
      resourceState: operation,
    });
  };
}
