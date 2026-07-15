import { useState } from "react";

import { createIdempotencyKey, type MarketsClient } from "../client/api/markets-client";
import { ProblemBanner } from "./problem-banner";

export function AuctionBidForm({
  auctionId,
  auctionVersion,
  canBid,
  client,
  hasAutoBid,
  onChanged,
}: Readonly<{
  auctionId: string;
  auctionVersion: number;
  canBid: boolean;
  client: MarketsClient;
  hasAutoBid: boolean;
  onChanged: () => void;
}>) {
  const [price, setPrice] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [autoBidMax, setAutoBidMax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function mutate(operation: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await operation();
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "REQUEST_FAILED");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="bid-heading" className="sub-panel">
      <h2 id="bid-heading">入札</h2>
      {!canBid ? <p className="status-label">最新状態の確認中は入札できません。</p> : null}
      {error ? <ProblemBanner message={error} /> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void mutate(() => {
            const idempotencyKey = createIdempotencyKey("bid");
            return client.bid(
              auctionId,
              {
                ...(autoBidMax ? { autoBidMaxTickCount: Number(autoBidMax) } : {}),
                expectedAuctionVersion: auctionVersion,
                priceTickCount: price,
                quantity,
              },
              { idempotencyKey },
            );
          });
        }}
      >
        <label htmlFor="bid-price">価格tick数</label>
        <input
          disabled={!canBid || busy}
          id="bid-price"
          min={1}
          onChange={(event) => setPrice(event.currentTarget.valueAsNumber)}
          required
          type="number"
          value={price}
        />
        <label htmlFor="bid-quantity">数量</label>
        <input
          disabled={!canBid || busy}
          id="bid-quantity"
          min={1}
          onChange={(event) => setQuantity(event.currentTarget.valueAsNumber)}
          required
          type="number"
          value={quantity}
        />
        <label htmlFor="auto-bid-max">AutoBid上限tick数（任意）</label>
        <input
          disabled={!canBid || busy}
          id="auto-bid-max"
          min={1}
          onChange={(event) => setAutoBidMax(event.currentTarget.value)}
          type="number"
          value={autoBidMax}
        />
        <button disabled={!canBid || busy} type="submit">
          入札する
        </button>
      </form>
      {hasAutoBid ? (
        <button
          disabled={!canBid || busy}
          onClick={() =>
            void mutate(() =>
              client.cancelAutoBid(auctionId, auctionVersion, {
                idempotencyKey: createIdempotencyKey("auto_bid_cancel"),
              }),
            )
          }
          type="button"
        >
          AutoBidを取消
        </button>
      ) : null}
      <button
        disabled={!canBid || busy}
        onClick={() =>
          void mutate(() =>
            client.buyNow(
              auctionId,
              { expectedAuctionVersion: auctionVersion, quantity },
              { idempotencyKey: createIdempotencyKey("buy_now") },
            ),
          )
        }
        type="button"
      >
        即時購入（Settlement開始）
      </button>
    </section>
  );
}
