import type { Auth } from "../auth/create-auth";
import { unlinkAuthAccount } from "../auth/unlink-auth-account";
import { runBatch, type Database } from "../db/database";
import { D1ExternalAccountRepository } from "../db/repositories/d1-external-account-repository";
import { ProblemError } from "../problem-details";

/**
 * 「連携解除」（外部アカウントの表示行全体の解除）。
 * 行がOAuthの証明を含む場合は、標準の認証連携の解除を先に行い、拒否された場合は独自表を変更しない。
 * その後、外部アカウント行を削除し、行の識別子・証明・対象関連・公開設定をCASCADEで終了する。
 * 証明と識別子の関連は同じ行の中だけにあるため、ほかの行の識別子の有効性は変わらない。
 * @throws {ProblemError} 本人の行でない場合は404 `NOT_FOUND`、最後のログイン手段の場合は400 `LAST_LOGIN_METHOD`。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./unlink-external-account.worker.test.ts
 */
export async function unlinkExternalAccount(
  deps: { db: Database; auth: Auth },
  input: { userId: string; headers: Headers; externalAccountId: string },
): Promise<void> {
  const repository = new D1ExternalAccountRepository(deps.db);
  const externalAccount = await repository.findOwnExternalAccount(
    input.userId,
    input.externalAccountId,
  );
  if (externalAccount === undefined) {
    throw new ProblemError(404, "NOT_FOUND");
  }

  // 1行に属するOAuthアカウントは通常1件で、最後のログイン手段は最初の解除で拒否される。
  for (const authAccountId of externalAccount.authAccountIds) {
    await unlinkAuthAccount(deps.auth, input.headers, authAccountId);
  }

  await runBatch(deps.db, [repository.deleteExternalAccount(input.userId, externalAccount.id)]);
}
