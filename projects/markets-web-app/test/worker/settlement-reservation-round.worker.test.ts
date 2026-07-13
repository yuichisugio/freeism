import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vite-plus/test";

import { closeAuctionAndPlan } from "../../src/backend/db/d1-settlement-plan-repository";
import { D1SettlementReservationRepository } from "../../src/backend/db/d1-settlement-repository";
import { PointsApiError } from "../../src/backend/points/points-api-client";
import { createSettlementPlan } from "../../src/backend/settlement/create-settlement-plan";
import {
  reserveSettlementRound,
  type BuyNowRestorer,
  type ReservationGateway,
  type ReservationStatusReceipt,
  type WinnerReservationRequest,
} from "../../src/backend/settlement/reserve-settlement-round";

interface SeededSettlement {
  auctionId: string;
  buyerIds: readonly [string, string];
  now: string;
  planHash: string;
  revisionId: string;
  settlementId: string;
}

async function insertUser(suffix: string, label: string) {
  const authId = `auth_${label}_${suffix}`;
  const marketsUserId = `musr_${label}_${suffix}`;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)").bind(
      authId,
      label,
      `${authId}@example.test`,
    ),
    env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
      marketsUserId,
      authId,
    ),
  ]);
  return { authId, marketsUserId };
}

async function insertConnection(
  suffix: string,
  user: { authId: string; marketsUserId: string },
) {
  const id = `pc_${user.marketsUserId}`;
  await env.DB.prepare(
    `INSERT INTO points_connection
     (id, markets_user_id, auth_user_id, status, link_attempt_id, attempt_payload_hash,
      points_issuer, points_subject, user_client_id, m2m_client_id, granted_scopes,
      session_id, expires_at)
     VALUES (?, ?, ?, 'ACTIVE', ?, ?, 'https://points.example.test', ?,
      'markets-user-client', 'markets-m2m-client', 'points.reservations.create', ?, ?)`,
  )
    .bind(
      id,
      user.marketsUserId,
      user.authId,
      `link_${user.marketsUserId}`,
      "a".repeat(64),
      `subject_${user.marketsUserId}`,
      `session_${suffix}_${user.marketsUserId}`,
      Date.now() + 60_000,
    )
    .run();
  return id;
}

async function seedEndSettlement(): Promise<SeededSettlement> {
  const suffix = crypto.randomUUID();
  const seller = await insertUser(suffix, "seller");
  const first = await insertUser(suffix, "a_first");
  const second = await insertUser(suffix, "b_second");
  await insertConnection(suffix, first);
  await insertConnection(suffix, second);
  const auctionId = `auc_${suffix}`;
  const revisionId = `rev_${suffix}`;
  const snapshotId = `pps_${suffix}`;
  const now = new Date(Date.now() - 1_000).toISOString();
  const before = new Date(Date.parse(now) - 10_000).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO point_package_snapshots
       (id, point_package_id, point_package_revision_id, name, total_weight)
       VALUES (?, ?, ?, 'Package', 1)`,
    ).bind(snapshotId, `pp_${suffix}`, `ppr_${suffix}`),
    env.DB.prepare(
      "INSERT INTO auctions (id, seller_markets_user_id, status, version) VALUES (?, ?, 'OPEN', 1)",
    ).bind(auctionId, seller.marketsUserId),
    env.DB.prepare(
      `INSERT INTO auction_revisions
       (id, auction_id, revision_number, title, description, external_url,
        seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity,
        starts_at, ends_at, package_tick, eligibility_receipt_id, auction_command_id,
        auction_command_hash, package_eligibility_version, eligibility_checked_at,
        eligibility_valid_until, commit_started_at)
       VALUES (?, ?, 1, 'Auction', '', 'https://example.test/item', '{}',
        'points.freeism.app', ?, 2, ?, ?, 5, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(
      revisionId,
      auctionId,
      snapshotId,
      before,
      now,
      `receipt_${suffix}`,
      `command_${suffix}`,
      "b".repeat(64),
      before,
      now,
      before,
    ),
    env.DB.prepare("UPDATE auctions SET current_revision_id = ? WHERE id = ?").bind(
      revisionId,
      auctionId,
    ),
    env.DB.prepare(
      `INSERT INTO bid_positions
       (id, auction_id, bidder_markets_user_id, quantity, price_tick_count,
        reached_sequence, status, updated_at)
       VALUES (?, ?, ?, 1, 5, 1, 'ACTIVE', ?)`,
    ).bind(`bp_first_${suffix}`, auctionId, first.marketsUserId, before),
    env.DB.prepare(
      `INSERT INTO bid_positions
       (id, auction_id, bidder_markets_user_id, quantity, price_tick_count,
        reached_sequence, status, updated_at)
       VALUES (?, ?, ?, 1, 4, 2, 'ACTIVE', ?)`,
    ).bind(`bp_second_${suffix}`, auctionId, second.marketsUserId, before),
  ]);
  const close = await closeAuctionAndPlan(env.DB, {
    auctionId,
    expectedAuctionVersion: 1,
    expectedRevisionId: revisionId,
    serverNow: now,
  });
  if (close.kind !== "PLANNED") throw new Error("TEST_SETTLEMENT_NOT_PLANNED");
  return {
    auctionId,
    buyerIds: [first.marketsUserId, second.marketsUserId],
    now,
    planHash: close.params.planHash,
    revisionId,
    settlementId: close.settlementId,
  };
}

