"use client";

import { useState } from "react";
import { placeBidAction } from "@/lib/auction/action/bid";
import { getWatchlistStatusAction, toggleWatchlistAction } from "@/lib/auction/action/watchlist";
import { type BidFormData, type BidHistoryWithUser } from "@/lib/auction/types";
import { toast } from "sonner";

/**
 * 入札操作用カスタムフック
 * @returns 入札操作用の関数群
 */
export function useBidActions() {
  // 入札中フラグ
  const [submitting, setSubmitting] = useState<boolean>(false);
  // エラーメッセージ
  const [error, setError] = useState<string | null>(null);
  // 最後の入札データ
  const [lastBid, setLastBid] = useState<BidHistoryWithUser | null>(null);
  // 警告メッセージ
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  // 入札処理中フラグ（グローバル状態管理用）
  const [bidProcessInProgress, setBidProcessInProgress] = useState<boolean>(false);

  /**
   * 入札を実行
   * @param bidData 入札データ
   * @param onBiddingStatusChange 入札状態変更時のコールバック（オプション）
   * @returns 入札成功時true, 失敗時false
   */
  async function clientPlaceBid(bidData: BidFormData, onBiddingStatusChange?: (isBidding: boolean) => void) {
    setSubmitting(true);
    setError(null);
    setWarningMessage(null);

    // 外部コールバックがあれば入札開始を通知
    if (onBiddingStatusChange) {
      onBiddingStatusChange(true);
    }

    try {
      console.log("入札サーバーアクション実行", bidData);

      // bidData.auctionIdがない場合、エラーを投げる
      if (!bidData.auctionId) {
        throw new Error("オークションIDが指定されていません");
      }

      // サーバーアクションを呼び出し
      const result = await placeBidAction(bidData.auctionId, bidData);

      if (!result.success) {
        setError(result.message || "入札に失敗しました");
        toast.error(result.message || "入札に失敗しました");
        return false;
      }

      // 成功時
      console.log("入札サーバーアクション成功レスポンス", result);
      if (result.bid) {
        // Date型からstring型に変換
        const bidWithStringDate = {
          ...result.bid,
          createdAt: result.bid.createdAt.toISOString(),
        };
        setLastBid(bidWithStringDate as BidHistoryWithUser);
      }

      // 警告メッセージがある場合は設定
      if (result.message) {
        setWarningMessage(result.message);
        toast.warning(result.message);
      } else {
        toast.success("入札が完了しました");
      }

      return true;
    } catch (err) {
      console.error("入札サーバーアクション呼び出しエラー:", err);
      setError("入札処理中にエラーが発生しました");
      toast.error("入札処理中にエラーが発生しました");
      return false;
    } finally {
      setSubmitting(false);
      setBidProcessInProgress(false);

      // 外部コールバックがあれば入札終了を通知
      if (onBiddingStatusChange) {
        onBiddingStatusChange(false);
      }

      console.log("入札処理完了");
    }
  }

  /**
   * ウォッチリストの切り替え
   * @param auctionId オークションID
   * @returns ウォッチリストの状態
   */
  async function toggleWatchlist(auctionId: string | undefined) {
    if (!auctionId) {
      toast.error("オークションIDが指定されていません");
      return null;
    }

    try {
      // ウォッチリストの切り替え（サーバーアクション）
      const result = await toggleWatchlistAction(auctionId);

      // 結果が正常でない場合
      if (!result.success) {
        toast.error(result.message || "ウォッチリストの更新に失敗しました");
        return null;
      }

      // ウォッチリストに追加した場合
      if (result.isWatched) {
        toast.success("ウォッチリストに追加しました");
      } else {
        // ウォッチリストから削除した場合
        toast.success("ウォッチリストから削除しました");
      }

      return result.isWatched;
    } catch (err) {
      console.error("ウォッチリストAPI呼び出しエラー:", err);
      toast.error("ウォッチリストの更新中にエラーが発生しました");
      return null;
    }
  }

  /**
   * ウォッチリストの状態を取得
   * @param auctionId オークションID
   * @returns ウォッチリストの状態
   */
  async function getWatchlistStatus(auctionId: string | undefined) {
    if (!auctionId) {
      return false;
    }

    try {
      // ウォッチリストの状態を取得（サーバーアクション）
      const result = await getWatchlistStatusAction(auctionId);

      // 結果が正常でない場合
      if (!result.success) {
        return false;
      }

      // ウォッチリストの状態を返す
      return result.isWatched;
    } catch (err) {
      console.error("ウォッチリスト状態取得エラー:", err);
      return false;
    }
  }

  return {
    submitting,
    error,
    lastBid,
    warningMessage,
    bidProcessInProgress,
    clientPlaceBid,
    toggleWatchlist,
    getWatchlistStatus,
  };
}
