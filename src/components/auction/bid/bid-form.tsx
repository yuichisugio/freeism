"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBidActions } from "@/hooks/auction/bid/use-bid-actions";
import { motion } from "framer-motion";
import { Gavel, Minus, Plus } from "lucide-react";

/**
 * 入札フォーム
 * @param currentHighestBid 現在の最高入札額
 * @param currentHighestBidderId 現在の最高入札者ID
 * @param auctionId オークションID
 * @returns 入札フォーム
 */
export const BidForm = memo(function BidForm({ currentHighestBid, auctionId }: { currentHighestBid: number; auctionId: string }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 入札フォームのロジック（use-bid-actionsに移動済み）
  const { submitting, error, bidAmount, minBid, setBidAmount, incrementBid, decrementBid, onSubmit } = useBidActions(auctionId, currentHighestBid);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <Card className="border-primary/20 overflow-hidden shadow-md">
      {/* 入札フォームのヘッダー */}
      <CardHeader className="from-primary/10 to-primary/5 bg-gradient-to-r pb-3">
        <CardTitle className="flex items-center text-lg font-medium">
          <Gavel className="text-primary mr-2 h-5 w-5" />
          入札フォーム
        </CardTitle>
      </CardHeader>

      {/* 入札フォームのコンテンツ */}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await onSubmit({ auctionId, amount: bidAmount, isAutoBid: false });
        }}
      >
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
          {currentHighestBid >= bidAmount && <p className="text-center text-xs text-amber-600">最低入札額より高いポイントを入力してください</p>}

          {/* 説明文 */}
          <p className="text-muted-foreground mt-2 text-center text-xs">入札すると、すぐに有効な入札として記録されます</p>
        </CardFooter>
      </form>
    </Card>
  );
});
