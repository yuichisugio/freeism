import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type {
  MarketsClient,
  PrivateAuctionSnapshot,
  PublicAuctionSnapshot,
} from "../../client/api/markets-client";
import { AuctionDetailPage } from "./$auctionId";

const auction: PublicAuctionSnapshot = {
  auctionId: "auction-a",
  providerId: "provider-a",
  providerDisplayName: "Example Points",
  providerOrigin: "https://points.example",
  providerStatus: "STOPPED",
  version: 3,
  title: "出品A",
  description: "説明",
  status: "OPEN",
  startsAt: "2026-09-28T00:00:00.000Z",
  endsAt: "2026-10-01T00:00:00.000Z",
  externalUrl: "https://example.test/item",
  quantity: 2,
  availableQuantity: 2,
  provisionalAllocatedQuantity: 1,
  publicPriceTickCount: 4,
  packageTick: 10,
  buyNowPriceTickCount: 5,
  pointPackageId: "package-a",
  pointPackageName: "100pt パッケージ",
  pointPackageRevisionId: "revision-a",
  seller: {},
  allocations: [],
  events: [{ bidSeq: 1, priceTickCount: 4 }],
};

class TestSocket {
  static instances: TestSocket[] = [];
  private listeners = new Map<string, (event: { data: string }) => void>();
  constructor() {
    TestSocket.instances.push(this);
  }
  addEventListener(type: string, listener: (event: { data: string }) => void) {
    this.listeners.set(type, listener);
  }
  close() {}
  emitSnapshot() {
    this.listeners.get("message")?.({
      data: JSON.stringify({
        auctionId: "auction-a",
        auctionVersion: 3,
        bidSeq: 1,
        data: {},
        occurredAt: "2026-09-29T00:00:00.000Z",
        type: "auction.snapshot",
      }),
    });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  TestSocket.instances = [];
  document.body.innerHTML = "";
});

describe("stopped provider auction details", () => {
  it("keeps watchlist and auto-bid cancellation while blocking new bids", async () => {
    vi.stubGlobal("WebSocket", TestSocket);
    const privateAuction: PrivateAuctionSnapshot = {
      ...auction,
      viewer: {
        isSeller: false,
        watching: true,
        autoBidMaxTickCount: 8,
      },
    };
    const client = {
      auction: async () => auction,
      privateAuction: async () => privateAuction,
      pointsConnection: async () => [
        {
          providerId: "provider-a",
          displayName: "Example Points",
          status: "STOPPED",
          connection: { id: "connection-a", status: "ACTIVE" },
        },
      ],
    } as unknown as MarketsClient;
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<AuctionDetailPage auctionId="auction-a" client={client} />);
    });
    expect(TestSocket.instances).toHaveLength(1);
    await act(async () => TestSocket.instances[0]?.emitSnapshot());

    expect(container.textContent).toContain("watchlistから削除");
    expect(container.textContent).toContain("AutoBidを取消");
    expect(container.innerHTML).toContain('<button type="button">AutoBidを取消</button>');
    expect(container.innerHTML).toContain('<button disabled="" type="submit">入札する</button>');
    await act(async () => root.unmount());
  });
});
