import type { PublicAuctionCard } from "../client/api/markets-client";
import { LocalDateTime } from "./local-date-time";

export function AuctionCard({ auction }: Readonly<{ auction: PublicAuctionCard }>) {
  return (
    <article className="auction-card">
      <p className="status-label">状態: {auction.status}</p>
      <h2>
        <a href={`/auctions/${encodeURIComponent(auction.auctionId)}`}>{auction.title}</a>
      </h2>
      <p>{auction.descriptionSummary}</p>
      <dl className="fact-list">
        <div>
          <dt>ポイントパッケージ</dt>
          <dd>{auction.pointPackage.name}</dd>
        </div>
        <div>
          <dt>現在価格</dt>
          <dd>{auction.publicPriceTickCount * auction.packageTick}</dd>
        </div>
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
