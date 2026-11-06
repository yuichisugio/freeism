import { type StructuredLogInput, writeStructuredLog } from "./structured-logger";

export interface AuditLogInput {
  action: string;
  environment?: string;
  requestId: string;
  outcome?: "SUCCESS" | "REJECTED";
  code?: string;
  resourceType?: string;
  claimedCount?: number;
  releasedLinkCount?: number;
  affectedCount?: number;
  previousState?: string;
  nextState?: string;
}

/** DBの確定後または拒否の確定後に、安全な監査情報をログへ出す。 */
export function writeAuditLog(
  input: AuditLogInput & Record<string, unknown>,
  sink?: (log: StructuredLogInput) => void,
): void {
  const outcome = input.outcome ?? "SUCCESS";
  try {
    writeStructuredLog(
      {
        app: "points",
        code: input.code ?? (outcome === "SUCCESS" ? "OK" : "REJECTED"),
        environment: input.environment ?? "unknown",
        event: input.action,
        level: outcome === "SUCCESS" ? "info" : "warn",
        operation: input.action,
        outcome,
        requestId: input.requestId,
        timestamp: new Date().toISOString(),
        resourceType: input.resourceType,
        claimedCount: input.claimedCount,
        releasedLinkCount: input.releasedLinkCount,
        affectedCount: input.affectedCount,
        previousState: input.previousState,
        nextState: input.nextState,
      },
      sink,
    );
  } catch {
    // ログ出力の失敗は、確定した業務結果に影響させない。
  }
}
