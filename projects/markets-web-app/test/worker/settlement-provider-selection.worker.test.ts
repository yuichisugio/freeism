import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vite-plus/test";

import { D1SettlementReservationRepository } from "../../src/backend/db/d1-settlement-repository";
import type { Bindings } from "../../src/backend/http/context";
import { createSettlementPlan } from "../../src/backend/settlement/create-settlement-plan";
import { releaseUnusedReservations } from "../../src/backend/settlement/release-unused-reservations";
import { openSettlementProvider } from "../../src/backend/settlement/settlement-provider";
import { seedPointsProvider } from "../fixtures/points-provider";

describe("settlement provider selection", () => {
  it("selects the buyer connection only from the auction provider", async () => {
    const suffix = crypto.randomUUID();
    const providerA = await seedPointsProvider(env.DB, {
      id: `provider_a_${suffix}`,
      origin: `https://${suffix}.points-a.example.test`,
    });
    const providerB = await seedPointsProvider(env.DB, {
      id: `provider_b_${suffix}`,
      origin: `https://${suffix}.points-b.example.test`,
    });
    const authUserId = `auth_${suffix}`;
    const marketsUserId = `musr_${suffix}`;
    const auctionId = `auc_${suffix}`;
    const settlementId = `stl_${suffix}`;
    const planId = `spl_${suffix}`;
    const holdId = `hold_${suffix}`;
    const connectionA = `conn_a_${suffix}`;
    const connectionB = `conn_b_${suffix}`;
    const planned = await createSettlementPlan({
      algorithmVersion: "uniform-price-v1",
      auctionId,
      auctionRevisionId: `rev_${suffix}`,
      availableQuantityBeforeHold: 1,
      buyerMarketsUserId: marketsUserId,
      buyNowHoldId: holdId,
      kind: "BUY_NOW",
      packageTick: 1,
      pointPackageRevisionId: `package_rev_${suffix}`,
      priceTickCount: 1,
      providerId: providerA,
      quantity: 1,
    });
    await env.DB.batch([
      env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Buyer', ?)").bind(
        authUserId,
        `${suffix}@example.test`,
      ),
      env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
        marketsUserId,
        authUserId,
      ),
      env.DB.prepare(
        "INSERT INTO auctions (id, provider_id, seller_markets_user_id, status, version) VALUES (?, ?, ?, 'CLOSING', 1)",
      ).bind(auctionId, providerA, marketsUserId),
      env.DB.prepare(
        `INSERT INTO buy_now_holds
         (id, auction_id, buyer_markets_user_id, quantity, buy_now_price_tick_count, status)
         VALUES (?, ?, ?, 1, 1, 'PENDING')`,
      ).bind(holdId, auctionId, marketsUserId),
      env.DB.prepare(
        `INSERT INTO settlements
         (id, auction_id, kind, source_key, saga_state, current_plan_id)
         VALUES (?, ?, 'BUY_NOW', ?, 'PLANNED', ?)`,
      ).bind(settlementId, auctionId, `buy:${holdId}`, planId),
      env.DB.prepare(
        `INSERT INTO settlement_plans
         (id, settlement_id, settlement_revision, plan_json, plan_hash, algorithm_version)
         VALUES (?, ?, 1, ?, ?, 'uniform-price-v1')`,
      ).bind(planId, settlementId, planned.planJson, planned.planHash),
      ...[
        { id: connectionB, providerId: providerB, status: "ACTIVE" },
        { id: connectionA, providerId: providerA, status: "REAUTH_REQUIRED" },
      ].map((connection) =>
        env.DB.prepare(
          `INSERT INTO points_connection
           (id, provider_id, markets_user_id, auth_user_id, status, link_attempt_id,
            attempt_payload_hash, points_issuer, points_subject, user_client_id,
            m2m_client_id, granted_scopes, session_id, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'markets-client', 'markets-client',
                   'points.reservations.create', ?, ?)`,
        ).bind(
          connection.id,
          connection.providerId,
          marketsUserId,
          authUserId,
          connection.status,
          `link_${connection.id}`,
          "a".repeat(64),
          "https://points.example.test/api/auth",
          `subject_${connection.id}`,
          `session_${connection.id}`,
          Date.now() + 60_000,
        ),
      ),
    ]);

    const loaded = await new D1SettlementReservationRepository(env.DB).loadPlan(
      settlementId,
      1,
      planned.planHash,
    );
    expect(loaded.connectionByUser).toEqual({ [marketsUserId]: connectionA });
    expect(loaded.reauthRequiredUserIds).toEqual([marketsUserId]);
    await env.DB.prepare("UPDATE points_provider SET status = 'STOPPED' WHERE id = ?")
      .bind(providerA)
      .run();
    const openProvider = vi.fn(
      async () => ({}) as Awaited<ReturnType<typeof openSettlementProvider>>,
    );
    await openSettlementProvider(env as Bindings, settlementId, openProvider);
    expect(openProvider).toHaveBeenCalledWith(env, providerA, { allowStopped: true });
  });

  it("releases only the local winner when providers return the same reservation ID", async () => {
    const suffix = crypto.randomUUID();
    const providers = await Promise.all([
      seedPointsProvider(env.DB, {
        id: `provider_a_${suffix}`,
        origin: `https://${suffix}.points-a.example.test`,
      }),
      seedPointsProvider(env.DB, {
        id: `provider_b_${suffix}`,
        origin: `https://${suffix}.points-b.example.test`,
      }),
    ]);
    const userId = `musr_${suffix}`;
    const authId = `auth_${suffix}`;
    const planHash = `sha256:${"a".repeat(64)}`;
    const reservationId = `shared_${suffix}`;
    const now = "2030-01-01T00:00:00.000Z";
    await env.DB.batch([
      env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Buyer', ?)").bind(
        authId,
        `${suffix}@example.test`,
      ),
      env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
        userId,
        authId,
      ),
      ...providers.flatMap((providerId, index) => {
        const auctionId = `auc_${index}_${suffix}`;
        const settlementId = `stl_${index}_${suffix}`;
        const roundId = `round_${index}_${suffix}`;
        return [
          env.DB.prepare(
            "INSERT INTO auctions (id, provider_id, seller_markets_user_id, status, version) VALUES (?, ?, ?, 'CLOSING', 1)",
          ).bind(auctionId, providerId, userId),
          env.DB.prepare(
            `INSERT INTO settlements
             (id, auction_id, kind, source_key, saga_state, current_plan_id)
             VALUES (?, ?, 'END_OF_AUCTION', ?, 'CAPTURED', ?)`,
          ).bind(settlementId, auctionId, `source_${index}`, `plan_${index}_${suffix}`),
          env.DB.prepare(
            `INSERT INTO settlement_rounds
             (id, settlement_id, round_ordinal, plan_hash, cutoff_hash, state,
              first_attempt_at, retry_deadline_at)
             VALUES (?, ?, 1, ?, ?, 'RESERVED', ?, ?)`,
          ).bind(roundId, settlementId, planHash, "b".repeat(64), now, now),
          env.DB.prepare(
            `INSERT INTO settlement_round_winners
             (id, settlement_round_id, markets_user_id, allocation_quantity,
              price_tick_count, price_ticks, reservation_key, status, point_reservation_id)
             VALUES (?, ?, ?, 1, 1, 1, ?, 'ACTIVE', ?)`,
          ).bind(
            `winner_${index}_${suffix}`,
            roundId,
            userId,
            `key_${index}_${suffix}`,
            reservationId,
          ),
        ];
      }),
      env.DB.prepare(
        `INSERT INTO settlement_capture_receipts
         (capture_receipt_id, settlement_id, settlement_round_id, auction_id,
          plan_hash, captured_at, content_hash, reservations_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, '[]')`,
      ).bind(
        `capture_${suffix}`,
        `stl_0_${suffix}`,
        `round_0_${suffix}`,
        `auc_0_${suffix}`,
        planHash,
        now,
        `sha256:${"c".repeat(64)}`,
      ),
      env.DB.prepare(
        `INSERT INTO settlement_capture_receipts
         (capture_receipt_id, settlement_id, settlement_round_id, auction_id,
          plan_hash, captured_at, content_hash, reservations_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, '[]')`,
      ).bind(
        `capture_${suffix}`,
        `stl_1_${suffix}`,
        `round_1_${suffix}`,
        `auc_1_${suffix}`,
        planHash,
        now,
        `sha256:${"d".repeat(64)}`,
      ),
    ]);
    expect(
      await env.DB.prepare(
        "SELECT count(*) AS count FROM settlement_capture_receipts WHERE capture_receipt_id = ?",
      )
        .bind(`capture_${suffix}`)
        .first<number>("count"),
    ).toBe(2);
    const releaseCalls: string[] = [];
    await releaseUnusedReservations(
      {
        db: env.DB,
        gateway: {
          async capture() {
            throw new Error("UNUSED");
          },
          async release(input) {
            releaseCalls.push(input.reservationKey);
            return {
              contentHash: `sha256:${"d".repeat(64)}`,
              receiptId: `release_${suffix}`,
              releasedAt: now,
            };
          },
          async statusByIds() {
            return [{ pointReservationId: reservationId, status: "ACTIVE" as const }];
          },
        },
        now: () => new Date(now),
      },
      { captureReceiptId: `capture_${suffix}`, planHash, settlementId: `stl_0_${suffix}` },
    );
    expect(releaseCalls).toEqual([`key_0_${suffix}`]);
    const rows = await env.DB.prepare(
      "SELECT reservation_key AS reservationKey, status FROM settlement_round_winners WHERE point_reservation_id = ? ORDER BY reservation_key",
    )
      .bind(reservationId)
      .all<{ reservationKey: string; status: string }>();
    expect(rows.results).toEqual([
      { reservationKey: `key_0_${suffix}`, status: "RELEASED" },
      { reservationKey: `key_1_${suffix}`, status: "ACTIVE" },
    ]);

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO auctions (id, provider_id, seller_markets_user_id, status, version) VALUES (?, ?, ?, 'CLOSING', 1)",
      ).bind(`auc_2_${suffix}`, providers[0], userId),
      env.DB.prepare(
        `INSERT INTO settlements
         (id, auction_id, kind, source_key, saga_state, current_plan_id)
         VALUES (?, ?, 'END_OF_AUCTION', 'source_2', 'CAPTURED', ?)`,
      ).bind(`stl_2_${suffix}`, `auc_2_${suffix}`, `plan_2_${suffix}`),
    ]);
    await expect(
      env.DB.prepare(
        `INSERT INTO settlement_finalize_receipts
         (id, settlement_id, capture_receipt_id, plan_hash, proof_ids_json,
          proof_set_hash, finalized_at)
         VALUES (?, ?, ?, ?, '[]', ?, ?)`,
      )
        .bind(
          `finalize_2_${suffix}`,
          `stl_2_${suffix}`,
          `capture_${suffix}`,
          planHash,
          "e".repeat(64),
          now,
        )
        .run(),
    ).rejects.toThrow();
  });
});
