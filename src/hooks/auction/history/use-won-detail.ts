"use client";

import type { GetAuctionWonDetailReturn } from "@/lib/actions/auction/auction-won-detail";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getAuctionWonDetail } from "@/lib/actions/auction/auction-won-detail";
import { completeTaskDelivery } from "@/lib/actions/auction/won-detail";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";
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
   * タブの状態をURLパラメータで管理
   */
  const [tab, setTab] = useQueryState("tab", {
    defaultValue: "info",
    history: "replace",
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーID
   */
  const { data: session, status: sessionStatus } = useSession();
  const userId = useMemo(() => {
    return session?.user?.id ?? "";
  }, [session?.user?.id]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * TanStack Query のクエリクライアントインスタンス。キャッシュの無効化などに使用します。
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリ有効化の条件
   */
  const auctionQueryEnabled = useMemo(() => {
    const enabled = sessionStatus === "authenticated" && !!userId && !!auctionId;
    return enabled;
  }, [sessionStatus, userId, auctionId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 指定された auctionId に基づいて、落札したオークションの詳細情報を取得します。
   */
  const {
    data: auction,
    isPending: isAuctionQueryPending,
    error: auctionError,
  } = useQuery<GetAuctionWonDetailReturn["auctionWonDetail"], Error>({
    queryKey: queryCacheKeys.auction.wonDetail(auctionId, userId),
    queryFn: async () => {
      const result = await getAuctionWonDetail(auctionId, userId);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.auctionWonDetail;
    },
    enabled: auctionQueryEnabled,
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
      await queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.wonDetail(auctionId, userId) });
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
   * 全体のローディング状態を管理
   */
  const isLoadingOverall = useMemo(() => {
    if (sessionStatus === "loading") {
      return true; // セッション情報ロード中
    }
    if (auctionQueryEnabled && isAuctionQueryPending) {
      return true; // オークション詳細クエリが有効でロード中
    }
    return false; // 上記以外はロード完了または非表示状態
  }, [sessionStatus, auctionQueryEnabled, isAuctionQueryPending]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フックからの返り値
   */
  return {
    // state
    auction,
    isLoading: isLoadingOverall,
    error: auctionError?.message ?? null,
    isCompleting: isCompletingDelivery,
    router,
    tab,

    // functions
    handleComplete,
    setTab,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
