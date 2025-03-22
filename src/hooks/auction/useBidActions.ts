"use client";

import { useState } from "react";
import { type BidFormData, type BidHistoryWithUser } from "@/types/auction";
import { toast } from "sonner";

/**
 * 入札操作用カスタムフック
 */
export function useBidActions() {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBid, setLastBid] = useState<BidHistoryWithUser | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  /**
   * 入札を実行
   */
  const placeBid = async (bidData: BidFormData) => {
    setSubmitting(true);
    setError(null);
    setWarningMessage(null);

    try {
      const response = await fetch(`/api/auctions/${bidData.auctionId}/bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bidData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "入札に失敗しました");
        toast.error(data.error || "入札に失敗しました");
        return false;
      }

      // 成功時
      if (data.bid) {
        setLastBid(data.bid);
      }

      // 警告メッセージがある場合は設定
      if (data.message) {
        setWarningMessage(data.message);
        toast.warning(data.message);
      } else {
        toast.success("入札が完了しました");
      }

      return true;
    } catch (err) {
      console.error("入札API呼び出しエラー:", err);
      setError("入札処理中にエラーが発生しました");
      toast.error("入札処理中にエラーが発生しました");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * ウォッチリストの切り替え
   */
  const toggleWatchlist = async (auctionId: string) => {
    try {
      const response = await fetch(`/api/auctions/${auctionId}/watchlist`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "ウォッチリストの更新に失敗しました");
        return null;
      }

      if (data.isWatched) {
        toast.success("ウォッチリストに追加しました");
      } else {
        toast.success("ウォッチリストから削除しました");
      }

      return data.isWatched;
    } catch (err) {
      console.error("ウォッチリストAPI呼び出しエラー:", err);
      toast.error("ウォッチリストの更新中にエラーが発生しました");
      return null;
    }
  };

  /**
   * ウォッチリストの状態を取得
   */
  const getWatchlistStatus = async (auctionId: string) => {
    try {
      const response = await fetch(`/api/auctions/${auctionId}/watchlist`);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.isWatched;
    } catch (err) {
      console.error("ウォッチリスト状態取得エラー:", err);
      return false;
    }
  };

  return {
    submitting,
    error,
    lastBid,
    warningMessage,
    placeBid,
    toggleWatchlist,
    getWatchlistStatus,
  };
}
