import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { PublicAuctionCard } from "../client/api/markets-client";
import { AuctionCard } from "./auction-card";

// read-auction-history.ts の publicAuction() が返す形に合わせる。
const auction = {
  auctionId: "auction-a",
  providerId: "provider-a",
  providerDisplayName: "Example Points",
  providerOrigin: "https://points.example",
  providerStatus: "STOPPED",
  buyNowPriceTickCount: 5,
  description: "説明",
  endsAt: "2026-10-01T00:00:00.000Z",
  externalUrl: "https://example.test/item",
  packageTick: 10,
  pointPackageId: "package-a",
  pointPackageName: "100pt パッケージ",
  pointPackageRevisionId: "revision-a",
  quantity: 2,
  seller: {},
  startsAt: "2026-09-30T00:00:00.000Z",
  status: "OPEN",
  title: "出品A",
  version: 3,
} satisfies PublicAuctionCard;

describe("auction card with actual read response", () => {
  it("shows the provider and package without relying on absent response fields", () => {
    const html = renderToStaticMarkup(<AuctionCard auction={auction} />);
    expect(html).toContain("Example Points");
    expect(html).toContain("https://points.example");
    expect(html).toContain("100pt パッケージ");
    expect(html).toContain("現在停止中");
    expect(html).toContain("50");
  });
});
