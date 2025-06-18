"use server";

import type {
  ReviewSearchParams,
  ReviewSearchResult,
  SearchSuggestion,
} from "@/components/review-search/review-search";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

import {
  getCachedAllReviews,
  getCachedMyReviews,
  getCachedSearchSuggestions,
  getCachedUserReviews,
} from "./cache-review-search";

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
export async function updateReview(reviewId: string, rating: number, comment: string | null) {
  try {
    const userId = await getAuthenticatedSessionUserId();

    // 自分が書いたレビューかどうかを確認
    const existingReview = await prisma.auctionReview.findFirst({
      where: {
        id: reviewId,
        reviewerId: userId,
      },
    });

    if (!existingReview) {
      throw new Error("レビューが見つからないか、編集権限がありません");
    }

    const updatedReview = await prisma.auctionReview.update({
      where: { id: reviewId },
      data: {
        rating,
        comment,
        updatedAt: new Date(),
      },
    });

    return updatedReview;
  } catch (error) {
    console.error("Error updating review:", error);
    throw new Error("レビューの更新に失敗しました");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
