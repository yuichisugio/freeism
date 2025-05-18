"use client";

import type { AuctionReview } from "@prisma/client";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuctionReview } from "@/lib/auction/action/history";
import { ReviewPosition } from "@prisma/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションレビューのカスタムフックの型
 */
type UseAuctionReviewProps = {
  auctionId: string | undefined; // undefined を許容
  winnerId?: string | null;
  creatorId: string | undefined; // undefined を許容
  reviews: AuctionReview[] | undefined; // undefined を許容
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションレビューのカスタムフック
 * @param props オークション情報
 * @returns レビュー関連の状態と関数
 */
export function useAuctionReview({ auctionId, winnerId, creatorId, reviews }: UseAuctionReviewProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  // isSubmitting は useMutation の isPending を使用するため削除
  // const [isSubmitting, setIsSubmitting] = useState(false);

  const hasReviewed = useMemo(
    () => reviews?.some((review) => review.reviewerId === creatorId && review.reviewPosition === ReviewPosition.SELLER_TO_BUYER) ?? false,
    [reviews, creatorId],
  );

  const { mutate: createAuctionReviewMutation, isPending: isSubmitting } = useMutation({
    mutationFn: async (params: { rating: number; comment: string }) => {
      if (!auctionId || !winnerId) {
        throw new Error("オークションIDまたは落札者IDが無効です。");
      }
      return createAuctionReview(auctionId, winnerId, params.rating, params.comment, ReviewPosition.SELLER_TO_BUYER);
    },
    onSuccess: () => {
      toast.success("評価を送信しました");
      // オークション詳細やレビューリストなどの関連クエリを無効化
      void queryClient.invalidateQueries({ queryKey: ["auctionDetail", auctionId] }); // 仮のクエリキー
      void queryClient.invalidateQueries({ queryKey: ["auctionReviews", auctionId] }); // 仮のクエリキー
      router.refresh();
    },
    onError: (error) => {
      console.error("評価の送信に失敗しました", error);
      toast.error("評価の送信に失敗しました: " + error.message);
    },
  });

  const handleReviewSubmit = useCallback(async () => {
    if (!winnerId) {
      toast.error("落札者がいないため評価できません");
      return;
    }
    if (rating === 0) {
      toast.error("評価を選択してください");
      return;
    }
    if (!auctionId || !creatorId) {
      toast.error("オークション情報または作成者情報が不足しています。");
      return;
    }
    createAuctionReviewMutation({ rating, comment });
  }, [auctionId, winnerId, creatorId, comment, rating, createAuctionReviewMutation]);

  return {
    rating,
    comment,
    isSubmitting,
    hasReviewed,
    handleReviewSubmit,
    setRating,
    setComment,
  };
}
