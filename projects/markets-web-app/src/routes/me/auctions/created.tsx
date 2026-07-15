import { createFileRoute } from "@tanstack/react-router";

import { marketsClient, type MarketsClient } from "../../../client/api/markets-client";
import { MyAuctionHistory } from "../../../components/my-auction-history";

export const Route = createFileRoute("/me/auctions/created")({
  component: MyAuctionCreatedPage,
  head: () => ({ meta: [{ title: "出品したAuction | Freeism Markets" }] }),
});

export function MyAuctionCreatedPage({
  client = marketsClient,
}: Readonly<{ client?: MarketsClient }>) {
  return <MyAuctionHistory client={client} kind="created" title="出品したAuction" />;
}
