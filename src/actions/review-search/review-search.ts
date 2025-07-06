"use server";

import type {
  ReviewSearchParams,
  ReviewSearchResult,
  SearchSuggestion,
} from "@/components/review-search/review-search";
import type { AuctionReview } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { useCacheKeys } from "@/library-setting/nextjs-use-cache";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";

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
  searchParams: ReviewSearchParams | null,
): PromiseResult<AuctionReview> {
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
   * キャッシュの更新
   */
  revalidateTag(
    useCacheKeys.reviewSearch
      .myReviews(
        userId,
        searchParams ?? {
          searchQuery: "",
          page: 1,
          tab: "search",
        },
      )
      .join(":"),
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューを更新した結果を返す
   */
  return { success: true, message: "レビューを更新しました", data: updatedReview };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
