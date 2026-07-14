import { env, introspectWorkflowInstance } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  closeAuctionAndPlan,
  resumeAuctionCloseFromCutoff,
} from "../../src/backend/db/d1-settlement-plan-repository";
import { createSettlementPlan } from "../../src/backend/settlement/create-settlement-plan";
import {
  dispatchSettlementOutbox,
  settlementWorkflowInstanceId,
} from "../../src/backend/settlement/outbox-dispatcher";
import {
  SETTLEMENT_HTTP_POLICIES,
  SETTLEMENT_STEP_POLICIES,
} from "../../src/backend/settlement/settlement-step-policies";

interface SeededDueAuction {
  auctionId: string;
  earlyBidId: string;
  lateBidId: string;
  revisionId: string;
  serverNow: string;
}

async function seedDueAuction(): Promise<SeededDueAuction> {
  const suffix = crypto.randomUUID();
  const auctionId = `auc_settlement_${suffix}`;
  const sellerAuthId = `auth_seller_${suffix}`;
  const sellerId = `musr_seller_${suffix}`;
  const firstBuyerAuthId = `auth_first_${suffix}`;
  const firstBuyerId = `musr_first_${suffix}`;
  const secondBuyerAuthId = `auth_second_${suffix}`;
  const secondBuyerId = `musr_second_${suffix}`;
  const packageSnapshotId = `pps_${suffix}`;
  const revisionId = `rev_${suffix}`;
  const earlyBidId = `bp_early_${suffix}`;
  const lateBidId = `bp_late_${suffix}`;
  const serverNow = new Date(Date.now() - 1_000).toISOString();
  const beforeCutoff = new Date(Date.parse(serverNow) - 10_000).toISOString();
  const afterCutoff = new Date(Date.parse(serverNow) + 10_000).toISOString();

  await env.DB.batch([
    env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Seller', ?)").bind(
      sellerAuthId,
      `${sellerAuthId}@example.test`,
    ),
    env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'First', ?)").bind(
      firstBuyerAuthId,
      `${firstBuyerAuthId}@example.test`,
    ),
    env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Second', ?)").bind(
      secondBuyerAuthId,
      `${secondBuyerAuthId}@example.test`,
    ),
    env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
      sellerId,
      sellerAuthId,
    ),
    env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
      firstBuyerId,
      firstBuyerAuthId,
    ),
    env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
      secondBuyerId,
      secondBuyerAuthId,
    ),
    env.DB.prepare(
      `INSERT INTO point_package_snapshots
       (id, point_package_id, point_package_revision_id, name, total_weight)
       VALUES (?, ?, ?, 'Settlement package', 1)`,
    ).bind(packageSnapshotId, `pp_${suffix}`, `ppr_${suffix}`),
    env.DB.prepare(
      "INSERT INTO auctions (id, seller_markets_user_id, status, version) VALUES (?, ?, 'OPEN', 4)",
    ).bind(auctionId, sellerId),
    env.DB.prepare(
      `INSERT INTO auction_revisions
       (id, auction_id, revision_number, title, description, external_url,
        seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity,
        starts_at, ends_at, package_tick, eligibility_receipt_id, auction_command_id,
        auction_command_hash, package_eligibility_version, eligibility_checked_at,
        eligibility_valid_until, commit_started_at)
       VALUES (?, ?, 1, 'Settlement auction', '', 'https://example.test/item', '{}',
        'points.freeism.app', ?, 2, ?, ?, 5, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(
      revisionId,
      auctionId,
      packageSnapshotId,
      new Date(Date.parse(serverNow) - 60_000).toISOString(),
      serverNow,
      `receipt_${suffix}`,
      `command_${suffix}`,
      "a".repeat(64),
      beforeCutoff,
      serverNow,
      beforeCutoff,
    ),
    env.DB.prepare("UPDATE auctions SET current_revision_id = ? WHERE id = ?").bind(
      revisionId,
      auctionId,
    ),
    env.DB.prepare(
      `INSERT INTO bid_positions
       (id, auction_id, bidder_markets_user_id, quantity, price_tick_count,
        reached_sequence, status, updated_at)
       VALUES (?, ?, ?, 1, 4, 1, 'ACTIVE', ?)`,
    ).bind(earlyBidId, auctionId, firstBuyerId, beforeCutoff),
    env.DB.prepare(
      `INSERT INTO bid_positions
       (id, auction_id, bidder_markets_user_id, quantity, price_tick_count,
        reached_sequence, status, updated_at)
       VALUES (?, ?, ?, 1, 3, 2, 'ACTIVE', ?)`,
    ).bind(lateBidId, auctionId, secondBuyerId, afterCutoff),
    env.DB.prepare(
      `INSERT INTO bid_events
       (id, auction_id, bid_seq, bidder_markets_user_id, command_id, event_type,
        quantity, price_tick_count, created_at)
       VALUES (?, ?, 1, ?, ?, 'BID_POSITION_UPDATED', 1, 4, ?)`,
    ).bind(`be_early_${suffix}`, auctionId, firstBuyerId, `bid_command_${suffix}`, beforeCutoff),
  ]);

  return { auctionId, earlyBidId, lateBidId, revisionId, serverNow };
}

async function settlementCounts(auctionId: string) {
  return env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM auction_close_cutoffs WHERE auction_id = ?) AS cutoffs,
      (SELECT COUNT(*) FROM settlements WHERE auction_id = ?) AS settlements,
      (SELECT COUNT(*) FROM settlement_plans p
        JOIN settlements s ON s.id = p.settlement_id WHERE s.auction_id = ?) AS plans,
      (SELECT COUNT(*) FROM settlement_outbox o
        JOIN settlements s ON s.id = o.settlement_id WHERE s.auction_id = ?) AS outbox,
      (SELECT status FROM auctions WHERE id = ?) AS status,
      (SELECT version FROM auctions WHERE id = ?) AS version`,
  )
    .bind(auctionId, auctionId, auctionId, auctionId, auctionId, auctionId)
    .first<{
      cutoffs: number;
      outbox: number;
      plans: number;
      settlements: number;
      status: string;
      version: number;
    }>();
}

