import { type AuditLogInput, writeAuditLog } from "./audit-logger";

const REJECTION_CODES = [
  "REVISION_CONFLICT",
  "INSUFFICIENT_BALANCE",
  "SAFE_INTEGER_OVERFLOW",
  "POINT_TRANSACTION_REFERENCE_INVALID",
  "AUTO_DISTRIBUTION_TARGET_LIMIT_EXCEEDED",
] as const;

/** ロールバック後、D1が返した拒否理由から固定コードだけを監査ログへ残す。 */
export function writeEconomicRejectionLog(error: unknown, input: AuditLogInput): void {
  if (!(error instanceof Error)) return;
  const code = REJECTION_CODES.find((candidate) => error.message.includes(candidate));
  if (code) writeAuditLog({ ...input, code, outcome: "REJECTED" });
}
