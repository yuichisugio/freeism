import { useCallback } from "react";

import { type MarketsClient } from "../client/api/markets-client";
import { useApiResource } from "../client/api/use-api-resource";
import { AuctionCard } from "./auction-card";
import { ProblemBanner } from "./problem-banner";

export function MyAuctionHistory({
  client,
  kind,
  title,
}: Readonly<{
  client: MarketsClient;
  kind: "created" | "bids" | "won";
  title: string;
}>) {
  const load = useCallback(() => client.history(kind), [client, kind]);
  const resource = useApiResource(load);
  return (
    <main className="page-shell">
      <section aria-labelledby={`${kind}-heading`} className="ledger-panel">
        <p className="eyebrow">My auctions</p>
        <h1 id={`${kind}-heading`}>{title}</h1>
        {resource.loading ? <p aria-live="polite">読み込み中…</p> : null}
        {resource.error ? (
          <ProblemBanner message="本人履歴を取得できません。ログイン状態をご確認ください。" />
        ) : null}
        {resource.data?.items.length === 0 ? <p>該当する履歴はありません。</p> : null}
        <div className="card-grid">
          {resource.data?.items.map((item) => (
            <div key={`${item.kind}-${item.auction.auctionId}`}>
              <AuctionCard auction={item.auction} />
              {item.allocation ? (
                <p>
                  確定数量: {item.allocation.quantity} /{" "}
                  <a href={`/proofs/${item.allocation.proofId}`}>取引証明</a>
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
