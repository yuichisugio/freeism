"use client";

import { useCallback, useState } from "react";
import { executeBid } from "@/lib/auction/action/bid-common";
import { type BidFormData } from "@/lib/auction/type/types";
import { toast } from "sonner";

/**
 * 入札操作用カスタムフック
 * @returns 入札操作用の関数群
 */
export function useBidActions() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  // 入札中フラグ
  const [submitting, setSubmitting] = useState<boolean>(false);
  // エラーメッセージ
  const [error, setError] = useState<string | null>(null);
  // 警告メッセージ
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札を実行
   * @param bidData 入札データ
   * @param onBiddingStatusChange 入札状態変更時のコールバック（オプション）
   * @returns 入札成功時true, 失敗時false
   */
  const clientPlaceBid = useCallback(async (bidData: BidFormData, onBiddingStatusChange?: (isBidding: boolean) => void) => {
    setSubmitting(true);
    setError(null);
    setWarningMessage(null);

    // 外部コールバックがあれば入札開始を通知
    if (onBiddingStatusChange) {
      onBiddingStatusChange(true);
    }

    try {
      console.log("useBidActions_clientPlaceBid_入札サーバーアクション実行", bidData);

      // bidData.auctionIdがない場合、エラーを投げる
      if (!bidData.auctionId) {
        throw new Error("オークションIDが指定されていません");
      }

      // サーバーアクションを呼び出し
      const result = await executeBid(bidData.auctionId, bidData.amount, bidData.isAutoBid ?? false);

      if (!result.success) {
        setError(result.message ?? "入札に失敗しました");
        toast.error(result.message ?? "入札に失敗しました");
        return false;
      }

      // 成功時
      console.log("useBidActions_clientPlaceBid_入札サーバーアクション成功レスポンス", result);

      // 警告メッセージがある場合は設定
      if (result.message) {
        setWarningMessage(result.message);
        toast.warning(result.message);
      } else {
        toast.success("入札が完了しました");
      }

      return true;
    } catch (err) {
      console.error("useBidActions_clientPlaceBid_入札サーバーアクション呼び出しエラー:", err);
      setError("useBidActions_clientPlaceBid_入札処理中にエラーが発生しました");
      toast.error("useBidActions_clientPlaceBid_入札処理中にエラーが発生しました");
      return false;
    } finally {
      setSubmitting(false);

      // 外部コールバックがあれば入札終了を通知
      if (onBiddingStatusChange) {
        onBiddingStatusChange(false);
      }

      console.log("useBidActions_clientPlaceBid_入札処理完了");
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    submitting,
    error,
    warningMessage,
    clientPlaceBid,
  };
}
