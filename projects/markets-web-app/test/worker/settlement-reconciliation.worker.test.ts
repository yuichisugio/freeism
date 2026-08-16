import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  completeSettlementRetryCallback,
  consumeSettlementRetryAuthorization,
  createSettlementRetryAuthorization,
  readSafeSettlementStatus,
} from "../../src/backend/settlement/admin-retry-authorization";
import { reconcileSettlement } from "../../src/backend/settlement/reconcile-settlements";

const db = env.DB;
const now = "2033-05-18T03:33:20.000Z";
const expiresAt = Date.parse(now) + 60_000;
const planHash = `sha256:${"1".repeat(64)}`;
const reasonHash = `sha256:${"2".repeat(64)}` as const;

async function seedSettlement(
  kind: "BUY_NOW" | "END_OF_AUCTION" = "END_OF_AUCTION",
  buyNow?: {
    buyerMarketsUserId: string;
    status: "FAILED_RESTORED" | "PENDING" | "SETTLED";
  },
) {
  const suffix = crypto.randomUUID();
  const authUserId = `auth_${suffix}`;
  const marketsUserId = `market_${suffix}`;
  const auctionId = `auction_${suffix}`;
  const settlementId = `settlement_${suffix}`;
  const planId = `plan_${suffix}`;
  const holdId = buyNow ? `hold_${suffix}` : null;
  const statements = [
    db
      .prepare("INSERT INTO user (id, name, email) VALUES (?, 'Admin', ?)")
      .bind(authUserId, `${suffix}@example.test`),
    db
      .prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)")
      .bind(marketsUserId, authUserId),
    db
      .prepare(
        "INSERT INTO auctions (id, seller_markets_user_id, status, version) VALUES (?, ?, 'CLOSING', 1)",
      )
      .bind(auctionId, marketsUserId),
    db
      .prepare(
        `INSERT INTO settlements
       (id, auction_id, kind, source_key, saga_state, current_plan_id, updated_at)
       VALUES (?, ?, ?, ?, 'MANUAL_ACTION_REQUIRED', ?, ?)`,
      )
      .bind(settlementId, auctionId, kind, `source:${suffix}`, planId, now),
    db
      .prepare(
        `INSERT INTO settlement_plans
       (id, settlement_id, settlement_revision, plan_json, plan_hash, algorithm_version)
       VALUES (?, ?, 1, '{}', ?, 'uniform-price-v1')`,
      )
      .bind(planId, settlementId, planHash),
  ];
  if (buyNow && holdId) {
    statements.splice(
      3,
      0,
      db
        .prepare(
          `INSERT INTO buy_now_holds
           (id, auction_id, buyer_markets_user_id, quantity, buy_now_price_tick_count, status)
           VALUES (?, ?, ?, 1, 1, ?)`,
        )
        .bind(holdId, auctionId, buyNow.buyerMarketsUserId, buyNow.status),
    );
    statements[5] = db
      .prepare(
        `INSERT INTO settlement_plans
         (id, settlement_id, settlement_revision, plan_json, plan_hash, algorithm_version)
         VALUES (?, ?, 1, ?, ?, 'uniform-price-v1')`,
      )
      .bind(planId, settlementId, JSON.stringify({ buyNowHoldId: holdId }), planHash);
  }
  await db.batch(statements);
  return { auctionId, authUserId, holdId, marketsUserId, planId, settlementId };
}

async function seedMarketsUser(label: string) {
  const suffix = crypto.randomUUID();
  const authUserId = `auth_${label}_${suffix}`;
  const marketsUserId = `market_${label}_${suffix}`;
  await db.batch([
    db
      .prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)")
      .bind(authUserId, label, `${suffix}@example.test`),
    db
      .prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)")
      .bind(marketsUserId, authUserId),
  ]);
  return marketsUserId;
}

async function seedRoundWinner(
  settlement: Awaited<ReturnType<typeof seedSettlement>>,
  marketsUserId: string,
  status: "ACTIVE" | "CAPTURED" = "ACTIVE",
) {
  const suffix = crypto.randomUUID();
  const roundId = `round_${suffix}`;
  const reservationKey = `reservation_${suffix}`;
  await db.batch([
    db
      .prepare(
        `INSERT INTO settlement_rounds
         (id, settlement_id, round_ordinal, plan_hash, cutoff_hash, state,
          first_attempt_at, retry_deadline_at)
         VALUES (?, ?, 1, ?, ?, 'RESERVED', ?, ?)`,
      )
      .bind(roundId, settlement.settlementId, planHash, "4".repeat(64), now, now),
    db
      .prepare(
        `INSERT INTO settlement_round_winners
         (id, settlement_round_id, markets_user_id, allocation_quantity,
          price_tick_count, price_ticks, reservation_key, status, point_reservation_id)
         VALUES (?, ?, ?, 1, 1, 1, ?, ?, ?)`,
      )
      .bind(`winner_${suffix}`, roundId, marketsUserId, reservationKey, status, `pres_${suffix}`),
  ]);
  return { reservationKey, roundId };
}

