"use server";

import type {
  ReviewSearchParams,
  ReviewSearchResult,
  SearchSuggestion,
} from "@/components/review-search/review-search";
import type { AuctionReview } from "@prisma/client";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prisma } from "@/library-setting/prisma";

import { getCachedAllReviews } from "./cache-get-all-review";
import { getCachedMyReviews } from "./cache-get-my-review";
import { getCachedSearchSuggestions } from "./cache-get-search-suggestion";
import { getCachedUserReviews } from "./cache-get-user-reviews";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  return await getCachedSearchSuggestions(query);
}

export async function getAllReviews(searchParams: ReviewSearchParams | null): Promise<ReviewSearchResult> {
  return await getCachedAllReviews(searchParams);
}

export async function getUserReviews(searchParams: ReviewSearchParams | null): Promise<ReviewSearchResult> {
  const userId = await getAuthenticatedSessionUserId();
  return await getCachedUserReviews(searchParams, userId);
}

export async function getMyReviews(searchParams: ReviewSearchParams | null): Promise<ReviewSearchResult> {
  const userId = await getAuthenticatedSessionUserId();
  return await getCachedMyReviews(searchParams, userId);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * レビューを更新する関数
 * @param reviewId - レビューID
 * @param rating - 新しい評価
 * @param comment - 新しいコメント
 * @returns 更新されたレビューデータ
 */
export async function updateReview(
  reviewId: string,
  rating: number,
  comment: string | null,
): Promise<{ success: boolean; message: string; review?: AuctionReview }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * パラメータの検証
     */
    if (!reviewId || rating === null || rating === undefined || rating < 0 || rating > 5) {
      throw new Error("無効なパラメータが指定されました");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーの認証
     */
    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 自分が書いたレビューかどうかを確認
     */
    const existingReview = await prisma.auctionReview.findFirst({
      where: {
        id: reviewId,
        reviewerId: userId,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * レビューが見つからないか、編集権限がありません
     */
    if (!existingReview) {
      throw new Error("レビューが見つからないか、編集権限がありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * レビューを更新
     */
    const updatedReview = await prisma.auctionReview.update({
      where: { id: reviewId },
      data: {
        rating,
        comment,
        updatedAt: new Date(),
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * レビューを更新した結果を返す
     */
    return { success: true, message: "レビューを更新しました", review: updatedReview };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("Error updating review:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("レビューの更新に失敗しました");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
