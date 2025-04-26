"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBidActions } from "@/hooks/auction/bid/use-bid-actions";
import { type Auction } from "@/lib/auction/type/types";
import { motion } from "framer-motion";
import { Gavel, Minus, Plus } from "lucide-react";

import { AutoBidForm } from "./auto-bid-form";

/**
 * 入札フォーム
 * @param auction オークション
 * @param onCancel キャンセルボタンのクリックハンドラ
 * @returns 入札フォーム
 */
export const BidForm = memo(function BidForm({ auction }: { auction: Auction }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/components/auction/bid/bid-form.tsx_BidForm_render");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 入札額を管理するuseState
  const [bidAmount, setBidAmount] = useState(auction.currentHighestBid + 1);

  // 最低入札額は現在価格の1ポイント増し
  const [minBid] = useState(auction.currentHighestBid + 1);

  // 入札フォームのサブミットハンドラ
  const { clientPlaceBid, submitting, error } = useBidActions();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  useEffect(() => {
    // 最低入札額は現在価格の1ポイント増し。現在の入札額が、他社が入札して更新された額より小さい場合は1ポイント増し
    if (auction.currentHighestBid >= bidAmount) {
      setBidAmount(auction.currentHighestBid + 1);
    }
  }, [auction, bidAmount]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 入札フォームのサブミットハンドラ
  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
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
    },
    [auction, bidAmount, clientPlaceBid, minBid],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 入札額をインクリメント
  const incrementBid = useCallback(() => {
    setBidAmount((prev) => prev + 1);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 入札額をデクリメント（最小入札額未満にはならないように）
  const decrementBid = useCallback(() => {
    if (bidAmount > minBid) {
      setBidAmount((prev) => prev - 1);
    }
  }, [bidAmount, minBid]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="space-y-4">
      {/* 入札フォーム */}
      <Card className="border-primary/20 overflow-hidden shadow-md">
        {/* 入札フォームのヘッダー */}
        <CardHeader className="from-primary/10 to-primary/5 bg-gradient-to-r pb-3">
          <CardTitle className="flex items-center text-lg font-medium">
            <Gavel className="text-primary mr-2 h-5 w-5" />
            入札フォーム
          </CardTitle>
        </CardHeader>

        {/* 入札フォームのコンテンツ */}
        <form onSubmit={onSubmit}>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {/* デクリメントボタン */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  id="decrement-bid"
                  onClick={decrementBid}
                  disabled={bidAmount <= minBid}
                  className="h-10 w-10 rounded-full"
                >
                  <Minus className="h-4 w-4" />
                </Button>

                {/* 入札額入力フィールド */}
                <div className="relative w-full">
                  <Input
                    type="number"
                    id="bid-amount"
                    min={minBid}
                    step={1}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(Number(e.target.value))}
                    required
                    className="h-12 text-center text-lg font-bold"
                  />
                  <span className="text-muted-foreground absolute inset-y-0 right-3 flex items-center pr-7 text-sm">pt</span>
                </div>

                {/* インクリメントボタン */}
                <Button type="button" variant="outline" size="icon" id="increment-bid" onClick={incrementBid} className="h-10 w-10 rounded-full">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* エラーメッセージ */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-destructive/10 text-destructive rounded-md p-2 text-sm"
                >
                  {error}
                </motion.div>
              )}
            </div>
          </CardContent>

          {/* 入札フォームのフッター */}
          <CardFooter className="flex-col gap-2 pb-4">
            {/* 入札ボタン */}
            <Button type="submit" disabled={submitting || bidAmount < minBid} className="w-full gap-1">
              {submitting ? (
                <>
                  <span className="animate-pulse">入札処理中...</span>
                </>
              ) : (
                <>入札する</>
              )}
            </Button>

            {/* 最低入札額より低い場合のメッセージ */}
            {auction.currentHighestBid >= bidAmount && (
              <p className="text-center text-xs text-amber-600">最低入札額より高いポイントを入力してください</p>
            )}

            {/* 説明文 */}
            <p className="text-muted-foreground mt-2 text-center text-xs">入札すると、すぐに有効な入札として記録されます</p>
          </CardFooter>
        </form>
      </Card>

      {/* 自動入札フォーム */}
      <AutoBidForm
        auctionId={auction.id}
        currentHighestBid={auction.currentHighestBid}
        currentHighestBidderId={auction.currentHighestBidderId ?? null}
      />
    </div>
  );
});
