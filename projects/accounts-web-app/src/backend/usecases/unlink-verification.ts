import { runBatch, type Database } from "../db/database";
import { D1ClientProvisionRepository } from "../db/repositories/d1-client-provision-repository";
import { D1ExternalAccountRepository } from "../db/repositories/d1-external-account-repository";
import { ProblemError } from "../problem-details";
import { planAuthAccountDeletion } from "./plan-auth-account-deletion";

/**
 * 「この証明を解除」（成功した証明行1件の解除）。
 * 証明行と対象関連を削除し、OAuthの証明では参照する標準`account`行（認証連携）も削除する。
 * 最後のログイン手段の解除は、何も変更せずに拒否する。
 * DNS TXTの証明は外部アカウント行ごとに持つため、同じhostのほかの行の証明は残る。
 * 支えを失った識別子は候補（`is_active=0`）にし、ほかの方法が支える識別子・外部アカウント行・公開選択は残す。
 * 最後の成功証明を解除した行は、公開選択を保持したまま未検証の行になる。
 * 提供しなくなったクライアントの標準`oauthConsent`も削除し、これらを1回のbatchで確定する。
 * @throws {ProblemError} 本人の行の成功した証明でない場合は404 `NOT_FOUND`、最後のログイン手段の場合は400 `LAST_LOGIN_METHOD`。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./unlink-external-account.worker.test.ts
 */
export async function unlinkVerification(
  deps: { db: Database; now: Date },
  input: { userId: string; externalAccountId: string; verificationId: string },
): Promise<void> {
  const repository = new D1ExternalAccountRepository(deps.db);
  const verification = await repository.findOwnSuccessfulVerification(
    input.userId,
    input.externalAccountId,
    input.verificationId,
  );
  if (verification === undefined) {
    throw new ProblemError(404, "NOT_FOUND");
  }

  // 標準`account`を参照するのは`oauth`証明だけ。
  const authAccountDeletion = await planAuthAccountDeletion(deps, {
    userId: input.userId,
    authAccountIds: verification.authAccountId === null ? [] : [verification.authAccountId],
  });
  await runBatch(deps.db, [
    ...authAccountDeletion,
    repository.deleteVerification(verification.id),
    ...repository.reconcileIdentifierActivity([input.userId], deps.now),
    new D1ClientProvisionRepository(deps.db).reconcileOAuthConsents([input.userId]),
  ]);
}
