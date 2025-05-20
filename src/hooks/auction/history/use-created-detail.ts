"use client";

import type { AuctionHistoryCreatedDetail } from "@/types/auction-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuctionHistoryCreatedDetail, getUserRating, updateDeliveryMethod } from "@/lib/auction/action/created-detail";
import { completeTaskDelivery, createAuctionReview } from "@/lib/auction/action/history";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { ReviewPosition } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
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
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

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
      return await getAuctionHistoryCreatedDetail(auctionId, userId);
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
   * 落札者の評価を取得
   */
  const hasReviewed = useMemo(
    () => auction?.reviews?.some((review) => review.reviewerId === userId && review.reviewPosition === ReviewPosition.SELLER_TO_BUYER) ?? false,
    [auction?.reviews, userId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の評価を取得
   */
  const { data: winnerInfo, isPending: isWinnerRatingQueryPending } = useQuery({
    queryKey: queryCacheKeys.auction.winningRating(auction?.winner?.id ?? ""),
    queryFn: () => getUserRating(auction?.winner?.id ?? ""),
    enabled: !!auction?.winner?.id,
  });

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
    onSuccess: () => {
      toast.success("商品の提供を完了しました");
      void queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.historyCreatedDetail(userId, auctionId) });
      router.refresh();
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
   * レビューを送信する
   */
  const { mutate: createAuctionReviewMutation, isPending: isSubmittingReview } = useMutation({
    mutationFn: async (params: { rating: number; comment: string }) => {
      if (!auctionId || !auction?.winner?.id) {
        throw new Error("オークションIDまたは落札者IDが無効です。");
      }
      return createAuctionReview(auctionId, auction.winner.id, params.rating, params.comment, ReviewPosition.SELLER_TO_BUYER);
    },
    onSuccess: () => {
      toast.success("評価を送信しました");
      void queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.historyCreatedDetail(userId, auctionId) });
      setRating(0);
      setComment("");
    },
    onError: (error: Error) => {
      console.error("評価の送信に失敗しました", error);
      toast.error("評価の送信に失敗しました: " + error.message);
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューを送信する
   */
  const handleReviewSubmit = useCallback(async () => {
    if (!auction?.winner?.id) {
      toast.error("落札者がいないため評価できません");
      return;
    }
    if (rating === 0) {
      toast.error("評価を選択してください");
      return;
    }
    if (!auctionId || !userId) {
      // userId は creatorId に相当
      toast.error("オークション情報または作成者情報が不足しています。");
      return;
    }
    createAuctionReviewMutation({ rating, comment });
  }, [auctionId, auction?.winner?.id, userId, comment, rating, createAuctionReviewMutation]);

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
    // オークション詳細取得後、落札者情報があればその評価クエリが有効でロード中
    if (auction && !!auction.winner?.id && isWinnerRatingQueryPending) {
      return true;
    }
    return false; // 上記以外はロード完了または非表示状態
  }, [sessionStatus, auctionQueryEnabled, isAuctionQueryPending, auction, isWinnerRatingQueryPending]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細を返却
   */
  return {
    // state
    isCompleting,
    auction: auction ?? null,
    winnerRating: winnerInfo?.rating ?? 0,
    winnerReviewCount: winnerInfo?.reviewCount ?? 0,
    isLoading: isLoadingOverall,
    deliveryMethod,
    isEditingDelivery,
    isUpdatingDelivery,
    rating,
    comment,
    isSubmittingReview,
    hasReviewed,
    router,

    // functions
    handleComplete,
    setDeliveryMethod,
    handleUpdateDeliveryMethod,
    cancelEditingDelivery,
    startEditingDelivery,
    setRating,
    setComment,
    handleReviewSubmit,
  };
}
