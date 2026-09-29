import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { marketsClient, type MarketsClient } from "../../client/api/markets-client";
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

export function AuctionDetailPage({
  auctionId,
  client = marketsClient,
}: Readonly<{ auctionId: string; client?: MarketsClient }>) {
  const loadPublic = useCallback(() => client.auction(auctionId), [auctionId, client]);
  const loadPrivate = useCallback(() => client.privateAuction(auctionId), [auctionId, client]);
  const loadConnections = useCallback(() => client.pointsConnection(), [client]);
  const publicResource = useApiResource(loadPublic);
  const privateResource = useApiResource(loadPrivate, { clearOnError: true });
  const connections = useApiResource(loadConnections, { clearOnError: true });
  const viewer = privateResource.data?.viewer;
  const auction = publicResource.data;
  const selectedConnection = connections.data?.find(
    (item) => item.providerId === auction?.providerId,
  );
  const linked = selectedConnection?.connection?.status === "ACTIVE";
  const resync = useCallback(async () => {
    const snapshot = await client.auction(auctionId);
    publicResource.reload();
    privateResource.reload();
    connections.reload();
    return {
      auctionId: snapshot.auctionId,
      auctionVersion: snapshot.version,
      bidSeq: Math.max(0, ...snapshot.events.map((event) => event.bidSeq)),
      status: snapshot.status,
    };
  }, [auctionId, client, connections.reload, privateResource.reload, publicResource.reload]);
  const connection = useAuctionEvents({
    applyPublicEvent: () => publicResource.reload(),
    auctionId,
    enabled: Boolean(auction && privateResource.data),
    initial: {
      auctionId,
      auctionVersion: auction?.version ?? 0,
      bidSeq: Math.max(0, ...(auction?.events.map((event) => event.bidSeq) ?? [])),
      status: auction?.status ?? "SCHEDULED",
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
            <p>{publicResource.data.description}</p>
            <p>
              ポイントサービス: {publicResource.data.providerDisplayName} (
              {publicResource.data.providerOrigin})
            </p>
            {publicResource.data.providerStatus === "STOPPED" ? (
              <p className="status-label">このポイントサービスは現在停止中です。</p>
            ) : null}
            <p className="status-label">状態: {publicResource.data.status}</p>
            <dl className="fact-list">
              <div>
                <dt>開始</dt>
                <dd>
                  <LocalDateTime value={publicResource.data.startsAt} />
                </dd>
              </div>
              <div>
                <dt>終了</dt>
                <dd>
                  <LocalDateTime value={publicResource.data.endsAt} />
                </dd>
              </div>
              <div>
                <dt>残数量</dt>
                <dd>{publicResource.data.availableQuantity}</dd>
              </div>
            </dl>
            <p>ポイントパッケージ: {publicResource.data.pointPackageName}</p>
            <a href={publicResource.data.externalUrl}>商材URL</a>
            <AuctionRanking
              allocatedQuantity={publicResource.data.provisionalAllocatedQuantity}
              price={publicResource.data.publicPriceTickCount * publicResource.data.packageTick}
            />
          </>
        ) : null}
        <p aria-live="polite" className="connection-state">
          リアルタイム接続: {connection.state}
        </p>
        {privateResource.error ? <p>ログインすると本人向け操作を利用できます。</p> : null}
        {viewer ? (
          <button
            onClick={() =>
              void client.watch(auctionId, !viewer.watching).then(() => privateResource.reload())
            }
            type="button"
          >
            {viewer.watching ? "watchlistから削除" : "watchlistへ追加"}
          </button>
        ) : null}
        <AuctionBidForm
          auctionId={auctionId}
          auctionVersion={connection.auctionVersion || auction?.version || 0}
          canBid={
            connection.canBid &&
            auction?.providerStatus === "ACTIVE" &&
            linked &&
            !privateResource.data?.viewer.isSeller
          }
          canCancelAutoBid={connection.canBid && !privateResource.data?.viewer.isSeller}
          client={client}
          hasAutoBid={privateResource.data?.viewer.autoBidMaxTickCount != null}
          onChanged={() => {
            publicResource.reload();
            privateResource.reload();
            connections.reload();
          }}
          unavailableReason={
            auction?.providerStatus === "STOPPED"
              ? "このポイントサービスは現在停止中のため、追加入札と即時購入はできません。"
              : privateResource.data?.viewer.isSeller
                ? "出品者は入札できません。"
                : connections.data && !linked
                  ? `${auction?.providerDisplayName ?? "ポイントサービス"}との連携が必要です。連携画面から手続きしてください。`
                  : undefined
          }
        />
        {auction?.providerStatus === "ACTIVE" &&
        privateResource.data &&
        !privateResource.data.viewer.isSeller &&
        connections.data &&
        !linked ? (
          <a href="/settings/points-connection">ポイントサービスを連携する</a>
        ) : null}
        <AuctionManagementForm />
      </section>
    </main>
  );
}
