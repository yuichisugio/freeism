"use cache";

import type { ReviewData, ReviewSearchParams, ReviewSearchResult, SearchSuggestion } from "@/components/review-search/review-search";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 特定ユーザーのレビューを取得するサーバーアクション
 * @param userId - 対象ユーザーのID（被評価者）
 * @param searchParams - 検索パラメータ（オプション）
 * @returns レビューデータと統計情報
 */
export async function getCachedUserReviews(searchParams: ReviewSearchParams | null): Promise<ReviewSearchResult> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーIDを取得
     */
    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ページネーション/オフセット/取得件数の設定
     */
    const page = searchParams?.page ?? 1;
    const limit = searchParams?.limit ?? 10;
    const offset = (page - 1) * limit;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 検索条件を構築
     */
    let whereCondition: Prisma.AuctionReviewWhereInput = {
      revieweeId: userId,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 検索条件がある場合、追加のフィルター条件を構築
     */
    if (searchParams?.searchQuery && searchParams?.searchType && searchParams.searchQuery.length > 0) {
      const { searchType, searchQuery } = searchParams;

      switch (searchType) {
        case "username":
          // ユーザー名での検索：UserSettingsのusernameフィールドを対象
          whereCondition = {
            reviewee: {
              settings: {
                username: {
                  contains: searchQuery, // 部分一致検索
                  mode: "insensitive", // 大文字小文字を区別しない
                },
              },
            },
          };
          break;
        case "userId":
          // ユーザーIDでの検索：完全一致
          whereCondition = {
            revieweeId: searchQuery,
          };
          break;
        case "auctionId":
          // オークションIDでの検索：完全一致
          whereCondition = {
            revieweeId: userId,
            auctionId: searchQuery,
          };
          break;
        case "groupId":
          // グループIDでの検索：auction → task → group の階層でアクセス
          whereCondition = {
            revieweeId: userId,
            auction: {
              task: {
                groupId: searchQuery,
              },
            },
          };
          break;
        case "taskId":
          // タスクIDでの検索：auction → task でアクセス
          whereCondition = {
            revieweeId: userId,
            auction: {
              taskId: searchQuery,
            },
          };
          break;
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * レビューデータを取得（ページネーション付き）
     */
    const reviews = await prisma.auctionReview.findMany({
      where: whereCondition,
      // 関連データを含めて取得（JOINに相当）
      include: {
        auction: {
          include: {
            task: {
              include: {
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
     * 平均評価を計算
     */
    const averageRatingResult = await prisma.auctionReview.aggregate({
      where: { revieweeId: userId }, // 元のユーザーIDで全体の平均を計算
      _avg: {
        rating: true,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 取得したデータを型安全な形式に変換
     */
    const reviewData: ReviewData[] = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      reviewPosition: review.reviewPosition,
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
     * レビューデータを返す
     */
    return {
      reviews: reviewData,
      totalCount,
      averageRating: averageRatingResult._avg.rating ?? 0,
      totalPages: Math.ceil(totalCount / limit),
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラーを返す
     */
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    throw new Error("レビューの取得に失敗しました");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 検索サジェストを取得するサーバーアクション
 * Prismaの全文検索機能を活用して候補を提案
 * @param query - 検索クエリ
 * @param searchType - 検索対象の種類
 * @returns サジェスト候補の配列
 */
export async function getCachedSearchSuggestions(query: string, searchType: ReviewSearchParams["searchType"]): Promise<SearchSuggestion[]> {
  try {
    if (!query || query.length < 2) {
      return []; // 2文字未満の場合は空の配列を返す
    }

    let suggestions: SearchSuggestion[] = [];

    switch (searchType) {
      case "username":
        // ユーザー名のサジェスト：UserSettingsから部分一致で検索
        const usernames = await prisma.userSettings.findMany({
          where: {
            username: {
              contains: query,
              mode: "insensitive",
            },
          },
          select: {
            username: true,
            userId: true,
          },
          take: 10, // 最大10件のサジェスト
        });

        suggestions = usernames.map((user) => ({
          value: user.username,
          label: user.username,
          type: "username" as const,
        }));
        break;

      case "userId":
        // ユーザーIDのサジェスト：Userテーブルから部分一致で検索
        const users = await prisma.user.findMany({
          where: {
            id: {
              contains: query,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
            name: true,
            settings: {
              select: {
                username: true,
              },
            },
          },
          take: 10,
        });

        suggestions = users.map((user) => ({
          value: user.id,
          label: `${user.settings?.username ?? user.name ?? "Unknown"} (${user.id})`,
          type: "userId" as const,
        }));
        break;

      case "groupId":
        // グループIDのサジェスト：Groupテーブルから検索
        const groups = await prisma.group.findMany({
          where: {
            OR: [
              {
                id: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          },
          select: {
            id: true,
            name: true,
          },
          take: 10,
        });

        suggestions = groups.map((group) => ({
          value: group.id,
          label: `${group.name} (${group.id})`,
          type: "groupId" as const,
        }));
        break;

      case "taskId":
        // タスクIDのサジェスト：Taskテーブルから検索
        const tasks = await prisma.task.findMany({
          where: {
            OR: [
              {
                id: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                task: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          },
          select: {
            id: true,
            task: true,
          },
          take: 10,
        });

        suggestions = tasks.map((task) => ({
          value: task.id,
          label: `${task.task.substring(0, 50)}... (${task.id})`,
          type: "taskId" as const,
        }));
        break;

      case "auctionId":
        // オークションIDのサジェスト：Auctionテーブルから検索
        const auctions = await prisma.auction.findMany({
          where: {
            id: {
              contains: query,
              mode: "insensitive",
            },
          },
          include: {
            task: {
              select: {
                task: true,
              },
            },
          },
          take: 10,
        });

        suggestions = auctions.map((auction) => ({
          value: auction.id,
          label: `${auction.task.task.substring(0, 30)}... (${auction.id})`,
          type: "auctionId" as const,
        }));
        break;
    }

    return suggestions;
  } catch (error) {
    console.error("Error fetching search suggestions:", error);
    return [];
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
