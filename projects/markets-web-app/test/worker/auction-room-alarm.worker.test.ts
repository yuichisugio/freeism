import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

const marketsUserId = "musr_auction_alarm";

async function seedScheduled(auctionId: string, startsAt: string, endsAt: string) {
  const revisionId = `rev-${auctionId}`;
  const packageId = `pps-${auctionId}`;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO user (id, name, email) VALUES ('auth-alarm', 'Alarm', 'alarm@example.test')",
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO markets_user (id, auth_user_id) VALUES (?, 'auth-alarm')",
    ).bind(marketsUserId),
    env.DB.prepare(
      "INSERT OR IGNORE INTO point_package_snapshots (id, point_package_id, point_package_revision_id, name, total_weight) VALUES (?, ?, ?, 'Alarm package', 1)",
    ).bind(packageId, `pp-${auctionId}`, `ppr-${auctionId}`),
    env.DB.prepare(
      "INSERT OR IGNORE INTO auctions (id, seller_markets_user_id, status, version) VALUES (?, ?, 'SCHEDULED', 1)",
    ).bind(auctionId, marketsUserId),
    env.DB.prepare(
      "INSERT OR IGNORE INTO auction_revisions (id, auction_id, revision_number, title, description, external_url, seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity, starts_at, ends_at, package_tick, eligibility_receipt_id, auction_command_id, auction_command_hash, package_eligibility_version, eligibility_checked_at, eligibility_valid_until, commit_started_at) VALUES (?, ?, 1, 'Alarm', '', 'https://example.test/item', '{}', 'https://points.example.test', ?, 1, ?, ?, 1, ?, ?, 'hash-alarm', 1, ?, ?, ?)",
    ).bind(
      revisionId,
      auctionId,
      packageId,
      startsAt,
      endsAt,
      `receipt-${auctionId}`,
      `command-${auctionId}`,
      new Date().toISOString(),
      endsAt,
      new Date().toISOString(),
    ),
    env.DB.prepare(
      "UPDATE auctions SET current_revision_id = ?, status = 'SCHEDULED', version = 1 WHERE id = ?",
    ).bind(revisionId, auctionId),
  ]);
  return revisionId;
}

async function status(auctionId: string) {
  return env.DB.prepare("SELECT status, version FROM auctions WHERE id = ?")
    .bind(auctionId)
    .first<{ status: string; version: number }>();
}

describe("AuctionRoom one-alarm lifecycle", () => {
  beforeEach(async () => {
    await env.DB.exec("DELETE FROM websocket_slot_leases;");
  });

  it("re-arms an early alarm and opens exactly once at startsAt", async () => {
    const auctionId = "auction-room-alarm-early";
    const startsAt = new Date(Date.now() + 60_000).toISOString();
    const endsAt = new Date(Date.now() + 120_000).toISOString();
    const revisionId = await seedScheduled(auctionId, startsAt, endsAt);
    const stub = env.AUCTION_ROOMS.getByName(auctionId);

    await stub.ensureRevisionSchedule(auctionId, revisionId, startsAt);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await expect(status(auctionId)).resolves.toMatchObject({ status: "SCHEDULED", version: 1 });
    const nextAlarm = await runInDurableObject(stub, (_instance, state) =>
      state.storage.getAlarm(),
    );
    expect(nextAlarm).toBe(Date.parse(startsAt));

    const afterStart = new Date(Date.parse(startsAt) + 1).toISOString();
    await stub.advanceDueTransitions(afterStart);
    await expect(status(auctionId)).resolves.toMatchObject({ status: "OPEN", version: 2 });
    await stub.advanceDueTransitions(afterStart);
    await expect(status(auctionId)).resolves.toMatchObject({ status: "OPEN", version: 2 });
  });

  it("hands an ended OPEN auction to CLOSING and removes CANCELLED alarms", async () => {
    const auctionId = "auction-room-alarm-ended";
    const revisionId = await seedScheduled(
      auctionId,
      new Date(Date.now() - 120_000).toISOString(),
      new Date(Date.now() - 60_000).toISOString(),
    );
    const stub = env.AUCTION_ROOMS.getByName(auctionId);
    await stub.ensureRevisionSchedule(auctionId, revisionId, new Date().toISOString());
    await stub.advanceDueTransitions(new Date().toISOString());
    await expect(status(auctionId)).resolves.toMatchObject({ status: "CLOSING", version: 3 });

    const cancelledId = "auction-room-alarm-cancelled";
    const cancelledRevision = await seedScheduled(
      cancelledId,
      new Date(Date.now() + 60_000).toISOString(),
      new Date(Date.now() + 120_000).toISOString(),
    );
    const cancelledStub = env.AUCTION_ROOMS.getByName(cancelledId);
    await cancelledStub.ensureRevisionSchedule(
      cancelledId,
      cancelledRevision,
      new Date().toISOString(),
    );
    await env.DB.prepare("UPDATE auctions SET status = 'CANCELLED' WHERE id = ?")
      .bind(cancelledId)
      .run();
    await cancelledStub.ensureRevisionSchedule(
      cancelledId,
      cancelledRevision,
      new Date().toISOString(),
    );
    await expect(
      runInDurableObject(cancelledStub, (_instance, state) => state.storage.getAlarm()),
    ).resolves.toBeNull();
  });
});
