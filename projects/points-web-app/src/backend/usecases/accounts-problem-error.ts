/**
 * Accounts連携の操作（接続先の管理・利用者の連携）の失敗。
 * routeはこの値をそのままProblem Details（RFC 9457）にする。
 * @see ../http/problem.ts
 */

// --------------------------------------------------
// 失敗
// --------------------------------------------------

export type AccountsProblemStatus = 400 | 404 | 409 | 422 | 429 | 503;

export class AccountsProblemError extends Error {
  constructor(
    readonly status: AccountsProblemStatus,
    readonly code: string,
    /** 429の`Retry-After`（秒）。 */
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
    this.name = "AccountsProblemError";
  }
}
