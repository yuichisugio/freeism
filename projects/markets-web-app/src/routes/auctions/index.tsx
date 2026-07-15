import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  marketsClient,
  type MarketsClient,
  type PublicAuctionStatus,
} from "../../client/api/markets-client";
import { useApiResource } from "../../client/api/use-api-resource";
import { AuctionCard } from "../../components/auction-card";
import { ProblemBanner } from "../../components/problem-banner";

export const Route = createFileRoute("/auctions/")({
  component: AuctionListPage,
  head: () => ({ meta: [{ title: "Auction一覧 | Freeism Markets" }] }),
});

export function AuctionListPage({ client = marketsClient }: Readonly<{ client?: MarketsClient }>) {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState<PublicAuctionStatus | "">("");
  const load = useCallback(
    () =>
      client.auctions({
        cursor: null,
        query: appliedQuery || null,
        status: status || null,
      }),
    [appliedQuery, client, status],
  );
  const resource = useApiResource(load);

  return (
    <main className="page-shell">
      <section aria-labelledby="auctions-heading" className="ledger-panel">
        <p className="eyebrow">Marketplace</p>
        <h1 id="auctions-heading">Auction一覧</h1>
        <form
          className="filter-form"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedQuery(query.trim());
          }}
        >
          <label htmlFor="auction-query">キーワード</label>
          <input
            id="auction-query"
            maxLength={100}
            onChange={(event) => setQuery(event.currentTarget.value)}
            value={query}
          />
          <label htmlFor="auction-status">状態</label>
          <select
            id="auction-status"
            onChange={(event) => setStatus(event.currentTarget.value as PublicAuctionStatus | "")}
            value={status}
          >
            <option value="">すべて</option>
            <option value="SCHEDULED">開始前</option>
            <option value="OPEN">開催中</option>
            <option value="CLOSED">終了</option>
            <option value="SETTLING">精算中</option>
            <option value="SETTLED">精算済み</option>
          </select>
          <button type="submit">検索</button>
        </form>
        {resource.loading ? <p aria-live="polite">読み込み中…</p> : null}
        {resource.error ? (
          <ProblemBanner message="Auction一覧を取得できません。未取得のAuctionは表示しません。" />
        ) : null}
        {resource.data?.items.length === 0 ? <p>該当するAuctionはありません。</p> : null}
        <div className="card-grid">
          {resource.data?.items.map((auction) => (
            <AuctionCard auction={auction} key={auction.auctionId} />
          ))}
        </div>
      </section>
    </main>
  );
}