async function authorize(settlement: Awaited<ReturnType<typeof seedSettlement>>, jti: string) {
  const rawState = `state_${crypto.randomUUID()}`;
  const authorization = await createSettlementRetryAuthorization(db, {
    auctionId: settlement.auctionId,
    authUserId: settlement.authUserId,
    callbackUri: "https://markets.example.test/api/settlements/retry-callback",
    expiresAt,
    marketsUserId: settlement.marketsUserId,
    nonce: `nonce_${jti}`,
    pkceVerifier: `verifier_${jti}`,
    rawState,
    reasonHash,
    sessionId: "session_1",
    settlementId: settlement.settlementId,
  });
  const callback = await completeSettlementRetryCallback(db, {
    claims: {
      admin: true,
      auctionId: settlement.auctionId,
      aud: "https://markets.example.test",
      authTime: 2_000_000_000 - 899,
      clientId: "settlement-client",
      exp: 2_000_000_060,
      iat: 2_000_000_000,
      iss: "https://points.example.test/api/auth",
      jti,
      reasonHash,
      scope: "points.admin.settlement.retry",
      settlementId: settlement.settlementId,
      sub: "points-admin-1",
      tokenClass: "SETTLEMENT_ADMIN_STEP_UP",
    },
    marketsUserId: settlement.marketsUserId,
    rawState,
    sessionId: "session_1",
    verifiedAt: Date.parse(now),
  });
  return { authorization, callback };
}

describe("settlement admin retry", () => {
  it("callback stores one pending JTI without starting a workflow, then same-session POST consumes once", async () => {
    const settlement = await seedSettlement();
    const { callback } = await authorize(settlement, `jti_${crypto.randomUUID()}`);

    expect(callback).toMatchObject({ status: "PENDING", workflowStarted: false });
    expect(
      await db
        .prepare("SELECT count(*) AS count FROM settlement_outbox WHERE settlement_id = ?")
        .bind(settlement.settlementId)
        .first<{ count: number }>(),
    ).toEqual({ count: 0 });

    const accepted = await consumeSettlementRetryAuthorization(db, {
      marketsUserId: settlement.marketsUserId,
      now: Date.parse(now),
      sessionId: "session_1",
      settlementId: settlement.settlementId,
    });
    expect(accepted).toMatchObject({ status: "ACCEPTED", workflowAttempt: 1 });
    await expect(
      consumeSettlementRetryAuthorization(db, {
        marketsUserId: settlement.marketsUserId,
        now: Date.parse(now),
        sessionId: "session_1",
        settlementId: settlement.settlementId,
      }),
    ).rejects.toThrow("ADMIN_ASSERTION_REPLAYED");

    const rows = await db
      .prepare(
        "SELECT status, workflow_attempt AS workflowAttempt FROM settlement_outbox WHERE settlement_id = ?",
      )
      .bind(settlement.settlementId)
      .all<{ status: string; workflowAttempt: number }>();
    expect(rows.results).toEqual([{ status: "PENDING", workflowAttempt: 1 }]);
  });

  it("rejects a pending assertion from another session or changed target", async () => {
    const settlement = await seedSettlement();
    await authorize(settlement, `jti_${crypto.randomUUID()}`);
    await expect(
      consumeSettlementRetryAuthorization(db, {
        marketsUserId: settlement.marketsUserId,
        now: Date.parse(now),
        sessionId: "session_2",
        settlementId: settlement.settlementId,
      }),
    ).rejects.toThrow("ADMIN_ASSERTION_SESSION_MISMATCH");
    await db
      .prepare("UPDATE settlement_retry_authorizations SET reason_hash = ? WHERE settlement_id = ?")
      .bind(`sha256:${"3".repeat(64)}`, settlement.settlementId)
      .run();
    await expect(
      consumeSettlementRetryAuthorization(db, {
        marketsUserId: settlement.marketsUserId,
        now: Date.parse(now),
        sessionId: "session_1",
        settlementId: settlement.settlementId,
      }),
    ).rejects.toThrow("ADMIN_ASSERTION_TARGET_CHANGED");
  });

  it("returns safe status to the seller and related buyer without disclosing existence", async () => {
    const buyerMarketsUserId = await seedMarketsUser("Buyer");
    const settlement = await seedSettlement("BUY_NOW", {
      buyerMarketsUserId,
      status: "PENDING",
    });
    const strangerMarketsUserId = await seedMarketsUser("Stranger");
    const result = await readSafeSettlementStatus(db, {
      marketsUserId: settlement.marketsUserId,
      settlementId: settlement.settlementId,
    });
    expect(result).toEqual({
      kind: "BUY_NOW",
      manualActionAllowed: true,
      progress: "Manual action required",
      settlementId: settlement.settlementId,
      state: "ACTION_REQUIRED",
      updatedAt: now,
    });
    expect(JSON.stringify(result)).not.toMatch(/reservation|balance|criteria|token|failure/i);
    await expect(
      readSafeSettlementStatus(db, {
        marketsUserId: buyerMarketsUserId,
        settlementId: settlement.settlementId,
      }),
    ).resolves.toEqual(result);
    await expect(
      readSafeSettlementStatus(db, {
        marketsUserId: strangerMarketsUserId,
        settlementId: settlement.settlementId,
      }),
    ).rejects.toThrow("SETTLEMENT_NOT_FOUND");

    const endSettlement = await seedSettlement();
    await seedRoundWinner(endSettlement, buyerMarketsUserId);
    await expect(
      readSafeSettlementStatus(db, {
        marketsUserId: buyerMarketsUserId,
        settlementId: endSettlement.settlementId,
      }),
    ).resolves.toMatchObject({ settlementId: endSettlement.settlementId });
  });
});

