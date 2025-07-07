"use cache";

import type { ReviewData, ReviewSearchParams, ReviewSearchResult } from "@/components/review-search/review-search";
import type { PromiseResult } from "@/types/general-types";
import type { Prisma } from "@prisma/client";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { REVIEW_SEARCH_CONSTANTS } from "@/lib/constants";
import { useCacheKeys } from "@/library-setting/nextjs-use-cache";
import { prisma } from "@/library-setting/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自分が書いたレビューを取得する関数（編集用）
 * @param searchParams - 検索パラメータ
 * @returns レビューデータと統計情報
 */
export async function getCachedMyReviews(
  searchParams: ReviewSearchParams | null,
  userId: string,
): PromiseResult<ReviewSearchResult> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * バリデーション
   * 検索クエリのバリデーション（undefined チェックのみ、空文字列は有効）。空文字列は「すべてのレビューを検索する」という意味で有効な値として扱う
   * ページ番号のバリデーション（1以上）
   * タブのバリデーション（search, edit, received）
   */
  // ユーザーIDのバリデーション
  if (!userId) {
    throw new Error("ユーザーIDが存在しません");
  }

  // タブのバリデーション
  if (searchParams?.tab && !REVIEW_SEARCH_CONSTANTS.TAB_TYPES.includes(searchParams.tab)) {
    throw new Error("無効なタブが指定されました");
  }

  // ページ番号のバリデーション
  if (searchParams?.page !== undefined && searchParams.page !== null && searchParams.page < 1) {
    throw new Error("ページ番号は1以上である必要があります");
  }

  // 検索クエリのバリデーション。空文字列は有効な値として扱うが、それ以外はエラー
  if (searchParams && (searchParams.searchQuery === undefined || searchParams.searchQuery === null)) {
    throw new Error("検索クエリの定義がありません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページネーション/オフセット/取得件数の設定
   */
  const page = searchParams?.page ?? 1;
  const limit = REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE;
  const offset = (page - 1) * limit;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューの取得条件
   */
  // 自分が書いたレビュー
  const whereCondition: Prisma.AuctionReviewWhereInput = {
    reviewerId: userId,
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索条件がある場合、追加のフィルター条件を構築
   */
  if (searchParams?.searchQuery && searchParams.searchQuery.length > 0) {
    whereCondition.OR = [
      // ユーザー名での検索（レビュー受信者）
      {
        reviewee: {
          settings: {
            username: {
              contains: searchParams.searchQuery,
              mode: "insensitive",
            },
          },
        },
      },
      // レビューコメントでの検索
      {
        comment: {
          contains: searchParams.searchQuery,
          mode: "insensitive",
        },
      },
      // グループ名での検索
      {
        auction: {
          task: {
            group: {
              name: {
                contains: searchParams.searchQuery,
                mode: "insensitive",
              },
            },
          },
        },
      },
      // タスク名での検索
      {
        auction: {
          task: {
            task: {
              contains: searchParams.searchQuery,
              mode: "insensitive",
            },
          },
        },
      },
      // ID系での検索
      { revieweeId: searchParams.searchQuery },
      { auctionId: searchParams.searchQuery },
      { auction: { taskId: searchParams.searchQuery } },
      { auction: { task: { groupId: searchParams.searchQuery } } },
    ];
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューの取得
   */
  const reviews = await prisma.auctionReview.findMany({
    where: whereCondition,
    orderBy: {
      createdAt: "desc",
    },
    skip: offset,
    take: limit,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      reviewPosition: true,
      // レビュー受信者の情報
      reviewee: {
        select: {
          id: true,
          settings: {
            select: {
              username: true,
            },
          },
        },
      },
      auction: {
        select: {
          id: true,
          task: {
            select: {
              id: true,
              task: true,
              category: true,
              group: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューの取得
   */
  const totalCount = await prisma.auctionReview.count({
    where: whereCondition,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューデータの整形
   */
  const reviewData: ReviewData[] = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    reviewPosition: review.reviewPosition,
    reviewer: null, // 編集タブでは送信者情報は不要
    reviewee: review.reviewee
      ? {
          id: review.reviewee.id,
          username: review.reviewee.settings?.username ?? `未設定:${review.reviewee.id}`,
        }
      : null,
    auction: {
      id: review.auction.id,
      task: {
        id: review.auction.task.id,
        task: review.auction.task.task,
        category: review.auction.task.category,
        group: {
          id: review.auction.task.group.id,
          name: review.auction.task.group.name,
        },
      },
    },
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュにタグをつける
   */
  cacheTag(
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューデータの返却
   */
  return {
    success: true,
    message: "自分のレビューを取得しました",
    data: {
      reviews: reviewData,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}
