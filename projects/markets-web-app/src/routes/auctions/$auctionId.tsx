import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  marketsClient,
  type MarketsClient,
  type PublicAuctionSnapshot,
} from "../../client/api/markets-client";
import { useApiResource } from "../../client/api/use-api-resource";
import { useAuctionEvents } from "../../client/auction/use-auction-events";
import { AuctionBidForm } from "../../components/auction-bid-form";
import { AuctionManagementForm } from "../../components/auction-management-form";
import { AuctionRanking } from "../../components/auction-ranking";
import { LocalDateTime } from "../../components/local-date-time";
import { ProblemBanner } from "../../components/problem-banner";

export const Route = createFileRoute("/auctions/$auctionId")({
  component: AuctionDetailRoute,
  head: () => ({ meta: [{ title: "Auction詳細 | Freeism Markets" }] }),
});

function AuctionDetailRoute() {
  const { auctionId } = Route.useParams();
  return <AuctionDetailPage auctionId={auctionId} />;
}

const EMPTY_SNAPSHOT: PublicAuctionSnapshot = {
  auctionId: "pending",
  auctionVersion: 0,
  availableQuantity: 0,
  bidSeq: 0,
  buyNowPriceTickCount: null,
  description: "",
  descriptionSummary: "",
  endsAt: "",
  externalUrl: "",
  packageTick: 1,
  pointPackage: { name: "" },
  provisionalAllocatedQuantity: 0,
  publicPriceTickCount: 0,
  quantity: 0,
  startsAt: "",
  status: "SCHEDULED",
  title: "",
};

export function AuctionDetailPage({
  auctionId,
  client = marketsClient,
}: Readonly<{ auctionId: string; client?: MarketsClient }>) {
  const loadPublic = useCallback(() => client.auction(auctionId), [auctionId, client]);
  const loadPrivate = useCallback(() => client.privateAuction(auctionId), [auctionId, client]);
  const publicResource = useApiResource(loadPublic);
  const privateResource = useApiResource(loadPrivate);
  const auction = publicResource.data ?? { ...EMPTY_SNAPSHOT, auctionId };
  const resync = useCallback(async () => {
    const snapshot = await client.auction(auctionId);
    publicResource.reload();
    privateResource.reload();
    return {
      auctionId: snapshot.auctionId,
      auctionVersion: snapshot.auctionVersion,
      bidSeq: snapshot.bidSeq,
      status: snapshot.status,
    };
  }, [auctionId, client, privateResource.reload, publicResource.reload]);
  const connection = useAuctionEvents({
    applyPublicEvent: () => publicResource.reload(),
    auctionId,
    enabled: Boolean(publicResource.data && privateResource.data),
    initial: {
      auctionId,
      auctionVersion: auction.auctionVersion,
      bidSeq: auction.bidSeq,
      status: auction.status,
    },
    resync,
  });

  return (
    <main className="page-shell">
      <section aria-labelledby="auction-heading" className="ledger-panel">
        <p className="eyebrow">Auction detail</p>
        <h1 id="auction-heading">{publicResource.data?.title ?? "Auction詳細"}</h1>
        {publicResource.loading ? <p aria-live="polite">読み込み中…</p> : null}
        {publicResource.error ? (
          <ProblemBanner message="Auctionを取得できません。存在しないか、現在公開されていません。" />
        ) : null}
        {publicResource.data ? (
          <>
            <p>{auction.description}</p>
            <p className="status-label">状態: {auction.status}</p>
            <dl className="fact-list">
              <div>
                <dt>開始</dt>
                <dd>
                  <LocalDateTime value={auction.startsAt} />
                </dd>
              </div>
              <div>
                <dt>終了</dt>
                <dd>
                  <LocalDateTime value={auction.endsAt} />
                </dd>
              </div>
              <div>
                <dt>残数量</dt>
                <dd>{auction.availableQuantity}</dd>
              </div>
            </dl>
            <a href={auction.externalUrl}>商材URL</a>
            <AuctionRanking
              allocatedQuantity={auction.provisionalAllocatedQuantity}
              price={auction.publicPriceTickCount * auction.packageTick}
            />
          </>
        ) : null}
        <p aria-live="polite" className="connection-state">
          リアルタイム接続: {connection.state}
        </p>
        {privateResource.error ? (
          <p>ログインするとwatchlistと本人向け操作を利用できます。</p>
        ) : null}
        {privateResource.data ? (
          <button
            onClick={() =>
              void client
                .watch(auctionId, !privateResource.data!.viewer.watching)
                .then(() => privateResource.reload())
            }
            type="button"
          >
            {privateResource.data.viewer.watching ? "watchlistから削除" : "watchlistへ追加"}
          </button>
        ) : null}
        <AuctionBidForm
          auctionId={auctionId}
          auctionVersion={connection.auctionVersion || auction.auctionVersion}
          canBid={
            connection.canBid && privateResource.data?.viewer.pointsConnectionStatus === "ACTIVE"
          }
          client={client}
          hasAutoBid={privateResource.data?.viewer.autoBidMaxTickCount != null}
          onChanged={() => {
            publicResource.reload();
            privateResource.reload();
          }}
        />
        <AuctionManagementForm />
      </section>
    </main>
  );
}