describe("settlement reconciliation", () => {
  it("moves a captured settlement forward to finalize without release or refund", async () => {
    const settlement = await seedSettlement();
    await db
      .prepare("UPDATE settlements SET saga_state = 'CAPTURED' WHERE id = ?")
      .bind(settlement.settlementId)
      .run();
    const finalize = vi.fn(async () => ({ kind: "SETTLED" as const }));
    const release = vi.fn();

    const result = await reconcileSettlement(
      {
        db,
        finalizeCaptured: finalize,
        getStatuses: vi.fn(),
        hasCaptureReceipt: vi.fn(async () => true),
        now: () => new Date(now),
        releaseBeforeCapture: release,
      },
      settlement.settlementId,
    );

    expect(result).toEqual({ action: "FORWARD_FINALIZE", settlementId: settlement.settlementId });
    expect(finalize).toHaveBeenCalledOnce();
    expect(release).not.toHaveBeenCalled();
  });

  it("keeps unresolved BUY_NOW in manual action and rejects opposite terminal outcomes", async () => {
    const settlement = await seedSettlement("BUY_NOW");
    const result = await reconcileSettlement(
      {
        db,
        finalizeCaptured: vi.fn(),
        getStatuses: vi.fn(async () => [{ reservationKey: "key_1", status: "ACTIVE" as const }]),
        hasCaptureReceipt: vi.fn(async () => false),
        now: () => new Date(now),
        releaseBeforeCapture: vi.fn(),
      },
      settlement.settlementId,
    );
    expect(result).toEqual({
      action: "MANUAL_ACTION_REQUIRED",
      settlementId: settlement.settlementId,
    });

    await db
      .prepare("UPDATE settlements SET saga_state = 'SETTLED' WHERE id = ?")
      .bind(settlement.settlementId)
      .run();
    await expect(
      reconcileSettlement(
        {
          db,
          finalizeCaptured: vi.fn(),
          getStatuses: vi.fn(),
          hasCaptureReceipt: vi.fn(async () => false),
          now: () => new Date(now),
          releaseBeforeCapture: vi.fn(),
        },
        settlement.settlementId,
      ),
    ).resolves.toEqual({
      action: "ALREADY_TERMINAL",
      settlementId: settlement.settlementId,
    });
  });

  it("never forward-finalizes a restored or settled BUY_NOW hold", async () => {
    for (const holdStatus of ["FAILED_RESTORED", "SETTLED"] as const) {
      const buyerMarketsUserId = await seedMarketsUser(`Buyer ${holdStatus}`);
      const settlement = await seedSettlement("BUY_NOW", {
        buyerMarketsUserId,
        status: holdStatus,
      });
      const winner = await seedRoundWinner(settlement, buyerMarketsUserId, "CAPTURED");
      const finalize = vi.fn();
      let terminalNow = "2033-05-18T03:34:20.000Z";
      const dependencies = {
        db,
        finalizeCaptured: finalize,
        getStatuses: vi.fn(async () => [
          { reservationKey: winner.reservationKey, status: "CAPTURED" as const },
        ]),
        hasCaptureReceipt: vi.fn(async () => true),
        now: () => new Date(terminalNow),
        releaseBeforeCapture: vi.fn(),
      };

      await expect(reconcileSettlement(dependencies, settlement.settlementId)).resolves.toEqual({
        action: "ALREADY_TERMINAL",
        settlementId: settlement.settlementId,
      });
      expect(finalize).not.toHaveBeenCalled();
      expect(
        await db
          .prepare(
            "SELECT saga_state AS sagaState, updated_at AS updatedAt FROM settlements WHERE id = ?",
          )
          .bind(settlement.settlementId)
          .first(),
      ).toEqual({ sagaState: "SETTLED", updatedAt: terminalNow });
      terminalNow = "2033-05-18T03:35:20.000Z";
      await reconcileSettlement(dependencies, settlement.settlementId);
      expect(
        await db
          .prepare("SELECT updated_at FROM settlements WHERE id = ?")
          .bind(settlement.settlementId)
          .first<string>("updated_at"),
      ).toBe("2033-05-18T03:34:20.000Z");
    }
  });

  it("keeps a remotely captured settlement manual when its local capture receipt is absent", async () => {
    const settlement = await seedSettlement();
    const buyerMarketsUserId = await seedMarketsUser("Captured buyer");
    const winner = await seedRoundWinner(settlement, buyerMarketsUserId, "CAPTURED");
    const finalize = vi.fn();

    await expect(
      reconcileSettlement(
        {
          db,
          finalizeCaptured: finalize,
          getStatuses: vi.fn(async () => [
            { reservationKey: winner.reservationKey, status: "CAPTURED" as const },
          ]),
          hasCaptureReceipt: vi.fn(async () => false),
          now: () => new Date(now),
          releaseBeforeCapture: vi.fn(),
        },
        settlement.settlementId,
      ),
    ).resolves.toEqual({
      action: "MANUAL_ACTION_REQUIRED",
      settlementId: settlement.settlementId,
    });
    expect(finalize).not.toHaveBeenCalled();
    expect(
      await db
        .prepare("SELECT saga_state FROM settlements WHERE id = ?")
        .bind(settlement.settlementId)
        .first<string>("saga_state"),
    ).toBe("MANUAL_ACTION_REQUIRED");
  });

  it("rechecks pre-capture release and converges to manual action without releasing again", async () => {
    for (const kind of ["END_OF_AUCTION", "BUY_NOW"] as const) {
      const buyerMarketsUserId = await seedMarketsUser(`Active ${kind}`);
      const settlement = await seedSettlement(
        kind,
        kind === "BUY_NOW" ? { buyerMarketsUserId, status: "PENDING" } : undefined,
      );
      const winner = await seedRoundWinner(settlement, buyerMarketsUserId);
      await db
        .prepare("UPDATE settlements SET saga_state = 'RESERVED' WHERE id = ?")
        .bind(settlement.settlementId)
        .run();
      const getStatuses = vi
        .fn()
        .mockResolvedValueOnce([{ reservationKey: winner.reservationKey, status: "ACTIVE" }])
        .mockResolvedValueOnce([{ reservationKey: winner.reservationKey, status: "RELEASED" }])
        .mockResolvedValue([{ reservationKey: winner.reservationKey, status: "RELEASED" }]);
      const release = vi.fn(async () => undefined);
      const dependencies = {
        db,
        finalizeCaptured: vi.fn(),
        getStatuses,
        hasCaptureReceipt: vi.fn(async () => false),
        now: () => new Date(now),
        releaseBeforeCapture: release,
      };

      await expect(reconcileSettlement(dependencies, settlement.settlementId)).resolves.toEqual({
        action: "MANUAL_ACTION_REQUIRED",
        settlementId: settlement.settlementId,
      });
      await expect(reconcileSettlement(dependencies, settlement.settlementId)).resolves.toEqual({
        action: "MANUAL_ACTION_REQUIRED",
        settlementId: settlement.settlementId,
      });
      expect(release).toHaveBeenCalledOnce();
      expect(
        await db
          .prepare("SELECT saga_state FROM settlements WHERE id = ?")
          .bind(settlement.settlementId)
          .first<string>("saga_state"),
      ).toBe("MANUAL_ACTION_REQUIRED");
    }
  });
});
