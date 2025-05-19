"use client";

import type { AuctionWonDetail } from "@/types/auction-types";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuctionWonDetail } from "@/lib/auction/action/auction-won-detail";
import { getUserRating } from "@/lib/auction/action/created-detail";
import { completeTaskDelivery, createAuctionReview } from "@/lib/auction/action/history";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { ReviewPosition } from "@prisma/client";
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
   * state
   */
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

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
   * オークション情報 (`auction`) から出品者ID (`taskCreatorId`) を取得し、
   */
  const {
    data: sellerRatingInfo,
    isLoading: isSellerRatingLoading,
    error: sellerInfoError,
  } = useQuery<{ rating: number; reviewCount: number }, Error>({
    queryKey: queryCacheKeys.auction.sellerRating(auction?.taskCreatorId ?? ""),
    queryFn: () => getUserRating(auction?.taskCreatorId ?? ""),
    enabled: !!auction?.taskCreatorId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在のユーザーが既に出品者を評価したかどうかを判定します。
   */
  const hasReviewed = useMemo(() => {
    if (!auction) return false;
    // 自分がすでに出品者を評価したかどうか (BUYER_TO_SELLER のレビューが存在するか)
    return auction.reviews.some((review) => review.reviewerId === auction.winnerId);
  }, [auction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品者に対する評価を送信する Mutation。
   */
  const { mutate: submitReview, isPending: isSubmittingReview } = useMutation({
    mutationFn: async (variables: { rating: number; comment: string }) => {
      if (!auction) {
        throw new Error("オークション情報が見つかりません。");
      }
      if (variables.rating === 0) {
        throw new Error("評価を選択してください");
      }
      // サーバーアクションを呼び出してレビューを作成
      await createAuctionReview(auction.auctionId, auction.taskCreatorId, variables.rating, variables.comment, ReviewPosition.BUYER_TO_SELLER);
    },
    onSuccess: async () => {
      toast.success("評価を送信しました");
      await queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.wonDetail(auctionId) });
      if (auction?.taskCreatorId) {
        // creatorId が存在する場合のみ invalidate
        await queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.sellerRating(auction.taskCreatorId) });
      }
      router.refresh();
    },
    onError: (error) => {
      console.error("評価の送信に失敗しました", error);
      toast.error(error.message || "評価の送信に失敗しました");
    },
  });

  /**
   * 出品者に対する評価を送信する非同期関数。
   */
  const handleReviewSubmit = useCallback(async () => {
    submitReview({ rating, comment });
  }, [submitReview, rating, comment]);

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
    sellerRating: sellerRatingInfo?.rating ?? 0,
    sellerReviewCount: sellerRatingInfo?.reviewCount ?? 0,
    isLoading: isAuctionLoading || isSellerRatingLoading,
    error: auctionError ?? sellerInfoError,
    hasReviewed,
    rating,
    comment,
    isSubmitting: isSubmittingReview,
    isCompleting: isCompletingDelivery,
    router,

    // functions
    setRating,
    setComment,
    handleReviewSubmit,
    handleComplete,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
