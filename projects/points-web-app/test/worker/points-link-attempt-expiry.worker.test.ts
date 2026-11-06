import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { sha256Hex } from "../../src/backend/csv/csv-validation-result";
import { bindPointsLinkAttemptFromOAuthState } from "../../src/backend/usecases/bind-points-link-attempt-from-oauth-state";
import { createPointsLinkAttempt } from "../../src/backend/usecases/create-points-link-attempt";

const db = env.DB!;
const startedAt = new Date("2026-07-13T00:00:00.000Z");
const expiresAt = new Date(startedAt.getTime() + 600_000);
const userClientId = "expiry-markets-client";
const pointsUserId = "pusr_link_expiry";

async function createAttempt(
  suffix: string,
  marketsUserId: string,
  now = startedAt,
  boundPointsUserId?: string,
) {
  return createPointsLinkAttempt(db, {
    expiresAt: new Date(now.getTime() + 600_000),
    idempotencyKey: `expiry-create-${suffix}`,
    marketsUserId,
    m2mClientId: userClientId,
    now,
    payloadHash: `sha256:${await sha256Hex(suffix)}`,
    pointsUserId: boundPointsUserId,
    requestedScopes: ["points.connection.read"],
    stateHash: `sha256:${await sha256Hex(`state-${suffix}`)}`,
    userClientId,
  });
}

describe("Points link attempts without periodic expiry processing", () => {
  beforeEach(async () => {
    await db.exec(
      "DELETE FROM points_oauth_revocation_outbox; DELETE FROM points_oauth_connection_deactivation; DELETE FROM points_oauth_connection; DELETE FROM points_oauth_link_attempt;",
    );
    await db
      .prepare(
        `INSERT OR IGNORE INTO user
           (id, name, email, email_verified, created_at, updated_at)
         VALUES ('auth_link_expiry', 'Link expiry', 'link-expiry@example.invalid', 1, ?, ?)`,
      )
      .bind(startedAt.getTime(), startedAt.getTime())
      .run();
    await db
      .prepare(
        `INSERT OR IGNORE INTO points_user (id, auth_user_id, account_status, created_at)
         VALUES (?, 'auth_link_expiry', 'ACTIVE', ?)`,
      )
      .bind(pointsUserId, startedAt.getTime())
      .run();
  });

  it("allows a fresh attempt after an abandoned attempt expires", async () => {
    const abandoned = await createAttempt("abandoned", "musr_retry");
    const unrelated = await createAttempt("unrelated", "musr_other");
    const replacement = await createAttempt("replacement", "musr_retry", expiresAt);

    expect(replacement.status).toBe("PENDING_MARKETS_CONFIRMATION");
    expect(
      await db
        .prepare(
          "SELECT status, finalized_at AS finalizedAt FROM points_oauth_link_attempt WHERE id = ?",
        )
        .bind(abandoned.linkAttemptId)
        .first(),
    ).toEqual({ status: "CANCELLED", finalizedAt: expiresAt.getTime() });
    expect(
      await db
        .prepare("SELECT status FROM points_oauth_link_attempt WHERE id = ?")
        .bind(unrelated.linkAttemptId)
        .first(),
    ).toEqual({ status: "PENDING_MARKETS_CONFIRMATION" });
  });

  it("binds the new OAuth request after the user's earlier bound attempt expires", async () => {
    const abandoned = await createAttempt("bound-abandoned", "musr_old", startedAt, pointsUserId);
    const fresh = await createAttempt("bound-fresh", "musr_new", expiresAt);

    await expect(
      bindPointsLinkAttemptFromOAuthState(db, {
        authUserId: "auth_link_expiry",
        now: expiresAt,
        rawState: "state-bound-fresh",
        userClientId,
      }),
    ).resolves.toBe(fresh.linkAttemptId);
    expect(
      await db
        .prepare("SELECT status FROM points_oauth_link_attempt WHERE id = ?")
        .bind(abandoned.linkAttemptId)
        .first(),
    ).toEqual({ status: "CANCELLED" });

    const concurrent = await createAttempt("bound-concurrent", "musr_concurrent", expiresAt);
    await expect(
      bindPointsLinkAttemptFromOAuthState(db, {
        authUserId: "auth_link_expiry",
        now: expiresAt,
        rawState: "state-bound-concurrent",
        userClientId,
      }),
    ).rejects.toThrow("POINTS_CONNECTION_ALREADY_PENDING");
    expect(
      await db
        .prepare(
          "SELECT status, points_user_id AS pointsUserId FROM points_oauth_link_attempt WHERE id = ?",
        )
        .bind(concurrent.linkAttemptId)
        .first(),
    ).toEqual({ status: "PENDING_MARKETS_CONFIRMATION", pointsUserId: null });
  });

  it("allows a bound replacement while retaining an unexpired pending attempt", async () => {
    const abandoned = await createAttempt("create-bound-old", "musr_old", startedAt, pointsUserId);
    const replacement = await createAttempt(
      "create-bound-new",
      "musr_new",
      expiresAt,
      pointsUserId,
    );
    expect(replacement.status).toBe("PENDING_MARKETS_CONFIRMATION");
    expect(
      await db
        .prepare("SELECT status FROM points_oauth_link_attempt WHERE id = ?")
        .bind(abandoned.linkAttemptId)
        .first(),
    ).toEqual({ status: "CANCELLED" });

    await expect(
      createAttempt("create-bound-concurrent", "musr_other", expiresAt, pointsUserId),
    ).rejects.toThrow("UNIQUE constraint failed");
    expect(
      await db
        .prepare("SELECT status FROM points_oauth_link_attempt WHERE id = ?")
        .bind(replacement.linkAttemptId)
        .first(),
    ).toEqual({ status: "PENDING_MARKETS_CONFIRMATION" });
  });
});
