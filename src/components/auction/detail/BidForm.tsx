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
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (bidAmount < minBid) {
      return;
    }

    try {
      // 入札を実行（入札状態変更のコールバックを渡す）
      const success = await clientPlaceBid({
        auctionId: auction.id,
        amount: bidAmount,
      });

      // 入札が成功した場合のみフォームを閉じる
      if (success) {
        // 入札成功後、キャンセルアクションを実行
        onCancelAction();
      }
    } catch (error) {
      console.error("Bid failed:", error);
    } finally {
      // 念のため入札状態をリセット（通常はclientPlaceBidのコールバックで処理される）
      console.log("入札処理完了 - SSE保護状態をリセット");
    }
  };

  return (
    <Card>
      <form onSubmit={onSubmit}>
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
