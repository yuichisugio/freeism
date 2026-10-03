import type { Database, DatabaseBatchItem } from "../db/database";
import { D1AuthAccountRepository } from "../db/repositories/d1-auth-account-repository";
import { ProblemError } from "../problem-details";

/**
 * OAuthの認証連携の解除で、本人の標準`account`行を削除する文を返す。
 * 標準`unlinkAccount`と同じく、削除後にログイン手段が残らない場合は拒否する。
 * 返した文は独自表の整理と同じbatchに入れ、途中で失敗した場合に標準`account`行だけが消えないようにする。
 * @param authAccountIds 削除する標準`account`の行ID（`account.id`）。
 * @throws {ProblemError} 最後のログイン手段の場合は400 `LAST_LOGIN_METHOD`。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./unlink-external-account.worker.test.ts
 */
export async function planAuthAccountDeletion(
  deps: { db: Database },
  input: { userId: string; authAccountIds: readonly string[] },
): Promise<DatabaseBatchItem[]> {
  if (input.authAccountIds.length === 0) {
    return [];
  }

  const repository = new D1AuthAccountRepository(deps.db);
  if ((await repository.countByUser(input.userId)) <= input.authAccountIds.length) {
    throw new ProblemError(400, "LAST_LOGIN_METHOD");
  }
  return [repository.deleteOwnAuthAccounts(input.userId, input.authAccountIds)];
}
