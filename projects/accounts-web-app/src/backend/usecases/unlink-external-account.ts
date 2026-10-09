import { runBatch, type Database } from "../db/database";
import { D1ClientProvisionRepository } from "../db/repositories/d1-client-provision-repository";
import { D1ExternalAccountRepository } from "../db/repositories/d1-external-account-repository";
import { ProblemError } from "../problem-details";
import { planAuthAccountDeletion } from "./plan-auth-account-deletion";

/**
 * 「連携解除」（外部アカウントの表示行全体の解除）。
 * 外部アカウント行を削除し、行の識別子・証明・対象関連・公開設定をCASCADEで終了する。
 * 行がOAuthの証明を含む場合は、参照する標準`account`行（認証連携）も削除する。
 * 最後のログイン手段の解除は、何も変更せずに拒否する。
 * 証明と識別子の関連は同じ行の中だけにあるため、ほかの行の識別子の有効性は変わらない。
 * 解除で提供しなくなったクライアントの標準`oauthConsent`も削除し、これらを1回のbatchで確定する。
 * @throws {ProblemError} 本人の行でない場合は404 `NOT_FOUND`、最後のログイン手段の場合は400 `LAST_LOGIN_METHOD`。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./unlink-external-account.worker.test.ts
 */
export async function unlinkExternalAccount(
  deps: { db: Database },
  input: { userId: string; externalAccountId: string },
): Promise<void> {
  const repository = new D1ExternalAccountRepository(deps.db);
  const externalAccount = await repository.findOwnExternalAccount(
    input.userId,
    input.externalAccountId,
  );
  if (externalAccount === undefined) {
    throw new ProblemError(404, "NOT_FOUND");
  }

  const authAccountDeletion = await planAuthAccountDeletion(deps, {
    userId: input.userId,
    authAccountIds: externalAccount.authAccountIds,
  });
  await runBatch(deps.db, [
    ...authAccountDeletion,
    repository.deleteExternalAccount(input.userId, externalAccount.id),
    new D1ClientProvisionRepository(deps.db).reconcileOAuthConsents([input.userId]),
  ]);
}
