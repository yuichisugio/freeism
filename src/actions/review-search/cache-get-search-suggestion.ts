"use cache";

import type { SearchSuggestion } from "@/components/review-search/review-search";
import type { PromiseResult } from "@/types/general-types";
import { prisma } from "@/library-setting/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 検索サジェストを取得するサーバーアクション
 * 全ての検索タイプに対してOR検索で対応
 * @param query - 検索クエリ
 * @returns サジェスト候補の配列
 */
export async function getCachedSearchSuggestions(query: string): PromiseResult<SearchSuggestion[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * バリデーション
   */
  // 検索クエリが空文字列または2文字未満の場合は空の配列を返す
  if (!query || query.trim().length < 2) {
    return {
      success: false,
      message: "検索クエリが空文字列または2文字未満です",
      data: [],
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェスト候補を格納する配列
   */
  const suggestions: SearchSuggestion[] = [];

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 一括でレビューデータを取得し、関連するすべての情報を含める
   */
  const reviews = await prisma.auctionReview.findMany({
    take: 50,
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
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューデータが0件の場合は空の配列を返す
   */
  if (reviews.length === 0) {
    return {
      success: true,
      message: "レビューデータが0件です",
      data: [],
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユニークな値を格納するためのSet
   */
  const uniqueUsernames = new Set<string>();
  const uniqueGroupNames = new Set<string>();
  const uniqueTaskNames = new Set<string>();
  const uniqueComments = new Set<string>();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューデータから各項目を抽出
   */
  reviews.forEach((review) => {
    // ユーザー名（送信者）
    if (review.reviewer?.settings?.username) {
      const username = review.reviewer.settings.username;
      if (username.toLowerCase().includes(query.toLowerCase())) {
        uniqueUsernames.add(username);
      }
    }

    // ユーザー名（受信者）
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サジェスト候補を作成（各カテゴリから最大5件ずつ）
   * Array.from()でSetを配列に変換している
   */
  const MAX_LENGTH = 30;
  // ユーザー名（送信者・受信者）
  Array.from(uniqueUsernames).forEach((username) => {
    suggestions.push({
      value: username,
      label: `ユーザー: ${username.length > MAX_LENGTH ? username.substring(0, MAX_LENGTH) + "..." : username}`,
    });
  });

  // グループ名
  Array.from(uniqueGroupNames).forEach((groupName) => {
    suggestions.push({
      value: groupName,
      label: `グループ: ${groupName.length > MAX_LENGTH ? groupName.substring(0, MAX_LENGTH) + "..." : groupName}`,
    });
  });

  // タスク名
  Array.from(uniqueTaskNames).forEach((taskName) => {
    suggestions.push({
      value: taskName,
      label: `タスク: ${taskName.length > MAX_LENGTH ? taskName.substring(0, MAX_LENGTH) + "..." : taskName}`,
    });
  });

  // コメント
  Array.from(uniqueComments).forEach((comment) => {
    suggestions.push({
      value: comment,
      label: `コメント: ${comment.length > MAX_LENGTH ? comment.substring(0, MAX_LENGTH) + "..." : comment}`,
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 重複を除去し、最大20件に制限
   */
  const uniqueSuggestions = Array.from(new Map(suggestions.map((item) => [item.value, item])).values()).slice(0, 20);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 返す
   */
  return {
    success: true,
    message: "検索サジェストを取得しました",
    data: uniqueSuggestions,
  };
}
