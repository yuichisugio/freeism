"use cache";

import type { ReviewData, ReviewSearchParams, ReviewSearchResult } from "@/components/review-search/review-search";
import type { Prisma } from "@prisma/client";
import { REVIEW_CONSTANTS } from "@/lib/constants";
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
): Promise<ReviewSearchResult> {
  try {
    const page = searchParams?.page ?? 1;
    const limit = REVIEW_CONSTANTS.ITEMS_PER_PAGE;
    const offset = (page - 1) * limit;

    const whereCondition: Prisma.AuctionReviewWhereInput = {
      reviewerId: userId, // 自分が書いたレビュー
    };

    // 検索条件がある場合、追加のフィルター条件を構築
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

    const reviews = await prisma.auctionReview.findMany({
      where: whereCondition,
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
      orderBy: {
        createdAt: "desc",
      },
      skip: offset,
      take: limit,
    });

    const totalCount = await prisma.auctionReview.count({
      where: whereCondition,
    });

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
            username: review.reviewee.settings?.username ?? "未設定",
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

    return {
      reviews: reviewData,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    };
  } catch (error) {
    console.error("Error fetching my reviews:", error);
    throw new Error("自分のレビューの取得に失敗しました");
  }
}