function gateway(
  reserve: (input: WinnerReservationRequest) => Promise<{
    expiresAt: string;
    pointReservationId: string;
    vectorHash: string;
  }>,
  statusByKeys: (keys: readonly string[]) => Promise<readonly ReservationStatusReceipt[]> = async () => [],
) {
  return {
    release: vi.fn(async (input) => ({
      contentHash: "c".repeat(64),
      receiptId: `release_${input.pointReservationId}`,
      releasedAt: new Date().toISOString(),
    })),
    reserve: vi.fn(reserve),
    statusByKeys: vi.fn(statusByKeys),
  } satisfies ReservationGateway;
}

function restorer() {
  return {
    restoreBuyNowHold: vi.fn(async () => ({ receiptId: `restore_${crypto.randomUUID()}` })),
  } satisfies BuyNowRestorer;
}

function dependencies(points: ReservationGateway, restore: BuyNowRestorer, now: string) {
  return {
    buyNowRestorer: restore,
    gateway: points,
    now: () => new Date(now),
    repository: new D1SettlementReservationRepository(env.DB),
  };
}

describe("settlement reservation round", () => {
  it("reserves every END winner and stops at RESERVED", async () => {
    const seeded = await seedEndSettlement();
    const points = gateway(async (input) => ({
      expiresAt: new Date(Date.parse(seeded.now) + 15 * 60_000).toISOString(),
      pointReservationId: `pres_${input.marketsUserId}`,
      vectorHash: "d".repeat(64),
    }));
    const result = await reserveSettlementRound(dependencies(points, restorer(), seeded.now), {
      planHash: seeded.planHash,
      roundOrdinal: 1,
      settlementId: seeded.settlementId,
      settlementRevision: 1,
    });

    expect(result).toMatchObject({ kind: "RESERVED", roundOrdinal: 1 });
    expect(points.reserve).toHaveBeenCalledTimes(2);
    expect(points.reserve.mock.calls.map(([input]) => input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ leaseSeconds: 900, planHash: seeded.planHash, priceTicks: 0 }),
      ]),
    );
    expect(
      await env.DB.prepare("SELECT saga_state FROM settlements WHERE id = ?")
        .bind(seeded.settlementId)
        .first<string>("saga_state"),
    ).toBe("RESERVED");
  });

  it("releases successes, blacklists only insufficiency, and recalculates from the same cutoff", async () => {
    const seeded = await seedEndSettlement();
    const insufficient = seeded.buyerIds[0];
    const points = gateway(async (input) => {
      if (input.marketsUserId === insufficient) {
        throw new PointsApiError(422, "INSUFFICIENT_BALANCE");
      }
      return {
        expiresAt: new Date(Date.parse(seeded.now) + 15 * 60_000).toISOString(),
        pointReservationId: `pres_${input.marketsUserId}_${input.reservationKey}`,
        vectorHash: "e".repeat(64),
      };
    });
    const deps = dependencies(points, restorer(), seeded.now);
    const first = await reserveSettlementRound(deps, {
      planHash: seeded.planHash,
      roundOrdinal: 1,
      settlementId: seeded.settlementId,
      settlementRevision: 1,
    });
    expect(first).toEqual({
      excludedUserIds: [insufficient],
      kind: "RECALCULATE",
      nextRoundOrdinal: 2,
    });
    expect(points.release).toHaveBeenCalledTimes(1);

    const second = await reserveSettlementRound(deps, {
      planHash: seeded.planHash,
      roundOrdinal: 2,
      settlementId: seeded.settlementId,
      settlementRevision: 1,
    });
    expect(second).toMatchObject({ kind: "RESERVED", roundOrdinal: 2 });
    const rows = await env.DB.prepare(
      `SELECT round_ordinal AS roundOrdinal, cutoff_hash AS cutoffHash
       FROM settlement_rounds WHERE settlement_id = ? ORDER BY round_ordinal`,
    )
      .bind(seeded.settlementId)
      .all<{ cutoffHash: string; roundOrdinal: number }>();
    expect(rows.results).toHaveLength(2);
    expect(new Set(rows.results.map((row) => row.cutoffHash)).size).toBe(1);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM auction_blacklist_events WHERE auction_id = ?")
        .bind(seeded.auctionId)
        .first<number>("count"),
    ).toBe(1);
  });

  it("checks status and retries a temporary failure with the same key", async () => {
    const seeded = await seedEndSettlement();
    let first = true;
    const points = gateway(async (input) => {
      if (first) {
        first = false;
        throw new PointsApiError(503, "POINTS_TEMPORARY_UNAVAILABLE");
      }
      return {
        expiresAt: new Date(Date.parse(seeded.now) + 15 * 60_000).toISOString(),
        pointReservationId: `pres_${input.marketsUserId}`,
        vectorHash: "f".repeat(64),
      };
    });
    const result = await reserveSettlementRound(dependencies(points, restorer(), seeded.now), {
      planHash: seeded.planHash,
      roundOrdinal: 1,
      settlementId: seeded.settlementId,
      settlementRevision: 1,
    });
    expect(result).toMatchObject({ kind: "RESERVED" });
    expect(points.statusByKeys).toHaveBeenCalledTimes(1);
    expect(points.reserve.mock.calls[0]?.[0].reservationKey).toBe(
      points.reserve.mock.calls[1]?.[0].reservationKey,
    );
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM settlement_exclusions WHERE settlement_id = ?")
        .bind(seeded.settlementId)
        .first<number>("count"),
    ).toBe(0);
  });

  it("restores a rejected BUY_NOW hold without selecting another buyer", async () => {
    const seeded = await seedEndSettlement();
    const buyerId = seeded.buyerIds[0];
    const holdId = `hold_${crypto.randomUUID()}`;
    const settlementId = `stl_buy_${crypto.randomUUID()}`;
    const planId = `spl_buy_${crypto.randomUUID()}`;
    const planned = await createSettlementPlan({
      algorithmVersion: "uniform-price-v1",
      auctionId: seeded.auctionId,
      auctionRevisionId: seeded.revisionId,
      availableQuantityBeforeHold: 2,
      buyerMarketsUserId: buyerId,
      buyNowHoldId: holdId,
      kind: "BUY_NOW",
      packageTick: 5,
      pointPackageRevisionId: `ppr_${seeded.auctionId.slice(4)}`,
      priceTickCount: 20,
      quantity: 1,
    });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO buy_now_holds
         (id, auction_id, buyer_markets_user_id, quantity, buy_now_price_tick_count, status)
         VALUES (?, ?, ?, 1, 20, 'PENDING')`,
      ).bind(holdId, seeded.auctionId, buyerId),
      env.DB.prepare(
        `INSERT INTO settlements
         (id, auction_id, kind, source_key, settlement_revision, workflow_attempt,
          saga_state, current_plan_id) VALUES (?, ?, 'BUY_NOW', ?, 1, 0, 'PLANNED', ?)`,
      ).bind(settlementId, seeded.auctionId, `buy:${holdId}`, planId),
      env.DB.prepare(
        `INSERT INTO settlement_plans
         (id, settlement_id, settlement_revision, plan_json, plan_hash, algorithm_version)
         VALUES (?, ?, 1, ?, ?, 'uniform-price-v1')`,
      ).bind(planId, settlementId, planned.planJson, planned.planHash),
    ]);
    const points = gateway(async () => {
      throw new PointsApiError(422, "INSUFFICIENT_BALANCE");
    });
    const restore = restorer();
    const result = await reserveSettlementRound(dependencies(points, restore, seeded.now), {
      planHash: planned.planHash,
      roundOrdinal: 1,
      settlementId,
      settlementRevision: 1,
    });
    expect(result).toMatchObject({ kind: "BUY_NOW_RESTORED" });
    expect(points.reserve).toHaveBeenCalledTimes(1);
    expect(restore.restoreBuyNowHold).toHaveBeenCalledWith(
      expect.objectContaining({ evidenceType: "RESERVATION_REJECTED", holdId }),
    );
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM auction_blacklist_events WHERE auction_id = ?")
        .bind(seeded.auctionId)
        .first<number>("count"),
    ).toBe(0);
  });
});
