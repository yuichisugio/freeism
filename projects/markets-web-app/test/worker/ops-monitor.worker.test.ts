import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { cleanupResolvedOpsAlerts } from "../../src/backend/observability/cleanup-ops-alerts";
import { deliverOpsAlert } from "../../src/backend/observability/deliver-ops-alert";
import {
  inspectMarketsOpsAlerts,
  monitorMarketsOpsAlerts,
} from "../../src/backend/observability/ops-monitor";
import { OpsAlertRepository } from "../../src/backend/observability/ops-alert-repository";
import { runMarketsCronJobs } from "../../src/server";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
    }
  }
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM ops_alerts").run();
  await env.DB.prepare("DELETE FROM ops_alert_cleanup_leases").run();
});

describe("Markets ops alert repository", () => {
  it("increments repeat_count when the same open alert is observed again", async () => {
    const repository = new OpsAlertRepository(env.DB);
    const input = {
      dedupeKey: "settlement-outbox-stuck:resource-hash",
      safeDetailCode: "PENDING_OVER_5_MINUTES",
      severity: "WARNING" as const,
      signal: "SETTLEMENT_OUTBOX_STUCK",
    };

    await repository.observe({ ...input, seenAt: "2026-07-14T00:00:00.000Z" });
    await repository.observe({ ...input, seenAt: "2026-07-14T00:05:00.000Z" });

    const alert = await env.DB.prepare(
      "SELECT repeat_count AS repeatCount FROM ops_alerts WHERE dedupe_key = ?",
    )
      .bind(input.dedupeKey)
      .first<{ repeatCount: number }>();

    expect(alert?.repeatCount).toBe(2);
  });

  it("starts a new observation window when a resolved alert reopens", async () => {
    const repository = new OpsAlertRepository(env.DB);
    const dedupeKey = `settlement-outbox-stuck:${crypto.randomUUID()}`;
    await repository.observe({
      dedupeKey,
      safeDetailCode: "PENDING_OVER_5_MINUTES",
      severity: "WARNING",
      signal: "SETTLEMENT_OUTBOX_STUCK",
      seenAt: "2026-07-14T00:00:00.000Z",
    });
    await repository.resolve(dedupeKey, "2026-07-14T00:05:00.000Z");

    await repository.observe({
      dedupeKey,
      safeDetailCode: "PENDING_OVER_5_MINUTES",
      severity: "WARNING",
      signal: "SETTLEMENT_OUTBOX_STUCK",
      seenAt: "2026-07-14T00:10:00.000Z",
    });

    const alert = await env.DB.prepare(
      `SELECT first_seen_at AS firstSeenAt, repeat_count AS repeatCount
       FROM ops_alerts WHERE dedupe_key = ?`,
    )
      .bind(dedupeKey)
      .first<{ firstSeenAt: string; repeatCount: number }>();
    expect(alert).toEqual({
      firstSeenAt: "2026-07-14T00:10:00.000Z",
      repeatCount: 1,
    });
  });
});

describe("Markets ops monitor", () => {
  it("observes a settlement outbox that has remained pending for five minutes", async () => {
    const now = new Date("2026-07-14T00:10:00.000Z");
    const suffix = crypto.randomUUID();
    const authUserId = `auth_${suffix}`;
    const marketsUserId = `markets_${suffix}`;
    const auctionId = `auction_${suffix}`;
    const settlementId = `settlement_${suffix}`;
    const outboxId = `outbox_${suffix}`;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Seller', ?)").bind(
        authUserId,
        `${suffix}@example.test`,
      ),
      env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
        marketsUserId,
        authUserId,
      ),
      env.DB.prepare(
        "INSERT INTO auctions (id, seller_markets_user_id, status, version) VALUES (?, ?, 'CLOSING', 1)",
      ).bind(auctionId, marketsUserId),
      env.DB.prepare(
        `INSERT INTO settlements
           (id, auction_id, kind, source_key, saga_state, current_plan_id, updated_at)
         VALUES (?, ?, 'END_OF_AUCTION', ?, 'PLANNED', ?, ?)`,
      ).bind(settlementId, auctionId, `source:${suffix}`, `plan_${suffix}`, now.toISOString()),
      env.DB.prepare(
        `INSERT INTO settlement_outbox
           (id, settlement_id, settlement_revision, workflow_attempt, plan_hash, status, created_at)
         VALUES (?, ?, 1, 0, ?, 'PENDING', ?)`,
      ).bind(
        outboxId,
        settlementId,
        "a".repeat(64),
        new Date(now.getTime() - 5 * 60_000).toISOString(),
      ),
    ]);

    const observations = await inspectMarketsOpsAlerts(env.DB, now.getTime(), "test-salt");

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      safeDetailCode: "PENDING_OVER_5_MINUTES",
      severity: "WARNING",
      signal: "SETTLEMENT_OUTBOX_STUCK",
    });
    expect(observations[0]?.dedupeKey).not.toContain(outboxId);
  });

  it("retries failed delivery and does not recursively email its failure alert", async () => {
    const suffix = crypto.randomUUID();
    const observation = {
      dedupeKey: `settlement-outbox-stuck:${suffix}`,
      resourceIdHash: "b".repeat(64),
      safeDetailCode: "PENDING_OVER_5_MINUTES" as const,
      severity: "WARNING" as const,
      signal: "SETTLEMENT_OUTBOX_STUCK" as const,
    };
    const notify = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("email unavailable"))
      .mockResolvedValue(undefined);

    await monitorMarketsOpsAlerts(env.DB, {
      inspect: async () => [observation],
      notify,
      now: Date.parse("2026-07-14T00:00:00.000Z"),
    });
    await monitorMarketsOpsAlerts(env.DB, {
      inspect: async () => [observation],
      notify,
      now: Date.parse("2026-07-14T00:05:00.000Z"),
    });

    expect(notify).toHaveBeenCalledTimes(2);
    const alert = await env.DB.prepare(
      `SELECT delivery_attempt_count AS deliveryAttemptCount
       FROM ops_alerts WHERE dedupe_key = ?`,
    )
      .bind(observation.dedupeKey)
      .first<{ deliveryAttemptCount: number }>();
    expect(alert?.deliveryAttemptCount).toBe(2);
    const failure = await env.DB.prepare(
      "SELECT status FROM ops_alerts WHERE signal = 'ALERT_DELIVERY_FAILED'",
    ).first<{ status: string }>();
    expect(failure?.status).toBe("RESOLVED");
  });
});

