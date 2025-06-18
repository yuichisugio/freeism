"use cache";

import type {
  ReviewData,
  ReviewSearchParams,
  ReviewSearchResult,
  SearchSuggestion,
} from "@/components/review-search/review-search";
import type { Prisma } from "@prisma/client";
import { REVIEW_CONSTANTS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 特定ユーザーのレビューを取得するサーバーアクション
 * @param userId - 対象ユーザーのID（被評価者）
 * @param searchParams - 検索パラメータ（オプション）
 * @returns レビューデータと統計情報
 */
export async function getCachedUserReviews(
  searchParams: ReviewSearchParams | null,
  userId: string,
): Promise<ReviewSearchResult> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ページネーション/オフセット/取得件数の設定
     */
    const page = searchParams?.page ?? 1;
    const limit = REVIEW_CONSTANTS.ITEMS_PER_PAGE;
    const offset = (page - 1) * limit;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 検索条件を構築
     */
    const whereCondition: Prisma.AuctionReviewWhereInput = {
      revieweeId: userId,
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
        // ユーザー名での検索（レビュー送信者）
        {
          reviewer: {
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
    console.error("Error fetching user reviews:", error);
    throw new Error("レビューの取得に失敗しました");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 検索サジェストを取得するサーバーアクション
 * 全ての検索タイプに対してOR検索で対応
 * @param query - 検索クエリ
 * @returns サジェスト候補の配列
 */
export async function getCachedSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  try {
    if (!query || query.length < 2) {
      return []; // 2文字未満の場合は空の配列を返す
    }

    const suggestions: SearchSuggestion[] = [];

    // 一括でレビューデータを取得し、関連するすべての情報を含める
    const reviews = await prisma.auctionReview.findMany({
      where: {
        OR: [
          // ユーザー名での検索（レビュー受信者）
          {
            reviewee: {
              settings: {
                username: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          // グループ名での検索
          {
            auction: {
              task: {
                group: {
                  name: {
                    contains: query,
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
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          // レビューコメントでの検索
          {
            comment: {
              contains: query,
              mode: "insensitive",
              not: null,
            },
          },
        ],
      },
      select: {
        comment: true,
        // レビュー送信者の情報
        reviewer: {
          select: {
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
            settings: {
              select: {
                username: true,
              },
            },
          },
        },
        auction: {
          select: {
            task: {
              select: {
                task: true,
                group: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      take: 50, // 最大50件のレビューから抽出
    });

    // ユニークな値を格納するためのSet
    const uniqueUsernames = new Set<string>();
    const uniqueGroupNames = new Set<string>();
    const uniqueTaskNames = new Set<string>();
    const uniqueComments = new Set<string>();

    // レビューデータから各項目を抽出
    reviews.forEach((review) => {
      // ユーザー名（送信者・受信者）
      if (review.reviewer?.settings?.username) {
        const username = review.reviewer.settings.username;
        if (username.toLowerCase().includes(query.toLowerCase())) {
          uniqueUsernames.add(username);
        }
      }
      if (review.reviewee?.settings?.username) {
        const username = review.reviewee.settings.username;
        if (username.toLowerCase().includes(query.toLowerCase())) {
          uniqueUsernames.add(username);
        }
      }

      // グループ名
      if (review.auction.task.group.name) {
        const groupName = review.auction.task.group.name;
        if (groupName.toLowerCase().includes(query.toLowerCase())) {
          uniqueGroupNames.add(groupName);
        }
      }

      // タスク名
      if (review.auction.task.task) {
        const taskName = review.auction.task.task;
        if (taskName.toLowerCase().includes(query.toLowerCase())) {
          uniqueTaskNames.add(taskName);
        }
      }

      // コメント
      if (review.comment) {
        const comment = review.comment;
        if (comment.toLowerCase().includes(query.toLowerCase())) {
          uniqueComments.add(comment);
        }
      }
    });

    // サジェスト候補を作成（各カテゴリから最大5件ずつ）
    Array.from(uniqueUsernames)
      .slice(0, 5)
      .forEach((username) => {
        suggestions.push({
          value: username,
          label: `ユーザー: ${username}`,
        });
      });

    Array.from(uniqueGroupNames)
      .slice(0, 5)
      .forEach((groupName) => {
        suggestions.push({
          value: groupName,
          label: `グループ: ${groupName}`,
        });
      });

    Array.from(uniqueTaskNames)
      .slice(0, 5)
      .forEach((taskName) => {
        suggestions.push({
          value: taskName,
          label: `タスク: ${taskName.substring(0, 30)}...`,
        });
      });

    Array.from(uniqueComments)
      .slice(0, 3)
      .forEach((comment) => {
        suggestions.push({
          value: comment,
          label: `コメント: ${comment.substring(0, 30)}...`,
        });
      });

    // 重複を除去し、最大10件に制限
    const uniqueSuggestions = suggestions
      .filter((suggestion, index, self) => index === self.findIndex((s) => s.value === suggestion.value))
      .slice(0, 10);

    return uniqueSuggestions;
  } catch (error) {
    console.error("Error fetching search suggestions:", error);
    return [];
  }
}

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
    const limit = REVIEW_CONSTANTS.ITEMS_PER_PAGE;
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
