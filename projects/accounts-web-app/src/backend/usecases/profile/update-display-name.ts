import type { Auth } from "../../auth/create-auth";
import { purgeProfileCache } from "../../infrastructure/cache/profile-cache-purger";
import { auditLog } from "../../logging/audit-log";

/**
 * Accountsプロフィールの表示名を更新する。
 * HTTPの`/update-user`は無効にしているため、共有schemaで検査した値をサーバー側の標準`updateUser`へ渡す。
 * 表示名は公開プロフィールに掲載するため、更新後にpurgeする。
 * 戻り値の`setCookies`は標準の更新処理が返すセッションのcookie cacheで、応答へ付けて次の読取に反映する。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../routes/profile-routes.worker.test.ts
 */
export async function updateDisplayName(
  deps: { auth: Auth; headers: Headers },
  input: { userId: string; displayName: string },
): Promise<{ setCookies: string[] }> {
  const { headers } = await deps.auth.api.updateUser({
    headers: deps.headers,
    body: { name: input.displayName },
    returnHeaders: true,
  });
  purgeProfileCache([input.userId]);
  auditLog({ event: "display_name_updated", outcome: "success" });
  return { setCookies: headers.getSetCookie() };
}
