"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeTaskDelivery,
  getAuctionHistoryCreatedDetail,
  updateDeliveryMethod,
} from "@/actions/auction/created-detail";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細を取得
 */
export function useCreatedDetail(auctionId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タブの状態をURLパラメータで管理
   */
  const [tab, setTab] = useQueryState("tab", {
    defaultValue: "info",
    history: "replace",
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーID
   */
  const { data: session, status: sessionStatus } = useSession();
  const userId = useMemo(() => {
    return session?.user?.id ?? "";
  }, [session?.user?.id]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細を取得
   */
  const auctionQueryEnabled = useMemo(() => {
    const enabled = sessionStatus === "authenticated" && !!userId && !!auctionId;
    return enabled;
  }, [sessionStatus, userId, auctionId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細を取得
   */
  const {
    data: auction,
    isPending: isAuctionQueryPending,
    error: auctionError,
  } = useQuery({
    queryKey: queryCacheKeys.auction.historyCreatedDetail(userId, auctionId),
    queryFn: async () => {
      return await getAuctionHistoryCreatedDetail(auctionId);
    },
    enabled: auctionQueryEnabled,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // auction データが変更されたら deliveryMethod を更新
  useEffect(() => {
    if (auction?.data && typeof auction.data.task.deliveryMethod === "string") {
      setDeliveryMethod(auction.data.task.deliveryMethod);
    }
  }, [auction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 商品の提供を完了する
   */
  const {
    mutate: handleComplete,
    isPending: isCompleting,
    error: completeError,
  } = useMutation({
    mutationFn: () => {
      return completeTaskDelivery(auction?.data.task.id ?? "", userId);
    },
    onSuccess: () => {
      router.refresh();
    },
    meta: {
      invalidateCacheKeys: [{ queryKey: queryCacheKeys.auction.historyCreatedDetail(userId, auctionId), exact: true }],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法を更新する
   */
  const {
    mutate: handleUpdateDeliveryMethod,
    isPending: isUpdatingDelivery,
    error: updateDeliveryMethodError,
  } = useMutation({
    mutationFn: (newDeliveryMethod: string) => {
      return updateDeliveryMethod(auction?.data.task.id ?? "", newDeliveryMethod, userId);
    },
    onSuccess: (_, newDeliveryMethod) => {
      setIsEditingDelivery(false);
      setDeliveryMethod(newDeliveryMethod);
      router.refresh();
    },
    meta: {
      invalidateCacheKeys: [
        { queryKey: queryCacheKeys.auction.historyCreatedDetail(userId, auctionId), exact: true },
        { queryKey: queryCacheKeys.tasks.all(), exact: true },
      ],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法の編集をキャンセルする
   */
  const cancelEditingDelivery = useCallback(() => {
    setIsEditingDelivery(false);
    if (auction?.data && typeof auction.data.task.deliveryMethod === "string") {
      setDeliveryMethod(auction.data.task.deliveryMethod);
    }
  }, [auction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法を編集する
   */
  const startEditingDelivery = useCallback(() => {
    setIsEditingDelivery(true);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
    // 不要なローディング判定を削除
    return false; // 上記以外はロード完了または非表示状態
  }, [sessionStatus, auctionQueryEnabled, isAuctionQueryPending]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細を返却
   */
  return {
    // state
    isCompleting,
    auction,
    error: auctionError?.message ?? updateDeliveryMethodError?.message ?? completeError?.message ?? null,
    isLoading: isLoadingOverall,
    deliveryMethod,
    isEditingDelivery,
    isUpdatingDelivery,
    router,
    tab,

    // functions
    handleComplete,
    setDeliveryMethod,
    handleUpdateDeliveryMethod,
    cancelEditingDelivery,
    startEditingDelivery,
    setTab,
  };
}
