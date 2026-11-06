import { env } from "cloudflare:test";
import { expect, it } from "vite-plus/test";

import { readPublicAuction } from "../../src/backend/history/read-auction-history";

it("namespaces snapshots and enforces the auction provider at the database boundary", async () => {
  const suffix = crypto.randomUUID();
  const providerA = `provider_a_${suffix}`;
  const providerB = `provider_b_${suffix}`;
  const sellerAuthId = `seller_auth_${suffix}`;
  const buyerAuthId = `buyer_auth_${suffix}`;
  const sellerId = `seller_${suffix}`;
  const buyerId = `buyer_${suffix}`;
  const auctionId = `auction_${suffix}`;
  const hash = "a".repeat(64);

  for (const [providerId, name] of [
    [providerA, "A"],
    [providerB, "B"],
  ]) {
    await env.DB.prepare(`INSERT INTO points_provider
      (id, display_name, origin, issuer, resource, client_public_jwk, status)
      VALUES (?, ?, ?, ?, ?, '{}', 'ACTIVE')`)
      .bind(
        providerId,
        name,
        `https://${providerId}.example.test`,
        `https://${providerId}.example.test/auth`,
        `https://${providerId}.example.test/api`,
      )
      .run();
  }
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
  ]);

  for (const providerId of [providerA, providerB]) {
    await env.DB.prepare(`INSERT INTO point_package_snapshots
      (id, provider_id, point_package_id, point_package_revision_id, name, total_weight)
      VALUES (?, ?, 'same-package', 'same-revision', 'Package', 1)`)
      .bind(`snapshot_${providerId}`, providerId)
      .run();
  }
  const snapshots = await env.DB.prepare(
    "SELECT provider_id FROM point_package_snapshots WHERE point_package_revision_id = 'same-revision' AND provider_id IN (?, ?)",
  )
    .bind(providerA, providerB)
    .all<{ provider_id: string }>();
  expect(snapshots.results).toHaveLength(2);

  await env.DB.prepare(
    "INSERT INTO auctions (id, provider_id, seller_markets_user_id, status, version) VALUES (?, ?, ?, 'OPEN', 1)",
  )
    .bind(auctionId, providerA, sellerId)
    .run();
  await env.DB.prepare(`INSERT INTO points_connection
    (id, provider_id, markets_user_id, auth_user_id, status, link_attempt_id, attempt_payload_hash,
     points_issuer, points_subject, user_client_id, m2m_client_id, granted_scopes, session_id, expires_at)
    VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, 'user-client', 'm2m-client', 'auction:bid', ?, ?)`)
    .bind(
      `connection_${suffix}`,
      providerB,
      buyerId,
      buyerAuthId,
      `attempt_${suffix}`,
      hash,
      `https://${providerB}.example.test/auth`,
      `subject_${suffix}`,
      `session_${suffix}`,
      Date.now() + 60_000,
    )
    .run();

  const command = (operation: string) =>
    env.DB.prepare(`INSERT INTO auction_commands
    (id, auction_id, command_id, actor_markets_user_id, operation, payload_hash,
     expected_auction_version, status) VALUES (?, ?, ?, ?, ?, ?, 1, 'COMPLETED')`).bind(
      `record_${crypto.randomUUID()}`,
      auctionId,
      `command_${crypto.randomUUID()}`,
      buyerId,
      operation,
      hash,
    );
  await expect(command("PLACE_BID").run()).rejects.toThrow(/POINTS_LINK_REQUIRED/);
  await env.DB.prepare("UPDATE points_provider SET status = 'STOPPED' WHERE id = ?")
    .bind(providerA)
    .run();
  await expect(command("BUY_NOW").run()).rejects.toThrow(/POINTS_PROVIDER_INACTIVE/);
  await expect(
    env.DB.prepare(
      "INSERT INTO auctions (id, provider_id, seller_markets_user_id) VALUES (?, ?, ?)",
    )
      .bind(`stopped_auction_${suffix}`, providerA, sellerId)
      .run(),
  ).rejects.toThrow(/POINTS_PROVIDER_INACTIVE/);
  await expect(command("CANCEL_AUTO_BID").run()).resolves.toBeDefined();

  const revisionId = `revision_${suffix}`;
  await env.DB.prepare(`INSERT INTO auction_revisions
    (id, auction_id, revision_number, title, description, external_url,
     seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity,
     starts_at, ends_at, package_tick, eligibility_receipt_id, auction_command_id,
     auction_command_hash, package_eligibility_version, eligibility_checked_at,
     eligibility_valid_until, commit_started_at)
    VALUES (?, ?, 1, 'Auction', '', 'https://example.test/item', '{}', ?, ?, 3,
      '2020-01-01T00:00:00.000Z', '2030-01-01T00:00:00.000Z', 1, ?, ?, ?, 1,
      '2020-01-01T00:00:00.000Z', '2030-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z')`)
    .bind(
      revisionId,
      auctionId,
      `https://${providerA}.example.test/auth`,
      `snapshot_${providerA}`,
      `receipt_${suffix}`,
      `import_${suffix}`,
      `sha256:${hash}`,
    )
    .run();
  await env.DB.batch([
    env.DB.prepare("UPDATE auctions SET current_revision_id = ? WHERE id = ?").bind(
      revisionId,
      auctionId,
    ),
    env.DB.prepare(
      "INSERT INTO watchlist_entries (id, markets_user_id, auction_id) VALUES (?, ?, ?)",
    ).bind(`watch_${suffix}`, buyerId, auctionId),
    env.DB.prepare(`INSERT INTO bid_positions
      (id, auction_id, bidder_markets_user_id, quantity, price_tick_count, reached_sequence)
      VALUES (?, ?, ?, 2, 5, 1)`).bind(`bid_${suffix}`, auctionId, buyerId),
    env.DB.prepare(`INSERT INTO auto_bid_rules
      (id, auction_id, bidder_markets_user_id, quantity, auto_bid_max_tick_count, active)
      VALUES (?, ?, ?, 2, 10, 1)`).bind(`auto_${suffix}`, auctionId, buyerId),
  ]);
  const detail = await readPublicAuction(env.DB, auctionId, buyerId);
  expect(detail.viewer).toEqual({ isSeller: false, watching: true, autoBidMaxTickCount: 10 });
  expect(detail).toMatchObject({
    availableQuantity: 3,
    provisionalAllocatedQuantity: 2,
    publicPriceTickCount: 0,
    providerId: providerA,
    providerStatus: "STOPPED",
  });
  expect((await readPublicAuction(env.DB, auctionId)).viewer).toBeNull();
});
