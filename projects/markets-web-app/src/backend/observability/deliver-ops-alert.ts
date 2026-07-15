import type { MarketsOpsAlertRecord } from "./ops-alert-repository";

export async function deliverOpsAlert(
  binding: SendEmail,
  alert: MarketsOpsAlertRecord,
  addresses: { from: string; to: string },
): Promise<void> {
  await binding.send({
    from: addresses.from,
    subject: `[Markets] ${alert.status}: ${alert.signal}`,
    text: JSON.stringify({
      alertKey: alert.dedupeKey,
      safeDetailCode: alert.safeDetailCode,
      severity: alert.severity,
      status: alert.status,
    }),
    to: addresses.to,
  });
}
