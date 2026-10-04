import { describe, expect, it, vi } from "vite-plus/test";

import { createAccountsFailureReporter } from "../../src/backend/accounts/accounts-failure-reporter";
import {
  createStructuredLog,
  type StructuredLogInput,
} from "../../src/backend/observability/structured-logger";
import { emitOpsMetric } from "../../src/backend/observability/ops-metrics";
describe("structured Workers observability", () => {
  it("omits Accounts connection IDs from logs and metric indexes", async () => {
    const logs: unknown[] = [];
    const points: AnalyticsEngineDataPoint[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((entry) => logs.push(entry));
    try {
      const reportFailure = createAccountsFailureReporter({
        APP_ENV: "staging",
        OPS_METRICS: {
          writeDataPoint: (point) => {
            if (point) points.push(point);
          },
        },
      });
      const failure = {
        code: "NETWORK_ERROR",
        connectionId: "acon_secret_internal_id",
        operation: "accounts_resolve" as const,
      };
      await reportFailure(failure);
      expect(logs).toEqual([
        expect.objectContaining({ event: "accounts_request", code: "NETWORK_ERROR" }),
      ]);
      expect(JSON.stringify(logs)).not.toContain(failure.connectionId);
      expect(points[0]?.indexes).toEqual(["accounts_request"]);
      expect(JSON.stringify(points)).not.toContain(failure.connectionId);
    } finally {
      log.mockRestore();
    }
  });

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
      resourceId: "private-resource-id",
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
      resourceType: "fix-import",
    });
    expect(encoded).not.toContain("secret-token");
    expect(encoded).not.toContain("secret-cookie");
    expect(encoded).not.toContain("person@example.com");
    expect(encoded).not.toContain("private.example");
    expect(encoded).not.toContain("private cell");
    expect(encoded).not.toContain("private-resource-id");
  });

  it("writes one allowlisted Analytics Engine point and absorbs metric failures", async () => {
    const points: AnalyticsEngineDataPoint[] = [];
    const dataset: AnalyticsEngineDataset = {
      writeDataPoint(point) {
        if (point) points.push(point);
      },
    };

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
        resourceState: "OPEN",
      }),
    ).toBe(true);
    expect(points).toEqual([
      {
        blobs: ["ops.alert.observed", "points", "staging", "open", "DUE_OVER_15_MINUTES", "OPEN"],
        doubles: [1, 25, 901, 2],
        indexes: ["ops.alert.observed"],
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
        resourceState: "OPEN",
      }),
    ).toBe(false);
  });
});
