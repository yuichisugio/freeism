"use client";

import type { ExecuteAutoBidParams, ExecuteAutoBidReturn } from "@/lib/auction/action/auto-bid/auto-bid";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeAutoBid } from "@/lib/auction/action/auto-bid/auto-bid";
import { cancelAutoBid } from "@/lib/auction/action/auto-bid/cancel-auto-bid";
import { getAutoBidByUserId } from "@/lib/auction/action/auto-bid/get-auto-bid-settings";
import { setAutoBid } from "@/lib/auction/action/auto-bid/set-auto-bid";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札設定の型
 */
type AutoBidSettings = {
  id: string;
  maxBidAmount: number;
  bidIncrement: number;
  isActive: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札のカスタムフックの型
 */
export type UseAutoBidReturn = {
  // state
  autoBidSettings: AutoBidSettings | null;
  loading: boolean;
  error: string | null;
  isAutoBidding: boolean;
  maxBidAmount: number;
  bidIncrement: number;

  // functions
  handleSetupAutoBid: (e: React.FormEvent) => Promise<void>;
  cancelAutoBidding: () => Promise<boolean>;
  setMaxBidAmount: (value: number) => void;
  setBidIncrement: (value: number) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札のカスタムフック
 * @param {string} auctionId オークションID
 * @param {number} currentHighestBid 現在の最高入札額
 * @param {string | null} currentHighestBidderId 現在の最高入札者ID
 * @returns {UseAutoBidReturn} 自動入札に関する状態と操作関数
 */
export function useAutoBid(
  auctionId: string,
  currentHighestBid: number,
  currentHighestBidderId: string | null,
): UseAutoBidReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッション情報
   */
  const { data: session } = useSession();
  const userId = useMemo(() => {
    if (!session?.user?.id) {
      console.error("useAutoBid: ユーザーIDがありません", { session });
      return null;
    }
    return session.user.id;
  }, [session]);

  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // 自動入札の設定情報 (ローカルでの表示用)
  const [displayAutoBidSettings, setDisplayAutoBidSettings] = useState<AutoBidSettings | null>(null);

  // 自動入札中フラグ (ローカルでの表示用)
  const [isDisplayAutoBidding, setIsDisplayAutoBidding] = useState<boolean>(false);

  // 最大入札額の入力値
  const [maxBidAmount, setMaxBidAmount] = useState<number>(currentHighestBid + 1);

  // 入札単位の入力値（デフォルト100ポイント）
  const [bidIncrement, setBidIncrement] = useState<number>(100);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 1. 自動入札設定の取得 (useQuery)
   *    画面を開いた時、またはauctionId, userId, currentHighestBidが変更された時に実行
   */
  const {
    data: fetchedAutoBidData,
    isLoading: isLoadingInitialAutoBid,
    error: errorInitialAutoBid,
  } = useQuery<ExecuteAutoBidReturn | null, Error>({
    queryKey: queryCacheKeys.auction.autoBid(auctionId, userId ?? "", currentHighestBid),
    queryFn: async () => {
      if (!auctionId || !userId) {
        return null;
      }
      const result = await getAutoBidByUserId(auctionId, currentHighestBid);
      // useQueryは成功/失敗をdata/errorで判断するため、APIの戻り値をそのまま返す
      return result;
    },
    enabled: !!auctionId && !!userId,
  });

  // fetchedAutoBidData の結果をローカルステートに反映
  useEffect(() => {
    if (fetchedAutoBidData) {
      if (fetchedAutoBidData.success && fetchedAutoBidData.autoBid) {
        setDisplayAutoBidSettings({
          id: fetchedAutoBidData.autoBid.id,
          maxBidAmount: fetchedAutoBidData.autoBid.maxBidAmount,
          bidIncrement: fetchedAutoBidData.autoBid.bidIncrement,
          isActive: true,
        });
        setIsDisplayAutoBidding(true);
      } else {
        // 成功したがautoBidがない場合、またはAPI呼び出し自体が失敗した場合
        setDisplayAutoBidSettings(null);
        setIsDisplayAutoBidding(false);
        if (!fetchedAutoBidData.success && fetchedAutoBidData.message) {
          // console.error("自動入札設定の取得エラー(useEffect):", fetchedAutoBidData.message);
          // toast.error(fetchedAutoBidData.message); // ここでトーストを出すかはUI次第
        }
      }
    }
  }, [fetchedAutoBidData]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 2. 自動入札を設定 (useMutation)
   */
  const {
    mutate: setupAutoBidMutate,
    isPending: isSetupAutoBidPending,
    error: setupAutoBidError,
  } = useMutation<ExecuteAutoBidReturn, Error, { maxBidAmount: number; bidIncrement: number }>({
    mutationFn: async (variables) => {
      if (!auctionId || !userId) {
        throw new Error("ログインが必要です");
      }
      return setAutoBid(auctionId, variables.maxBidAmount, variables.bidIncrement);
    },
    onSuccess: (result) => {
      if (result.success && result.autoBid) {
        toast.success(result.message || "自動入札を設定しました");
        // キャッシュを無効化して再フェッチをトリガー
        void queryClient.invalidateQueries({
          queryKey: queryCacheKeys.auction.autoBid(auctionId, userId ?? "", currentHighestBid),
        });
        // オークション詳細なども更新する場合
        void queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.detail(auctionId) });

        const params: ExecuteAutoBidParams = {
          auctionId,
          currentHighestBid, // この値はmutation実行前のものなので注意。最新が必要なら再取得
          currentHighestBidderId, // 同上
          validationDone: false, // API側で検証するためfalse
          paramsValidationResult: null,
        };
        executeAutoBid(params)
          .then((autoResult) => {
            if (autoResult?.success) {
              // 必要に応じて関連クエリをさらに無効化
              void queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.detail(auctionId) });
            } else if (autoResult && !autoResult.success) {
              console.warn("自動入札処理(mutation onSuccess)に失敗しました", autoResult.message);
            }
          })
          .catch((autoError) => {
            console.error("即時の自動入札処理でエラーが発生しました", autoError);
          });
      } else {
        toast.error(result.message || "自動入札の設定に失敗しました");
      }
    },
    onError: (error) => {
      toast.error(error.message || "自動入札の設定中にエラーが発生しました");
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 3. 自動入札を取り消す (useMutation)
   */
  const {
    mutateAsync: cancelAutoBidMutateAsync,
    isPending: isCancelAutoBidPending,
    error: cancelAutoBidError,
  } = useMutation<ExecuteAutoBidReturn, Error>({
    mutationFn: async () => {
      if (!auctionId || !userId) {
        throw new Error("ログインが必要です");
      }
      return cancelAutoBid(auctionId, isDisplayAutoBidding);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || "自動入札を取り消しました");
        // キャッシュを無効化して再フェッチをトリガー
        void queryClient.invalidateQueries({
          queryKey: queryCacheKeys.auction.autoBid(auctionId, userId ?? "", currentHighestBid),
        });
        // オークション詳細なども更新する場合
        void queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.detail(auctionId) });
      } else {
        toast.error(result.message || "自動入札の取り消しに失敗しました");
      }
    },
    onError: (error) => {
      toast.error(error.message || "自動入札の取り消し中にエラーが発生しました");
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自動入札の設定を保存
   */
  const handleSetupAutoBid = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (maxBidAmount <= currentHighestBid) {
        toast.error("最大入札額は現在の最高入札額より高く設定してください。");
        return;
      }
      // setupAutoBidMutation.mutate を呼び出す
      setupAutoBidMutate({ maxBidAmount, bidIncrement });
    },
    [maxBidAmount, bidIncrement, currentHighestBid, setupAutoBidMutate],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自動入札を取り消す関数
   */
  const cancelAutoBidding = useCallback(async (): Promise<boolean> => {
    try {
      const result = await cancelAutoBidMutateAsync();
      return result.success;
    } catch (error) {
      console.error("自動入札の取り消し中にエラーが発生しました", error);
      return false;
    }
  }, [cancelAutoBidMutateAsync]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング状態の集約
   */
  const loading = useMemo(() => {
    return isLoadingInitialAutoBid || isSetupAutoBidPending || isCancelAutoBidPending;
  }, [isLoadingInitialAutoBid, isSetupAutoBidPending, isCancelAutoBidPending]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * エラーメッセージの集約 (useQueryのエラーを優先し、なければmutationのエラーメッセージ)
   */
  const error = useMemo(() => {
    if (errorInitialAutoBid) return errorInitialAutoBid.message;
    if (setupAutoBidError) return setupAutoBidError.message;
    if (cancelAutoBidError) return cancelAutoBidError.message;
    if (fetchedAutoBidData && !fetchedAutoBidData.success && fetchedAutoBidData.message) {
      return fetchedAutoBidData.message;
    }
    return null;
  }, [errorInitialAutoBid, setupAutoBidError, cancelAutoBidError, fetchedAutoBidData]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    // state
    autoBidSettings: displayAutoBidSettings,
    loading,
    error,
    isAutoBidding: isDisplayAutoBidding,
    maxBidAmount,
    bidIncrement,

    // 関数
    handleSetupAutoBid,
    cancelAutoBidding,
    setMaxBidAmount,
    setBidIncrement,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
