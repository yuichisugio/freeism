import { env, runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createMarketsBackendApp } from "../../src/backend/app";

interface SeededAuction {
  auctionId: string;
  buyerAuthUserId: string;
  buyerMarketsUserId: string;
  sellerAuthUserId: string;
  sellerMarketsUserId: string;
}

async function seedAuction(options: { activePoints?: boolean; quantity?: number } = {}) {
  const suffix = crypto.randomUUID();
  const auctionId = `auc_command_${suffix}`;
  const sellerAuthUserId = `auth_seller_${suffix}`;
  const sellerMarketsUserId = `musr_seller_${suffix}`;
  const buyerAuthUserId = `auth_buyer_${suffix}`;
  const buyerMarketsUserId = `musr_buyer_${suffix}`;
  const snapshotId = `pps_${suffix}`;
  const revisionId = `rev_${suffix}`;
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Seller', ?)").bind(
      sellerAuthUserId,
      `seller-${suffix}@example.test`,
    ),
    env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Buyer', ?)").bind(
      buyerAuthUserId,
      `buyer-${suffix}@example.test`,
    ),
    env.DB.prepare(
      "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (?, ?, 'google', ?, ?)",
    ).bind(`acc_seller_${suffix}`, `google_seller_${suffix}`, sellerAuthUserId, now),
    env.DB.prepare(
      "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (?, ?, 'google', ?, ?)",
    ).bind(`acc_buyer_${suffix}`, `google_buyer_${suffix}`, buyerAuthUserId, now),
    env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
      sellerMarketsUserId,
      sellerAuthUserId,
    ),
    env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
      buyerMarketsUserId,
      buyerAuthUserId,
    ),
    env.DB.prepare(
      "INSERT INTO point_package_snapshots (id, point_package_id, point_package_revision_id, name, total_weight) VALUES (?, ?, ?, 'Command package', 1)",
    ).bind(snapshotId, `pp_${suffix}`, `ppr_${suffix}`),
    env.DB.prepare(
      "INSERT INTO auctions (id, seller_markets_user_id, status, version) VALUES (?, ?, 'OPEN', 1)",
    ).bind(auctionId, sellerMarketsUserId),
    env.DB.prepare(
      `INSERT INTO auction_revisions
       (id, auction_id, revision_number, title, description, external_url,
        seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity,
        starts_at, ends_at, package_tick, buy_now_price_tick_count,
        eligibility_receipt_id, auction_command_id, auction_command_hash,
        package_eligibility_version, eligibility_checked_at, eligibility_valid_until,
        commit_started_at)
       VALUES (?, ?, 1, 'Command auction', '', 'https://example.test/item', '{}',
        'points.freeism.app', ?, ?, ?, ?, 5, 20, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(
      revisionId,
      auctionId,
      snapshotId,
      options.quantity ?? 3,
      new Date(now - 60_000).toISOString(),
      new Date(now + 60_000).toISOString(),
      `receipt_${suffix}`,
      `import_${suffix}`,
      "a".repeat(64),
      new Date(now - 60_000).toISOString(),
      new Date(now + 60_000).toISOString(),
      new Date(now - 60_000).toISOString(),
    ),
    env.DB.prepare("UPDATE auctions SET current_revision_id = ? WHERE id = ?").bind(
      revisionId,
      auctionId,
    ),
  ]);
  if (options.activePoints !== false) {
    await env.DB.prepare(
      `INSERT INTO points_connection
       (id, markets_user_id, auth_user_id, status, link_attempt_id, attempt_payload_hash,
        points_issuer, points_subject, user_client_id, m2m_client_id, granted_scopes,
        session_id, expires_at)
       VALUES (?, ?, ?, 'ACTIVE', ?, ?, 'points.freeism.app', ?, 'markets-user',
        'markets-m2m', 'auction:bid', ?, ?)`,
    )
      .bind(
        `pc_${suffix}`,
        buyerMarketsUserId,
        buyerAuthUserId,
        `attempt_${suffix}`,
        "b".repeat(64),
        `subject_${suffix}`,
        `session_${suffix}`,
        now + 60_000,
      )
      .run();
  }
  return {
    auctionId,
    buyerAuthUserId,
    buyerMarketsUserId,
    sellerAuthUserId,
    sellerMarketsUserId,
  } satisfies SeededAuction;
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

function commandRequest(
  seeded: SeededAuction,
  path: "bids" | "auto-bid" | "buy-now",
  body: Record<string, unknown>,
  options: { idempotencyKey?: string; method?: "DELETE" | "POST" } = {},
) {
  return new Request(`https://markets.example.test/api/auctions/${seeded.auctionId}/${path}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": options.idempotencyKey ?? `idem_${crypto.randomUUID()}`,
      Origin: "https://markets.example.test",
      "Sec-Fetch-Site": "same-origin",
    },
    method: options.method ?? "POST",
  });
}

