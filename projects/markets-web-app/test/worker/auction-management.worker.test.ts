import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vite-plus/test";

import { cancelAuction } from "../../src/backend/auction/management/cancel-auction";
import { updateAuctionBeforeStart } from "../../src/backend/auction/management/update-auction-before-start";
import { D1AuctionRepository } from "../../src/backend/db/d1-auction-repository";
import type { MarketsActor } from "../../src/backend/http/context";

const ownerAuthId = `auth-owner-${crypto.randomUUID()}`;
const otherAuthId = `auth-other-${crypto.randomUUID()}`;
const ownerId = `musr_owner_${crypto.randomUUID()}`;
const otherId = `musr_other_${crypto.randomUUID()}`;
const owner: MarketsActor = {
  accountId: "google-owner",
  marketsUserId: ownerId,
  providerId: "google",
};
const other: MarketsActor = {
  accountId: "google-other",
  marketsUserId: otherId,
  providerId: "google",
};
const now = new Date("2031-01-01T00:00:00.000Z");

beforeAll(async () => {
  for (const [authId, marketsId] of [
    [ownerAuthId, ownerId],
    [otherAuthId, otherId],
  ]) {
    await env.DB!.batch([
      env
        .DB!.prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)")
        .bind(authId, authId, `${authId}@example.test`),
      env
        .DB!.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)")
        .bind(marketsId, authId),
    ]);
  }
});

async function seedAuction(suffix: string) {
  const auctionId = `auc_${suffix}_${crypto.randomUUID()}`;
  const revisionId = `arev_${suffix}_${crypto.randomUUID()}`;
  const snapshotId = `pps_${suffix}_${crypto.randomUUID()}`;
  await env.DB!.batch([
    env
      .DB!.prepare(
        "INSERT INTO point_package_snapshots (id, point_package_id, point_package_revision_id, name, total_weight) VALUES (?, ?, ?, ?, 1)",
      )
      .bind(snapshotId, `pp_${suffix}`, `ppr_${suffix}_${crypto.randomUUID()}`, "Package"),
    env
      .DB!.prepare(
        "INSERT INTO auctions (id, seller_markets_user_id, status, version) VALUES (?, ?, 'SCHEDULED', 1)",
      )
      .bind(auctionId, ownerId),
    env
      .DB!.prepare(
        `INSERT INTO auction_revisions
       (id, auction_id, revision_number, title, description, external_url,
        seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity,
        starts_at, ends_at, package_tick, eligibility_receipt_id, auction_command_id,
        auction_command_hash, package_eligibility_version, eligibility_checked_at,
        eligibility_valid_until, commit_started_at)
       VALUES (?, ?, 1, 'Old', 'Old description', 'https://example.test/old', ?, 'points.freeism.app', ?, 1,
               '2031-01-02T00:00:00.000Z', '2031-01-03T00:00:00.000Z', 1,
               'receipt-old', 'command-old', ?, 1, ?, '2031-01-01T00:01:00.000Z', ?)`,
      )
      .bind(
        revisionId,
        auctionId,
        JSON.stringify(owner),
        snapshotId,
        "a".repeat(64),
        now.toISOString(),
        now.toISOString(),
      ),
    env
      .DB!.prepare("UPDATE auctions SET current_revision_id = ? WHERE id = ?")
      .bind(revisionId, auctionId),
  ]);
  return { auctionId, revisionId, snapshotId };
}

function replacementRow(suffix: string) {
  return {
    clientRowId: `row-${suffix}`,
    title: "New",
    description: "New description",
    externalUrl: "https://example.test/new",
    pointPackageId: `pp_new_${suffix}`,
    pointPackageRevisionId: `ppr_new_${suffix}`,
    quantity: 2,
    startsAt: "2031-01-02T01:00:00.000Z",
    endsAt: "2031-01-03T01:00:00.000Z",
    buyNowPriceTickCount: null,
    extensionThresholdSeconds: null,
    extensionDurationSeconds: null,
    maxExtensions: null,
    eligible: true as const,
    packageEligibilityVersion: 1,
    packageSnapshot: {
      pointPackageId: `pp_new_${suffix}`,
      pointPackageRevisionId: `ppr_new_${suffix}`,
      status: "ACTIVE" as const,
      name: "New package",
      description: null,
      relatedUrl: null,
      totalWeight: 1,
      packageTick: 1,
      contentHash: `sha256:${"b".repeat(64)}`,
      components: [
        {
          evaluationCriterionId: `criterion-${suffix}`,
          evaluationCriterionRevisionId: `criterion-revision-${suffix}`,
          name: "Criterion",
          displayOrder: 0,
          weight: 1,
          minimumUnitScaled: 1,
          buyNowEnabled: true,
        },
      ],
    },
  };
}

