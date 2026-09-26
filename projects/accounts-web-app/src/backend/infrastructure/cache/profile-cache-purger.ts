import { exports, waitUntil } from "cloudflare:workers";

import { auditLog } from "../../logging/audit-log";

/**
 * 公開プロフィールのWorkers Cacheのpurge。
 * 公開内容が変わる更新の後に、関係するユーザーをまとめて1回の要求でpurgeする。
 * purgeは応答後の処理として`waitUntil`で行い、失敗は監査ログへ残してedgeのTTL（最長1日）で反映する。
 * @see ../../../../docs/implementation-plan/v0.1.md
 * @see ../../../public-profile.ts
 */

/**
 * 公開プロフィールのpurgeを依頼する。
 * 対象が無い場合は何もしない。
 */
export function purgeProfileCache(accountsUserIds: readonly string[]): void {
  const uniqueUserIds = [...new Set(accountsUserIds)];
  if (uniqueUserIds.length === 0) {
    return;
  }
  waitUntil(requestProfilePurge(uniqueUserIds));
}

/**
 * 公開プロフィール専用エントリーポイントのRPCでpurgeし、結果を監査ログへ残す。
 */
async function requestProfilePurge(accountsUserIds: string[]): Promise<void> {
  const count = accountsUserIds.length;
  try {
    const result = await exports.PublicProfileEntrypoint.purgeProfiles(accountsUserIds);
    auditLog(
      result.success
        ? { event: "profile_purge", outcome: "success", count }
        : {
            event: "profile_purge",
            outcome: "failure",
            errorCategory: result.errors.map((error) => error.code).join(","),
            count,
          },
    );
  } catch (error) {
    auditLog({
      event: "profile_purge",
      outcome: "failure",
      errorCategory: error instanceof Error ? error.name : "UnknownError",
      count,
    });
  }
}
