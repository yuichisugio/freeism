"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBidActions } from "@/hooks/auction/useBidActions";
import { type BidFormProps } from "@/lib/auction/types";
import { formatCurrency } from "@/lib/formatters";

import { useAuctionEventContext } from "../../../hooks/auction/useAuctionEventContext";

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

  // SSE接続の保護状態を管理するためのコンテキストを取得
  // このコンテキストがない場合は何もしない関数を用意
  const auctionEventContext = useAuctionEventContext();
  const setIsBidding = useMemo(() => auctionEventContext?.setIsBidding || (() => {}), [auctionEventContext]);

  // コンポーネントのマウント時に処理状態をリセット
  useEffect(() => {
    // クリーンアップ関数（アンマウント時に呼ばれる）
    return () => {
      // 入札処理中フラグがまだtrueの場合には強制的にリセット
      setIsBidding(false);
      console.log("BidFormアンマウント: SSE保護状態をリセット");
    };
  }, [setIsBidding]);

  // 入札フォームのサブミットハンドラ
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (bidAmount < minBid) {
      return;
    }

    try {
      // 入札中の状態を設定する（先に設定することが重要）
      setIsBidding(true);
      console.log("入札処理開始 - SSE保護状態を設定:", true);

      // 入札を実行（入札状態変更のコールバックを渡す）
      const success = await clientPlaceBid(
        {
          auctionId: auction.id,
          amount: bidAmount,
        },
        // 入札状態変更のコールバック
        (isBidding) => {
          console.log("入札状態変更:", isBidding);
          setIsBidding(isBidding);
        },
      );

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
      setIsBidding(false);
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
