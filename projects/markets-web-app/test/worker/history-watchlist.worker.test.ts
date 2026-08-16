import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createMarketsBackendApp } from "../../src/backend/app";

const origin = "https://markets.example.test";

async function seedUserAndAuction(
  label: string,
  options: {
    endsAt?: string;
    startsAt?: string;
    status?: "CANCELLED" | "DRAFT" | "SCHEDULED" | "OPEN" | "SETTLED";
  } = {},
) {
  const suffix = crypto.randomUUID();
  const authUserId = `auth_${label}_${suffix}`;
  const marketsUserId = `musr_${label}_${suffix}`;
  const auctionId = `auction_${label}_${suffix}`;
  const revisionId = `auction_revision_${label}_${suffix}`;
  const packageSnapshotId = `package_snapshot_${label}_${suffix}`;
  const startsAt = options.startsAt ?? "2026-07-15T00:00:00.000Z";
  const endsAt = options.endsAt ?? "2026-07-16T00:00:00.000Z";
  const pointPackageId = `package_${suffix}`;
  const pointPackageRevisionId = `package_revision_${suffix}`;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)").bind(
      authUserId,
      `${label} user`,
      `${authUserId}@example.test`,
    ),
    env.DB.prepare(
      "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (?, ?, 'google', ?, 1)",
    ).bind(`account_${suffix}`, `google_${suffix}`, authUserId),
    env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
      marketsUserId,
      authUserId,
    ),
    env.DB.prepare(
      `INSERT INTO point_package_snapshots
       (id, point_package_id, point_package_revision_id, name, total_weight)
       VALUES (?, ?, ?, ?, 1)`,
    ).bind(packageSnapshotId, pointPackageId, pointPackageRevisionId, `${label} package`),
    env.DB.prepare(
      `INSERT INTO auctions (id, seller_markets_user_id, status, version)
       VALUES (?, ?, ?, 1)`,
    ).bind(auctionId, marketsUserId, options.status ?? "SCHEDULED"),
    env.DB.prepare(
      `INSERT INTO auction_revisions
       (id, auction_id, revision_number, title, description, external_url,
        seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity,
        starts_at, ends_at, package_tick, eligibility_receipt_id, auction_command_id,
        auction_command_hash, package_eligibility_version, eligibility_checked_at,
        eligibility_valid_until, commit_started_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, 'points.freeism.app', ?, 2, ?, ?, 10000, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(
      revisionId,
      auctionId,
      `${label} title`,
      `${label} description`,
      `https://example.test/${label}`,
      JSON.stringify({ displayName: `${label} seller`, marketsUserId }),
      packageSnapshotId,
      startsAt,
      endsAt,
      `eligibility_${suffix}`,
      `command_${suffix}`,
      "a".repeat(64),
      startsAt,
      endsAt,
      startsAt,
    ),
    env.DB.prepare("UPDATE auctions SET current_revision_id = ? WHERE id = ?").bind(
      revisionId,
      auctionId,
    ),
  ]);
  return {
    auctionId,
    authUserId,
    endsAt,
    marketsUserId,
    pointPackageId,
    pointPackageRevisionId,
    startsAt,
  };
}

function appFor(authUserId: string | null) {
  return createMarketsBackendApp(async () =>
    authUserId
      ? {
          session: { id: `session_${authUserId}`, userId: authUserId },
          user: { id: authUserId },
        }
      : null,
  );
}

function mutationRequest(path: string, method: "DELETE" | "PUT") {
  return new Request(`${origin}${path}`, {
    headers: { Origin: origin, "Sec-Fetch-Site": "same-origin" },
    method,
  });
}

