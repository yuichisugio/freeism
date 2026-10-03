import { describe, expect, it } from "vite-plus/test";

import { calculateAuctionCommandIdentity } from "./validate-auction-import";

describe("Auction import identity", () => {
  it("separates identical package revisions and rows by provider", async () => {
    const rows = [
      {
        clientRowId: "row-1",
        title: "Auction",
        description: "",
        externalUrl: "https://example.test/item",
        pointPackageId: "package-1",
        pointPackageRevisionId: "revision-1",
        quantity: 1,
        startsAt: "2030-01-01T00:00:00.000Z",
        endsAt: "2030-01-02T00:00:00.000Z",
        buyNowPriceTickCount: null,
        extensionThresholdSeconds: null,
        extensionDurationSeconds: null,
        maxExtensions: null,
        packageSnapshot: {
          pointPackageId: "package-1",
          pointPackageRevisionId: "revision-1",
          status: "ACTIVE" as const,
          name: "Package",
          description: null,
          relatedUrl: null,
          totalWeight: 1,
          packageTick: 1,
          contentHash: `sha256:${"a".repeat(64)}`,
          components: [],
        },
      },
    ];
    const first = await calculateAuctionCommandIdentity(rows, "provider-a");
    const second = await calculateAuctionCommandIdentity(rows, "provider-b");
    expect(first.auctionCommandHash).not.toBe(second.auctionCommandHash);
    expect(first.auctionCommandId).not.toBe(second.auctionCommandId);
  });
});
