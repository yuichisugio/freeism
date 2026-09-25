import type { LoginProviderId } from "../../shared/providers";
import type { VerificationMethod } from "../domain/identity/verification-method";

/**
 * 操作監査ログ。
 * 操作種別・実行日時・成否・エラー分類・検証方法・処理時間・処理件数だけを構造化JSONで記録する。
 * ユーザーID・表示名・メール・URL・IP・token・外部の本文などの個人情報は、型で受け付けず、実行時も許可した項目だけを出力する。
 * 保存・保持はWorkers Logsの設定に従う。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./audit-log.test.ts
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

/**
 * 監査する操作の種別。
 */
export type AuditEvent =
  // ログイン・外部連携（OAuthのcallback）の成功と拒否
  | "oauth_callback"
  // OAuthの標準`account`から独自表への同期
  | "oauth_sync"
  // トークン要求の拒否（refreshの失敗、grant種別・scopeによる拒否を含む）
  | "oauth_token_rejected"
  // 所有権確認の開始と方法別の結果
  | "url_verification_started"
  | "url_verification"
  // Web識別子の紐付け先の更新
  | "identifier_transfer"
  // 連携解除
  | "external_account_unlinked"
  | "oauth_unlinked"
  // 情報提供同意・公開選択の変更
  | "visibility_saved"
  // 同意画面での標準OAuthの同意・拒否
  | "oauth_consent_accepted"
  | "oauth_consent_denied"
  // Accountsプロフィールの表示名の変更
  | "display_name_updated"
  // 退会・ban・unban
  | "user_withdrawn"
  | "user_banned"
  | "user_unbanned"
  // OAuthクライアント・クライアント公開鍵の変更
  | "oauth_client_registered"
  | "oauth_client_updated"
  | "oauth_client_deleted"
  // JSON出力・復元
  | "backup_exported"
  | "backup_restored"
  // 資源APIのtoken種別・scopeによる拒否
  | "resource_api_rejected"
  // 公開プロフィールのキャッシュpurge
  | "profile_purge";

/**
 * 監査ログの1件。
 * `errorCategory`は固定の分類コード（`failure_code`・HTTPステータス・標準のエラーコードなど）だけを渡す。
 * `method`は証明方法、またはログイン・追加連携のProvider識別子。
 */
export type AuditLogEntry = {
  event: AuditEvent;
  outcome: "success" | "failure";
  errorCategory?: string;
  method?: VerificationMethod | LoginProviderId;
  durationMs?: number;
  count?: number;
};

// --------------------------------------------------
// 出力
// --------------------------------------------------

/**
 * 監査ログを1行のJSONで出力する。
 * 成功は`console.log`、失敗は`console.warn`へ出す。
 */
export function auditLog(entry: AuditLogEntry): void {
  const line = JSON.stringify({
    type: "audit",
    event: entry.event,
    outcome: entry.outcome,
    at: new Date().toISOString(),
    errorCategory: entry.errorCategory,
    method: entry.method,
    durationMs: entry.durationMs,
    count: entry.count,
  });
  if (entry.outcome === "success") {
    console.log(line);
  } else {
    console.warn(line);
  }
}

/**
 * 外部から受け取ったエラーコード（OAuthの`error`、標準のエラーコード）を監査ログの分類にする。
 * 識別子や文章が入り込まないよう、短い記号列だけをそのまま使い、それ以外は`OTHER`にする。
 */
export function toErrorCategory(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,64}$/.test(value) ? value : "OTHER";
}