describe("watchlist", () => {
  it("adds the same auction idempotently without creating notification state", async () => {
    const seeded = await seedUserAndAuction("watch_add");
    const app = appFor(seeded.authUserId);

    const first = await app.fetch(
      mutationRequest(`/api/watchlist/${seeded.auctionId}`, "PUT"),
      env,
    );
    const replay = await app.fetch(
      mutationRequest(`/api/watchlist/${seeded.auctionId}`, "PUT"),
      env,
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(first.headers.get("Cache-Control")).toBe("private, no-store");
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM watchlist_entries WHERE markets_user_id = ? AND auction_id = ?",
      )
        .bind(seeded.marketsUserId, seeded.auctionId)
        .first<number>("count"),
    ).toBe(1);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND lower(name) LIKE '%notification%'",
      ).first<number>("count"),
    ).toBe(0);
  });

  it("removes a watchlist entry idempotently", async () => {
    const seeded = await seedUserAndAuction("watch_remove");
    const app = appFor(seeded.authUserId);
    await app.fetch(mutationRequest(`/api/watchlist/${seeded.auctionId}`, "PUT"), env);

    const first = await app.fetch(
      mutationRequest(`/api/watchlist/${seeded.auctionId}`, "DELETE"),
      env,
    );
    const replay = await app.fetch(
      mutationRequest(`/api/watchlist/${seeded.auctionId}`, "DELETE"),
      env,
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM watchlist_entries WHERE markets_user_id = ? AND auction_id = ?",
      )
        .bind(seeded.marketsUserId, seeded.auctionId)
        .first<number>("count"),
    ).toBe(0);
  });

  it("lists only the authenticated user's entries with a cursor envelope", async () => {
    const first = await seedUserAndAuction("watch_list_first");
    const second = await seedUserAndAuction("watch_list_second");
    const app = appFor(first.authUserId);
    await app.fetch(mutationRequest(`/api/watchlist/${first.auctionId}`, "PUT"), env);

    const response = await app.fetch(new Request(`${origin}/api/watchlist?limit=10`), env);
    const body = (await response.json()) as {
      data: Array<{ auctionId: string }>;
      meta: { cursor: string | null; hasMore: boolean; requestId: string };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body.data.map((entry) => entry.auctionId)).toEqual([first.auctionId]);
    expect(body.data.map((entry) => entry.auctionId)).not.toContain(second.auctionId);
    expect(body.meta).toMatchObject({ cursor: null, hasMore: false });
    expect(body.meta.requestId).toMatch(/^req_/u);
  });
});

