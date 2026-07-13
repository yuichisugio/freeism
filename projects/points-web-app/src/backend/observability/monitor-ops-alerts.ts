import { reconcilePoints } from "../usecases/reconcile-points";
import { hashOpsResourceId } from "./ops-metrics";
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
  resourceHashSalt = "points-ops-alert",
): Promise<ObservedOpsAlert[]> {
  const [laggingJobs, stuckCommands, stuckRevocations, reconciliation] = await Promise.all([
    db
      .prepare(
        `SELECT identity_ownership_id AS resourceId
         FROM ownership_revalidation_job
         WHERE status IN ('PENDING', 'LEASED')
           AND due_at <= ?
         ORDER BY identity_ownership_id`,
      )
      .bind(now - 15 * MINUTE)
      .all<{ resourceId: string }>(),
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
  for (const row of laggingJobs.results) {
    const resourceIdHash = await hashOpsResourceId(row.resourceId, resourceHashSalt);
    alerts.push({
      alertKey: `ownership-scheduler-lag:${resourceIdHash}`,
      resourceIdHash,
      safeDetailCode: "DUE_OVER_15_MINUTES",
      type: "OWNERSHIP_SCHEDULER_LAG",
    });
  }
  for (const row of [...stuckCommands.results, ...stuckRevocations.results]) {
    const resourceIdHash = await hashOpsResourceId(row.resourceId, resourceHashSalt);
    alerts.push({
      alertKey: `command-outbox-stuck:${resourceIdHash}`,
      resourceIdHash,
      safeDetailCode: "PENDING_OVER_5_MINUTES",
      type: "COMMAND_OUTBOX_STUCK",
    });
  }
  if (!reconciliation.consistent) {
    const resourceIdHash = await hashOpsResourceId("points-reconciliation", resourceHashSalt);
    alerts.push({
      alertKey: `reconciliation-mismatch:${resourceIdHash}`,
      resourceIdHash,
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
    const deliveryResourceHash = await hashOpsResourceId(alert.alertKey, "ops-alert-delivery");
    const deliveryAlertKey = `alert-delivery-failed:${deliveryResourceHash}`;
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
          resourceIdHash: deliveryResourceHash,
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
