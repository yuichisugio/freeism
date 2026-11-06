import { OpsAlertRepository, type MarketsOpsAlertRecord } from "./ops-alert-repository";

const FIVE_MINUTES = 5 * 60_000;

export interface ObservedMarketsOpsAlert {
  dedupeKey: string;
  safeDetailCode: string;
  severity: "WARNING";
  signal: "SETTLEMENT_OUTBOX_STUCK";
}

export async function inspectMarketsOpsAlerts(
  db: D1Database,
  now: number,
): Promise<ObservedMarketsOpsAlert[]> {
  const stuck = await db
    .prepare(
      `SELECT id FROM settlement_outbox
       WHERE status = 'PENDING' AND created_at <= ?
       ORDER BY created_at, id`,
    )
    .bind(new Date(now - FIVE_MINUTES).toISOString())
    .all<{ id: string }>();

  return stuck.results.map(({ id }) => ({
    dedupeKey: `settlement-outbox-stuck:${id}`,
    safeDetailCode: "PENDING_OVER_5_MINUTES",
    severity: "WARNING",
    signal: "SETTLEMENT_OUTBOX_STUCK",
  }));
}

export interface MonitorMarketsOpsAlertsOptions {
  environment?: string;
  inspect?: (db: D1Database, now: number) => Promise<ObservedMarketsOpsAlert[]>;
  notify: (alert: MarketsOpsAlertRecord) => Promise<void>;
  now?: number;
}

export async function monitorMarketsOpsAlerts(
  db: D1Database,
  options: MonitorMarketsOpsAlertsOptions,
): Promise<{ deliveryFailures: number; notified: number; observed: number }> {
  const now = options.now ?? Date.now();
  const nowIso = new Date(now).toISOString();
  const repository = new OpsAlertRepository(db);
  const observations = await (options.inspect ?? inspectMarketsOpsAlerts)(db, now);
  for (const observation of observations) {
    await repository.observe({
      dedupeKey: observation.dedupeKey,
      safeDetailCode: observation.safeDetailCode,
      severity: observation.severity,
      signal: observation.signal,
      seenAt: nowIso,
    });
  }
  await repository.resolveUnobserved(
    new Set(observations.map(({ dedupeKey }) => dedupeKey)),
    nowIso,
  );

  let deliveryFailures = 0;
  let notified = 0;
  for (const alert of await repository.listDueForNotification(nowIso)) {
    const deliveryAlertKey = `alert-delivery-failed:${alert.dedupeKey}`;
    await repository.recordDeliveryAttempt(alert.dedupeKey);
    try {
      await options.notify(alert);
      await repository.recordNotification(alert, nowIso, options.environment ?? "unknown");
      await repository.resolve(deliveryAlertKey, nowIso);
      notified += 1;
    } catch {
      await repository.observe({
        dedupeKey: deliveryAlertKey,
        safeDetailCode: "EMAIL_SEND_FAILED",
        severity: "WARNING",
        signal: "ALERT_DELIVERY_FAILED",
        seenAt: nowIso,
      });
      deliveryFailures += 1;
    }
  }
  return { deliveryFailures, notified, observed: observations.length };
}
