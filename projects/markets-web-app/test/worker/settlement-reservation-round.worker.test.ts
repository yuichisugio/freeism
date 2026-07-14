import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vite-plus/test";

import { createMarketsAuth } from "../../src/backend/auth/create-auth";
import { closeAuctionAndPlan } from "../../src/backend/db/d1-settlement-plan-repository";
import {
  D1BuyNowRestorer,
  D1SettlementReservationRepository,
} from "../../src/backend/db/d1-settlement-repository";
import { PointsApiError } from "../../src/backend/points/points-api-client";
import { createBetterAuthPointsTokenStore } from "../../src/backend/points/points-token-store";
import { createSettlementPlan } from "../../src/backend/settlement/create-settlement-plan";
import { createSettlementReservationDependencies } from "../../src/backend/settlement/settlement-dependencies";
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

async function insertConnection(suffix: string, user: { authId: string; marketsUserId: string }) {
  const id = `pc_${user.marketsUserId}`;
  await env.DB.prepare(
    `INSERT INTO points_connection
     (id, markets_user_id, auth_user_id, status, link_attempt_id, attempt_payload_hash,
      points_issuer, points_subject, user_client_id, m2m_client_id, granted_scopes,
      session_id, expires_at)
     VALUES (?, ?, ?, 'ACTIVE', ?, ?, 'https://points.example.test/api/auth', ?,
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
  statusByKeys: (
    keys: readonly string[],
  ) => Promise<readonly ReservationStatusReceipt[]> = async () => [],
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

async function seedBuyNowSettlement(seeded: SeededSettlement) {
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
  return { buyerId, holdId, planned, settlementId };
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
    const reserveCount = points.reserve.mock.calls.length;
    await expect(
      reserveSettlementRound(deps, {
        planHash: seeded.planHash,
        roundOrdinal: 1,
        settlementId: seeded.settlementId,
        settlementRevision: 1,
      }),
    ).resolves.toEqual(first);
    expect(points.reserve).toHaveBeenCalledTimes(reserveCount);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM settlement_rounds WHERE settlement_id = ?",
      )
        .bind(seeded.settlementId)
        .first<number>("count"),
    ).toBe(2);

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
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM auction_blacklist_events WHERE auction_id = ?",
      )
        .bind(seeded.auctionId)
        .first<number>("count"),
    ).toBe(1);
  });

  it("excludes an END winner that requires reauthentication without blacklisting", async () => {
    const seeded = await seedEndSettlement();
    const reauthUserId = seeded.buyerIds[0];
    await env.DB.prepare("DELETE FROM points_connection WHERE markets_user_id = ?")
      .bind(reauthUserId)
      .run();
    const points = gateway(async (input) => ({
      expiresAt: new Date(Date.parse(seeded.now) + 15 * 60_000).toISOString(),
      pointReservationId: `pres_${input.marketsUserId}`,
      vectorHash: "a".repeat(64),
    }));
    const result = await reserveSettlementRound(dependencies(points, restorer(), seeded.now), {
      planHash: seeded.planHash,
      roundOrdinal: 1,
      settlementId: seeded.settlementId,
      settlementRevision: 1,
    });
    expect(result).toEqual({
      excludedUserIds: [reauthUserId],
      kind: "RECALCULATE",
      nextRoundOrdinal: 2,
    });
    expect(points.reserve).toHaveBeenCalledTimes(1);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM auction_blacklist_events WHERE auction_id = ?",
      )
        .bind(seeded.auctionId)
        .first<number>("count"),
    ).toBe(0);
    expect(
      await env.DB.prepare(
        "SELECT reason FROM settlement_exclusions WHERE settlement_id = ? AND markets_user_id = ?",
      )
        .bind(seeded.settlementId, reauthUserId)
        .first<string>("reason"),
    ).toBe("REAUTH_REQUIRED");
  });

  it("resumes after releases were recorded without reserving terminal winners again", async () => {
    const seeded = await seedEndSettlement();
    const insufficient = seeded.buyerIds[0];
    const points = gateway(async (input) => {
      if (input.marketsUserId === insufficient) {
        throw new PointsApiError(422, "INSUFFICIENT_BALANCE");
      }
      return {
        expiresAt: new Date(Date.parse(seeded.now) + 15 * 60_000).toISOString(),
        pointReservationId: `pres_${input.marketsUserId}`,
        vectorHash: "8".repeat(64),
      };
    });
    const repository = new D1SettlementReservationRepository(env.DB);
    const complete = repository.completeReleaseAndExclude.bind(repository);
    vi.spyOn(repository, "completeReleaseAndExclude")
      .mockRejectedValueOnce(new Error("TEST_AFTER_RELEASE_CRASH"))
      .mockImplementation(complete);
    const deps = {
      buyNowRestorer: restorer(),
      gateway: points,
      now: () => new Date(seeded.now),
      repository,
    };
    const input = {
      planHash: seeded.planHash,
      roundOrdinal: 1,
      settlementId: seeded.settlementId,
      settlementRevision: 1,
    };
    await expect(reserveSettlementRound(deps, input)).rejects.toThrow("TEST_AFTER_RELEASE_CRASH");
    const reserveCount = points.reserve.mock.calls.length;
    const releaseCount = points.release.mock.calls.length;
    await expect(reserveSettlementRound(deps, input)).resolves.toMatchObject({
      kind: "RECALCULATE",
      nextRoundOrdinal: 2,
    });
    expect(points.reserve).toHaveBeenCalledTimes(reserveCount);
    expect(points.release).toHaveBeenCalledTimes(releaseCount);
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
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM settlement_exclusions WHERE settlement_id = ?",
      )
        .bind(seeded.settlementId)
        .first<number>("count"),
    ).toBe(0);
  });

  it("refreshes an expired user token once before reserving with the same key", async () => {
    const seeded = await seedEndSettlement();
    const marketsUserId = seeded.buyerIds[0];
    const connectionId = `pc_${marketsUserId}`;
    const accountId = `points_${crypto.randomUUID()}`;
    const authUserId = await env.DB.prepare("SELECT auth_user_id FROM markets_user WHERE id = ?")
      .bind(marketsUserId)
      .first<string>("auth_user_id");
    if (!authUserId) throw new Error("TEST_AUTH_USER_NOT_FOUND");
    const authEnv = {
      ...env,
      APP_ORIGIN: "https://markets.example.test",
      BETTER_AUTH_SECRETS: "2:test-current-secret-at-least-32-characters",
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
    };
    const tokenStore = createBetterAuthPointsTokenStore(createMarketsAuth(authEnv));
    await tokenStore.save({
      accessToken: "expired-access-token",
      accessTokenExpiresAt: new Date(Date.now() - 60_000),
      accountId,
      authUserId,
      refreshToken: "current-refresh-token",
      scopes: ["offline_access", "points.reservations.create"],
    });
    await env.DB.prepare(
      `UPDATE points_connection SET better_auth_account_id = ?, token_version = 0
       WHERE id = ?`,
    )
      .bind(accountId, connectionId)
      .run();

    const introspectedTokens: string[] = [];
    let reservationKey = "";
    const service = {
      fetch: vi.fn(async (request: Request) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith("/oauth2/introspect")) {
          const token = (await request.formData()).get("token")?.toString() ?? "";
          introspectedTokens.push(token);
          if (token === "expired-access-token" || token === "expired-revoked-access-token") {
            return Response.json({ active: false });
          }
          return Response.json({
            active: true,
            aud: "https://points.example.test/api",
            client_id: "markets-user-client",
            exp: Math.floor(Date.now() / 1000) + 3_600,
            iss: "https://points.example.test/api/auth",
            scope: "offline_access points.reservations.create",
            sub: `subject_${marketsUserId}`,
          });
        }
        if (url.pathname.endsWith("/oauth2/token")) {
          const body = await request.formData();
          expect(body.get("grant_type")).toBe("refresh_token");
          if (body.get("refresh_token") === "revoked-refresh-token") {
            return Response.json({ error: "invalid_grant" }, { status: 400 });
          }
          expect(body.get("refresh_token")).toBe("current-refresh-token");
          return Response.json({
            access_token: "refreshed-access-token",
            expires_in: 3_600,
            refresh_token: "rotated-refresh-token",
            scope: "offline_access points.reservations.create",
            token_type: "Bearer",
          });
        }
        if (url.pathname === "/api/v1/me/point-reservations") {
          expect(request.headers.get("Authorization")).toBe("Bearer refreshed-access-token");
          const body = (await request.json()) as { planHash: string; reservationKey: string };
          reservationKey = body.reservationKey;
          return Response.json({
            data: {
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
              planHash: body.planHash,
              pointReservationId: "pres_refreshed",
              reservationKey: body.reservationKey,
              status: "ACTIVE",
              vectorHash: "7".repeat(64),
            },
            meta: { requestId: "req_refreshed" },
          });
        }
        return new Response(null, { status: 404 });
      }),
    } satisfies Fetcher;
    const deps = createSettlementReservationDependencies({
      ...authEnv,
      POINTS_AUDIENCE: "https://points.example.test/api",
      POINTS_ISSUER: "https://points.example.test/api/auth",
      POINTS_M2M_CLIENT_ID: "markets-m2m-client",
      POINTS_M2M_CLIENT_SECRET: "markets-m2m-secret",
      POINTS_SERVICE: service,
      POINTS_SETTLEMENT_CLIENT_ID: "markets-settlement-client",
      POINTS_SETTLEMENT_CLIENT_SECRET: "markets-settlement-secret",
      POINTS_USER_CLIENT_ID: "markets-user-client",
      POINTS_USER_CLIENT_SECRET: "markets-user-secret",
    });
    const receipt = await deps.gateway.reserve({
      allocationQuantity: 1,
      auctionId: seeded.auctionId,
      leaseSeconds: 900,
      marketsUserId,
      planHash: seeded.planHash,
      pointPackageRevisionId: `ppr_${seeded.auctionId.slice(4)}`,
      pointsConnectionId: connectionId,
      priceTicks: 25,
      reservationKey: `${seeded.settlementId}:${marketsUserId}:revision_1`,
      settlementId: seeded.settlementId,
    });
    expect(receipt.pointReservationId).toBe("pres_refreshed");
    expect(introspectedTokens).toEqual([
      "expired-access-token",
      "refreshed-access-token",
      "refreshed-access-token",
    ]);
    expect(reservationKey).toBe(`${seeded.settlementId}:${marketsUserId}:revision_1`);
    expect(
      await env.DB.prepare("SELECT token_version FROM points_connection WHERE id = ?")
        .bind(connectionId)
        .first<number>("token_version"),
    ).toBe(1);
    const stored = await env.DB.prepare(
      "SELECT access_token AS accessToken, refresh_token AS refreshToken FROM account WHERE account_id = ? AND provider_id = 'points'",
    )
      .bind(accountId)
      .first<{ accessToken: string; refreshToken: string }>();
    expect(stored?.accessToken).not.toContain("refreshed-access-token");
    expect(stored?.refreshToken).not.toContain("rotated-refresh-token");

    await tokenStore.save({
      accessToken: "expired-revoked-access-token",
      accessTokenExpiresAt: new Date(Date.now() - 60_000),
      accountId,
      authUserId,
      refreshToken: "revoked-refresh-token",
      scopes: ["offline_access", "points.reservations.create"],
    });
    await expect(
      deps.gateway.reserve({
        allocationQuantity: 1,
        auctionId: seeded.auctionId,
        leaseSeconds: 900,
        marketsUserId,
        planHash: seeded.planHash,
        pointPackageRevisionId: `ppr_${seeded.auctionId.slice(4)}`,
        pointsConnectionId: connectionId,
        priceTicks: 25,
        reservationKey: `${seeded.settlementId}:${marketsUserId}:revision_2`,
        settlementId: seeded.settlementId,
      }),
    ).rejects.toThrow("REAUTH_REQUIRED");
  });

  it("restores a rejected BUY_NOW hold without selecting another buyer", async () => {
    const seeded = await seedEndSettlement();
    const { holdId, planned, settlementId } = await seedBuyNowSettlement(seeded);
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
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM auction_blacklist_events WHERE auction_id = ?",
      )
        .bind(seeded.auctionId)
        .first<number>("count"),
    ).toBe(0);
  });

  it("keeps BUY_NOW in manual action when a response mismatch may have issued an ID", async () => {
    const seeded = await seedEndSettlement();
    const { planned, settlementId } = await seedBuyNowSettlement(seeded);
    const points = gateway(
      async () => {
        throw new Error("POINTS_RESERVATION_RESPONSE_MISMATCH");
      },
      async (keys) =>
        keys.map((reservationKey) => ({
          expiresAt: new Date(Date.parse(seeded.now) + 15 * 60_000).toISOString(),
          pointReservationId: `pres_unknown_${reservationKey}`,
          reservationKey,
          status: "ACTIVE" as const,
          vectorHash: "9".repeat(64),
        })),
    );
    const restore = restorer();
    const result = await reserveSettlementRound(dependencies(points, restore, seeded.now), {
      planHash: planned.planHash,
      roundOrdinal: 1,
      settlementId,
      settlementRevision: 1,
    });
    expect(result).toEqual({ kind: "MANUAL_ACTION", reason: "BUY_NOW_RESERVATION_UNKNOWN" });
    expect(points.statusByKeys).toHaveBeenCalledTimes(2);
    expect(points.release).toHaveBeenCalledTimes(1);
    expect(restore.restoreBuyNowHold).not.toHaveBeenCalled();
  });

  it("releases a discovered ACTIVE BUY_NOW reservation before atomic restore", async () => {
    const seeded = await seedEndSettlement();
    const { holdId, planned, settlementId } = await seedBuyNowSettlement(seeded);
    const reservationKey = `${settlementId}:${seeded.buyerIds[0]}:revision_1`;
    let statusCall = 0;
    const points = gateway(
      async () => {
        throw new Error("POINTS_RESERVATION_RESPONSE_MISMATCH");
      },
      async () => {
        statusCall += 1;
        if (statusCall === 1) {
          return [
            {
              expiresAt: new Date(Date.parse(seeded.now) + 15 * 60_000).toISOString(),
              pointReservationId: "pres_discovered",
              reservationKey,
              status: "ACTIVE" as const,
              vectorHash: "6".repeat(64),
            },
          ];
        }
        return [
          {
            pointReservationId: "pres_discovered",
            reservationKey,
            status: "RELEASED" as const,
            terminalReceiptId: "release_pres_discovered",
          },
        ];
      },
    );
    const restore = new D1BuyNowRestorer(env.DB, env.AUCTION_SETTLEMENT);
    const crashBeforeCommit: BuyNowRestorer = {
      async restoreBuyNowHold() {
        throw new Error("TEST_BEFORE_BUY_NOW_RESTORE_COMMIT");
      },
    };
    let committedReceiptId = "";
    const crashAfterCommit: BuyNowRestorer = {
      async restoreBuyNowHold(input) {
        const receipt = await restore.restoreBuyNowHold(input);
        committedReceiptId = receipt.receiptId;
        throw new Error("TEST_AFTER_BUY_NOW_RESTORE_COMMIT");
      },
    };
    const input = {
      planHash: planned.planHash,
      roundOrdinal: 1,
      settlementId,
      settlementRevision: 1,
    };
    await expect(
      reserveSettlementRound(dependencies(points, crashBeforeCommit, seeded.now), input),
    ).rejects.toThrow("TEST_BEFORE_BUY_NOW_RESTORE_COMMIT");
    expect(
      await env.DB.prepare("SELECT status FROM buy_now_holds WHERE id = ?")
        .bind(holdId)
        .first<string>("status"),
    ).toBe("PENDING");
    const reserveCalls = points.reserve.mock.calls.length;
    const releaseCalls = points.release.mock.calls.length;
    const statusCalls = points.statusByKeys.mock.calls.length;
    await expect(
      reserveSettlementRound(dependencies(points, crashAfterCommit, seeded.now), input),
    ).rejects.toThrow("TEST_AFTER_BUY_NOW_RESTORE_COMMIT");
    expect(committedReceiptId).not.toBe("");
    expect(
      await env.DB.prepare("SELECT status FROM buy_now_holds WHERE id = ?")
        .bind(holdId)
        .first<string>("status"),
    ).toBe("FAILED_RESTORED");
    expect(points.reserve).toHaveBeenCalledTimes(reserveCalls);
    expect(points.release).toHaveBeenCalledTimes(releaseCalls);
    expect(points.statusByKeys).toHaveBeenCalledTimes(statusCalls);
    await expect(
      reserveSettlementRound(dependencies(points, restore, seeded.now), input),
    ).resolves.toEqual({ kind: "BUY_NOW_RESTORED", receiptId: committedReceiptId });
    expect(points.reserve).toHaveBeenCalledTimes(reserveCalls);
    expect(points.release).toHaveBeenCalledTimes(releaseCalls);
    expect(points.statusByKeys).toHaveBeenCalledTimes(statusCalls);
    expect(points.release).toHaveBeenCalledTimes(1);
    const failureHash = await env.DB.prepare(
      "SELECT failure_hash FROM settlement_round_winners WHERE settlement_round_id = ?",
    )
      .bind(`sround_${settlementId}_1`)
      .first<string>("failure_hash");
    if (!failureHash) throw new Error("TEST_FAILURE_HASH_NOT_FOUND");
    await expect(
      restore.restoreBuyNowHold({
        evidenceType: "ALL_RESERVATIONS_NON_CAPTURABLE",
        failureHash: "0".repeat(64),
        holdId,
        settlementId,
      }),
    ).rejects.toThrow("BUY_NOW_RESTORE_EVIDENCE_REQUIRED");
    await expect(
      restore.restoreBuyNowHold({
        evidenceType: "RESERVATION_REJECTED",
        failureHash,
        holdId,
        settlementId,
      }),
    ).rejects.toThrow("BUY_NOW_RESTORE_EVIDENCE_REQUIRED");
    expect(
      await env.DB.prepare(
        `SELECT status, point_reservation_id AS pointReservationId,
                release_receipt_id AS releaseReceiptId, failure_code AS failureCode
         FROM settlement_round_winners WHERE settlement_round_id = ?`,
      )
        .bind(`sround_${settlementId}_1`)
        .first(),
    ).toMatchObject({
      failureCode: "ALL_RESERVATIONS_NON_CAPTURABLE",
      pointReservationId: "pres_discovered",
      releaseReceiptId: "release_pres_discovered",
      status: "RELEASED",
    });
  });

  it("keeps BUY_NOW pending when a discovered reservation is CAPTURED", async () => {
    const seeded = await seedEndSettlement();
    const { holdId, planned, settlementId } = await seedBuyNowSettlement(seeded);
    const points = gateway(
      async () => {
        throw new Error("POINTS_RESERVATION_RESPONSE_MISMATCH");
      },
      async () => [
        {
          pointReservationId: "pres_captured",
          reservationKey: `${settlementId}:${seeded.buyerIds[0]}:revision_1`,
          status: "CAPTURED" as const,
        },
      ],
    );
    const restore = restorer();
    await expect(
      reserveSettlementRound(dependencies(points, restore, seeded.now), {
        planHash: planned.planHash,
        roundOrdinal: 1,
        settlementId,
        settlementRevision: 1,
      }),
    ).resolves.toEqual({ kind: "MANUAL_ACTION", reason: "BUY_NOW_RESERVATION_UNKNOWN" });
    expect(points.release).not.toHaveBeenCalled();
    expect(restore.restoreBuyNowHold).not.toHaveBeenCalled();
    expect(
      await env.DB.prepare("SELECT status FROM buy_now_holds WHERE id = ?")
        .bind(holdId)
        .first<string>("status"),
    ).toBe("PENDING");
  });

  it("atomically persists BUY_NOW restore intent and dispatches the delayed END outbox", async () => {
    const seeded = await seedEndSettlement();
    const { holdId, planned, settlementId } = await seedBuyNowSettlement(seeded);
    const points = gateway(async () => {
      throw new PointsApiError(422, "INSUFFICIENT_BALANCE");
    });
    const repository = new D1SettlementReservationRepository(env.DB);
    const buyNowRestorer = new D1BuyNowRestorer(env.DB, env.AUCTION_SETTLEMENT);
    await expect(
      buyNowRestorer.restoreBuyNowHold({
        evidenceType: "RESERVATION_REJECTED",
        failureHash: "0".repeat(64),
        holdId,
        settlementId,
      }),
    ).rejects.toThrow("BUY_NOW_RESTORE_EVIDENCE_REQUIRED");
    const deps = {
      buyNowRestorer,
      gateway: points,
      now: () => new Date(seeded.now),
      repository,
    };
    await env.DB.exec(
      "CREATE TRIGGER test_fail_close_resume_outbox BEFORE INSERT ON auction_close_resume_outbox BEGIN SELECT RAISE(ABORT, 'TEST_CLOSE_RESUME_OUTBOX_FAILURE'); END;",
    );
    await expect(
      reserveSettlementRound(deps, {
        planHash: planned.planHash,
        roundOrdinal: 1,
        settlementId,
        settlementRevision: 1,
      }),
    ).rejects.toThrow();
    expect(
      await env.DB.prepare("SELECT status FROM buy_now_holds WHERE id = ?")
        .bind(holdId)
        .first<string>("status"),
    ).toBe("PENDING");
    await env.DB.exec("DROP TRIGGER test_fail_close_resume_outbox;");

    await expect(
      reserveSettlementRound(deps, {
        planHash: planned.planHash,
        roundOrdinal: 1,
        settlementId,
        settlementRevision: 1,
      }),
    ).resolves.toMatchObject({ kind: "BUY_NOW_RESTORED" });
    expect(
      await env.DB.prepare(
        "SELECT status FROM auction_close_resume_outbox WHERE buy_now_hold_id = ?",
      )
        .bind(holdId)
        .first<string>("status"),
    ).toBe("DISPATCHED");
    expect(
      await env.DB.prepare(
        `SELECT status FROM settlement_outbox o JOIN settlements s ON s.id = o.settlement_id
         WHERE s.auction_id = ? AND s.kind = 'END_OF_AUCTION'`,
      )
        .bind(seeded.auctionId)
        .first<string>("status"),
    ).toBe("DISPATCHED");
  });
});
