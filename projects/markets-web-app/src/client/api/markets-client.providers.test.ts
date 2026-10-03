import { describe, expect, it, vi } from "vite-plus/test";

import { createMarketsClient } from "./markets-client";

function clientWithRequests() {
  const fetcher = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: [] }), {
        headers: { "Content-Type": "application/json" },
      }),
  );
  return { client: createMarketsClient(fetcher), fetcher };
}

function jsonBody(init?: RequestInit) {
  if (typeof init?.body !== "string") throw new Error("JSON body required");
  return JSON.parse(init.body) as unknown;
}

describe("Points provider requests", () => {
  it("selects one provider for CSV validation and commit", async () => {
    const { client, fetcher } = clientWithRequests();
    const preview = {
      auctionCommandId: "command",
      fileHash: "hash",
      providerId: "provider-a",
      rows: [],
    };
    await client.validateAuctionImport(new File(["title"], "auctions.csv"), "provider-a", {
      idempotencyKey: "validate",
    });
    await client.commitAuctionImport(preview, { idempotencyKey: "commit" });

    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/auctions/import/validate");
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("X-Points-Provider-Id")).toBe(
      "provider-a",
    );
    expect(jsonBody(fetcher.mock.calls[1]?.[1])).toEqual({ providerId: "provider-a", preview });
  });

  it("sends the selected provider for linking and unlinking", async () => {
    const { client, fetcher } = clientWithRequests();
    await client.startPointsConnection("provider-b", { idempotencyKey: "link" });
    await client.startPointsUnlink("provider-b", "利用者による連携解除", {
      idempotencyKey: "unlink",
    });

    expect(jsonBody(fetcher.mock.calls[0]?.[1])).toEqual({ providerId: "provider-b" });
    expect(jsonBody(fetcher.mock.calls[1]?.[1])).toEqual({
      providerId: "provider-b",
      reason: "利用者による連携解除",
    });
  });

  it("keeps admin mutations scoped to the provider and includes their reasons", async () => {
    const { client, fetcher } = clientWithRequests();
    await client.createPointsProvider("https://points.example", "Example", "接続するため", {
      idempotencyKey: "create",
    });
    await client.activatePointsProvider("provider-a", "client-a", "登録完了", {
      idempotencyKey: "activate",
    });
    await client.stopPointsProvider("provider-a", "運用停止", { idempotencyKey: "stop" });

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/admin/points-connections",
      "/api/admin/points-connections/provider-a/activate",
      "/api/admin/points-connections/provider-a/stop",
    ]);
    expect(jsonBody(fetcher.mock.calls[2]?.[1])).toEqual({ reason: "運用停止" });
  });

  it("returns to provider management after a fresh Google login", async () => {
    const { client, fetcher } = clientWithRequests();
    await client.startGoogleLogin("/admin/points-connections");
    expect(jsonBody(fetcher.mock.calls[0]?.[1])).toMatchObject({
      callbackURL: "/admin/points-connections",
      provider: "google",
    });
  });

  it("updates the actual watchlist route used by the backend", async () => {
    const { client, fetcher } = clientWithRequests();
    await client.watch("auction-a", true);
    await client.watch("auction-a", false);
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/watchlist/auction-a", "PUT"],
      ["/api/watchlist/auction-a", "DELETE"],
    ]);
  });
});
