import { env, runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createMarketsBackendApp } from "../../src/backend/app";

const auctionId = "auction-room-websocket";
const marketsUserId = "musr_auction_room";

async function seedAuction() {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO user (id, name, email) VALUES ('auth-room', 'Room', 'room@example.test')",
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ('acc-room', 'google-room', 'google', 'auth-room', 1)",
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO markets_user (id, auth_user_id) VALUES (?, 'auth-room')",
    ).bind(marketsUserId),
    env.DB.prepare(
      "INSERT OR IGNORE INTO point_package_snapshots (id, point_package_id, point_package_revision_id, name, total_weight) VALUES ('pps-room', 'pp-room', 'ppr-room', 'Room package', 1)",
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO auctions (id, seller_markets_user_id, status, version) VALUES (?, ?, 'OPEN', 1)",
    ).bind(auctionId, marketsUserId),
    env.DB.prepare(
      "INSERT OR IGNORE INTO auction_revisions (id, auction_id, revision_number, title, description, external_url, seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity, starts_at, ends_at, package_tick, eligibility_receipt_id, auction_command_id, auction_command_hash, package_eligibility_version, eligibility_checked_at, eligibility_valid_until, commit_started_at) VALUES ('rev-room', ?, 1, 'Room', '', 'https://example.test/item', '{}', 'https://points.example.test', 'pps-room', 1, ?, ?, 1, 'receipt-room', 'command-room', 'hash-room', 1, ?, ?, ?)",
    ).bind(
      auctionId,
      new Date(Date.now() - 60_000).toISOString(),
      new Date(Date.now() + 60_000).toISOString(),
      new Date().toISOString(),
      new Date(Date.now() + 60_000).toISOString(),
      new Date().toISOString(),
    ),
    env.DB.prepare(
      "UPDATE auctions SET current_revision_id = 'rev-room', status = 'OPEN' WHERE id = ?",
    ).bind(auctionId),
  ]);
}

function authenticatedApp() {
  return createMarketsBackendApp(async () => ({
    session: { id: "session-room", userId: "auth-room" },
    user: { id: "auth-room" },
  }));
}

function upgradeRequest(query = "") {
  return new Request(`https://markets.example.test/api/auctions/${auctionId}/events${query}`, {
    headers: {
      Connection: "Upgrade",
      Origin: "https://markets.example.test",
      "Sec-Fetch-Site": "same-origin",
      Upgrade: "websocket",
    },
  });
}

async function closeCode(socket: WebSocket) {
  return new Promise<number>((resolve) =>
    socket.addEventListener("close", (event) => resolve(event.code), { once: true }),
  );
}

describe("AuctionRoom Hibernation WebSocket", () => {
  beforeEach(async () => {
    await env.DB.exec("DELETE FROM websocket_slot_leases;");
    await seedAuction();
  });

  it("rejects token query, hostile Origin, and missing session before upgrade", async () => {
    expect(
      (await authenticatedApp().fetch(upgradeRequest("?access_token=secret"), env)).status,
    ).toBe(400);
    const hostile = upgradeRequest();
    hostile.headers.set("Origin", "https://evil.example");
    expect((await authenticatedApp().fetch(hostile, env)).status).toBe(403);
    expect(
      (await createMarketsBackendApp(async () => null).fetch(upgradeRequest(), env)).status,
    ).toBe(401);
  });

  it("accepts through Hibernation API with only the four attachment identifiers", async () => {
    const response = await authenticatedApp().fetch(upgradeRequest("?lastBidSeq=0"), env);
    expect(response.status).toBe(101);
    const client = response.webSocket;
    expect(client).not.toBeNull();
    client!.accept();

    const stub = env.AUCTION_ROOMS.getByName(auctionId);
    const attachment = await runInDurableObject(stub, (_instance, state) =>
      state.getWebSockets()[0]?.deserializeAttachment(),
    );
    expect(Object.keys(attachment).sort()).toEqual([
      "auctionId",
      "connectionId",
      "lastBidSeq",
      "marketsUserId",
    ]);
    client!.close(1000, "done");
  });

  it("closes domain commands with 1008 and frames over 4 KiB with 1009", async () => {
    const commandResponse = await authenticatedApp().fetch(upgradeRequest(), env);
    const commandSocket = commandResponse.webSocket!;
    commandSocket.accept();
    const commandClose = closeCode(commandSocket);
    commandSocket.send(JSON.stringify({ priceTickCount: 3, type: "bid" }));
    await expect(commandClose).resolves.toBe(1008);

    const largeResponse = await authenticatedApp().fetch(upgradeRequest(), env);
    const largeSocket = largeResponse.webSocket!;
    largeSocket.accept();
    const largeClose = closeCode(largeSocket);
    largeSocket.send("x".repeat(4097));
    await expect(largeClose).resolves.toBe(1009);
  });
});
