import type { Context } from "hono";

import { AccountsRecipientResolutionError } from "../identity/accounts-recipient-resolver";
import type { BackendContext } from "./context";
import { problem } from "./problem";

/**
 * Accounts で照合できなかった失敗を Problem Details（RFC 9457）にする。
 * 未受領 FIX の受領・reopen・FIX 取込で共通に使う。
 * @see ../identity/accounts-recipient-resolver.ts
 * @see ../../../test/worker/unclaimed-claim.worker.test.ts
 */

// --------------------------------------------------
// 対応付け
// --------------------------------------------------

/**
 * 照合の失敗を problem 応答にする。
 * Accounts の制限超過で `Retry-After` を受け取っていれば、そのまま転記する。
 * @returns 照合の失敗でなければ `null`
 */
export function toAccountsResolutionProblem(
  context: Context<BackendContext>,
  error: unknown,
): Response | null {
  if (!(error instanceof AccountsRecipientResolutionError)) return null;
  if (error.code === "ACCOUNTS_CONNECTION_NOT_ACTIVE")
    return problem(context, 409, error.code, "Accounts connection is not active");
  const response = problem(
    context,
    503,
    error.code,
    error.code === "ACCOUNTS_CLIENT_UNAUTHORIZED"
      ? "Accounts rejected the client"
      : "Accounts is unavailable",
  );
  if (error.retryAfter !== null) response.headers.set("Retry-After", error.retryAfter);
  return response;
}
