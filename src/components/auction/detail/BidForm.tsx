"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBidActions } from "@/hooks/auction/useBidActions";
import { type BidFormProps } from "@/lib/auction/types";

/**
 * 入札フォーム
 * @param auction オークション
 * @param onCancel キャンセルボタンのクリックハンドラ
 * @returns 入札フォーム
 */
export default function BidForm({ auction }: BidFormProps) {
  useEffect(() => {
    // 最低入札額は現在価格の1ポイント増し。現在の入札額が、他社が入札して更新された額より小さい場合は1ポイント増し
    if (auction.currentHighestBid >= bidAmount) {
      setBidAmount(auction.currentHighestBid + 1);
    }
  }, [auction]);

  // 最低入札額は現在価格の1ポイント増し
  const [minBid, setMinBid] = useState(auction.currentHighestBid + 1);
  // 入札額を管理するuseState
  const [bidAmount, setBidAmount] = useState(auction.currentHighestBid + 1);

  // 入札フォームのサブミットハンドラ
  const { clientPlaceBid, submitting, error } = useBidActions();

  // 入札フォームのサブミットハンドラ
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (bidAmount < minBid) {
      return;
    }

    try {
      // 入札を実行（入札状態変更のコールバックを渡す）
      await clientPlaceBid({
        auctionId: auction.id,
        amount: bidAmount,
      });

      // 入札成功後、前回の入札額に1ポイント加算した金額を入札額に設定
      setBidAmount(bidAmount + 1);
    } catch (error) {
      console.error("Bid failed:", error);
    }
  };

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardContent className="pt-4">
          <div className="space-y-4">
            <div>
              <Input type="number" min={minBid} step={1} value={bidAmount} onChange={(e) => setBidAmount(Number(e.target.value))} required />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </CardContent>

        <CardFooter className="w-full">
          <Button type="submit" disabled={submitting || bidAmount < minBid} className="w-full">
            {auction.currentHighestBid > bidAmount ? "最低入札額より高いポイントを入力して下さい" : submitting ? "入札処理中..." : "入札する"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
