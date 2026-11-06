import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  consumePointsRateLimit,
  pointsRateLimitPolicies,
} from "../../src/backend/security/rate-limit";

const NOW = Date.parse("2026-07-13T04:00:00.000Z");

beforeEach(async () => {
  await env.DB!.batch([
    env.DB!.prepare(`CREATE TABLE IF NOT EXISTS app_rate_limit_window (
      operation TEXT NOT NULL,
      subject_key_hash TEXT NOT NULL,
      window_started_at INTEGER NOT NULL,
      window_seconds INTEGER NOT NULL,
      request_count INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (operation, subject_key_hash, window_started_at)
    )`),
    env.DB!.prepare("DELETE FROM app_rate_limit_window"),
  ]);
});

describe("Points application rate limits", () => {
  it("atomically rejects the eleventh hourly CSV commit for the same criterion key", async () => {
    const input = {
      db: env.DB!,
      now: NOW,
      operation: "CSV_CRITERION_HOURLY" as const,
      subjectParts: ["pusr_1", "criterion_a"],
    };

    for (let count = 1; count <= pointsRateLimitPolicies.CSV_CRITERION_HOURLY.limit; count++) {
      const result = await consumePointsRateLimit(input);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(pointsRateLimitPolicies.CSV_CRITERION_HOURLY.limit - count);
    }

    const rejected = await consumePointsRateLimit(input);
    expect(rejected).toMatchObject({
      allowed: false,
      limit: 10,
      remaining: 0,
      retryAfterSeconds: 3_600,
    });
  });

  it("isolates counters by operation and normalized subject key", async () => {
    const first = await consumePointsRateLimit({
      db: env.DB!,
      now: NOW,
      operation: "CSV_CRITERION_MINUTE",
      subjectParts: ["pusr_admin", "criterion_a"],
    });
    const otherCriterion = await consumePointsRateLimit({
      db: env.DB!,
      now: NOW,
      operation: "CSV_CRITERION_MINUTE",
      subjectParts: ["pusr_admin", "criterion_b"],
    });
    const otherWindow = await consumePointsRateLimit({
      db: env.DB!,
      now: NOW,
      operation: "CSV_CRITERION_HOURLY",
      subjectParts: ["pusr_admin", "criterion_a"],
    });

    expect(first.remaining).toBe(1);
    expect(otherCriterion.remaining).toBe(1);
    expect(otherWindow.remaining).toBe(9);

    const stored = await env
      .DB!.prepare(
        "SELECT subject_key_hash FROM app_rate_limit_window ORDER BY operation, subject_key_hash",
      )
      .all<{ subject_key_hash: string }>();
    expect(stored.results).toHaveLength(3);
    expect(stored.results.every((row) => /^[a-f0-9]{64}$/.test(row.subject_key_hash))).toBe(true);
    expect(JSON.stringify(stored.results)).not.toContain("pusr_admin");
    expect(JSON.stringify(stored.results)).not.toContain("criterion_a");
  });
});
