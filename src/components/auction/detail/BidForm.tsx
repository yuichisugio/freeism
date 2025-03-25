"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBidActions } from "@/hooks/auction/useBidActions";
import { type BidFormProps } from "@/lib/auction/types";
import { formatCurrency } from "@/lib/formatters";

/**
 * 入札フォーム
 * @param auction オークション
 * @param onCancel キャンセルボタンのクリックハンドラ
 * @returns 入札フォーム
 */
export default function BidForm({ auction, onCancelAction }: BidFormProps) {
  // 最低入札額は現在価格の1ポイント増し
  const minBid = auction.currentPrice + 1;

  // 入札額を管理するuseState
  const [bidAmount, setBidAmount] = useState(minBid);

  // 入札フォームのサブミットハンドラ
  const { clientPlaceBid, submitting, error } = useBidActions();

  // 入札フォームのサブミットハンドラ
  async function handleSubmit(e: React.FormEvent) {
    // フォームのサブミットを防ぐ
    e.preventDefault();

    // オークションIDがない場合は処理を中断
    if (!auction.id) return;

    // 入札額が最低入札額未満の場合は処理を中断
    if (bidAmount < minBid) return;

    try {
      console.log("入札処理開始");
      const success = await clientPlaceBid({
        auctionId: auction.id,
        amount: bidAmount,
      });
      console.log("入札処理完了", success);
      if (success) {
        // 少し遅延を入れてからフォームを閉じる
        setTimeout(() => {
          onCancelAction(); // 入札成功後フォームを閉じる
        }, 300);
      }
    } catch (err) {
      console.error("入札エラー:", err);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="pt-4">
          <div className="space-y-4">
            <div>
              <p className="text-muted-foreground mb-1 text-sm">現在価格: {formatCurrency(auction.currentPrice)}</p>
              <p className="text-muted-foreground mb-2 text-sm">最低入札額: {formatCurrency(minBid)}</p>
              <Input type="number" min={minBid} step={1} value={bidAmount} onChange={(e) => setBidAmount(Number(e.target.value))} required />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancelAction} disabled={submitting}>
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
