"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cancelAutoBid, executeAutoBid, getAutoBid, setAutoBid } from "@/lib/auction/action/bid-common";
import { AUCTION_CONSTANTS } from "@/lib/auction/constants";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札設定の型
 */
type AutoBidSettings = {
  id?: string;
  maxBidAmount: number;
  bidIncrement: number;
  isActive: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札のカスタムフック
 * @param auctionId オークションID
 * @param currentHighestBid 現在の最高入札額
 * @param currentHighestBidderId 現在の最高入札者ID
 * @returns 自動入札に関する状態と操作関数
 */
export function useAutoBid(auctionId: string, currentHighestBid: number, currentHighestBidderId: string | null) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // セッション情報を取得
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 自動入札の設定情報
  const [autoBidSettings, setAutoBidSettings] = useState<AutoBidSettings | null>(null);

  // ローディング状態
  const [loading, setLoading] = useState<boolean>(false);

  // エラーメッセージ
  const [error, setError] = useState<string | null>(null);

  // 自動入札中フラグ
  const [isAutoBidding, setIsAutoBidding] = useState<boolean>(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // インターバルの参照
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 最後の入札時刻
  const lastBidTimeRef = useRef<Date | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自動入札設定を初期化
   */
  const initializeAutoBid = useCallback(async () => {
    // auctionId or userIdがない場合は何もしない
    if (!auctionId || !userId) return;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    try {
      // ローディング状態をtrueにする
      setLoading(true);

      // 自動入札設定を取得
      const result = await getAutoBid(auctionId);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      // 自動入札設定を取得できて、自動入札設定が存在する場合
      if (result.success && result.autoBid) {
        setAutoBidSettings({
          id: result.autoBid.id,
          maxBidAmount: result.autoBid.maxBidAmount + 100,
          bidIncrement: result.autoBid.bidIncrement,
          isActive: true,
        });

        // 自動入札中フラグをtrueにする
        setIsAutoBidding(true);
      } else {
        // 自動入札設定を取得できて、自動入札設定が存在しない場合
        setAutoBidSettings(null);
        setIsAutoBidding(false);
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    } catch (err) {
      // エラーが発生した場合
      console.error("自動入札設定の初期化エラー:", err);
      setError("自動入札設定の取得中にエラーが発生しました");
    } finally {
      // ローディング状態をfalseにする
      setLoading(false);
    }
  }, [auctionId, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自動入札を設定
   */
  const setupAutoBid = useCallback(
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    async (maxBidAmount: number, bidIncrement: number) => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      // auctionId or userIdがない場合は何もしない
      if (!auctionId || !userId) {
        setError("ログインが必要です");
        return false;
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      try {
        // ローディング状態をtrueにする
        setLoading(true);
        setError(null);

        // 自動入札を設定をDBに保存
        const result = await setAutoBid(auctionId, maxBidAmount, bidIncrement);

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        // 自動入札を設定できて、自動入札設定が存在する場合
        if (result.success && result.autoBid) {
          // stateに自動入札設定を保存
          setAutoBidSettings({
            id: result.autoBid.id,
            maxBidAmount: result.autoBid.maxBidAmount,
            bidIncrement: result.autoBid.bidIncrement,
            isActive: true,
          });

          // 自動入札中フラグをtrueにする
          setIsAutoBidding(true);

          toast.success(result.message || "自動入札を設定しました");
          return true;
        } else {
          // 自動入札を設定できなかった場合
          setError(result.message || "自動入札の設定に失敗しました");
          toast.error(result.message || "自動入札の設定に失敗しました");
          return false;
        }
      } catch (err) {
        // エラーが発生した場合
        console.error("自動入札設定エラー:", err);
        setError("自動入札の設定中にエラーが発生しました");
        toast.error("自動入札の設定中にエラーが発生しました");
        return false;
      } finally {
        // ローディング状態をfalseにする
        setLoading(false);
      }
    },
    [auctionId, userId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自動入札を取り消す
   */
  const cancelAutoBidding = useCallback(async () => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    if (!auctionId || !userId) return false;

    try {
      // ローディング状態をtrueにする
      setLoading(true);
      setError(null);

      // 自動入札を取り消す
      const result = await cancelAutoBid(auctionId);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      if (result.success) {
        // stateに自動入札設定を保存
        setAutoBidSettings(null);
        setIsAutoBidding(false);

        toast.success(result.message || "自動入札を取り消しました");
        return true;
      } else {
        // 自動入札を取り消すことができなかった場合
        setError(result.message || "自動入札の取り消しに失敗しました");
        toast.error(result.message || "自動入札の取り消しに失敗しました");
        return false;
      }
    } catch (err) {
      // エラーが発生した場合
      console.error("自動入札取り消しエラー:", err);
      setError("自動入札の取り消し中にエラーが発生しました");
      toast.error("自動入札の取り消し中にエラーが発生しました");
      return false;
    } finally {
      // ローディング状態をfalseにする
      setLoading(false);
    }
  }, [auctionId, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自動入札を実行する
   */
  const executeAutoBidding = useCallback(async () => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    if (!auctionId || !userId || !isAutoBidding || !autoBidSettings) return;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 自分が最高入札者の場合は何もしない
    if (currentHighestBidderId === userId) return;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 前回の入札から10分経過していない場合は何もしない
    const TEN_MINUTES = AUCTION_CONSTANTS.AUTO_BID_MIN_INTERVAL_MS; // constansts.tsから自動入札の間隔を取得
    if (lastBidTimeRef.current && new Date().getTime() - lastBidTimeRef.current.getTime() < TEN_MINUTES) {
      return;
    }

    try {
      // サーバーサイドの自動入札実行関数を呼び出し
      const result = await executeAutoBid(auctionId, currentHighestBid, currentHighestBidderId);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 入札成功
      if (result.success) {
        lastBidTimeRef.current = new Date();
        toast.success(result.message || "自動入札を実行しました");

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      } else if (result.message === "自動入札の上限金額に達しました") {
        // 上限に達した場合
        toast.warning(result.message);
        setIsAutoBidding(false);
        setAutoBidSettings(null);

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      } else if (result.message !== "あなたが現在の最高入札者です") {
        // その他のエラー（最高入札者である場合を除く）
        console.error("自動入札実行エラー:", result.message);
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    } catch (err) {
      // エラーが発生した場合
      console.error("自動入札実行中のエラー:", err);
    }
  }, [auctionId, userId, autoBidSettings, isAutoBidding, currentHighestBid, currentHighestBidderId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自動入札の定期実行。
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自動入札の監視を停止
   */
  const stopAutoBidMonitoring = useCallback(() => {
    // インターバルが存在する場合は停止
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * マウント時に自動入札設定を取得
   */
  useEffect(() => {
    // 自動入札設定を取得
    void initializeAutoBid();

    // アンマウント時にインターバルをクリア
    return () => {
      stopAutoBidMonitoring();
    };
  }, [initializeAutoBid, stopAutoBidMonitoring]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自動入札設定が存在する場合は監視を開始
   */
  useEffect(() => {
    // 自動入札設定が存在する場合は監視を開始
    if (isAutoBidding) {
      // 自動入札の定期実行を開始
      startAutoBidMonitoring();

      // 初期状態で入札条件を確認（自動入札が必要かどうか）
      void executeAutoBidding();
    } else {
      // 自動入札の定期実行を停止
      stopAutoBidMonitoring();
    }
  }, [isAutoBidding, startAutoBidMonitoring, stopAutoBidMonitoring, executeAutoBidding]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在の最高入札価格や入札者が変わったとき、自動入札を評価
   */
  useEffect(() => {
    // 自動入札設定が存在する場合は自動入札を評価
    if (isAutoBidding && currentHighestBidderId !== userId) {
      void executeAutoBidding();
    }
  }, [currentHighestBid, currentHighestBidderId, userId, isAutoBidding, executeAutoBidding]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    autoBidSettings,
    loading,
    error,
    isAutoBidding,
    setupAutoBid,
    cancelAutoBidding,
  };
}
