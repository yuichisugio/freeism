"use cache";

import type { SearchSuggestion } from "@/components/review-search/review-search";
import { prisma } from "@/library-setting/prisma";

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