describe("settlement close and Workflow", () => {
  beforeEach(async () => {
    await env.DB.exec("DROP TRIGGER IF EXISTS test_fail_settlement_outbox;");
  });

  it("creates one cutoff, immutable END plan, and outbox with the OPEN to CLOSING CAS", async () => {
    const seeded = await seedDueAuction();
    const close = () =>
      closeAuctionAndPlan(env.DB, {
        auctionId: seeded.auctionId,
        expectedAuctionVersion: 4,
        expectedRevisionId: seeded.revisionId,
        serverNow: seeded.serverNow,
      });

    const results = await Promise.all([close(), close()]);
    expect(results[0]).toMatchObject({ kind: "PLANNED" });
    expect(results[1]).toMatchObject({ kind: "PLANNED" });
    expect(results[0]).toEqual(results[1]);
    expect(await settlementCounts(seeded.auctionId)).toEqual({
      cutoffs: 1,
      outbox: 1,
      plans: 1,
      settlements: 1,
      status: "CLOSING",
      version: 5,
    });

    const planJson = await env.DB.prepare(
      `SELECT p.plan_json FROM settlement_plans p
       JOIN settlements s ON s.id = p.settlement_id WHERE s.auction_id = ?`,
    )
      .bind(seeded.auctionId)
      .first<string>("plan_json");
    expect(JSON.parse(planJson ?? "null")).toMatchObject({
      eligibleBidIds: [seeded.earlyBidId],
      kind: "END_OF_AUCTION",
      maxBidSeq: 1,
    });
    expect(planJson).not.toContain(seeded.lateBidId);
  });

  it("creates only the cutoff while an unfinished BUY_NOW hold owns quantity", async () => {
    const seeded = await seedDueAuction();
    const buyerId = await env.DB.prepare(
      "SELECT bidder_markets_user_id FROM bid_positions WHERE id = ?",
    )
      .bind(seeded.earlyBidId)
      .first<string>("bidder_markets_user_id");
    await env.DB.prepare(
      `INSERT INTO buy_now_holds
       (id, auction_id, buyer_markets_user_id, quantity, buy_now_price_tick_count, status)
       VALUES (?, ?, ?, 2, 20, 'PENDING')`,
    )
      .bind(`hold_${crypto.randomUUID()}`, seeded.auctionId, buyerId)
      .run();

    await expect(
      closeAuctionAndPlan(env.DB, {
        auctionId: seeded.auctionId,
        expectedAuctionVersion: 4,
        expectedRevisionId: seeded.revisionId,
        serverNow: seeded.serverNow,
      }),
    ).resolves.toMatchObject({ kind: "WAITING_FOR_BUY_NOW" });
    expect(await settlementCounts(seeded.auctionId)).toMatchObject({
      cutoffs: 1,
      outbox: 0,
      plans: 0,
      settlements: 0,
      status: "CLOSING",
    });
  });

  it("closes a sold-out auction without creating an empty END plan", async () => {
    const seeded = await seedDueAuction();
    const buyerId = await env.DB.prepare(
      "SELECT bidder_markets_user_id FROM bid_positions WHERE id = ?",
    )
      .bind(seeded.earlyBidId)
      .first<string>("bidder_markets_user_id");
    await env.DB.prepare(
      `INSERT INTO buy_now_holds
       (id, auction_id, buyer_markets_user_id, quantity, buy_now_price_tick_count, status)
       VALUES (?, ?, ?, 2, 20, 'SETTLED')`,
    )
      .bind(`hold_${crypto.randomUUID()}`, seeded.auctionId, buyerId)
      .run();

    await expect(
      closeAuctionAndPlan(env.DB, {
        auctionId: seeded.auctionId,
        expectedAuctionVersion: 4,
        expectedRevisionId: seeded.revisionId,
        serverNow: seeded.serverNow,
      }),
    ).resolves.toEqual({ cutoffId: seeded.auctionId, kind: "SOLD_OUT" });
    expect(await settlementCounts(seeded.auctionId)).toEqual({
      cutoffs: 1,
      outbox: 0,
      plans: 0,
      settlements: 0,
      status: "SETTLED",
      version: 5,
    });
  });

  it("creates one delayed END plan from the saved cutoff after the last hold is restored", async () => {
    const seeded = await seedDueAuction();
    const buyerId = await env.DB.prepare(
      "SELECT bidder_markets_user_id FROM bid_positions WHERE id = ?",
    )
      .bind(seeded.earlyBidId)
      .first<string>("bidder_markets_user_id");
    const holdId = `hold_${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO buy_now_holds
       (id, auction_id, buyer_markets_user_id, quantity, buy_now_price_tick_count, status)
       VALUES (?, ?, ?, 2, 20, 'PENDING')`,
    )
      .bind(holdId, seeded.auctionId, buyerId)
      .run();
    await closeAuctionAndPlan(env.DB, {
      auctionId: seeded.auctionId,
      expectedAuctionVersion: 4,
      expectedRevisionId: seeded.revisionId,
      serverNow: seeded.serverNow,
    });
    await env.DB.prepare("UPDATE buy_now_holds SET status = 'FAILED_RESTORED' WHERE id = ?")
      .bind(holdId)
      .run();

    const resume = () =>
      resumeAuctionCloseFromCutoff(env.DB, {
        auctionId: seeded.auctionId,
        serverNow: new Date(Date.parse(seeded.serverNow) + 1_000).toISOString(),
      });
    const results = await Promise.all([resume(), resume()]);
    expect(results[0]).toMatchObject({ kind: "PLANNED" });
    expect(results[1]).toEqual(results[0]);
    expect(await settlementCounts(seeded.auctionId)).toEqual({
      cutoffs: 1,
      outbox: 1,
      plans: 1,
      settlements: 1,
      status: "CLOSING",
      version: 5,
    });
    const quantity = await env.DB.prepare(
      `SELECT json_extract(p.plan_json, '$.quantity') AS quantity
       FROM settlement_plans p JOIN settlements s ON s.id = p.settlement_id
       WHERE s.auction_id = ? AND s.kind = 'END_OF_AUCTION'`,
    )
      .bind(seeded.auctionId)
      .first<number>("quantity");
    expect(quantity).toBe(2);
  });

  it("finishes a delayed sold-out close without an empty END plan", async () => {
    const seeded = await seedDueAuction();
    const buyerId = await env.DB.prepare(
      "SELECT bidder_markets_user_id FROM bid_positions WHERE id = ?",
    )
      .bind(seeded.earlyBidId)
      .first<string>("bidder_markets_user_id");
    const holdId = `hold_${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO buy_now_holds
       (id, auction_id, buyer_markets_user_id, quantity, buy_now_price_tick_count, status)
       VALUES (?, ?, ?, 2, 20, 'PENDING')`,
    )
      .bind(holdId, seeded.auctionId, buyerId)
      .run();
    await closeAuctionAndPlan(env.DB, {
      auctionId: seeded.auctionId,
      expectedAuctionVersion: 4,
      expectedRevisionId: seeded.revisionId,
      serverNow: seeded.serverNow,
    });
    await env.DB.prepare("UPDATE buy_now_holds SET status = 'SETTLED' WHERE id = ?")
      .bind(holdId)
      .run();

    const resume = () =>
      resumeAuctionCloseFromCutoff(env.DB, {
        auctionId: seeded.auctionId,
        serverNow: new Date(Date.parse(seeded.serverNow) + 1_000).toISOString(),
      });
    await expect(resume()).resolves.toEqual({ cutoffId: seeded.auctionId, kind: "SOLD_OUT" });
    await expect(resume()).resolves.toEqual({ cutoffId: seeded.auctionId, kind: "SOLD_OUT" });
    expect(await settlementCounts(seeded.auctionId)).toEqual({
      cutoffs: 1,
      outbox: 0,
      plans: 0,
      settlements: 0,
      status: "SETTLED",
      version: 5,
    });
  });

  it("rolls back the close CAS and cutoff when the outbox insert fails", async () => {
    const seeded = await seedDueAuction();
    await env.DB.exec(
      "CREATE TRIGGER test_fail_settlement_outbox BEFORE INSERT ON settlement_outbox BEGIN SELECT RAISE(ABORT, 'TEST_SETTLEMENT_OUTBOX_FAILURE'); END;",
    );
    await expect(
      closeAuctionAndPlan(env.DB, {
        auctionId: seeded.auctionId,
        expectedAuctionVersion: 4,
        expectedRevisionId: seeded.revisionId,
        serverNow: seeded.serverNow,
      }),
    ).rejects.toThrow("TEST_SETTLEMENT_OUTBOX_FAILURE");
    expect(await settlementCounts(seeded.auctionId)).toEqual({
      cutoffs: 0,
      outbox: 0,
      plans: 0,
      settlements: 0,
      status: "OPEN",
      version: 4,
    });
  });

  it("canonicalizes a plan independently of eligible bid input order", async () => {
    const input = {
      algorithmVersion: "uniform-price-v1",
      auctionId: "auc_canonical",
      auctionRevisionId: "rev_canonical",
      cutoffAt: "2026-07-13T00:00:00.000Z",
      eligibleBids: [
        {
          bidPositionId: "bp_2",
          marketsUserId: "musr_2",
          priceTickCount: 3,
          quantity: 1,
          reachedSequence: 2,
        },
        {
          bidPositionId: "bp_1",
          marketsUserId: "musr_1",
          priceTickCount: 4,
          quantity: 1,
          reachedSequence: 1,
        },
      ],
      kind: "END_OF_AUCTION" as const,
      maxBidSeq: 2,
      packageTick: 5,
      pointPackageRevisionId: "ppr_canonical",
      quantity: 2,
    };
    const first = await createSettlementPlan(input);
    const second = await createSettlementPlan({
      ...input,
      eligibleBids: [...input.eligibleBids].reverse(),
    });
    expect(first).toEqual(second);
    expect(first.plan.eligibleBidIds).toEqual(["bp_1", "bp_2"]);
    expect(first.planHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("dispatches one deterministic Workflow instance and fails explicitly without Points bindings", async () => {
    const seeded = await seedDueAuction();
    const planned = await closeAuctionAndPlan(env.DB, {
      auctionId: seeded.auctionId,
      expectedAuctionVersion: 4,
      expectedRevisionId: seeded.revisionId,
      serverNow: seeded.serverNow,
    });
    if (planned.kind !== "PLANNED") throw new Error("Expected planned settlement");
    const instanceId = settlementWorkflowInstanceId(planned.params);
    const introspector = await introspectWorkflowInstance(env.AUCTION_SETTLEMENT, instanceId);
    try {
      const first = await dispatchSettlementOutbox(
        env.DB,
        env.AUCTION_SETTLEMENT,
        planned.outboxId,
      );
      const replay = await dispatchSettlementOutbox(
        env.DB,
        env.AUCTION_SETTLEMENT,
        planned.outboxId,
      );
      expect(replay).toEqual(first);
      expect(first).toEqual({ instanceId, status: "DISPATCHED" });
      await expect(introspector.waitForStepResult({ name: "validate-plan" })).resolves.toEqual({
        kind: "END_OF_AUCTION",
        planHash: planned.params.planHash,
        sagaState: "PLANNED",
        settlementId: planned.params.settlementId,
        settlementRevision: 1,
      });
      await expect(introspector.waitForStatus("errored")).rejects.toThrow(
        "Aborting engine: A step threw a NonRetryableError",
      );
      await expect((await env.AUCTION_SETTLEMENT.get(instanceId)).status()).resolves.toMatchObject({
        error: { message: expect.stringContaining("NonRetryableError") },
        status: "errored",
      });
      await expect(
        env.DB.prepare("SELECT saga_state FROM settlements WHERE id = ?")
          .bind(planned.params.settlementId)
          .first<string>("saga_state"),
      ).resolves.toBe("PLANNED");
    } finally {
      await introspector.dispose();
    }
  });

  it("recreates a retained DISPATCHED outbox when its deterministic Workflow instance is gone", async () => {
    const seeded = await seedDueAuction();
    const planned = await closeAuctionAndPlan(env.DB, {
      auctionId: seeded.auctionId,
      expectedAuctionVersion: 4,
      expectedRevisionId: seeded.revisionId,
      serverNow: seeded.serverNow,
    });
    if (planned.kind !== "PLANNED") throw new Error("Expected planned settlement");
    const instanceId = settlementWorkflowInstanceId(planned.params);
    await env.DB.prepare(
      `UPDATE settlement_outbox SET status = 'DISPATCHED', workflow_instance_id = ?
       WHERE id = ?`,
    )
      .bind(instanceId, planned.outboxId)
      .run();
    await expect(env.AUCTION_SETTLEMENT.get(instanceId)).rejects.toThrow("instance.not_found");

    await expect(
      dispatchSettlementOutbox(env.DB, env.AUCTION_SETTLEMENT, planned.outboxId),
    ).resolves.toEqual({ instanceId, status: "DISPATCHED" });
    expect((await (await env.AUCTION_SETTLEMENT.get(instanceId)).status()).status).not.toBe(
      "unknown",
    );
  });

  it("uses distinct retry IDs, rejects oversized IDs, and defines every explicit policy", () => {
    const base = {
      auctionId: "auc_1",
      planHash: "a".repeat(64),
      settlementId: "stl_1",
      settlementRevision: 1,
      workflowAttempt: 0,
    };
    expect(settlementWorkflowInstanceId(base)).toBe("settlement-stl_1-revision-1-attempt-0");
    expect(settlementWorkflowInstanceId({ ...base, workflowAttempt: 1 })).toBe(
      "settlement-stl_1-revision-1-attempt-1",
    );
    expect(() => settlementWorkflowInstanceId({ ...base, settlementId: "x".repeat(90) })).toThrow(
      "SETTLEMENT_WORKFLOW_ID_TOO_LONG",
    );
    expect(SETTLEMENT_STEP_POLICIES).toEqual({
      capture: {
        retries: { backoff: "exponential", delay: "2 seconds", limit: 5 },
        timeout: "2 minutes",
      },
      finalize: {
        retries: { backoff: "exponential", delay: "1 second", limit: 3 },
        timeout: "1 minute",
      },
      releaseRound: {
        retries: { backoff: "exponential", delay: "2 seconds", limit: 5 },
        timeout: "2 minutes",
      },
      reserveRound: {
        retries: { backoff: "exponential", delay: "1 second", limit: 3 },
        timeout: "5 minutes",
      },
      statusRound: {
        retries: { backoff: "exponential", delay: "1 second", limit: 3 },
        timeout: "30 seconds",
      },
      validatePlan: {
        retries: { backoff: "constant", delay: "1 second", limit: 1 },
        timeout: "30 seconds",
      },
    });
    expect(SETTLEMENT_HTTP_POLICIES).toEqual({
      capture: {
        attemptTimeoutMs: 10_000,
        backoff: "exponential",
        initialDelayMs: 2_000,
        maxElapsedMs: 120_000,
        retryableStatuses: [429, 502, 503, 504],
        totalAttempts: 5,
      },
      finalize: {
        attemptTimeoutMs: 10_000,
        backoff: "exponential",
        initialDelayMs: 1_000,
        maxElapsedMs: 60_000,
        retryableStatuses: [429, 502, 503, 504],
        totalAttempts: 3,
      },
      release: {
        attemptTimeoutMs: 5_000,
        backoff: "exponential",
        initialDelayMs: 2_000,
        maxElapsedMs: 120_000,
        retryableStatuses: [429, 502, 503, 504],
        totalAttempts: 5,
      },
      reserveWinner: {
        attemptTimeoutMs: 8_000,
        backoff: "exponential",
        initialDelayMs: 1_000,
        maxElapsedMs: 45_000,
        retryableStatuses: [429, 502, 503, 504],
        totalAttempts: 3,
      },
      status: {
        attemptTimeoutMs: 5_000,
        backoff: "exponential",
        initialDelayMs: 1_000,
        maxElapsedMs: 30_000,
        retryableStatuses: [429, 502, 503, 504],
        totalAttempts: 3,
      },
    });
    expect(env.AUCTION_SETTLEMENT).toBeDefined();
  });
});
