import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  consumePointsRateLimit,
  pointsRateLimitPolicies,
} from "../../src/backend/security/rate-limit";
import {
  enforceAdaptiveTurnstile,
  pointsTurnstileActions,
} from "../../src/backend/security/turnstile";

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
    env.DB!.prepare(`CREATE TABLE IF NOT EXISTS turnstile_token_replay (
      token_hash TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL,
      hostname TEXT NOT NULL,
      action TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER NOT NULL
    )`),
    env.DB!.prepare("DELETE FROM app_rate_limit_window"),
    env.DB!.prepare("DELETE FROM turnstile_token_replay"),
  ]);
});

describe("Points application rate limits", () => {
  it("atomically rejects the sixth hourly ownership verification for the same URL key", async () => {
    const input = {
      db: env.DB!,
      now: NOW,
      operation: "OWNERSHIP_IDENTITY_HOURLY" as const,
      subjectParts: ["pusr_1", "https://example.test/alice"],
    };

    for (let count = 1; count <= pointsRateLimitPolicies.OWNERSHIP_IDENTITY_HOURLY.limit; count++) {
      const result = await consumePointsRateLimit(input);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(
        pointsRateLimitPolicies.OWNERSHIP_IDENTITY_HOURLY.limit - count,
      );
    }

    const rejected = await consumePointsRateLimit(input);
    expect(rejected).toMatchObject({
      allowed: false,
      limit: 5,
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

describe("adaptive Points Turnstile", () => {
  it("does not require or call Turnstile for an ordinary request", async () => {
    const siteverifyFetch = vi.fn<typeof fetch>();
    const result = await enforceAdaptiveTurnstile(
      {
        db: env.DB!,
        expectedHostname: "points.freeism.app",
        now: NOW,
        operation: "OWNERSHIP_VERIFY",
        riskDetected: false,
        secret: "test-secret",
        siteKey: "test-site-key",
      },
      siteverifyFetch,
    );

    expect(result).toEqual({ status: "NOT_REQUIRED" });
    expect(siteverifyFetch).not.toHaveBeenCalled();
  });

  it("returns a fixed action and site key only when risk is detected without a token", async () => {
    const result = await enforceAdaptiveTurnstile({
      db: env.DB!,
      expectedHostname: "points.freeism.app",
      now: NOW,
      operation: "OWNERSHIP_VERIFY",
      riskDetected: true,
      secret: "test-secret",
      siteKey: "test-site-key",
    });

    expect(result).toEqual({
      action: pointsTurnstileActions.OWNERSHIP_VERIFY,
      siteKey: "test-site-key",
      status: "REQUIRED",
    });
  });

  it("validates a risk token server-side and stores only its hash", async () => {
    const token = "valid-turnstile-token";
    const siteverifyFetch = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);
      const body = init?.body as FormData;
      expect(body.get("secret")).toBe("test-secret");
      expect(body.get("response")).toBe(token);
      expect(body.get("remoteip")).toBe("203.0.113.1");
      return Response.json({
        action: pointsTurnstileActions.OWNERSHIP_VERIFY,
        challenge_ts: new Date(NOW - 60_000).toISOString(),
        hostname: "points.freeism.app",
        success: true,
      });
    });

    const result = await enforceAdaptiveTurnstile(
      {
        db: env.DB!,
        expectedHostname: "points.freeism.app",
        now: NOW,
        operation: "OWNERSHIP_VERIFY",
        remoteIp: "203.0.113.1",
        riskDetected: true,
        secret: "test-secret",
        siteKey: "test-site-key",
        token,
      },
      siteverifyFetch,
    );

    expect(result).toEqual({ status: "VERIFIED" });
    const replay = await env
      .DB!.prepare("SELECT token_hash, action, hostname FROM turnstile_token_replay")
      .first<{ action: string; hostname: string; token_hash: string }>();
    expect(replay).toMatchObject({
      action: pointsTurnstileActions.OWNERSHIP_VERIFY,
      hostname: "points.freeism.app",
    });
    expect(replay?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(replay?.token_hash).not.toBe(token);
  });

  it.each([
    ["TURNSTILE_HOSTNAME_MISMATCH", "other.example", pointsTurnstileActions.OWNERSHIP_VERIFY, NOW],
    ["TURNSTILE_ACTION_MISMATCH", "points.freeism.app", "wrong_action", NOW],
    [
      "TURNSTILE_TOKEN_EXPIRED",
      "points.freeism.app",
      pointsTurnstileActions.OWNERSHIP_VERIFY,
      NOW - 300_000,
    ],
  ] as const)(
    "rejects invalid Siteverify evidence with %s",
    async (code, hostname, action, issuedAt) => {
      const result = await enforceAdaptiveTurnstile(
        {
          db: env.DB!,
          expectedHostname: "points.freeism.app",
          now: NOW,
          operation: "OWNERSHIP_VERIFY",
          riskDetected: true,
          secret: "test-secret",
          siteKey: "test-site-key",
          token: `token-${code}`,
        },
        async () =>
          Response.json({
            action,
            challenge_ts: new Date(issuedAt).toISOString(),
            hostname,
            success: true,
          }),
      );

      expect(result).toEqual({ code, status: "REJECTED" });
    },
  );

  it("rejects a second use of the same verified token", async () => {
    const input = {
      db: env.DB!,
      expectedHostname: "points.freeism.app",
      now: NOW,
      operation: "CSV" as const,
      riskDetected: true,
      secret: "test-secret",
      siteKey: "test-site-key",
      token: "single-use-token",
    };
    const siteverifyFetch: typeof fetch = async () =>
      Response.json({
        action: pointsTurnstileActions.CSV,
        challenge_ts: new Date(NOW).toISOString(),
        hostname: "points.freeism.app",
        success: true,
      });

    await expect(enforceAdaptiveTurnstile(input, siteverifyFetch)).resolves.toEqual({
      status: "VERIFIED",
    });
    await expect(enforceAdaptiveTurnstile(input, siteverifyFetch)).resolves.toEqual({
      code: "TURNSTILE_TOKEN_REPLAYED",
      status: "REJECTED",
    });
  });
});
