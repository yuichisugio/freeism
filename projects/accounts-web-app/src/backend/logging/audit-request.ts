import { createMiddleware } from "hono/factory";

import { auditLog, type AuditEvent } from "./audit-log";

/**
 * BFFの状態変更ルートの結果を監査ログへ記録するミドルウェア。
 * 応答のHTTPステータスで成否を判定し、失敗はステータスを分類として残す。
 * セッション確認より前に置き、未認証による拒否も記録する。
 * @see ./audit-log.ts
 */
export function auditRequest(event: AuditEvent) {
  return createMiddleware(async (c, next) => {
    const startedAt = Date.now();
    await next();
    const { status } = c.res;
    auditLog({
      event,
      outcome: status < 400 ? "success" : "failure",
      errorCategory: status < 400 ? undefined : String(status),
      durationMs: Date.now() - startedAt,
    });
  });
}
