import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vite-plus/test";

import { D1SettlementCaptureRepository } from "../../src/backend/db/d1-settlement-capture-repository";
import {
  captureAllWinners,
  type CaptureRound,
  type CapturedSettlementReceipt,
  type SettlementCaptureGateway,
  type SettlementCaptureRepository,
} from "../../src/backend/settlement/capture-all-winners";
import {
  calculateStoredVectorHash,
  finalizeSettlement,
} from "../../src/backend/settlement/finalize-settlement";

const planHash = "a".repeat(64);
const capturedAt = "2026-07-14T00:00:00.000Z";

function round(status: CaptureRound["winners"][number]["status"] = "ACTIVE"): CaptureRound {
  return {
    auctionId: "auction_1",
    kind: "END_OF_AUCTION",
    roundId: "sround_settlement_1_1",
    roundOrdinal: 1,
    state: "RESERVED",
    winners: ["a", "b", "c"].map((suffix, index) => ({
      allocationQuantity: 1,
      componentVectorJson: JSON.stringify([
        {
          amountScaled: index === 0 ? "0" : String(index),
          evaluationCriterionId: "criterion_1",
          evaluationCriterionRevisionId: "criterion_revision_1",
        },
      ]),
      marketsUserId: `user_${suffix}`,
      pointReservationId: `reservation_${suffix}`,
      priceTickCount: index,
      priceTicks: index,
      reservationKey: `settlement_1:user_${suffix}:revision_1`,
      status,
      vectorHash: String(index + 1).repeat(64),
    })),
  };
}

function receipt(input: CaptureRound): CapturedSettlementReceipt {
  return {
    auctionId: input.auctionId,
    capturedAt,
    captureReceiptId: "capture_1",
    contentHash: `sha256:${"f".repeat(64)}`,
    planHash,
    reservations: input.winners.map((winner) => ({
      pointReservationId: winner.pointReservationId,
      status: "CAPTURED" as const,
      vectorHash: winner.vectorHash,
    })),
    settlementId: "settlement_1",
  };
}

function setup(current = round()) {
  const saved: CapturedSettlementReceipt[] = [];
  const repository = {
    loadCaptureRound: vi.fn(async () => current),
    markCaptureManualAction: vi.fn(async () => undefined),
    recordCaptureInsufficiency: vi.fn(async () => undefined),
    recordCaptureReceipt: vi.fn(async (value) => {
      saved.push(value.receipt);
      return value.receipt;
    }),
  } satisfies SettlementCaptureRepository;
  const gateway = {
    capture: vi.fn(async () => receipt(current)),
    release: vi.fn(async (input) => ({
      contentHash: "e".repeat(64),
      receiptId: `release_${input.pointReservationId}`,
      releasedAt: capturedAt,
    })),
    statusByIds: vi.fn(async () =>
      current.winners.map((winner) => ({
        auctionId: current.auctionId,
        planHash,
        pointReservationId: winner.pointReservationId,
        reservationKey: winner.reservationKey,
        settlementId: "settlement_1",
        status: winner.status === "ACTIVE" ? ("ACTIVE" as const) : ("EXPIRED" as const),
        vectorHash: winner.vectorHash,
      })),
    ),
  } satisfies SettlementCaptureGateway;
  return { gateway, repository, saved };
}

