import { createFileRoute } from "@tanstack/react-router";

import { marketsClient, type MarketsClient } from "../../../client/api/markets-client";
import { MyAuctionHistory } from "../../../components/my-auction-history";

export const Route = createFileRoute("/me/auctions/won")({
  component: MyAuctionWonPage,
  head: () => ({ meta: [{ title: "落札履歴 | Freeism Markets" }] }),
});

export function MyAuctionWonPage({ client = marketsClient }: Readonly<{ client?: MarketsClient }>) {
  return <MyAuctionHistory client={client} kind="won" title="落札履歴" />;
}