async function counts(auctionId: string) {
  return env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM auction_commands WHERE auction_id = ?) AS commands,
       (SELECT COUNT(*) FROM bid_events WHERE auction_id = ?) AS events,
       (SELECT COUNT(*) FROM bid_positions WHERE auction_id = ?) AS positions,
       (SELECT COUNT(*) FROM buy_now_holds WHERE auction_id = ?) AS holds,
       (SELECT COUNT(*) FROM settlement_plans WHERE auction_id = ?) AS plans,
       (SELECT COUNT(*) FROM settlement_outbox o JOIN settlement_plans p ON p.id = o.settlement_id WHERE p.auction_id = ?) AS outbox,
       (SELECT COUNT(*) FROM audit_events WHERE target_id = ?) AS audits,
       (SELECT version FROM auctions WHERE id = ?) AS version`,
  )
    .bind(auctionId, auctionId, auctionId, auctionId, auctionId, auctionId, auctionId, auctionId)
    .first<{
      audits: number;
      commands: number;
      events: number;
      holds: number;
      outbox: number;
      plans: number;
      positions: number;
      version: number;
    }>();
}

describe("authenticated auction HTTP commands", () => {
  beforeEach(async () => {
    await env.DB.exec("DROP TRIGGER IF EXISTS test_fail_bid_event;");
  });

  it("rejects missing session, seller, and a bidder without an ACTIVE Points connection", async () => {
    const seeded = await seedAuction();
    const body = {
      commandId: `cmd_${crypto.randomUUID()}`,
      expectedAuctionVersion: 1,
      priceTickCount: 2,
      quantity: 1,
    };
    expect((await appFor(null).fetch(commandRequest(seeded, "bids", body), env)).status).toBe(401);
    expect(
      (await appFor(seeded.sellerAuthUserId).fetch(commandRequest(seeded, "bids", body), env))
        .status,
    ).toBe(403);
    const unlinked = await seedAuction({ activePoints: false });
    expect(
      (await appFor(unlinked.buyerAuthUserId).fetch(commandRequest(unlinked, "bids", body), env))
        .status,
    ).toBe(403);
  });

  it("accepts PLACE_BID through HTTP and persists the guarded command batch", async () => {
    const seeded = await seedAuction();
    const response = await appFor(seeded.buyerAuthUserId).fetch(
      commandRequest(seeded, "bids", {
        actorMarketsUserId: seeded.sellerMarketsUserId,
        autoBidMaxTickCount: 6,
        commandId: `cmd_${crypto.randomUUID()}`,
        expectedAuctionVersion: 1,
        priceTickCount: 2,
        quantity: 1,
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { acceptedPriceTickCount: 2, auctionVersion: 2, bidSeq: 1, quantity: 1 },
    });
    expect(await counts(seeded.auctionId)).toMatchObject({
      audits: 1,
      commands: 1,
      events: 1,
      positions: 1,
      version: 2,
    });
    const cancelled = await appFor(seeded.buyerAuthUserId).fetch(
      commandRequest(
        seeded,
        "auto-bid",
        { commandId: `cmd_${crypto.randomUUID()}`, expectedAuctionVersion: 2 },
        { method: "DELETE" },
      ),
      env,
    );
    expect(cancelled.status).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT active FROM auto_bid_rules WHERE auction_id = ? AND bidder_markets_user_id = ?",
      )
        .bind(seeded.auctionId, seeded.buyerMarketsUserId)
        .first<number>("active"),
    ).toBe(0);
    expect(await counts(seeded.auctionId)).toMatchObject({
      commands: 2,
      events: 1,
      positions: 1,
      version: 3,
    });
  });

  it("allows exactly one of two commands with the same expected Auction version", async () => {
    const seeded = await seedAuction();
    const app = appFor(seeded.buyerAuthUserId);
    const request = () =>
      commandRequest(seeded, "bids", {
        commandId: `cmd_${crypto.randomUUID()}`,
        expectedAuctionVersion: 1,
        priceTickCount: 2,
        quantity: 1,
      });
    const responses = await Promise.all([app.fetch(request(), env), app.fetch(request(), env)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await counts(seeded.auctionId)).toMatchObject({ events: 1, version: 2 });
  });

  it("replays the same command and rejects command or idempotency payload replacement", async () => {
    const seeded = await seedAuction();
    const app = appFor(seeded.buyerAuthUserId);
    const commandId = `cmd_${crypto.randomUUID()}`;
    const idempotencyKey = `idem_${crypto.randomUUID()}`;
    const body = { commandId, expectedAuctionVersion: 1, priceTickCount: 2, quantity: 1 };
    const first = await app.fetch(commandRequest(seeded, "bids", body, { idempotencyKey }), env);
    const firstBody = await first.text();
    const replay = await app.fetch(commandRequest(seeded, "bids", body, { idempotencyKey }), env);
    expect(replay.status).toBe(200);
    expect(await replay.text()).toBe(firstBody);
    const changedKey = await app.fetch(
      commandRequest(seeded, "bids", { ...body, quantity: 2 }, { idempotencyKey }),
      env,
    );
    expect(changedKey.status).toBe(409);
    const changedCommand = await app.fetch(
      commandRequest(seeded, "bids", { ...body, quantity: 2 }),
      env,
    );
    expect(changedCommand.status).toBe(409);
    expect(await counts(seeded.auctionId)).toMatchObject({ commands: 1, events: 1, version: 2 });
  });

  it("rejects replaying a PLACE_BID commandId through the BUY_NOW route", async () => {
    const seeded = await seedAuction();
    const app = appFor(seeded.buyerAuthUserId);
    const body = {
      commandId: `cmd_${crypto.randomUUID()}`,
      expectedAuctionVersion: 1,
      priceTickCount: 2,
      quantity: 1,
    };
    expect((await app.fetch(commandRequest(seeded, "bids", body), env)).status).toBe(200);
    expect(
      (
        await app.fetch(
          commandRequest(seeded, "buy-now", body, {
            idempotencyKey: `idem_${crypto.randomUUID()}`,
          }),
          env,
        )
      ).status,
    ).toBe(409);
    expect(await counts(seeded.auctionId)).toMatchObject({
      commands: 1,
      events: 1,
      holds: 0,
      outbox: 0,
      plans: 0,
      version: 2,
    });
  });

  it("rejects invalid quantity, invalid tick, price decrease, and commands after endAt", async () => {
    const seeded = await seedAuction();
    const app = appFor(seeded.buyerAuthUserId);
    const post = (body: Record<string, unknown>) =>
      app.fetch(commandRequest(seeded, "bids", body), env);
    expect(
      (
        await post({
          commandId: `cmd_${crypto.randomUUID()}`,
          expectedAuctionVersion: 1,
          priceTickCount: 2,
          quantity: 0,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await post({
          commandId: `cmd_${crypto.randomUUID()}`,
          expectedAuctionVersion: 1,
          priceTickCount: -1,
          quantity: 1,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await post({
          commandId: `cmd_${crypto.randomUUID()}`,
          expectedAuctionVersion: 1,
          priceTickCount: 3,
          quantity: 1,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post({
          commandId: `cmd_${crypto.randomUUID()}`,
          expectedAuctionVersion: 2,
          priceTickCount: 2,
          quantity: 1,
        })
      ).status,
    ).toBe(422);
    await env.DB.prepare("UPDATE auction_revisions SET ends_at = ? WHERE auction_id = ?")
      .bind(new Date(Date.now() - 1).toISOString(), seeded.auctionId)
      .run()
      .catch(() => undefined);
    await env.DB.prepare("UPDATE auctions SET status = 'CLOSING' WHERE id = ?")
      .bind(seeded.auctionId)
      .run();
    expect(
      (
        await post({
          commandId: `cmd_${crypto.randomUUID()}`,
          expectedAuctionVersion: 2,
          priceTickCount: 4,
          quantity: 1,
        })
      ).status,
    ).toBe(409);
  });

  it("maps an AutoBid maximum below the requested price to 422", async () => {
    const seeded = await seedAuction();
    const response = await appFor(seeded.buyerAuthUserId).fetch(
      commandRequest(seeded, "bids", {
        autoBidMaxTickCount: 1,
        commandId: `cmd_${crypto.randomUUID()}`,
        expectedAuctionVersion: 1,
        priceTickCount: 2,
        quantity: 1,
      }),
      env,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "AUTO_BID_MAX_EXCEEDED" });
    expect(await counts(seeded.auctionId)).toMatchObject({
      commands: 0,
      events: 0,
      positions: 0,
      version: 1,
    });
  });

  it("maps lowering an existing AutoBid maximum to 422", async () => {
    const seeded = await seedAuction();
    const app = appFor(seeded.buyerAuthUserId);
    expect(
      (
        await app.fetch(
          commandRequest(seeded, "bids", {
            autoBidMaxTickCount: 6,
            commandId: `cmd_${crypto.randomUUID()}`,
            expectedAuctionVersion: 1,
            priceTickCount: 2,
            quantity: 1,
          }),
          env,
        )
      ).status,
    ).toBe(200);
    const response = await app.fetch(
      commandRequest(seeded, "bids", {
        autoBidMaxTickCount: 5,
        commandId: `cmd_${crypto.randomUUID()}`,
        expectedAuctionVersion: 2,
        priceTickCount: 3,
        quantity: 1,
      }),
      env,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "AUTO_BID_MAX_DECREASED" });
    expect(await counts(seeded.auctionId)).toMatchObject({ commands: 1, events: 1, version: 2 });
  });

  it("keeps seller and Points guards when the HTTP preflight is bypassed", async () => {
    const seller = await seedAuction();
    const unlinked = await seedAuction({ activePoints: false });
    for (const [seeded, actorId] of [
      [seller, seller.sellerMarketsUserId],
      [unlinked, unlinked.buyerMarketsUserId],
    ] as const) {
      const stub = env.AUCTION_ROOMS.getByName(seeded.auctionId);
      await runInDurableObject(stub, async (instance) => {
        await expect(
          instance.executeCommand({
            actor: { accountId: "direct", marketsUserId: actorId, providerId: "google" },
            auctionId: seeded.auctionId,
            command: { kind: "PLACE_BID", priceTickCount: 2, quantity: 1 },
            commandId: `cmd_${crypto.randomUUID()}`,
            expectedAuctionVersion: 1,
            idempotencyKey: `idem_${crypto.randomUUID()}`,
            payloadHash: "c".repeat(64),
            serverNow: new Date().toISOString(),
          }),
        ).rejects.toThrow();
      });
      expect(await counts(seeded.auctionId)).toMatchObject({ commands: 0, events: 0, version: 1 });
      await expect(
        env.DB.prepare(
          `INSERT INTO auction_commands
           (id, auction_id, command_id, actor_markets_user_id, operation, payload_hash,
            expected_auction_version, status)
           VALUES (?, ?, ?, ?, 'PLACE_BID', ?, 1, 'COMPLETED')`,
        )
          .bind(
            `ac_${crypto.randomUUID()}`,
            seeded.auctionId,
            `cmd_${crypto.randomUUID()}`,
            actorId,
            "f".repeat(64),
          )
          .run(),
      ).rejects.toThrow(
        actorId === seeded.sellerMarketsUserId ? "SELLER_CANNOT_BID" : "POINTS_LINK_REQUIRED",
      );
    }
  });

  it("does not broadcast or leave partial rows when the D1 command batch fails", async () => {
    const seeded = await seedAuction();
    await env.DB.exec(
      "CREATE TRIGGER test_fail_bid_event BEFORE INSERT ON bid_events BEGIN SELECT RAISE(ABORT, 'TEST_COMMAND_BATCH_FAILURE'); END;",
    );
    const stub = env.AUCTION_ROOMS.getByName(seeded.auctionId);
    const broadcastCount = await runInDurableObject(stub, async (instance) => {
      let count = 0;
      const room = instance as typeof instance & {
        broadcastCommitted: (...args: unknown[]) => Promise<void>;
      };
      room.broadcastCommitted = async () => {
        count += 1;
      };
      await expect(
        room.executeCommand({
          actor: {
            accountId: "buyer",
            marketsUserId: seeded.buyerMarketsUserId,
            providerId: "google",
          },
          auctionId: seeded.auctionId,
          command: { kind: "PLACE_BID", priceTickCount: 2, quantity: 1 },
          commandId: `cmd_${crypto.randomUUID()}`,
          expectedAuctionVersion: 1,
          idempotencyKey: `idem_${crypto.randomUUID()}`,
          payloadHash: "d".repeat(64),
          serverNow: new Date().toISOString(),
        }),
      ).rejects.toThrow("TEST_COMMAND_BATCH_FAILURE");
      return count;
    });
    expect(broadcastCount).toBe(0);
    expect(await counts(seeded.auctionId)).toMatchObject({
      audits: 0,
      commands: 0,
      events: 0,
      positions: 0,
      version: 1,
    });
  });

  it("broadcasts exactly once after a successful committed command", async () => {
    const seeded = await seedAuction();
    const stub = env.AUCTION_ROOMS.getByName(seeded.auctionId);
    const broadcastCount = await runInDurableObject(stub, async (instance) => {
      let count = 0;
      const room = instance as typeof instance & {
        broadcastCommitted: (...args: unknown[]) => Promise<void>;
      };
      room.broadcastCommitted = async () => {
        count += 1;
      };
      await room.executeCommand({
        actor: {
          accountId: "buyer",
          marketsUserId: seeded.buyerMarketsUserId,
          providerId: "google",
        },
        auctionId: seeded.auctionId,
        command: { kind: "PLACE_BID", priceTickCount: 2, quantity: 1 },
        commandId: `cmd_${crypto.randomUUID()}`,
        expectedAuctionVersion: 1,
        idempotencyKey: `idem_${crypto.randomUUID()}`,
        payloadHash: "e".repeat(64),
        serverNow: new Date().toISOString(),
      });
      return count;
    });
    expect(broadcastCount).toBe(1);
  });

  it("creates one all-or-nothing BUY_NOW hold, immutable plan, and pending outbox", async () => {
    const seeded = await seedAuction({ quantity: 2 });
    const app = appFor(seeded.buyerAuthUserId);
    const idempotencyKey = `idem_${crypto.randomUUID()}`;
    const body = {
      commandId: `cmd_${crypto.randomUUID()}`,
      expectedAuctionVersion: 1,
      quantity: 2,
    };
    const first = await app.fetch(commandRequest(seeded, "buy-now", body, { idempotencyKey }), env);
    expect(first.status).toBe(202);
    const receipt = await first.json();
    expect(receipt).toMatchObject({ data: { auctionVersion: 2, state: "PENDING" } });
    expect(await counts(seeded.auctionId)).toMatchObject({
      audits: 1,
      commands: 1,
      holds: 1,
      outbox: 1,
      plans: 1,
      version: 2,
    });
    const replay = await app.fetch(
      commandRequest(seeded, "buy-now", body, { idempotencyKey }),
      env,
    );
    expect(replay.status).toBe(202);
    expect(await replay.json()).toEqual(receipt);
    const unavailable = await app.fetch(
      commandRequest(seeded, "buy-now", {
        ...body,
        commandId: `cmd_${crypto.randomUUID()}`,
        expectedAuctionVersion: 2,
        quantity: 1,
      }),
      env,
    );
    expect(unavailable.status).toBe(409);
    expect(await counts(seeded.auctionId)).toMatchObject({ holds: 1, outbox: 1, plans: 1 });
  });

  it("rejects PLACE_BID and AutoBid quantities unavailable behind active BUY_NOW holds", async () => {
    for (const [heldQuantity, bidQuantity] of [
      [2, 1],
      [1, 2],
    ] as const) {
      const seeded = await seedAuction({ quantity: 2 });
      const app = appFor(seeded.buyerAuthUserId);
      const buyNow = await app.fetch(
        commandRequest(seeded, "buy-now", {
          commandId: `cmd_${crypto.randomUUID()}`,
          expectedAuctionVersion: 1,
          quantity: heldQuantity,
        }),
        env,
      );
      expect(buyNow.status).toBe(202);

      const bid = await app.fetch(
        commandRequest(seeded, "bids", {
          autoBidMaxTickCount: 6,
          commandId: `cmd_${crypto.randomUUID()}`,
          expectedAuctionVersion: 2,
          priceTickCount: 2,
          quantity: bidQuantity,
        }),
        env,
      );
      expect(bid.status).toBe(422);
      expect(await bid.json()).toMatchObject({ code: "INVALID_QUANTITY" });
      expect(await counts(seeded.auctionId)).toMatchObject({
        commands: 1,
        events: 0,
        holds: 1,
        positions: 0,
        version: 2,
      });
    }
  });
});
