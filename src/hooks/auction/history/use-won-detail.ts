"use client";

import type { AuctionWonDetail } from "@/types/auction-types";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAuctionWonDetail } from "@/lib/auction/action/auction-won-detail";
import { completeTaskDelivery } from "@/lib/auction/action/won-detail";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションで落札した商品の詳細情報を管理するためのカスタムフック。
 * 商品情報の取得、出品者評価の取得、評価の送信、商品受け取り完了処理などを提供します。
 *
 * @param auctionId - 詳細を取得するオークションのID。
 * @returns オークション詳細、出品者評価、ローディング状態、エラー情報、各種操作関数などを含むオブジェクト。
 */
export function useWonDetail(auctionId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Next.js のルーターインスタンス。ページ遷移に使用します。
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * TanStack Query のクエリクライアントインスタンス。キャッシュの無効化などに使用します。
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 指定された auctionId に基づいて、落札したオークションの詳細情報を取得します。
   */
  const {
    data: auction,
    isLoading: isAuctionLoading,
    error: auctionError,
  } = useQuery<AuctionWonDetail, Error>({
    queryKey: queryCacheKeys.auction.wonDetail(auctionId),
    queryFn: () => getAuctionWonDetail(auctionId),
    enabled: !!auctionId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 商品の受け取りを完了としてマークする Mutation。
   */
  const { mutate: completeDelivery, isPending: isCompletingDelivery } = useMutation({
    mutationFn: async () => {
      if (!auction) {
        throw new Error("オークション情報が見つかりません。");
      }
      // サーバーアクションを呼び出してタスクの配送を完了
      await completeTaskDelivery(auction.taskId);
    },
    onSuccess: async () => {
      toast.success("商品の受け取りを完了しました");
      await queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.wonDetail(auctionId) });
      router.refresh();
    },
    onError: (error) => {
      console.error("完了処理に失敗しました", error);
      toast.error(error.message || "完了処理に失敗しました");
    },
  });

  /**
   * 商品の受け取りを完了としてマークする非同期関数。
   */
  const handleComplete = useCallback(async () => {
    completeDelivery();
  }, [completeDelivery]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フックからの返り値
   */
  return {
    // state
    auction,
    isLoading: isAuctionLoading,
    error: auctionError,
    isCompleting: isCompletingDelivery,
    router,

    // functions
    handleComplete,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
