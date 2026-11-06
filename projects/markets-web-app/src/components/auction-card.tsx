import type { PublicAuctionCard } from "../client/api/markets-client";
import { LocalDateTime } from "./local-date-time";

export function AuctionCard({ auction }: Readonly<{ auction: PublicAuctionCard }>) {
  return (
    <article className="auction-card">
      <p className="status-label">状態: {auction.status}</p>
      <h2>
        <a href={`/auctions/${encodeURIComponent(auction.auctionId)}`}>{auction.title}</a>
      </h2>
      <p>{auction.description}</p>
      <p>
        ポイントサービス: {auction.providerDisplayName} ({auction.providerOrigin})
      </p>
      {auction.providerStatus === "STOPPED" ? (
        <p className="status-label">このポイントサービスは現在停止中です。</p>
      ) : null}
      <dl className="fact-list">
        <div>
          <dt>ポイントパッケージ</dt>
          <dd>{auction.pointPackageName}</dd>
        </div>
        {auction.buyNowPriceTickCount != null ? (
          <div>
            <dt>即時購入価格</dt>
            <dd>{auction.buyNowPriceTickCount * auction.packageTick}</dd>
          </div>
        ) : null}
        <div>
          <dt>終了</dt>
          <dd>
            <LocalDateTime value={auction.endsAt} />
          </dd>
        </div>
      </dl>
    </article>
  );
}