describe("Auction management", () => {
  it("lets the owner append a revision before startsAt and replays the same key", async () => {
    const seeded = await seedAuction("update");
    const repository = new D1AuctionRepository(env.DB!);
    const row = replacementRow("update");
    const input = {
      actor: owner,
      auctionId: seeded.auctionId,
      expectedAuctionVersion: 1,
      idempotencyKey: `update-${crypto.randomUUID()}`,
      row,
      sellerIdentitySnapshot: owner,
    };
    const dependencies = {
      repository,
      now: () => now,
      refreshPackage: async () => row.packageSnapshot,
      checkEligibility: async (request: {
        auctionCommandId: string;
        auctionCommandHash: string;
        items: Array<Record<string, string>>;
      }) => ({
        data: {
          pointPackageAuctionEligibilityReceiptId: "receipt-new",
          auctionCommandId: request.auctionCommandId,
          auctionCommandHash: request.auctionCommandHash,
          items: request.items.map((item) => ({ ...item, packageEligibilityVersion: 2 })),
          checkedAt: now.toISOString(),
          validUntil: "2031-01-01T00:01:00.000Z",
        },
      }),
      scheduleAuction: async () => undefined,
    };

    const updated = await updateAuctionBeforeStart(input, dependencies);
    const replay = await updateAuctionBeforeStart(input, dependencies);

    expect(replay).toEqual(updated);
    expect(updated).toMatchObject({ auctionId: seeded.auctionId, status: "SCHEDULED", version: 2 });
    expect(
      await env
        .DB!.prepare("SELECT COUNT(*) AS count FROM auction_revisions WHERE auction_id = ?")
        .bind(seeded.auctionId)
        .first<number>("count"),
    ).toBe(2);
  });

  it("rejects another seller, stale versions and the startsAt boundary", async () => {
    const seeded = await seedAuction("guards");
    const repository = new D1AuctionRepository(env.DB!);
    const base = {
      auctionId: seeded.auctionId,
      expectedAuctionVersion: 1,
      idempotencyKey: `guard-${crypto.randomUUID()}`,
      row: replacementRow("guards"),
      sellerIdentitySnapshot: owner,
    };
    const dependencies = {
      repository,
      now: () => now,
      refreshPackage: async () => base.row.packageSnapshot,
      checkEligibility: async () => {
        throw new Error("must not call dependency for rejected actor");
      },
      scheduleAuction: async () => undefined,
    };
    await expect(
      updateAuctionBeforeStart({ ...base, actor: other }, dependencies),
    ).rejects.toMatchObject({
      code: "AUCTION_FORBIDDEN",
    });
    await expect(
      cancelAuction(
        {
          actor: owner,
          auctionId: seeded.auctionId,
          expectedAuctionVersion: 2,
          idempotencyKey: "stale",
        },
        { repository, now: () => now },
      ),
    ).rejects.toMatchObject({ code: "AUCTION_VERSION_CONFLICT" });
    await expect(
      cancelAuction(
        {
          actor: owner,
          auctionId: seeded.auctionId,
          expectedAuctionVersion: 1,
          idempotencyKey: "boundary",
        },
        { repository, now: () => new Date("2031-01-02T00:00:00.000Z") },
      ),
    ).rejects.toMatchObject({ code: "AUCTION_ALREADY_STARTED" });

    const pastRow = {
      ...base.row,
      startsAt: "2030-12-31T23:59:59.000Z",
      endsAt: "2031-01-01T01:00:00.000Z",
    };
    await expect(
      updateAuctionBeforeStart(
        {
          ...base,
          actor: owner,
          idempotencyKey: `past-${crypto.randomUUID()}`,
          row: pastRow,
        },
        {
          ...dependencies,
          refreshPackage: async () => pastRow.packageSnapshot,
        },
      ),
    ).rejects.toMatchObject({ code: "AUCTION_STARTS_AT_NOT_FUTURE" });
  });

  it("does not persist success side effects for the loser of concurrent cancellation", async () => {
    const seeded = await seedAuction("cancel-race");
    let waiting = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => {
      release = resolve;
    });
    class BarrierRepository extends D1AuctionRepository {
      override async findForManagement(auctionId: string) {
        const snapshot = await super.findForManagement(auctionId);
        waiting += 1;
        if (waiting === 2) release();
        await bothRead;
        return snapshot;
      }
    }
    const repository = new BarrierRepository(env.DB!);
    const keys = [`race-a-${crypto.randomUUID()}`, `race-b-${crypto.randomUUID()}`];

    const results = await Promise.allSettled(
      keys.map((idempotencyKey) =>
        cancelAuction(
          {
            actor: owner,
            auctionId: seeded.auctionId,
            expectedAuctionVersion: 1,
            idempotencyKey,
          },
          { repository, now: () => now },
        ),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(
      await env
        .DB!.prepare(
          `SELECT COUNT(*) AS count FROM idempotency_results
           WHERE operation = 'auction-cancel-before-start' AND idempotency_key IN (?, ?)`,
        )
        .bind(...keys)
        .first<number>("count"),
    ).toBe(1);
    expect(
      await env
        .DB!.prepare(
          `SELECT COUNT(*) AS count FROM audit_events
           WHERE target_id = ? AND event_code IN ('AUCTION_CANCELLED', 'AUCTION_ALARM_CANCEL_REQUESTED')`,
        )
        .bind(seeded.auctionId)
        .first<number>("count"),
    ).toBe(2);
  });

  it("cancels without deleting history and maps bid, auto-bid and buy-now guards to 409 errors", async () => {
    const repository = new D1AuctionRepository(env.DB!);
    const cancellable = await seedAuction("cancel-ok");
    const result = await cancelAuction(
      {
        actor: owner,
        auctionId: cancellable.auctionId,
        expectedAuctionVersion: 1,
        idempotencyKey: `cancel-${crypto.randomUUID()}`,
        reason: "seller-request",
      },
      { repository, now: () => now },
    );
    expect(result.status).toBe("CANCELLED");
    expect(
      await env
        .DB!.prepare("SELECT COUNT(*) AS count FROM auction_revisions WHERE auction_id = ?")
        .bind(cancellable.auctionId)
        .first<number>("count"),
    ).toBe(1);

    for (const blocker of ["bid", "auto", "buy-now"] as const) {
      const seeded = await seedAuction(`blocked-${blocker}`);
      if (blocker === "bid") {
        await env
          .DB!.prepare(
            "INSERT INTO bid_events (id, auction_id, bid_seq, bidder_markets_user_id, command_id, event_type, quantity, price_tick_count) VALUES (?, ?, 1, ?, ?, 'BID_ACCEPTED', 1, 1)",
          )
          .bind(
            `bid-${crypto.randomUUID()}`,
            seeded.auctionId,
            otherId,
            `cmd-${crypto.randomUUID()}`,
          )
          .run();
      } else if (blocker === "auto") {
        await env
          .DB!.prepare(
            "INSERT INTO auto_bid_rules (id, auction_id, bidder_markets_user_id, quantity, auto_bid_max_tick_count, active) VALUES (?, ?, ?, 1, 2, 1)",
          )
          .bind(`auto-${crypto.randomUUID()}`, seeded.auctionId, otherId)
          .run();
      } else {
        await env
          .DB!.prepare(
            "INSERT INTO buy_now_holds (id, auction_id, buyer_markets_user_id, quantity, buy_now_price_tick_count, status) VALUES (?, ?, ?, 1, 2, 'FAILED_RESTORED')",
          )
          .bind(`hold-${crypto.randomUUID()}`, seeded.auctionId, otherId)
          .run();
        await env
          .DB!.prepare(
            "UPDATE buy_now_holds SET status = 'PENDING' WHERE auction_id = ? AND buyer_markets_user_id = ?",
          )
          .bind(seeded.auctionId, otherId)
          .run();
      }
      await expect(
        cancelAuction(
          {
            actor: owner,
            auctionId: seeded.auctionId,
            expectedAuctionVersion: 1,
            idempotencyKey: `blocked-${crypto.randomUUID()}`,
          },
          { repository, now: () => now },
        ),
      ).rejects.toMatchObject({ code: "AUCTION_CANCELLATION_BLOCKED" });
      expect(
        await env
          .DB!.prepare("SELECT status FROM auctions WHERE id = ?")
          .bind(seeded.auctionId)
          .first<string>("status"),
      ).toBe("SCHEDULED");
    }
  });
});
