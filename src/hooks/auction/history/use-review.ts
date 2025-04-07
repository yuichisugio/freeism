"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuctionReview } from "@/lib/auction/action/history";
import { type AuctionReview } from "@prisma/client";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションレビューのカスタムフックの型
 */
type UseAuctionReviewProps = {
  auctionId: string;
  winnerId?: string | null;
  creatorId: string;
  reviews: AuctionReview[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションレビューのカスタムフック
 * @param props オークション情報
 * @returns レビュー関連の状態と関数
 */
export function useAuctionReview({ auctionId, winnerId, creatorId, reviews }: UseAuctionReviewProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ルーター
  const router = useRouter();

  // 評価
  const [rating, setRating] = useState(0);

  // コメント
  const [comment, setComment] = useState("");

  // 評価送信ローディング
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ユーザーがすでに評価を送信したかどうか
  const hasReviewed = useMemo(() => reviews.some((review) => review.reviewerId === creatorId && review.isSellerReview), [reviews, creatorId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 評価を送信する
  const handleReviewSubmit = useCallback(async () => {
    if (!winnerId) {
      toast.error("落札者がいないため評価できません");
      return;
    }

    if (rating === 0) {
      toast.error("評価を選択してください");
      return;
    }

    setIsSubmitting(true);
    try {
      await createAuctionReview(
        auctionId,
        winnerId,
        rating,
        comment,
        true, // 出品者からの評価なのでtrue
      );
      toast.success("評価を送信しました");
      router.refresh();
    } catch (error) {
      console.error("評価の送信に失敗しました", error);
      toast.error("評価の送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }, [auctionId, winnerId, comment, rating, router]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    rating,
    setRating,
    comment,
    setComment,
    isSubmitting,
    hasReviewed,
    handleReviewSubmit,
  };
}
