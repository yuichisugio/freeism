"use client";

import type { AutoBidResponse, ProcessAutoBidParams } from "@/lib/auction/action/auto-bid";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cancelAutoBid, getAutoBidByUserId, processAutoBid, setAutoBid } from "@/lib/auction/action/auto-bid";
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
 * 自動入札のカスタムフックの型
 */
type UseAutoBidResult = {
  autoBidSettings: AutoBidSettings | null;
  loading: boolean;
  error: string | null;
  isAutoBidding: boolean;
  setupAutoBid: (maxBidAmount: number, bidIncrement: number) => Promise<boolean>;
  cancelAutoBidding: () => Promise<boolean>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札のカスタムフック
 * @param {string} auctionId オークションID
 * @param {number} currentHighestBid 現在の最高入札額
 * @param {string | null} currentHighestBidderId 現在の最高入札者ID
 * @returns {UseAutoBidResult} 自動入札に関する状態と操作関数
 */
export function useAutoBid(auctionId: string, currentHighestBid: number, currentHighestBidderId: string | null): UseAutoBidResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // セッション情報を取得
  const { data: session } = useSession();
  const userId = useMemo(() => session?.user?.id, [session]);

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

  /**
   * APIレスポンスから自動入札設定を更新する共通関数
   * @param result APIレスポンス
   * @param additionalMaxAmount 追加の最大入札額
   * @returns 自動入札設定の更新結果
   */
  const updateSettingsFromResponse = useCallback((result: AutoBidResponse, additionalMaxAmount = 0) => {
    // 成功した場合
    if (result.success && result.autoBid) {
      setAutoBidSettings({
        id: result.autoBid.id,
        maxBidAmount: result.autoBid.maxBidAmount + additionalMaxAmount,
        bidIncrement: result.autoBid.bidIncrement,
        isActive: true,
      });
      setIsAutoBidding(true);
      return true;
    } else {
      // 失敗した場合
      setAutoBidSettings(null);
      setIsAutoBidding(false);
      setError(result.message || "自動入札設定に失敗しました");
      return false;
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 画面を開いた時に、現在の自動入札設定を取得して表示
   */
  const initializeAutoBid = useCallback(async () => {
    // ユーザーIDまたはオークションIDがない場合は処理しない
    if (!auctionId || !userId) {
      console.log("initializeAutoBid: ユーザーIDまたはオークションIDがありません", { auctionId, userId });
      return;
    }

    try {
      // ローディング状態をtrueにする
      setLoading(true);
      // エラーメッセージをクリア
      setError(null);

      // 自動入札設定を取得
      const result = await getAutoBidByUserId(auctionId);
      console.log("自動入札設定取得結果:", result);

      // 結果に基づいて状態を更新（既存設定がある場合はmaxBidAmountに100を加算して表示）
      updateSettingsFromResponse(result, 100);
    } catch (err) {
      console.error("自動入札設定の初期化エラー:", err);
      setError("自動入札設定の取得中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [auctionId, userId, updateSettingsFromResponse]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自動入札を設定した際に呼ばれる関数
   */
  const setupAutoBid = useCallback(
    async (maxBidAmount: number, bidIncrement: number) => {
      // 必要なパラメータがない場合はエラー
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
        console.log("setupAutoBid_setAutoBid_result", result);

        // 設定に成功した場合
        if (result.success && result.autoBid) {
          // 状態を更新
          updateSettingsFromResponse(result);

          // 成功メッセージを表示
          toast.success(result.message || "自動入札を設定しました");

          // 自動入札設定後、即時の自動入札処理を実行
          try {
            const params: ProcessAutoBidParams = {
              auctionId,
              currentHighestBid,
              currentHighestBidderId,
            };
            const autoResult = await processAutoBid(params);
            if (autoResult) {
              console.log("自動入札処理を実行しました", autoResult);
            }
          } catch (autoError) {
            console.error("即時の自動入札処理でエラーが発生しました", autoError);
            // エラーが発生しても設定自体は成功しているので、trueを返す
          }

          return true;
        } else {
          // 設定に失敗した場合
          setError(result.message || "自動入札の設定に失敗しました");
          toast.error(result.message || "自動入札の設定に失敗しました");
          return false;
        }
      } catch (err) {
        // エラー処理
        console.error("自動入札設定エラー:", err);
        setError("自動入札の設定中にエラーが発生しました");
        toast.error("自動入札の設定中にエラーが発生しました");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [auctionId, userId, currentHighestBid, currentHighestBidderId, updateSettingsFromResponse],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自動入札を取り消す関数
   */
  const cancelAutoBidding = useCallback(async () => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    if (!auctionId || !userId) {
      console.log("自動入札取り消し: ユーザーIDまたはオークションIDがありません", { auctionId, userId });
      return false;
    }

    try {
      // ローディング状態をtrueにする
      setLoading(true);
      setError(null);

      // 自動入札を取り消す
      const result = await cancelAutoBid(auctionId);
      console.log("cancelAutoBidding_cancelAutoBid_result", result);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
      if (result.success) {
        // stateに自動入札設定を保存
        setAutoBidSettings(null);
        setIsAutoBidding(false);
        toast.success(result.message || "自動入札を取り消しました");
        console.log("cancelAutoBidding_end_result.success", result.success);
        return true;
      } else {
        // 取り消しに失敗した場合
        setError(result.message || "自動入札の取り消しに失敗しました");
        toast.error(result.message || "自動入札の取り消しに失敗しました");
        console.log("cancelAutoBidding_end_result.success_false", result.success);
        return false;
      }
    } catch (err) {
      // エラー処理
      console.error("自動入札取り消しエラー:", err);
      setError("自動入札の取り消し中にエラーが発生しました");
      toast.error("自動入札の取り消し中にエラーが発生しました");
      return false;
    } finally {
      setLoading(false);
    }
  }, [auctionId, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * マウント時に自動入札設定を取得
   */
  useEffect(() => {
    console.log("use-auto-bid_useEffect_マウント時に自動入札設定を取得");
    // 自動入札設定を取得
    void initializeAutoBid();
  }, [initializeAutoBid]);

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
