import type { Database } from "../../db/database";
import { D1PublicProfileRepository } from "../../db/repositories/d1-public-profile-repository";

/**
 * 外部アカウント・識別子の更新後に、公開プロフィールのキャッシュをpurgeするユーザーを選ぶ。
 * 操作した本人は、`affectedUserIds`に含まれ、一般公開中の外部アカウント行がある場合だけ対象にする（何も保存しなかった操作や、非公開の行の変更は公開プロフィールに現れないため）。
 * 識別子を失ったほかのユーザー（旧所有者）は、行の削除で公開状態を判定できないため常に対象にする。
 * Workers Cacheのpurgeはアカウント単位の頻度制限を受けるため、公開内容が変わらない更新を対象から外す。
 * @see ../../../../docs/implementation-plan/v0.1.md
 */
export async function selectProfilePurgeTargets(
  deps: { db: Database },
  input: { actorUserId: string; affectedUserIds: readonly string[] },
): Promise<string[]> {
  const otherUserIds = input.affectedUserIds.filter((userId) => userId !== input.actorUserId);
  if (!input.affectedUserIds.includes(input.actorUserId)) {
    return otherUserIds;
  }
  const hasPublicAccount = await new D1PublicProfileRepository(
    deps.db,
  ).hasPublicExternalAccount(input.actorUserId);
  return hasPublicAccount ? [input.actorUserId, ...otherUserIds] : otherUserIds;
}
