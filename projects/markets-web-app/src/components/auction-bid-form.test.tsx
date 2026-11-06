import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { MarketsClient } from "../client/api/markets-client";
import { AuctionBidForm } from "./auction-bid-form";

describe("auction bid availability", () => {
  it("shows the provider stop reason when bid actions are unavailable", () => {
    const html = renderToStaticMarkup(
      <AuctionBidForm
        auctionId="auction-a"
        auctionVersion={1}
        canBid={false}
        canCancelAutoBid={false}
        client={{} as MarketsClient}
        hasAutoBid={false}
        onChanged={() => undefined}
        unavailableReason="このポイントサービスは現在停止中のため、追加入札と即時購入はできません。"
      />,
    );

    expect(html).toContain("現在停止中");
    expect(html).toContain('<button disabled="" type="submit">入札する</button>');
  });

  it("keeps auto-bid cancellation available while new bids are blocked", () => {
    const html = renderToStaticMarkup(
      <AuctionBidForm
        auctionId="auction-a"
        auctionVersion={3}
        canBid={false}
        canCancelAutoBid={true}
        client={{} as MarketsClient}
        hasAutoBid={true}
        onChanged={() => undefined}
        unavailableReason="このポイントサービスは現在停止中です。"
      />,
    );

    expect(html).toContain('<button disabled="" type="submit">入札する</button>');
    expect(html).toContain('<button type="button">AutoBidを取消</button>');
  });
});
