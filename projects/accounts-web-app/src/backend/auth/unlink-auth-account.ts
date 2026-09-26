import { isAPIError } from "better-auth/api";

import { ProblemError } from "../problem-details";
import type { Auth } from "./create-auth";

/**
 * 標準`unlinkAccount`で、セッション本人のOAuthの認証連携を解除する。
 * 標準`account`の削除により、対応する`oauth`証明と対象関連はCASCADEで削除される。
 * @param headers セッション本人の要求ヘッダー。
 * @param authAccountId 標準`account`の行ID（`account.id`）。
 * @throws {ProblemError} 最後のログイン手段として拒否された場合は400 `LAST_LOGIN_METHOD`。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */
export async function unlinkAuthAccount(
  auth: Auth,
  headers: Headers,
  authAccountId: string,
): Promise<void> {
  try {
    await auth.api.unlinkAccount({ headers, body: { accountId: authAccountId } });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "FAILED_TO_UNLINK_LAST_ACCOUNT") {
      throw new ProblemError(400, "LAST_LOGIN_METHOD");
    }
    throw error;
  }
}
