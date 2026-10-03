import { reconcilePoints } from "../usecases/reconcile-points";
import {
  listOpsAlertsDueForNotification,
  observeOpsAlert,
  recordOpsAlertNotification,
  resolveOpsAlert,
  resolveUnobservedManagedAlerts,
  type OpsAlertObservation,
  type OpsAlertRecord,
} from "./ops-alert-repository";

export type ObservedOpsAlert = OpsAlertObservation;

const MINUTE = 60_000;

export async function inspectPointsOpsAlerts(
  db: D1Database,
  now: number,
): Promise<ObservedOpsAlert[]> {
  const [stuckCommands, stuckRevocations, reconciliation] = await Promise.all([
    db
      .prepare(
        `SELECT id AS resourceId FROM idempotency_results
         WHERE status = 102 AND created_at <= ? ORDER BY id`,
      )
      .bind(now - 5 * MINUTE)
      .all<{ resourceId: string }>(),
    db
      .prepare(
        `SELECT id AS resourceId FROM points_oauth_revocation_outbox
         WHERE status = 'PENDING' AND created_at <= ? ORDER BY id`,
      )
      .bind(now - 5 * MINUTE)
      .all<{ resourceId: string }>(),
    reconcilePoints(db, new Date(now)),
  ]);

  const alerts: ObservedOpsAlert[] = [];
  for (const row of [...stuckCommands.results, ...stuckRevocations.results]) {
    alerts.push({
      alertKey: `command-outbox-stuck:${row.resourceId}`,
      safeDetailCode: "PENDING_OVER_5_MINUTES",
      type: "COMMAND_OUTBOX_STUCK",
    });
  }
  if (!reconciliation.consistent) {
    alerts.push({
      alertKey: "reconciliation-mismatch:points-reconciliation",
      safeDetailCode: "POINTS_STATE_MISMATCH",
      type: "RECONCILIATION_MISMATCH",
    });
  }
  return alerts;
}

export interface MonitorOpsAlertsOptions {
  inspect?: (db: D1Database, now: number) => Promise<ObservedOpsAlert[]>;
  notify: (alert: OpsAlertRecord) => Promise<void>;
  now?: number;
}

export async function monitorOpsAlerts(
  db: D1Database,
  options: MonitorOpsAlertsOptions,
): Promise<{ deliveryFailures: number; notified: number; observed: number }> {
  const now = options.now ?? Date.now();
  const observations = await (options.inspect ?? inspectPointsOpsAlerts)(db, now);
  for (const observation of observations) await observeOpsAlert(db, observation, now);
  await resolveUnobservedManagedAlerts(
    db,
    new Set(observations.map(({ alertKey }) => alertKey)),
    now,
  );

  let deliveryFailures = 0;
  let notified = 0;
  const due = await listOpsAlertsDueForNotification(db, now);
  for (const alert of due) {
    const deliveryAlertKey = `alert-delivery-failed:${alert.alertKey}`;
    try {
      await options.notify(alert);
      await recordOpsAlertNotification(db, alert, now);
      await resolveOpsAlert(db, deliveryAlertKey, now);
      notified += 1;
    } catch {
      await observeOpsAlert(
        db,
        {
          alertKey: deliveryAlertKey,
          safeDetailCode: "EMAIL_SEND_FAILED",
          type: "ALERT_DELIVERY_FAILED",
        },
        now,
      );
      deliveryFailures += 1;
    }
  }
  return { deliveryFailures, notified, observed: observations.length };
}
