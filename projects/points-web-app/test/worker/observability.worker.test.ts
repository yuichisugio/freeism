import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createStructuredLog,
  type StructuredLogInput,
} from "../../src/backend/observability/structured-logger";
import { emitOpsMetric, hashOpsResourceId } from "../../src/backend/observability/ops-metrics";
import { cleanupResolvedOpsAlerts } from "../../src/backend/observability/cleanup-ops-alerts";
import {
  monitorOpsAlerts,
  type ObservedOpsAlert,
} from "../../src/backend/observability/monitor-ops-alerts";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
    }
  }
}

const NOW = Date.UTC(2026, 6, 13, 0, 0, 0);

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM ops_alert").run();
  await env.DB.prepare(
    "DELETE FROM audit_event WHERE action LIKE 'OPS_ALERT_%' OR action = 'OPS_ALERT_CLEANUP'",
  ).run();
});

describe("structured Workers observability", () => {
  it("keeps only the canonical fields and never emits credentials or private payloads", () => {
    const input: StructuredLogInput & Record<string, unknown> = {
      app: "points",
      attempt: 1,
      code: "CSV_VALIDATION_FAILED",
      correlationId: "correlation-1",
      durationMs: 12,
      environment: "staging",
      event: "request.completed",
      level: "warn",
      operation: "fix.csv.validate",
      outcome: "rejected",
      requestId: "request-1",
      resourceIdHash: "hash-1",
      resourceType: "fix-import",
      authorization: "Bearer secret-token",
      cookie: "session=secret-cookie",
      csvCell: "private cell",
      email: "person@example.com",
      externalUrl: "https://private.example/person",
    };

    const log = createStructuredLog(input);
    const encoded = JSON.stringify(log);

    expect(log).toEqual({
      app: "points",
      attempt: 1,
      code: "CSV_VALIDATION_FAILED",
      correlationId: "correlation-1",
      durationMs: 12,
      environment: "staging",
      event: "request.completed",
      level: "warn",
      operation: "fix.csv.validate",
      outcome: "rejected",
      requestId: "request-1",
      resourceIdHash: "hash-1",
      resourceType: "fix-import",
    });
    expect(encoded).not.toContain("secret-token");
    expect(encoded).not.toContain("secret-cookie");
    expect(encoded).not.toContain("person@example.com");
    expect(encoded).not.toContain("private.example");
    expect(encoded).not.toContain("private cell");
  });

  it("writes one allowlisted Analytics Engine point and absorbs metric failures", async () => {
    const points: AnalyticsEngineDataPoint[] = [];
    const dataset: AnalyticsEngineDataset = {
      writeDataPoint(point) {
        if (point) points.push(point);
      },
    };
    const resourceIdHash = await hashOpsResourceId("ownership-123", "test-salt");

    expect(
      emitOpsMetric(dataset, {
        app: "points",
        attempt: 2,
        code: "DUE_OVER_15_MINUTES",
        count: 1,
        durationMs: 25,
        environment: "staging",
        event: "ops.alert.observed",
        lagSeconds: 901,
        outcome: "open",
        resourceIdHash,
        resourceState: "OPEN",
      }),
    ).toBe(true);
    expect(points).toEqual([
      {
        blobs: ["ops.alert.observed", "points", "staging", "open", "DUE_OVER_15_MINUTES", "OPEN"],
        doubles: [1, 25, 901, 2],
        indexes: [resourceIdHash],
      },
    ]);

    const failingDataset: AnalyticsEngineDataset = {
      writeDataPoint() {
        throw new Error("analytics unavailable");
      },
    };
    expect(
      emitOpsMetric(failingDataset, {
        app: "points",
        attempt: 1,
        code: "ANALYTICS_FAILED",
        count: 1,
        durationMs: 0,
        environment: "staging",
        event: "ops.metric.write",
        lagSeconds: 0,
        outcome: "failed",
        resourceIdHash,
        resourceState: "OPEN",
      }),
    ).toBe(false);
  });
});

