import { createFileRoute } from "@tanstack/react-router";

import { marketsClient, type MarketsClient } from "../../../client/api/markets-client";
import { MyAuctionHistory } from "../../../components/my-auction-history";

export const Route = createFileRoute("/me/auctions/bids")({
  component: MyAuctionBidsPage,
  head: () => ({ meta: [{ title: "入札履歴 | Freeism Markets" }] }),
});

export function MyAuctionBidsPage({
  client = marketsClient,
}: Readonly<{ client?: MarketsClient }>) {
  return <MyAuctionHistory client={client} kind="bids" title="入札履歴" />;
}
