"use client";

import { useCallback, useState } from "react";
import { toggleWatchlistAction } from "@/lib/auction/action/watchlist";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ウォッチリスト操作用カスタムフックの型
 */
type UseWatchlistActionsResult = {
  submitting: boolean;
  toggleWatchlist: (auctionId: string | undefined) => Promise<boolean | null>;
  isWatchlisted: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ウォッチリスト操作用カスタムフック
 * @returns {UseWatchlistActionsResult} ウォッチリスト操作用の関数群
 */
export function useWatchlistActions(initialIsWatched: boolean): UseWatchlistActionsResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 処理中フラグ
  const [submitting, setSubmitting] = useState<boolean>(false);
  // ウォッチリストの状態
  const [isWatchlisted, setIsWatchlisted] = useState(initialIsWatched);

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
        setIsWatchlisted(true);
        toast.success("ウォッチリストに追加しました");
      } else {
        // ウォッチリストから削除した場合
        setIsWatchlisted(false);
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

  return {
    submitting,
    isWatchlisted,
    toggleWatchlist,
  };
}