describe("Markets ops alert delivery", () => {
  it("uses only the configured destination and safe alert fields", async () => {
    const send = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await deliverOpsAlert(
      { send } as unknown as SendEmail,
      {
        dedupeKey: "settlement-outbox-stuck:hash",
        deliveryAttemptCount: 0,
        firstSeenAt: "2026-07-14T00:00:00.000Z",
        lastSeenAt: "2026-07-14T00:00:00.000Z",
        repeatCount: 1,
        resolvedAt: null,
        safeDetailCode: "PENDING_OVER_5_MINUTES",
        severity: "WARNING",
        signal: "SETTLEMENT_OUTBOX_STUCK",
        status: "OPEN",
      },
      { from: "alerts@freeism.app", to: "ops@freeism.app" },
    );

    expect(send).toHaveBeenCalledWith({
      from: "alerts@freeism.app",
      subject: "[Markets] OPEN: SETTLEMENT_OUTBOX_STUCK",
      text: JSON.stringify({
        alertKey: "settlement-outbox-stuck:hash",
        safeDetailCode: "PENDING_OVER_5_MINUTES",
        severity: "WARNING",
        status: "OPEN",
      }),
      to: "ops@freeism.app",
    });
  });
});

describe("Markets scheduled job isolation", () => {
  it("runs monitor and cleanup even when settlement maintenance fails", async () => {
    const settlement = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("settlement"));
    const monitor = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const cleanup = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const results = await runMarketsCronJobs([settlement, monitor, cleanup]);

    expect(settlement).toHaveBeenCalledOnce();
    expect(monitor).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(results.map(({ status }) => status)).toEqual(["rejected", "fulfilled", "fulfilled"]);
  });
});

describe("Markets resolved ops alert cleanup", () => {
  it("keeps open and 179d23:59:59 alerts, deletes exactly 180d, and leases once per day", async () => {
    const now = new Date("2026-07-14T00:00:00.000Z");
    const retentionMs = 180 * 24 * 60 * 60_000;
    const insert = env.DB.prepare(
      `INSERT INTO ops_alerts
         (dedupe_key, signal, severity, first_seen_at, last_seen_at, resolved_at,
          status, delivery_attempt_count, repeat_count, safe_detail_code)
       VALUES (?, 'TEST_ALERT', 'WARNING', ?, ?, ?, ?, 0, 1, 'TEST')`,
    );
    await env.DB.batch([
      insert.bind(
        "open-old",
        new Date(now.getTime() - retentionMs).toISOString(),
        new Date(now.getTime() - retentionMs).toISOString(),
        null,
        "OPEN",
      ),
      insert.bind(
        "resolved-keep",
        new Date(now.getTime() - retentionMs + 1_000).toISOString(),
        new Date(now.getTime() - retentionMs + 1_000).toISOString(),
        new Date(now.getTime() - retentionMs + 1_000).toISOString(),
        "RESOLVED",
      ),
      insert.bind(
        "resolved-delete",
        new Date(now.getTime() - retentionMs).toISOString(),
        new Date(now.getTime() - retentionMs).toISOString(),
        new Date(now.getTime() - retentionMs).toISOString(),
        "RESOLVED",
      ),
    ]);

    const results = await Promise.all([
      cleanupResolvedOpsAlerts(env.DB, now, "test"),
      cleanupResolvedOpsAlerts(env.DB, now, "test"),
    ]);

    expect(results).toEqual(
      expect.arrayContaining([
        { deleted: 1, skipped: false },
        { deleted: 0, skipped: true },
      ]),
    );
    const remaining = await env.DB.prepare(
      "SELECT dedupe_key AS dedupeKey FROM ops_alerts ORDER BY dedupe_key",
    ).all<{ dedupeKey: string }>();
    expect(remaining.results).toEqual([{ dedupeKey: "open-old" }, { dedupeKey: "resolved-keep" }]);
    const audit = await env.DB.prepare(
      `SELECT after_json AS afterJson, result FROM audit_events
       WHERE event_code = 'OPS_ALERT_CLEANUP' ORDER BY created_at DESC LIMIT 1`,
    ).first<{ afterJson: string; result: string }>();
    expect(JSON.parse(audit!.afterJson)).toEqual({
      cutoff: new Date(now.getTime() - retentionMs).toISOString(),
      deleted: 1,
    });
    expect(audit?.result).toBe("SUCCEEDED");
  });
});
