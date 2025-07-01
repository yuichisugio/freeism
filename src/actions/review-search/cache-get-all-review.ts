"use cache";

import type { ReviewData, ReviewSearchParams, ReviewSearchResult } from "@/components/review-search/review-search";
import type { Prisma } from "@prisma/client";
import { REVIEW_SEARCH_CONSTANTS } from "@/lib/constants";
import { prisma } from "@/library-setting/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 全レビューを検索する関数（検索タブ用）
 * @param searchParams - 検索パラメータ
 * @returns レビューデータと統計情報
 */
export async function getCachedAllReviews(searchParams: ReviewSearchParams | null): Promise<ReviewSearchResult> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ページネーション/オフセット/取得件数の設定
     */
    const page = searchParams?.page ?? 1;
    const limit = REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE;
    const offset = (page - 1) * limit;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 検索条件を構築（全レビューが対象）
     */
    const whereCondition: Prisma.AuctionReviewWhereInput = {};

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
        { reviewerId: searchParams.searchQuery },
        { auctionId: searchParams.searchQuery },
        { auction: { taskId: searchParams.searchQuery } },
        { auction: { task: { groupId: searchParams.searchQuery } } },
      ];
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * レビューデータを取得（ページネーション付き）
     */
    const reviews = await prisma.auctionReview.findMany({
      where: whereCondition,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        reviewPosition: true,
        // レビュー送信者の情報
        reviewer: {
          select: {
            id: true,
            settings: {
              select: {
                username: true,
              },
            },
          },
        },
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
      // 作成日時の降順でソート（新しいレビューが上に）
      orderBy: {
        createdAt: "desc",
      },
      skip: offset, // スキップする件数
      take: limit, // 取得する件数
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 総件数を取得（ページネーション計算のため）
     */
    const totalCount = await prisma.auctionReview.count({
      where: whereCondition,
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 取得したデータを型安全な形式に変換
     */
    const reviewData: ReviewData[] = reviews.map((review) => {
      // レビュー送信者の情報を安全に取得
      const reviewer = review.reviewer
        ? {
            id: review.reviewer.id,
            username: review.reviewer.settings?.username ?? "未設定",
          }
        : null;

      // レビュー受信者の情報を安全に取得
      const reviewee = review.reviewee
        ? {
            id: review.reviewee.id,
            username: review.reviewee.settings?.username ?? "未設定",
          }
        : null;

      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        reviewPosition: review.reviewPosition,
        reviewer,
        reviewee,
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
      };
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * レビューデータを返す
     */
    return {
      reviews: reviewData,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラーを返す
     */
  } catch (error) {
    console.error("Error fetching all reviews:", error);
    throw new Error("レビューの取得に失敗しました");
  }
}
