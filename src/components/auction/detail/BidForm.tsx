"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBidActions } from "@/hooks/auction/useBidActions";
import { type Auction } from "@/lib/auction/types";
import { formatCurrency } from "@/lib/formatters";

export type BidFormProps = {
  auction: Auction;
  onCancel: () => void;
};

function BidForm({ auction, onCancel }: BidFormProps) {
  const minBid = Math.ceil(auction.currentPrice * 1.05); // 最低入札額は現在価格の5%増し
  const [bidAmount, setBidAmount] = useState(minBid);
  const { clientPlaceBid, submitting, error } = useBidActions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!auction.id) return;

    try {
      const success = await clientPlaceBid({
        auctionId: auction.id,
        amount: bidAmount,
      });
      if (success) {
        onCancel(); // 入札成功後フォームを閉じる
      }
    } catch (err) {
      console.error("入札エラー:", err);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="pt-4">
          <div className="space-y-4">
            <div>
              <p className="text-muted-foreground mb-1 text-sm">現在価格: {formatCurrency(auction.currentPrice)}</p>
              <p className="text-muted-foreground mb-2 text-sm">最低入札額: {formatCurrency(minBid)}</p>
              <Input type="number" min={minBid} step={100} value={bidAmount} onChange={(e) => setBidAmount(Number(e.target.value))} required />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            キャンセル
          </Button>
          <Button type="submit" disabled={submitting || bidAmount < minBid}>
            {submitting ? "処理中..." : "入札する"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default BidForm;