describe("public auction read", () => {
  it("lists public auction cards with cursor pagination and supported search fields", async () => {
    const first = await seedUserAndAuction("search_alpha");
    const second = await seedUserAndAuction("search_beta");
    await seedUserAndAuction("search_hidden", { status: "DRAFT" });
    const app = appFor(null);

    for (const query of [
      "search_alpha title",
      "search_alpha description",
      first.auctionId,
      first.pointPackageId,
      "search_alpha package",
    ]) {
      const response = await app.fetch(
        new Request(`${origin}/api/v1/auctions?limit=10&query=${encodeURIComponent(query)}`),
        env,
      );
      const body = (await response.json()) as {
        data: Array<Record<string, unknown>>;
        meta: { cursor: string | null; hasMore: boolean; requestId: string };
      };
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toMatch(/^public,/u);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        auctionId: first.auctionId,
        pointPackageId: first.pointPackageId,
        pointPackageName: "search_alpha package",
        status: "SCHEDULED",
        title: "search_alpha title",
      });
      expect(body.meta.requestId).toMatch(/^req_/u);
    }

    const pageOneResponse = await app.fetch(new Request(`${origin}/api/v1/auctions?limit=1`), env);
    const pageOne = (await pageOneResponse.json()) as {
      data: Array<{ auctionId: string }>;
      meta: { cursor: string | null; hasMore: boolean };
    };
    expect(pageOne.meta.hasMore).toBe(true);
    expect(pageOne.meta.cursor).not.toBeNull();
    const pageTwo = (await (
      await app.fetch(
        new Request(
          `${origin}/api/v1/auctions?limit=1&cursor=${encodeURIComponent(pageOne.meta.cursor!)}`,
        ),
        env,
      )
    ).json()) as { data: Array<{ auctionId: string }> };
    expect(pageTwo.data[0]?.auctionId).not.toBe(pageOne.data[0]?.auctionId);
    expect([first.auctionId, second.auctionId]).toContain(pageTwo.data[0]?.auctionId);
  });

  it("returns a public detail and bid history without AutoBid maximum or private data", async () => {
    const seeded = await seedUserAndAuction("detail", {
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      status: "OPEN",
    });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO bid_events
         (id, auction_id, bid_seq, bidder_markets_user_id, command_id,
          event_type, quantity, price_tick_count, created_at)
         VALUES (?, ?, 1, ?, ?, 'MANUAL_BID_PLACED', 1, 3, ?)`,
      ).bind(
        `bid_event_${seeded.auctionId}`,
        seeded.auctionId,
        seeded.marketsUserId,
        `bid_command_${seeded.auctionId}`,
        "2026-07-14T01:00:00.000Z",
      ),
      env.DB.prepare(
        `INSERT INTO auto_bid_rules
         (id, auction_id, bidder_markets_user_id, quantity, auto_bid_max_tick_count)
         VALUES (?, ?, ?, 1, 999999)`,
      ).bind(`auto_bid_${seeded.auctionId}`, seeded.auctionId, seeded.marketsUserId),
    ]);

    const response = await appFor(null).fetch(
      new Request(`${origin}/api/v1/auctions/${seeded.auctionId}`),
      env,
    );
    const text = await response.text();
    const body = JSON.parse(text) as { data: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toMatch(/^public,/u);
    expect(body.data).toMatchObject({
      auctionId: seeded.auctionId,
      events: [
        {
          bidSeq: 1,
          eventType: "MANUAL_BID_PLACED",
          priceTickCount: 3,
          quantity: 1,
        },
      ],
      pointPackageId: seeded.pointPackageId,
      status: "OPEN",
      title: "detail title",
    });
    expect(text).not.toContain("999999");
    expect(text).not.toContain("@example.test");
    expect(text).not.toMatch(/token|balance|failureDetail/iu);
  });

  it("keeps legacy listing routes as non-HTML 404 responses", async () => {
    const app = appFor(null);
    for (const path of ["/api/v1/listings", "/api/listings/legacy-id"]) {
      const response = await app.fetch(new Request(`${origin}${path}`), env);
      expect(response.status).toBe(404);
      expect(response.headers.get("Content-Type")).not.toMatch(/text\/html/iu);
    }
  });

  it("advances delayed start and end transitions once before concurrent detail snapshots", async () => {
    const seeded = await seedUserAndAuction("due_transition", {
      endsAt: new Date(Date.now() - 60_000).toISOString(),
      startsAt: new Date(Date.now() - 120_000).toISOString(),
    });
    const app = appFor(null);
    const request = () => new Request(`${origin}/api/v1/auctions/${seeded.auctionId}`);

    const responses = await Promise.all([app.fetch(request(), env), app.fetch(request(), env)]);
    const bodies = await Promise.all(
      responses.map(
        (response) => response.json() as Promise<{ data: { status: string; version: number } }>,
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(bodies.map((body) => body.data)).toEqual([
      expect.objectContaining({ status: "CLOSING", version: 3 }),
      expect.objectContaining({ status: "CLOSING", version: 3 }),
    ]);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM auction_close_cutoffs WHERE auction_id = ?",
      )
        .bind(seeded.auctionId)
        .first<number>("count"),
    ).toBe(1);
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM settlement_plans p
         JOIN settlements s ON s.id = p.settlement_id WHERE s.auction_id = ?`,
      )
        .bind(seeded.auctionId)
        .first<number>("count"),
    ).toBe(1);
  });
});

describe("private seller auction read", () => {
  it("keeps draft detail private to its seller", async () => {
    const seller = await seedUserAndAuction("private_draft", { status: "DRAFT" });
    const other = await seedUserAndAuction("private_other");

    const publicResponse = await appFor(null).fetch(
      new Request(`${origin}/api/v1/auctions/${seller.auctionId}`),
      env,
    );
    const unauthenticated = await appFor(null).fetch(
      new Request(`${origin}/api/auctions/${seller.auctionId}`),
      env,
    );
    const notSeller = await appFor(other.authUserId).fetch(
      new Request(`${origin}/api/auctions/${seller.auctionId}`),
      env,
    );
    const own = await appFor(seller.authUserId).fetch(
      new Request(`${origin}/api/auctions/${seller.auctionId}`),
      env,
    );

    expect(publicResponse.status).toBe(404);
    expect(unauthenticated.status).toBe(401);
    expect(notSeller.status).toBe(404);
    expect(own.status).toBe(200);
    expect(own.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(own.json()).resolves.toMatchObject({
      data: { auctionId: seller.auctionId, status: "DRAFT" },
    });
  });

  it("lists only the seller's own auctions including draft and cancelled", async () => {
    const sellerDraft = await seedUserAndAuction("own_draft", { status: "DRAFT" });
    const sellerCancelled = await seedUserAndAuction("own_cancelled", {
      status: "CANCELLED",
    });
    const other = await seedUserAndAuction("not_own");
    await env.DB.prepare("UPDATE auctions SET seller_markets_user_id = ? WHERE id = ?")
      .bind(sellerDraft.marketsUserId, sellerCancelled.auctionId)
      .run();

    const response = await appFor(sellerDraft.authUserId).fetch(
      new Request(`${origin}/api/auctions?limit=10`),
      env,
    );
    const body = (await response.json()) as { data: Array<{ auctionId: string }> };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body.data.map((entry) => entry.auctionId)).toEqual(
      expect.arrayContaining([sellerDraft.auctionId, sellerCancelled.auctionId]),
    );
    expect(body.data.map((entry) => entry.auctionId)).not.toContain(other.auctionId);
  });
});

