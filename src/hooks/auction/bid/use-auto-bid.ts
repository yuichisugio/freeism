"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cancelAutoBid, executeAutoBid, getAutoBid, setAutoBid } from "@/lib/auction/action/bid-common";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

type AutoBidSettings = {
  id?: string;
  maxBidAmount: number;
  bidIncrement: number;
  isActive: boolean;
};

/**
 * 自動入札のカスタムフック
 * @param auctionId オークションID
 * @param currentHighestBid 現在の最高入札額
 * @param currentHighestBidderId 現在の最高入札者ID
 * @returns 自動入札に関する状態と操作関数
 */
export function useAutoBid(auctionId: string, currentHighestBid: number, currentHighestBidderId: string | null) {
  // セッション情報を取得
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // 自動入札の設定情報
  const [autoBidSettings, setAutoBidSettings] = useState<AutoBidSettings | null>(null);

  // ローディング状態
  const [loading, setLoading] = useState<boolean>(false);

  // エラーメッセージ
  const [error, setError] = useState<string | null>(null);

  // 自動入札中フラグ
  const [isAutoBidding, setIsAutoBidding] = useState<boolean>(false);

  // インターバルの参照
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 最後の入札時刻
  const lastBidTimeRef = useRef<Date | null>(null);

  /**
   * 自動入札設定を初期化
   */
  const initializeAutoBid = useCallback(async () => {
    if (!auctionId || !userId) return;

    try {
      setLoading(true);
      const result = await getAutoBid(auctionId);

      if (result.success && result.autoBid) {
        setAutoBidSettings({
          id: result.autoBid.id,
          maxBidAmount: result.autoBid.maxBidAmount,
          bidIncrement: result.autoBid.bidIncrement,
          isActive: true,
        });
        setIsAutoBidding(true);
      } else {
        setAutoBidSettings(null);
        setIsAutoBidding(false);
      }
    } catch (err) {
      console.error("自動入札設定の初期化エラー:", err);
      setError("自動入札設定の取得中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [auctionId, userId]);

  /**
   * 自動入札を設定
   */
  const setupAutoBid = useCallback(
    async (maxBidAmount: number, bidIncrement: number) => {
      if (!auctionId || !userId) {
        setError("ログインが必要です");
        return false;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await setAutoBid(auctionId, maxBidAmount, bidIncrement);

        if (result.success && result.autoBid) {
          setAutoBidSettings({
            id: result.autoBid.id,
            maxBidAmount: result.autoBid.maxBidAmount,
            bidIncrement: result.autoBid.bidIncrement,
            isActive: true,
          });
          setIsAutoBidding(true);

          toast.success(result.message || "自動入札を設定しました");
          return true;
        } else {
          setError(result.message || "自動入札の設定に失敗しました");
          toast.error(result.message || "自動入札の設定に失敗しました");
          return false;
        }
      } catch (err) {
        console.error("自動入札設定エラー:", err);
        setError("自動入札の設定中にエラーが発生しました");
        toast.error("自動入札の設定中にエラーが発生しました");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [auctionId, userId],
  );

  /**
   * 自動入札を取り消す
   */
  const cancelAutoBidding = useCallback(async () => {
    if (!auctionId || !userId) return false;

    try {
      setLoading(true);
      setError(null);

      const result = await cancelAutoBid(auctionId);

      if (result.success) {
        setAutoBidSettings(null);
        setIsAutoBidding(false);

        toast.success(result.message || "自動入札を取り消しました");
        return true;
      } else {
        setError(result.message || "自動入札の取り消しに失敗しました");
        toast.error(result.message || "自動入札の取り消しに失敗しました");
        return false;
      }
    } catch (err) {
      console.error("自動入札取り消しエラー:", err);
      setError("自動入札の取り消し中にエラーが発生しました");
      toast.error("自動入札の取り消し中にエラーが発生しました");
      return false;
    } finally {
      setLoading(false);
    }
  }, [auctionId, userId]);

  /**
   * 自動入札を実行する
   */
  const executeAutoBidding = useCallback(async () => {
    if (!auctionId || !userId || !isAutoBidding || !autoBidSettings) return;

    // 自分が最高入札者の場合は何もしない
    if (currentHighestBidderId === userId) return;

    // 前回の入札から10分経過していない場合は何もしない
    const TEN_MINUTES = 10 * 60 * 1000; // 10分をミリ秒で表現
    if (lastBidTimeRef.current && new Date().getTime() - lastBidTimeRef.current.getTime() < TEN_MINUTES) {
      return;
    }

    try {
      // サーバーサイドの自動入札実行関数を呼び出し
      const result = await executeAutoBid(auctionId, currentHighestBid, currentHighestBidderId);

      if (result.success) {
        // 入札成功
        lastBidTimeRef.current = new Date();
        toast.success(result.message || "自動入札を実行しました");
      } else if (result.message === "自動入札の上限金額に達しました") {
        // 上限に達した場合
        toast.warning(result.message);
        setIsAutoBidding(false);
        setAutoBidSettings(null);
      } else if (result.message !== "あなたが現在の最高入札者です") {
        // その他のエラー（最高入札者である場合を除く）
        console.error("自動入札実行エラー:", result.message);
      }
    } catch (err) {
      console.error("自動入札実行中のエラー:", err);
    }
  }, [auctionId, userId, autoBidSettings, isAutoBidding, currentHighestBid, currentHighestBidderId]);

  /**
   * 自動入札の監視を開始
   */
  const startAutoBidMonitoring = useCallback(() => {
    // 既存のインターバルがあれば停止
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // 30秒ごとに自動入札の条件を確認
    intervalRef.current = setInterval(() => {
      void executeAutoBidding();
    }, 30 * 1000); // 30秒ごとに確認
  }, [executeAutoBidding]);

  /**
   * 自動入札の監視を停止
   */
  const stopAutoBidMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // マウント時に自動入札設定を取得
  useEffect(() => {
    void initializeAutoBid();

    // アンマウント時にインターバルをクリア
    return () => {
      stopAutoBidMonitoring();
    };
  }, [initializeAutoBid, stopAutoBidMonitoring]);

  // 自動入札設定が存在する場合は監視を開始
  useEffect(() => {
    if (isAutoBidding) {
      startAutoBidMonitoring();

      // 初期状態で入札条件を確認（自動入札が必要かどうか）
      void executeAutoBidding();
    } else {
      stopAutoBidMonitoring();
    }
  }, [isAutoBidding, startAutoBidMonitoring, stopAutoBidMonitoring, executeAutoBidding]);

  // 現在の最高入札価格や入札者が変わったとき、自動入札を評価
  useEffect(() => {
    if (isAutoBidding && currentHighestBidderId !== userId) {
      void executeAutoBidding();
    }
  }, [currentHighestBid, currentHighestBidderId, userId, isAutoBidding, executeAutoBidding]);

  return {
    autoBidSettings,
    loading,
    error,
    isAutoBidding,
    setupAutoBid,
    cancelAutoBidding,
  };
}
