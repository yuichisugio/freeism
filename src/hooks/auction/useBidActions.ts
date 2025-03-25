"use client";

import { useState } from "react";
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
    setBidProcessInProgress(true);

    // 外部コールバックがあれば入札開始を通知
    if (onBiddingStatusChange) {
      onBiddingStatusChange(true);
    }

    try {
      console.log("入札処理開始 - SSE接続保護モード有効");

      // SSE保護用クッキーを設定（入札中であることをサーバーに伝える）
      document.cookie = `bid_in_progress=${bidData.auctionId}; path=/; max-age=30; SameSite=Strict`;

      console.log("入札APIリクエスト送信", bidData);
      const response = await fetch(`/api/auctions/${bidData.auctionId}/bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bidData),
        // シグナルなしでリクエストを送信（abortしない）
        signal: undefined,
        // 重要: 既存のSSE接続を切断しないようにする
        keepalive: true,
        // キャッシュを無効化
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "入札に失敗しました");
        toast.error(data.error || "入札に失敗しました");
        return false;
      }

      // 成功時
      console.log("入札API成功レスポンス", data);
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
      // 少し遅延させてから入札処理終了状態にする
      setTimeout(() => {
        setSubmitting(false);
        setBidProcessInProgress(false);

        // SSE保護用クッキーを削除
        document.cookie = "bid_in_progress=; path=/; max-age=0; SameSite=Strict";

        // 外部コールバックがあれば入札終了を通知
        if (onBiddingStatusChange) {
          onBiddingStatusChange(false);
        }

        console.log("入札処理完了 - SSE接続保護モード無効化");
      }, 1000);
    }
  }

  /**
   * ウォッチリストの切り替え
   * @param auctionId オークションID
   * @returns ウォッチリストの状態
   */
  async function toggleWatchlist(auctionId: string) {
    try {
      // ウォッチリストの切り替え
      const response = await fetch(`/api/auctions/${auctionId}/watchlist`, {
        method: "POST",
      });

      // レスポンスデータ
      const data = await response.json();

      // レスポンスが成功しない場合
      if (!response.ok) {
        toast.error(data.error || "ウォッチリストの更新に失敗しました");
        return null;
      }

      // ウォッチリストに追加した場合
      if (data.isWatched) {
        toast.success("ウォッチリストに追加しました");
      } else {
        // ウォッチリストから削除した場合
        toast.success("ウォッチリストから削除しました");
      }

      return data.isWatched;
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
  async function getWatchlistStatus(auctionId: string) {
    try {
      // ウォッチリストの状態を取得
      const response = await fetch(`/api/auctions/${auctionId}/watchlist`);

      // レスポンスが成功しない場合
      if (!response.ok) {
        return false;
      }

      // レスポンスデータ
      const data = await response.json();

      // ウォッチリストの状態を返す
      return data.isWatched;
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
