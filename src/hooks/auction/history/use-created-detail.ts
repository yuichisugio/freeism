"use client";

import type { AuctionMessage } from "@/lib/auction/action/history";
import type { AuctionReview } from "@prisma/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuctionHistoryCreatedDetail, getUserRating } from "@/lib/auction/action/created-detail";
import {
  completeTaskDelivery,
  createAuctionReview,
  getAuctionMessages,
  sendAuctionMessage,
  updateDeliveryMethod,
} from "@/lib/auction/action/history";
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
  const { data: session } = useSession();
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
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細を取得
   */
  const { data: auction, isPending: isAuctionLoading } = useQuery({
    queryKey: queryCacheKeys.auction.historyCreatedDetail(userId, auctionId),
    queryFn: () => getAuctionHistoryCreatedDetail(auctionId, userId),
  });

  // auction データが変更されたら deliveryMethod を更新
  useEffect(() => {
    if (auction && auction.task && typeof auction.task.deliveryMethod === "string") {
      setDeliveryMethod(auction.task.deliveryMethod);
    }
  }, [auction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の評価を取得
   */
  const hasReviewed = useMemo(
    () =>
      auction?.reviews?.some((review: AuctionReview) => review.reviewerId === userId && review.reviewPosition === ReviewPosition.SELLER_TO_BUYER) ??
      false,
    [auction?.reviews, userId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の評価を取得
   */
  const { data: winnerInfo, isPending: isWinnerRatingLoading } = useQuery({
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
      if (!auction?.taskId) {
        throw new Error("タスクIDが指定されていません。");
      }
      return completeTaskDelivery(auction.taskId);
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
      if (!auction?.taskId) {
        throw new Error("タスクIDが指定されていません。");
      }
      if (!deliveryMethod.trim()) {
        toast.error("提供方法を入力してください");
      }
      return updateDeliveryMethod(auction.taskId, newDeliveryMethod);
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
    if (auction && auction.task && typeof auction.task.deliveryMethod === "string") {
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
   * オークションメッセージを取得
   */
  const {
    data: messages,
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
  } = useQuery<AuctionMessage[], Error>({
    queryKey: queryCacheKeys.auction.messages(auctionId),
    queryFn: async () => {
      if (!auctionId) return [];
      return getAuctionMessages(auctionId);
    },
    enabled: !!auctionId && !!auction?.winner?.id,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージをスクロールする
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージを送信する
   */
  const { mutate: handleSendMessage, isPending: isSendingMessage } = useMutation<AuctionMessage, Error, string>({
    mutationFn: async (messageContent: string) => {
      if (!auctionId || !auction?.winner?.id) {
        throw new Error("オークションIDまたは落札者IDが無効です");
      }
      if (!messageContent.trim()) {
        toast.error("メッセージを入力してください");
      }
      return sendAuctionMessage(auctionId, auction.winner.id, messageContent);
    },
    onSuccess: (sentMessage) => {
      queryClient.setQueryData<AuctionMessage[]>(queryCacheKeys.auction.messages(auctionId), (oldMessages) =>
        oldMessages ? [...oldMessages, sentMessage] : [sentMessage],
      );
      setNewMessage("");
      toast.success("メッセージを送信しました");
    },
    onError: (error: Error) => {
      console.error("メッセージの送信に失敗しました", error);
      toast.error("メッセージの送信に失敗しました: " + error.message);
    },
  });

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
    isLoading: isAuctionLoading || isWinnerRatingLoading,
    deliveryMethod,
    isEditingDelivery,
    isUpdatingDelivery,
    rating,
    comment,
    messages: messages ?? [],
    isLoadingMessages,
    isSendingMessage,
    messagesEndRef,
    newMessage,
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
    setNewMessage,
    handleSendMessage,
    refetchMessages,
  };
}
