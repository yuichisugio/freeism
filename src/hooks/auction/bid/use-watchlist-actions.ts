"use client";

import { useCallback, useState } from "react";
import { getWatchlistStatusAction, toggleWatchlistAction } from "@/lib/auction/action/watchlist";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ウォッチリスト操作用カスタムフックの型
 */
type UseWatchlistActionsResult = {
  submitting: boolean;
  toggleWatchlist: (auctionId: string | undefined) => Promise<boolean | null>;
  getWatchlistStatus: (auctionId: string | undefined) => Promise<boolean>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ウォッチリスト操作用カスタムフック
 * @returns {UseWatchlistActionsResult} ウォッチリスト操作用の関数群
 */
export function useWatchlistActions(): UseWatchlistActionsResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 処理中フラグ
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリストの切り替え
   * @param auctionId オークションID
   * @returns ウォッチリストの状態
   */
  const toggleWatchlist = useCallback(async (auctionId: string | undefined) => {
    if (!auctionId) {
      toast.error("useWatchlistActions_toggleWatchlist_オークションIDが指定されていません");
      return null;
    }

    setSubmitting(true);
    try {
      // ウォッチリストの切り替え（サーバーアクション）
      const result = await toggleWatchlistAction(auctionId);

      // 結果が正常でない場合
      if (!result.success) {
        toast.error(result.message || "useWatchlistActions_toggleWatchlist_ウォッチリストの更新に失敗しました");
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
      console.error("useWatchlistActions_toggleWatchlist_ウォッチリストAPI呼び出しエラー:", err);
      toast.error("ウォッチリストの更新中にエラーが発生しました");
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリストの状態を取得
   * @param auctionId オークションID
   * @returns ウォッチリストの状態
   */
  const getWatchlistStatus = useCallback(async (auctionId: string | undefined) => {
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
      console.error("useWatchlistActions_getWatchlistStatus_ウォッチリスト状態取得エラー:", err);
      return false;
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    submitting,
    toggleWatchlist,
    getWatchlistStatus,
  };
}
