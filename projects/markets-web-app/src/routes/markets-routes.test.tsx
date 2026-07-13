import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { AuctionDetailPage } from "./auctions/$auctionId";
import { AuctionImportPage } from "./auctions/import";
import { AuctionListPage } from "./auctions/index";
import { LoginPage } from "./login";
import { MyAuctionBidsPage } from "./me/auctions/bids";
import { MyAuctionCreatedPage } from "./me/auctions/created";
import { MyAuctionWonPage } from "./me/auctions/won";
import { ProofPage } from "./proofs/$proofId";
import { PointsConnectionPage } from "./settings/points-connection";
import { SettlementPage } from "./settlements/$settlementId/index";
import { createMarketsClient } from "../client/api/markets-client";
import { AppShell, CANONICAL_MARKETS_ROUTES } from "../components/app-shell";
import { en } from "../locales/en";
import { ja } from "../locales/ja";

describe("Markets canonical routes", () => {
  it("exposes only the new canonical application routes", () => {
    expect(CANONICAL_MARKETS_ROUTES).toEqual([
      "/login",
      "/settings/points-connection",
      "/auctions",
      "/auctions/import",
      "/auctions/$auctionId",
      "/me/auctions/created",
      "/me/auctions/bids",
      "/me/auctions/won",
      "/proofs/$proofId",
      "/settlements/$settlementId",
    ]);

    const shell = renderToStaticMarkup(<AppShell>content</AppShell>);
    expect(shell).toContain('href="/auctions"');
    expect(shell).not.toContain("/dashboard");
    expect(shell).not.toContain("/listings");
  });

  it("renders Google-only login and accessible core controls", () => {
    const html = [
      <LoginPage key="login" />,
      <PointsConnectionPage key="points" />,
      <AuctionListPage key="list" />,
      <AuctionImportPage key="import" />,
      <AuctionDetailPage auctionId="auction_1" key="detail" />,
      <MyAuctionCreatedPage key="created" />,
      <MyAuctionBidsPage key="bids" />,
      <MyAuctionWonPage key="won" />,
      <ProofPage key="proof" proofId="proof_1" />,
      <SettlementPage key="settlement" settlementId="settlement_1" />,
    ].map((page) => renderToStaticMarkup(page));

    expect(html[0]).toContain("Googleでログイン");
    expect(html[0]).not.toMatch(/password|Apple/i);
    expect(html[1]).toContain("Points連携");
    expect(html[3]).toContain('type="file"');
    expect(html[3]).toContain("CSVファイル");
    expect(html[4]).toContain("入札");
    expect(html[8]).toContain("取引証明");
    expect(html[8]).not.toContain("レビューはまだありません");
    expect(html[9]).toContain("Settlement");
  });

  it("keeps Japanese and English label keys in parity", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
    expect(ja.loginWithGoogle).toBe("Googleでログイン");
    expect(en.loginWithGoogle).toBe("Continue with Google");
  });
});

describe("same-origin Markets client", () => {
  it("uses relative API paths and same-origin credentials", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ data: [], meta: { cursor: null, hasMore: false } }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
    );
    const client = createMarketsClient(fetcher);

    await client.auctions({ cursor: null, query: null, status: null });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("/api/v1/auctions?limit=20");
    expect(init).toMatchObject({ credentials: "same-origin" });
  });
});
