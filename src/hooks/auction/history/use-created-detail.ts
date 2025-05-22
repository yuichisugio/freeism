"use client";

import type { AuctionHistoryCreatedDetail } from "@/types/auction-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { completeTaskDelivery, getAuctionHistoryCreatedDetail, updateDeliveryMethod } from "@/lib/auction/action/created-detail";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

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
    history: "push",
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
   * 初期化
   */
  const queryClient = useQueryClient();

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
    // デバッグログを追加して、各値と最終的なenabled状態を確認
    console.log("[useCreatedDetail] auctionQueryEnabled check:", {
      sessionStatus,
      userId,
      hasUserId: !!userId, // userIdが空文字列でないか
      auctionId,
      hasAuctionId: !!auctionId, // auctionIdが空文字列でないか
      enabled, // 最終的な有効状態
    });
    return enabled;
  }, [sessionStatus, userId, auctionId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細を取得
   */
  const { data: auction, isPending: isAuctionQueryPending } = useQuery<AuctionHistoryCreatedDetail | null>({
    queryKey: queryCacheKeys.auction.historyCreatedDetail(userId, auctionId),
    queryFn: async () => {
      // queryFnが実行される直前にもログを追加
      console.log("[useCreatedDetail] queryFn executing with:", { auctionId, userId });
      return await getAuctionHistoryCreatedDetail(auctionId);
    },
    enabled: auctionQueryEnabled,
  });

  // auction データが変更されたら deliveryMethod を更新
  useEffect(() => {
    if (auction?.task && typeof auction.task.deliveryMethod === "string") {
      setDeliveryMethod(auction.task.deliveryMethod);
    }
  }, [auction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 商品の提供を完了する
   */
  const { mutate: handleComplete, isPending: isCompleting } = useMutation({
    mutationFn: () => {
      if (!auction?.task.id) {
        throw new Error("タスクIDが指定されていません。");
      }
      return completeTaskDelivery(auction.task.id);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("商品の提供を完了しました");
        void queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.historyCreatedDetail(userId, auctionId) });
        router.refresh();
      } else {
        toast.error(result.error ?? "商品の提供を完了に失敗しました");
      }
    },
    onError: (error: Error) => {
      console.error("完了処理に失敗しました", error);
      toast.error(error.message || "完了処理に失敗しました");
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法を更新する
   */
  const { mutate: handleUpdateDeliveryMethod, isPending: isUpdatingDelivery } = useMutation({
    mutationFn: (newDeliveryMethod: string) => {
      console.log("[useCreatedDetail] handleUpdateDeliveryMethod", newDeliveryMethod);
      if (!auction?.task.id) {
        throw new Error("タスクIDが指定されていません。");
      }
      if (!deliveryMethod.trim()) {
        toast.error("提供方法を入力してください");
      }
      return updateDeliveryMethod(auction.task.id, newDeliveryMethod);
    },
    onSuccess: (_, newDeliveryMethod) => {
      toast.success("提供方法を更新しました");
      setIsEditingDelivery(false);
      setDeliveryMethod(newDeliveryMethod);
      void queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.historyCreatedDetail(userId, auctionId) });
      void queryClient.invalidateQueries({ queryKey: queryCacheKeys.tasks.all() });
      router.refresh();
    },
    onError: (error: Error) => {
      console.error("提供方法の更新に失敗しました", error);
      toast.error(error.message || "提供方法の更新に失敗しました");
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法の編集をキャンセルする
   */
  const cancelEditingDelivery = useCallback(() => {
    setIsEditingDelivery(false);
    if (auction?.task && typeof auction.task.deliveryMethod === "string") {
      setDeliveryMethod(auction.task.deliveryMethod);
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
    auction: auction ?? null,
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