describe("settlement capture", () => {
  it("全winnerを0 tickを含めて1回だけcaptureし、receiptを保存する", async () => {
    const { gateway, repository, saved } = setup();

    const result = await captureAllWinners(
      { gateway, now: () => new Date(capturedAt), repository },
      {
        planHash,
        roundOrdinal: 1,
        settlementId: "settlement_1",
        settlementRevision: 1,
      },
    );

    expect(result).toMatchObject({ kind: "CAPTURED", receipt: { captureReceiptId: "capture_1" } });
    expect(gateway.capture).toHaveBeenCalledTimes(1);
    expect(gateway.capture.mock.calls[0]?.[0].reservations).toEqual([
      { expectedVectorHash: "1".repeat(64), pointReservationId: "reservation_a" },
      { expectedVectorHash: "2".repeat(64), pointReservationId: "reservation_b" },
      { expectedVectorHash: "3".repeat(64), pointReservationId: "reservation_c" },
    ]);
    expect(repository.recordCaptureReceipt).toHaveBeenCalledTimes(1);
    expect(saved).toHaveLength(1);
  });

  it("prefixなしのcapture receiptは保存せずmanual actionにする", async () => {
    const current = round();
    const { gateway, repository } = setup(current);
    gateway.capture.mockResolvedValueOnce({
      ...receipt(current),
      contentHash: "f".repeat(64),
    });

    const result = await captureAllWinners(
      { gateway, now: () => new Date(capturedAt), repository },
      {
        planHash,
        roundOrdinal: 1,
        settlementId: "settlement_1",
        settlementRevision: 1,
      },
    );

    expect(result).toEqual({ kind: "MANUAL_ACTION", reason: "CAPTURE_RECEIPT_MISMATCH" });
    expect(repository.recordCaptureReceipt).not.toHaveBeenCalled();
  });

  it("capture直前の1件不整合ではcaptureもreceipt保存も行わない", async () => {
    const current = round();
    const { gateway, repository } = setup(current);
    gateway.statusByIds.mockResolvedValueOnce([
      ...(await gateway.statusByIds([])).slice(0, 2),
      {
        auctionId: current.auctionId,
        planHash,
        pointReservationId: "reservation_c",
        reservationKey: current.winners[2]!.reservationKey,
        settlementId: "settlement_1",
        status: "EXPIRED",
        vectorHash: current.winners[2]!.vectorHash,
      },
    ]);

    const result = await captureAllWinners(
      { gateway, now: () => new Date(capturedAt), repository },
      {
        planHash,
        roundOrdinal: 1,
        settlementId: "settlement_1",
        settlementRevision: 1,
      },
    );

    expect(result).toEqual({ kind: "RECALCULATE", nextRoundOrdinal: 2 });
    expect(gateway.capture).not.toHaveBeenCalled();
    expect(repository.recordCaptureReceipt).not.toHaveBeenCalled();
  });

  it("CAPTURED statusは同じkeyのreceipt replayへ進め、response欠落はmanual actionにする", async () => {
    const current = round("CAPTURED");
    const { gateway, repository } = setup(current);
    gateway.statusByIds.mockResolvedValueOnce(
      current.winners.map((winner) => ({
        auctionId: current.auctionId,
        planHash,
        pointReservationId: winner.pointReservationId,
        reservationKey: winner.reservationKey,
        settlementId: "settlement_1",
        status: "CAPTURED",
        terminalReceiptId: "capture_1",
        vectorHash: winner.vectorHash,
      })),
    );
    gateway.capture.mockResolvedValueOnce({
      ...receipt(current),
      reservations: receipt(current).reservations.slice(0, 2),
    });

    const result = await captureAllWinners(
      { gateway, now: () => new Date(capturedAt), repository },
      {
        planHash,
        roundOrdinal: 1,
        settlementId: "settlement_1",
        settlementRevision: 1,
      },
    );

    expect(gateway.capture).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: "MANUAL_ACTION", reason: "CAPTURE_RECEIPT_MISMATCH" });
    expect(repository.recordCaptureReceipt).not.toHaveBeenCalled();
    expect(repository.markCaptureManualAction).toHaveBeenCalledTimes(1);
  });

  it("capture時残高不足はrequest内userだけを除外対象にし、旧ACTIVEを全件releaseする", async () => {
    const { gateway, repository } = setup();
    gateway.capture.mockRejectedValueOnce({
      code: "INSUFFICIENT_BALANCE",
      insufficientReservationIds: ["reservation_b"],
      status: 409,
    });

    const result = await captureAllWinners(
      { gateway, now: () => new Date(capturedAt), repository },
      {
        planHash,
        roundOrdinal: 1,
        settlementId: "settlement_1",
        settlementRevision: 1,
      },
    );

    expect(result).toEqual({ kind: "RECALCULATE", nextRoundOrdinal: 2 });
    expect(gateway.release).toHaveBeenCalledTimes(3);
    expect(repository.recordCaptureInsufficiency).toHaveBeenCalledWith(
      expect.objectContaining({ insufficientUserIds: ["user_b"] }),
    );
  });

  it("不足IDの重複やrequest外IDではcandidateを変えずmanual actionにする", async () => {
    const { gateway, repository } = setup();
    gateway.capture.mockRejectedValueOnce({
      code: "INSUFFICIENT_BALANCE",
      insufficientReservationIds: ["reservation_b", "reservation_b"],
      status: 409,
    });

    const result = await captureAllWinners(
      { gateway, now: () => new Date(capturedAt), repository },
      {
        planHash,
        roundOrdinal: 1,
        settlementId: "settlement_1",
        settlementRevision: 1,
      },
    );

    expect(result).toEqual({
      kind: "MANUAL_ACTION",
      reason: "CAPTURE_INSUFFICIENCY_IDS_INVALID",
    });
    expect(gateway.release).not.toHaveBeenCalled();
  });

  it("capture後は0 tick allocationとproofへforward finalizeし、retryで増えない", async () => {
    const suffix = crypto.randomUUID();
    const sellerAuthId = `auth_seller_${suffix}`;
    const buyerAuthId = `auth_buyer_${suffix}`;
    const sellerId = `seller_${suffix}`;
    const buyerId = `buyer_${suffix}`;
    const auctionId = `auction_${suffix}`;
    const revisionId = `revision_${suffix}`;
    const snapshotId = `snapshot_${suffix}`;
    const settlementId = `settlement_${suffix}`;
    const settlementRoundId = `round_${suffix}`;
    const captureReceiptId = `capture_${suffix}`;
    const pointReservationId = `reservation_${suffix}`;
    const now = "2026-07-14T01:00:00.000Z";
    const componentVectorJson = JSON.stringify([
      {
        amountScaled: "0",
        evaluationCriterionId: "criterion_1",
        evaluationCriterionRevisionId: "criterion_revision_1",
      },
    ]);
    const plan = {
      algorithmVersion: "uniform-price-v1",
      auctionId,
      auctionRevisionId: revisionId,
      cutoffAt: now,
      eligibleBidIds: [],
      kind: "END_OF_AUCTION",
      maxBidSeq: 0,
      packageTick: 1,
      pointPackageRevisionId: `package_revision_${suffix}`,
      quantity: 1,
      rankingInputHash: "8".repeat(64),
    };
    const vectorHash = await calculateStoredVectorHash({
      componentVectorJson,
      pointPackageRevisionId: plan.pointPackageRevisionId,
      priceTicks: 0,
      quantity: 1,
    });
    await env.DB.batch([
      env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Seller', ?)").bind(
        sellerAuthId,
        `${sellerAuthId}@example.test`,
      ),
      env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Buyer', ?)").bind(
        buyerAuthId,
        `${buyerAuthId}@example.test`,
      ),
      env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
        sellerId,
        sellerAuthId,
      ),
      env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
        buyerId,
        buyerAuthId,
      ),
      env.DB.prepare(
        `INSERT INTO point_package_snapshots
         (id, point_package_id, point_package_revision_id, name, total_weight)
         VALUES (?, ?, ?, 'Package', 1)`,
      ).bind(snapshotId, `package_${suffix}`, plan.pointPackageRevisionId),
      env.DB.prepare(
        `INSERT INTO auctions (id, seller_markets_user_id, status, version)
         VALUES (?, ?, 'CLOSING', 1)`,
      ).bind(auctionId, sellerId),
      env.DB.prepare(
        `INSERT INTO auction_revisions
         (id, auction_id, revision_number, title, description, external_url,
          seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity,
          starts_at, ends_at, package_tick, eligibility_receipt_id, auction_command_id,
          auction_command_hash, package_eligibility_version, eligibility_checked_at,
          eligibility_valid_until, commit_started_at)
         VALUES (?, ?, 1, 'Item', 'Description', 'https://example.test/item', ?,
          'points.freeism.app', ?, 2, ?, ?, 1, ?, ?, ?, 1, ?, ?, ?)`,
      ).bind(
        revisionId,
        auctionId,
        JSON.stringify({ displayName: "Seller", marketsUserId: sellerId }),
        snapshotId,
        now,
        now,
        `eligibility_${suffix}`,
        `command_${suffix}`,
        "7".repeat(64),
        now,
        now,
        now,
      ),
      env.DB.prepare("UPDATE auctions SET current_revision_id = ? WHERE id = ?").bind(
        revisionId,
        auctionId,
      ),
      env.DB.prepare(
        `INSERT INTO settlements
         (id, auction_id, kind, source_key, saga_state, current_plan_id)
         VALUES (?, ?, 'END_OF_AUCTION', ?, 'RESERVED', ?)`,
      ).bind(settlementId, auctionId, `end:${suffix}`, `plan_${suffix}`),
      env.DB.prepare(
        `INSERT INTO settlement_plans
         (id, settlement_id, settlement_revision, plan_json, plan_hash, algorithm_version)
         VALUES (?, ?, 1, ?, ?, 'uniform-price-v1')`,
      ).bind(`plan_${suffix}`, settlementId, JSON.stringify(plan), planHash),
      env.DB.prepare(
        `INSERT INTO settlement_rounds
         (id, settlement_id, round_ordinal, plan_hash, cutoff_hash, state,
          first_attempt_at, retry_deadline_at)
         VALUES (?, ?, 1, ?, ?, 'RESERVED', ?, ?)`,
      ).bind(settlementRoundId, settlementId, planHash, "6".repeat(64), now, now),
      env.DB.prepare(
        `INSERT INTO settlement_round_winners
         (id, settlement_round_id, markets_user_id, allocation_quantity,
          price_tick_count, price_ticks, reservation_key, status,
          point_reservation_id, vector_hash, component_vector_json)
         VALUES (?, ?, ?, 1, 0, 0, ?, 'ACTIVE', ?, ?, ?)`,
      ).bind(
        `winner_${suffix}`,
        settlementRoundId,
        buyerId,
        `${settlementId}:${buyerId}:revision_1`,
        pointReservationId,
        vectorHash,
        componentVectorJson,
      ),
    ]);
    const captureRepository = new D1SettlementCaptureRepository(env.DB);
    await expect(
      captureRepository.recordCaptureReceipt({
        now,
        receipt: {
          auctionId,
          capturedAt: now,
          captureReceiptId,
          contentHash: `sha256:${"z".repeat(64)}`,
          planHash,
          reservations: [{ pointReservationId, status: "CAPTURED", vectorHash }],
          settlementId,
        },
        roundId: settlementRoundId,
      }),
    ).rejects.toThrow(/settlement_capture_receipts_content_hash_check/);
    await captureRepository.recordCaptureReceipt({
      now,
      receipt: {
        auctionId,
        capturedAt: now,
        captureReceiptId,
        contentHash: `sha256:${"5".repeat(64)}`,
        planHash,
        reservations: [{ pointReservationId, status: "CAPTURED", vectorHash }],
        settlementId,
      },
      roundId: settlementRoundId,
    });

    const input = { captureReceiptId, planHash, settlementId };
    const first = await finalizeSettlement({ db: env.DB, now: () => new Date(now) }, input);
    const replay = await finalizeSettlement({ db: env.DB, now: () => new Date(now) }, input);

    expect(replay).toEqual(first);
    expect(first.proofIds).toHaveLength(1);
    expect(
      await env.DB.prepare(
        `SELECT
          (SELECT COUNT(*) FROM settlement_allocations WHERE settlement_id = ?) AS allocations,
          (SELECT COUNT(*) FROM proofs WHERE settlement_id = ?) AS proofs,
          (SELECT COUNT(*) FROM settlement_finalize_receipts WHERE settlement_id = ?) AS receipts,
          (SELECT uniform_price_tick_count FROM settlement_allocations WHERE settlement_id = ?) AS tickCount`,
      )
        .bind(settlementId, settlementId, settlementId, settlementId)
        .first(),
    ).toMatchObject({ allocations: 1, proofs: 1, receipts: 1, tickCount: 0 });
    expect(
      await env.DB.prepare("SELECT saga_state FROM settlements WHERE id = ?")
        .bind(settlementId)
        .first<string>("saga_state"),
    ).toBe("SETTLED");

    const holdId = `hold_${suffix}`;
    const buySettlementId = `buy_settlement_${suffix}`;
    const buyRoundId = `buy_round_${suffix}`;
    const buyCaptureId = `buy_capture_${suffix}`;
    const buyAllocationId = `buy_allocation_${suffix}`;
    const buyProofId = `buy_proof_${suffix}`;
    const buyFinalizeId = `buy_finalize_${suffix}`;
    const buyProofHash = "4".repeat(64);
    const buyCaptureHash = `sha256:${"3".repeat(64)}`;
    const auctionVersion = await env.DB.prepare("SELECT version FROM auctions WHERE id = ?")
      .bind(auctionId)
      .first<number>("version");
    await env.DB.batch([
      env.DB.prepare("UPDATE auctions SET status = 'CLOSING' WHERE id = ?").bind(auctionId),
      env.DB.prepare(
        `INSERT INTO auction_close_cutoffs
         (auction_id, auction_revision_id, closed_auction_version, cutoff_at, max_bid_seq,
          eligible_bid_ids_json, ranking_input_hash, available_quantity,
          point_package_revision_id, package_tick, algorithm_version)
         VALUES (?, ?, ?, ?, 0, '[]', ?, 1, ?, 1, 'uniform-price-v1')`,
      ).bind(
        auctionId,
        revisionId,
        auctionVersion,
        now,
        "9".repeat(64),
        plan.pointPackageRevisionId,
      ),
      env.DB.prepare(
        `INSERT INTO buy_now_holds
         (id, auction_id, buyer_markets_user_id, quantity, buy_now_price_tick_count, status)
         VALUES (?, ?, ?, 1, 1, 'CAPTURED_PENDING_FINALIZE')`,
      ).bind(holdId, auctionId, buyerId),
      env.DB.prepare(
        `INSERT INTO settlements
         (id, auction_id, kind, source_key, saga_state, current_plan_id)
         VALUES (?, ?, 'BUY_NOW', ?, 'SETTLED', ?)`,
      ).bind(buySettlementId, auctionId, `buy:${holdId}`, `buy_plan_${suffix}`),
      env.DB.prepare(
        `INSERT INTO settlement_plans
         (id, settlement_id, settlement_revision, plan_json, plan_hash, algorithm_version)
         VALUES (?, ?, 1, ?, ?, 'uniform-price-v1')`,
      ).bind(
        `buy_plan_${suffix}`,
        buySettlementId,
        JSON.stringify({ ...plan, buyNowHoldId: holdId, kind: "BUY_NOW" }),
        planHash,
      ),
      env.DB.prepare(
        `INSERT INTO settlement_rounds
         (id, settlement_id, round_ordinal, plan_hash, cutoff_hash, state,
          first_attempt_at, retry_deadline_at)
         VALUES (?, ?, 1, ?, ?, 'RESERVED', ?, ?)`,
      ).bind(buyRoundId, buySettlementId, planHash, "2".repeat(64), now, now),
      env.DB.prepare(
        `INSERT INTO settlement_capture_receipts
         (capture_receipt_id, settlement_id, settlement_round_id, auction_id,
          plan_hash, captured_at, content_hash, reservations_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, '[]')`,
      ).bind(buyCaptureId, buySettlementId, buyRoundId, auctionId, planHash, now, buyCaptureHash),
      env.DB.prepare(
        `INSERT INTO settlement_allocations
         (id, settlement_id, settlement_round_id, allocation_ordinal, auction_id,
          buyer_markets_user_id, point_reservation_id, quantity,
          uniform_price_tick_count, price_ticks, vector_hash, settled_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, 1, 1, 1, ?, ?)`,
      ).bind(
        buyAllocationId,
        buySettlementId,
        buyRoundId,
        auctionId,
        buyerId,
        `buy_reservation_${suffix}`,
        vectorHash,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO proofs
         (id, allocation_id, settlement_id, auction_id, auction_revision_id,
          buyer_markets_user_id, point_package_revision_id, item_snapshot_json,
          seller_identity_snapshot_json, buyer_identity_snapshot_json,
          allocation_quantity, uniform_price_tick_count, price_ticks,
          component_vector_json, completion_status, settled_at, plan_hash, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, '{}', '{}', '{}', 1, 1, 1, ?,
          'SETTLED', ?, ?, ?)`,
      ).bind(
        buyProofId,
        buyAllocationId,
        buySettlementId,
        auctionId,
        revisionId,
        buyerId,
        plan.pointPackageRevisionId,
        componentVectorJson,
        now,
        planHash,
        buyProofHash,
      ),
      env.DB.prepare(
        `INSERT INTO settlement_finalize_receipts
         (id, settlement_id, capture_receipt_id, plan_hash, proof_ids_json,
          proof_set_hash, finalized_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        buyFinalizeId,
        buySettlementId,
        buyCaptureId,
        planHash,
        JSON.stringify([buyProofId]),
        "1".repeat(64),
        now,
      ),
    ]);
    const settleInput = {
      auctionId,
      captureContentHash: buyCaptureHash,
      captureReceiptId: buyCaptureId,
      expectedAuctionVersion: auctionVersion!,
      finalizeReceiptId: buyFinalizeId,
      holdId,
      proofContentHash: buyProofHash,
      proofId: buyProofId,
      serverNow: now,
      settlementId: buySettlementId,
    };
    const room = env.AUCTION_ROOMS.getByName(auctionId);
    const settledHold = await room.settleBuyNowHold(settleInput);
    expect(
      await room.settleBuyNowHold({
        ...settleInput,
        serverNow: "2026-07-14T01:00:01.000Z",
      }),
    ).toEqual(settledHold);
    expect(
      await env.DB.prepare("SELECT status FROM buy_now_holds WHERE id = ?")
        .bind(holdId)
        .first<string>("status"),
    ).toBe("SETTLED");
    expect(
      await env.DB.prepare(
        `SELECT
          (SELECT COUNT(*) FROM settlements
            WHERE auction_id = ? AND source_key = ?) AS settlements,
          (SELECT COUNT(*) FROM settlement_outbox o JOIN settlements s ON s.id = o.settlement_id
            WHERE s.auction_id = ? AND s.source_key = ?) AS outbox`,
      )
        .bind(auctionId, `end:${revisionId}:${now}`, auctionId, `end:${revisionId}:${now}`)
        .first(),
    ).toMatchObject({ outbox: 1, settlements: 1 });
  });
});
