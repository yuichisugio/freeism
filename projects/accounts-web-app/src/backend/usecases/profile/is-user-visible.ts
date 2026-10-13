import type { Database } from "../../db/database";
import { D1PublicProfileRepository } from "../../db/repositories/d1-public-profile-repository";

/**
 * ユーザーが存在し、banされていないかを返す。
 * 公開プロフィール・連携アカウント一覧API・照合APIでは、banされたユーザーを存在しないユーザーと同じ結果にする。
 * `user`表を結合する読取では、同じ条件`coalesce(user.banned, 0) = 0`を使う。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../auth/admin-ban.worker.test.ts
 */
export async function isUserVisible(
  deps: { db: Database },
  input: { userId: string },
): Promise<boolean> {
  const visibleUser = await new D1PublicProfileRepository(deps.db).findVisibleUser(input.userId);
  return visibleUser !== undefined;
}
