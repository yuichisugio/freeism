import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { reapExpiredPointsLinkAttempts } from "../../src/backend/usecases/reap-expired-points-link-attempts";

describe("expired Points link-attempt reaper", () => {
  it("cancels only expired pending attempts", async () => {
    const now = Date.now();
    const insert = (id: string, status: string, createdAt: number, expiresAt: number) =>
      env
        .DB!.prepare(
          `INSERT INTO points_oauth_link_attempt
           (id, idempotency_key, payload_hash, state_hash, user_client_id, m2m_client_id,
            markets_user_id, requested_scopes, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, 'user-client', 'm2m-client', ?, 'scope', ?, ?, ?)`,
        )
        .bind(
          id,
          `key-${id}`,
          "a".repeat(64),
          `state-${id}`,
          `market-${id}`,
          status,
          createdAt,
          expiresAt,
        );
    await env.DB!.batch([
      insert(
        `attempt-expired-${crypto.randomUUID()}`,
        "PENDING_MARKETS_CONFIRMATION",
        now - 600_000,
        now - 1,
      ),
      insert(
        `attempt-live-${crypto.randomUUID()}`,
        "PENDING_MARKETS_CONFIRMATION",
        now,
        now + 60_000,
      ),
      insert(`attempt-confirmed-${crypto.randomUUID()}`, "CONFIRMED", now - 600_000, now - 1),
    ]);

    await expect(reapExpiredPointsLinkAttempts(env.DB!, new Date(now))).resolves.toBe(1);
    const statuses = await env
      .DB!.prepare(
        `SELECT status, count(*) AS count FROM points_oauth_link_attempt
       WHERE markets_user_id LIKE 'market-attempt-%' GROUP BY status ORDER BY status`,
      )
      .all<{ count: number; status: string }>();
    expect(statuses.results).toEqual([
      { count: 1, status: "CANCELLED" },
      { count: 1, status: "CONFIRMED" },
      { count: 1, status: "PENDING_MARKETS_CONFIRMATION" },
    ]);
  });
});