describe("user auction history", () => {
  it("returns the authenticated user's created, bid, and won histories", async () => {
    const seller = await seedUserAndAuction("history_seller", { status: "SETTLED" });
    const actor = await seedUserAndAuction("history_actor");
    const settlementId = `settlement_${crypto.randomUUID()}`;
    const roundId = `round_${crypto.randomUUID()}`;
    const settledAt = "2026-07-14T03:00:00.000Z";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO bid_events
         (id, auction_id, bid_seq, bidder_markets_user_id, command_id,
          event_type, quantity, price_tick_count, created_at)
         VALUES (?, ?, 1, ?, ?, 'MANUAL_BID_PLACED', 1, 4, ?)`,
      ).bind(
        `bid_${crypto.randomUUID()}`,
        seller.auctionId,
        actor.marketsUserId,
        `command_${crypto.randomUUID()}`,
        settledAt,
      ),
      env.DB.prepare(
        `INSERT INTO settlements
         (id, auction_id, kind, source_key, saga_state, current_plan_id)
         VALUES (?, ?, 'END_OF_AUCTION', ?, 'SETTLED', ?)`,
      ).bind(settlementId, seller.auctionId, `end:${seller.auctionId}`, `plan_${settlementId}`),
      env.DB.prepare(
        `INSERT INTO settlement_rounds
         (id, settlement_id, round_ordinal, plan_hash, cutoff_hash, state,
          first_attempt_at, retry_deadline_at)
         VALUES (?, ?, 1, ?, ?, 'RESERVED', ?, ?)`,
      ).bind(roundId, settlementId, `sha256:${"b".repeat(64)}`, "c".repeat(64), settledAt, settledAt),
      env.DB.prepare(
        `INSERT INTO settlement_allocations
         (id, settlement_id, settlement_round_id, allocation_ordinal, auction_id,
          buyer_markets_user_id, point_reservation_id, quantity,
          uniform_price_tick_count, price_ticks, vector_hash, settled_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, 1, 4, 40000, ?, ?)`,
      ).bind(
        `allocation_${crypto.randomUUID()}`,
        settlementId,
        roundId,
        seller.auctionId,
        actor.marketsUserId,
        `reservation_${crypto.randomUUID()}`,
        "d".repeat(64),
        settledAt,
      ),
    ]);
    const app = appFor(actor.authUserId);

    for (const [path, expectedAuctionId] of [
      ["/api/me/auctions/created", actor.auctionId],
      ["/api/me/auctions/bids", seller.auctionId],
      ["/api/me/auctions/won", seller.auctionId],
    ] as const) {
      const response = await app.fetch(new Request(`${origin}${path}?limit=10`), env);
      const body = (await response.json()) as {
        data: Array<{ auctionId: string }>;
        meta: { cursor: string | null; hasMore: boolean; requestId: string };
      };
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(body.data.map((entry) => entry.auctionId)).toContain(expectedAuctionId);
      expect(body.meta).toMatchObject({ cursor: null, hasMore: false });
      expect(body.meta.requestId).toMatch(/^req_/u);
    }
  });

  it("publishes created and won history without private fields", async () => {
    const user = await seedUserAndAuction("public_history", { status: "SETTLED" });
    const response = await appFor(null).fetch(
      new Request(`${origin}/api/v1/users/${user.marketsUserId}/history?limit=10`),
      env,
    );
    const text = await response.text();
    const body = JSON.parse(text) as {
      data: Array<{ auctionId: string; historyType: string }>;
      meta: { requestId: string };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toMatch(/^public,/u);
    expect(body.data).toContainEqual(
      expect.objectContaining({ auctionId: user.auctionId, historyType: "CREATED" }),
    );
    expect(body.meta.requestId).toMatch(/^req_/u);
    expect(text).not.toContain("@example.test");
    expect(text).not.toMatch(/token|balance|autoBidMax|failureDetail/iu);
  });
});
