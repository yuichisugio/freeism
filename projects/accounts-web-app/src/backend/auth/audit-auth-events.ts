import { createAuthMiddleware, isAPIError } from "better-auth/api";

import { isOAuthProviderId } from "../domain/identity/providers";
import { auditLog, toErrorCategory, type AuditEvent } from "../logging/audit-log";

/**
 * Better Authの標準エンドポイントの監査とban・unban後のpurge。
 * `hooks.after`は標準の処理が例外（リダイレクトを含む）で終わった場合も実行され、結果は`ctx.context.returned`に入る。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./audit-auth-events.worker.test.ts
 */

/**
 * ban・unbanのエンドポイントと監査の操作種別。
 */
const banEvents: Partial<Record<string, AuditEvent>> = {
  "/admin/ban-user": "user_banned",
  "/admin/unban-user": "user_unbanned",
};

/**
 * 失敗した標準エンドポイントの結果から、エラーコードまたはHTTPステータスを分類として取り出す。
 */
function readErrorCategory(returned: unknown): string {
  if (!isAPIError(returned)) {
    return "OTHER";
  }
  const body = returned.body as { code?: unknown; error?: unknown } | undefined;
  return toErrorCategory(body?.code ?? body?.error ?? String(returned.statusCode));
}

/**
 * `hooks.after`に渡す監査処理を作る。
 * - OAuthのcallback（ログイン・追加連携・再連携）: リダイレクト先の`error`の有無で成否を記録する。
 * - ban・unban: 成功後に対象ユーザーの公開プロフィールをpurgeし、成否を記録する。
 * - token endpoint: grant種別・scope・クライアント認証などによる拒否を記録する（refresh tokenの要求も拒否として残る）。
 * - 退会: 失敗を記録する（成功は`user.deleteUser.afterDelete`で記録する）。
 */
export function createAuditAfterHook({
  purgeProfiles,
}: {
  purgeProfiles: (accountsUserIds: readonly string[]) => void;
}) {
  return createAuthMiddleware(async (ctx) => {
    const returned = ctx.context.returned;

    if (ctx.path === "/callback/:id") {
      // 成功・失敗ともリダイレクトで終わり、失敗は戻り先に`error`が付く。
      const location = ctx.context.responseHeaders?.get("location") ?? "";
      const error = new URL(location, ctx.context.baseURL).searchParams.get("error");
      const providerId = String(ctx.params?.id);
      auditLog({
        event: "oauth_callback",
        outcome: error === null ? "success" : "failure",
        errorCategory: error === null ? undefined : toErrorCategory(error),
        method: isOAuthProviderId(providerId) ? providerId : undefined,
      });
      return;
    }

    const banEvent = banEvents[ctx.path];
    if (banEvent !== undefined) {
      if (isAPIError(returned)) {
        auditLog({ event: banEvent, outcome: "failure", errorCategory: readErrorCategory(returned) });
        return;
      }
      purgeProfiles([String(ctx.body.userId)]);
      auditLog({ event: banEvent, outcome: "success" });
      return;
    }

    if (ctx.path === "/oauth2/token" && isAPIError(returned)) {
      auditLog({
        event: "oauth_token_rejected",
        outcome: "failure",
        errorCategory: readErrorCategory(returned),
      });
      return;
    }

    if (ctx.path === "/delete-user" && isAPIError(returned)) {
      auditLog({
        event: "user_withdrawn",
        outcome: "failure",
        errorCategory: readErrorCategory(returned),
      });
    }
  });
}
