import type { Auth } from "../auth/create-auth";
import { unlinkAuthAccount } from "../auth/unlink-auth-account";
import { runBatch, type Database } from "../db/database";
import { D1ExternalAccountRepository } from "../db/repositories/d1-external-account-repository";
import { ProblemError } from "../problem-details";

/**
 * 「OAuthの認証連携だけ解除する」。
 * 標準`unlinkAccount`で認証連携を解除し、CASCADEで対応する`oauth`証明と対象関連だけを終了する。
 * 支えを失った識別子は候補（`is_active=0`）にし、ほかの方法が支える識別子・外部アカウント行・公開設定は残す。
 * @throws {ProblemError} 本人の行の`oauth`証明に属さない場合は404 `NOT_FOUND`、最後のログイン手段の場合は400 `LAST_LOGIN_METHOD`。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./unlink-external-account.worker.test.ts
 */
export async function unlinkOAuthOnly(
  deps: { db: Database; auth: Auth; now: Date },
  input: { userId: string; headers: Headers; externalAccountId: string; authAccountId: string },
): Promise<void> {
  const repository = new D1ExternalAccountRepository(deps.db);
  const externalAccount = await repository.findOwnExternalAccount(
    input.userId,
    input.externalAccountId,
  );
  if (!externalAccount?.authAccountIds.includes(input.authAccountId)) {
    throw new ProblemError(404, "NOT_FOUND");
  }

  await unlinkAuthAccount(deps.auth, input.headers, input.authAccountId);
  await runBatch(deps.db, repository.reconcileIdentifierActivity([input.userId], deps.now));
}