describe("ops alert monitor", () => {
  const lagAlert: ObservedOpsAlert = {
    alertKey: "ownership-scheduler-lag:hash-1",
    resourceIdHash: "hash-1",
    safeDetailCode: "DUE_OVER_15_MINUTES",
    type: "OWNERSHIP_SCHEDULER_LAG",
  };

  it("opens, deduplicates, repeats after one hour, and notifies resolution", async () => {
    const notifications: Array<{ alertKey: string; status: "OPEN" | "RESOLVED" }> = [];
    const notify = async (alert: { alertKey: string; status: "OPEN" | "RESOLVED" }) => {
      notifications.push({ alertKey: alert.alertKey, status: alert.status });
    };

    await monitorOpsAlerts(env.DB, {
      inspect: async () => [lagAlert],
      notify,
      now: NOW,
    });
    await monitorOpsAlerts(env.DB, {
      inspect: async () => [lagAlert],
      notify,
      now: NOW + 5 * 60_000,
    });
    await monitorOpsAlerts(env.DB, {
      inspect: async () => [lagAlert],
      notify,
      now: NOW + 60 * 60_000,
    });
    await monitorOpsAlerts(env.DB, {
      inspect: async () => [],
      notify,
      now: NOW + 65 * 60_000,
    });

    expect(notifications).toEqual([
      { alertKey: lagAlert.alertKey, status: "OPEN" },
      { alertKey: lagAlert.alertKey, status: "OPEN" },
      { alertKey: lagAlert.alertKey, status: "RESOLVED" },
    ]);
    const alert = await env.DB.prepare(
      `SELECT status, repeat_count AS repeatCount, resolved_at AS resolvedAt
       FROM ops_alert WHERE alert_key = ?`,
    )
      .bind(lagAlert.alertKey)
      .first<{ repeatCount: number; resolvedAt: number | null; status: string }>();
    expect(alert).toEqual({
      repeatCount: 3,
      resolvedAt: NOW + 65 * 60_000,
      status: "RESOLVED",
    });
  });

  it("keeps a failed delivery pending and retries without recursively emailing its failure alert", async () => {
    const notify = vi
      .fn<(alert: { alertKey: string; status: "OPEN" | "RESOLVED" }) => Promise<void>>()
      .mockRejectedValueOnce(new Error("email unavailable"))
      .mockResolvedValue(undefined);

    await monitorOpsAlerts(env.DB, {
      inspect: async () => [lagAlert],
      notify,
      now: NOW,
    });
    await monitorOpsAlerts(env.DB, {
      inspect: async () => [lagAlert],
      notify,
      now: NOW + 5 * 60_000,
    });

    expect(notify).toHaveBeenCalledTimes(2);
    const failure = await env.DB.prepare(
      "SELECT status FROM ops_alert WHERE type = 'ALERT_DELIVERY_FAILED'",
    ).first<{ status: string }>();
    expect(failure?.status).toBe("RESOLVED");
  });
});

describe("resolved alert cleanup", () => {
  async function insertResolved(alertKey: string, resolvedAt: number) {
    await env.DB.prepare(
      `INSERT INTO ops_alert
         (alert_key, type, resource_id_hash, status, first_observed_at,
          last_observed_at, resolved_at, repeat_count, safe_detail_code)
       VALUES (?, 'TEST_ALERT', 'hash', 'RESOLVED', ?, ?, ?, 1, 'TEST')`,
    )
      .bind(alertKey, resolvedAt, resolvedAt, resolvedAt)
      .run();
  }

  it("retains 179d 23:59:59, removes exactly 180d, and runs once per UTC day", async () => {
    const day = 24 * 60 * 60_000;
    await insertResolved("keep", NOW - 180 * day + 1_000);
    await insertResolved("remove", NOW - 180 * day);

    expect(await cleanupResolvedOpsAlerts(env.DB, new Date(NOW))).toEqual({
      deleted: 1,
      skipped: false,
    });
    expect(await cleanupResolvedOpsAlerts(env.DB, new Date(NOW + 5 * 60_000))).toEqual({
      deleted: 0,
      skipped: true,
    });

    const rows = await env.DB.prepare("SELECT alert_key AS alertKey FROM ops_alert").all<{
      alertKey: string;
    }>();
    expect(rows.results).toEqual([{ alertKey: "keep" }]);
    const audit = await env.DB.prepare(
      "SELECT reason, result FROM audit_event WHERE action = 'OPS_ALERT_CLEANUP'",
    ).first<{ reason: string; result: string }>();
    expect(JSON.parse(audit!.reason)).toEqual({
      cutoff: new Date(NOW - 180 * day).toISOString(),
      deleted: 1,
    });
    expect(audit?.result).toBe("SUCCEEDED");
  });
});
