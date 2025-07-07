import type { ReviewSearchParams } from "@/components/review-search/review-search";
import type { Prisma } from "@prisma/client";
import { REVIEW_SEARCH_CONSTANTS } from "@/lib/constants";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedAllReviews } from "./cache-get-all-review";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cache-review-search_getCachedAllReviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    test("should return all reviews without user filtering", async () => {
      // Arrange
      const mockReviews = [
        {
          id: "review-1",
          rating: 5,
          comment: "全体検索テスト",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          auctionId: "auction-1",
          reviewerId: "reviewer-1",
          revieweeId: "reviewee-1",
          completionProofUrl: null,
          reviewer: {
            id: "reviewer-1",
            settings: { username: "reviewer1" },
          },
          reviewee: {
            id: "reviewee-1",
            settings: { username: "reviewee1" },
          },
          auction: {
            id: "auction-1",
            task: {
              id: "task-1",
              task: "全体タスク",
              category: "開発",
              group: {
                id: "group-1",
                name: "全体グループ",
              },
            },
          },
        },
      ];

      prismaMock.auctionReview.findMany.mockResolvedValue(
        mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(1);

      // Act
      const result = await getCachedAllReviews(null);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "全レビューを取得しました",
        data: {
          reviews: [
            {
              id: "review-1",
              rating: 5,
              comment: "全体検索テスト",
              createdAt: new Date("2024-01-01"),
              updatedAt: new Date("2024-01-01"),
              reviewPosition: ReviewPosition.BUYER_TO_SELLER,
              reviewer: {
                id: "reviewer-1",
                username: "reviewer1",
              },
              reviewee: {
                id: "reviewee-1",
                username: "reviewee1",
              },
              auction: {
                id: "auction-1",
                task: {
                  id: "task-1",
                  task: "全体タスク",
                  category: "開発",
                  group: {
                    id: "group-1",
                    name: "全体グループ",
                  },
                },
              },
            },
          ],
          totalCount: 1,
          totalPages: 1,
        },
      });

      // 全レビューを対象とするため、where条件が空オブジェクトであることを確認
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: 0,
        take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
      });
      expect(prismaMock.auctionReview.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    test("should handle undefined searchParams", async () => {
      // Arrange
      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      // Act&Assert
      // undefinedを渡してもエラーにならないことを確認
      await expect(getCachedAllReviews(undefined as unknown as ReviewSearchParams)).resolves.toBeDefined();
    });

    test("should handle search query with OR conditions", async () => {
      // Arrange
      const searchParams: ReviewSearchParams = {
        searchQuery: "全体",
        page: 1,
        tab: "search",
      };

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      // Act
      await getCachedAllReviews(searchParams);

      // Assert
      // OR条件が正しく設定されていることを確認
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            {
              reviewer: {
                settings: {
                  username: {
                    contains: "全体",
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              reviewee: {
                settings: {
                  username: {
                    contains: "全体",
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              comment: {
                contains: "全体",
                mode: "insensitive",
              },
            },
            {
              auction: {
                task: {
                  group: {
                    name: {
                      contains: "全体",
                      mode: "insensitive",
                    },
                  },
                },
              },
            },
            {
              auction: {
                task: {
                  task: {
                    contains: "全体",
                    mode: "insensitive",
                  },
                },
              },
            },
            { reviewerId: "全体" },
            { revieweeId: "全体" },
            { auctionId: "全体" },
            { auction: { taskId: "全体" } },
            { auction: { task: { groupId: "全体" } } },
          ]) as unknown as unknown[],
        },
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: 0,
        take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
      });
    });

    test("should handle pagination correctly", async () => {
      // Arrange
      const searchParams: ReviewSearchParams = {
        searchQuery: "",
        page: 2,
        tab: "search",
      };

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      // Act
      await getCachedAllReviews(searchParams);

      // Assert
      // 2ページ目のオフセットが正しく計算されていることを確認
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE, // 1ページ分スキップ
        take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
      });
    });

    test("should handle null reviewer and reviewee in all reviews", async () => {
      // Arrange
      const mockReviews = [
        {
          id: "review-1",
          rating: 5,
          comment: "全体検索テスト",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          auctionId: "auction-1",
          reviewerId: "reviewer-1",
          revieweeId: "reviewee-1",
          completionProofUrl: null,
          reviewer: null, // nullの場合をテスト
          reviewee: null, // nullの場合をテスト
          auction: {
            id: "auction-1",
            task: {
              id: "task-1",
              task: "全体タスク",
              category: "開発",
              group: {
                id: "group-1",
                name: "全体グループ",
              },
            },
          },
        },
      ];

      prismaMock.auctionReview.findMany.mockResolvedValue(
        mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(1);

      // Act
      const result = await getCachedAllReviews(null);

      // Assert
      expect(result.data.reviews[0].reviewer).toBeNull();
      expect(result.data.reviews[0].reviewee).toBeNull();
    });

    test("should handle missing username in settings for all reviews", async () => {
      // Arrange
      const mockReviews = [
        {
          id: "review-1",
          rating: 5,
          comment: "全体検索テスト",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          auctionId: "auction-1",
          reviewerId: "reviewer-1",
          revieweeId: "reviewee-1",
          completionProofUrl: null,
          reviewer: {
            id: "reviewer-1",
            settings: null, // settingsがnullの場合をテスト
          },
          reviewee: {
            id: "reviewee-1",
            settings: { username: null }, // usernameがnullの場合をテスト
          },
          auction: {
            id: "auction-1",
            task: {
              id: "task-1",
              task: "全体タスク",
              category: "開発",
              group: {
                id: "group-1",
                name: "全体グループ",
              },
            },
          },
        },
      ];

      prismaMock.auctionReview.findMany.mockResolvedValue(
        mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(1);

      // Act
      const result = await getCachedAllReviews(null);

      // Assert
      expect(result.data.reviews[0].reviewer?.username).toBe("未設定:reviewer-1");
      expect(result.data.reviews[0].reviewee?.username).toBe("未設定:reviewee-1");
    });

    test("should handle empty searchQuery as valid input", async () => {
      // Arrange
      const searchParams: ReviewSearchParams = {
        searchQuery: "",
        page: 1,
        tab: "search",
      };

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      // 空文字列は有効な入力として扱われることを確認
      // Act
      const result = await getCachedAllReviews(searchParams);

      // Assert
      expect(result).toBeDefined();
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: 0,
        take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
      });
    });

    test.each(REVIEW_SEARCH_CONSTANTS.TAB_TYPES)("should handle all valid tab types", async (tab) => {
      // Arrange
      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      const searchParams: ReviewSearchParams = {
        searchQuery: "",
        page: 1,
        tab,
      };

      // Act
      const result = await getCachedAllReviews(searchParams);

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe("異常系", () => {
    test("should throw error when database operation fails", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");

      prismaMock.auctionReview.findMany.mockRejectedValue(dbError);

      // Act&Assert
      await expect(getCachedAllReviews(null)).rejects.toThrow("Database connection failed");
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("バリデーションエラーテスト", () => {
      test("should throw error when invalid tab is provided", async () => {
        // Arrange
        const searchParams: ReviewSearchParams = {
          searchQuery: "",
          page: 1,
          tab: "invalid-tab" as unknown as "search" | "edit" | "received",
        };

        await expect(getCachedAllReviews(searchParams)).rejects.toThrow("無効なタブが指定されました");
      });

      test.each([
        { page: 0, description: "page 0" },
        { page: -1, description: "negative page" },
      ])("should throw error when $description", async ({ page }) => {
        const searchParams: ReviewSearchParams = {
          searchQuery: "searchしたいキーワード",
          page, // 無効なページ番号
          tab: "search",
        };

        // page 0の場合、エラーが発生することを確認
        await expect(getCachedAllReviews(searchParams)).rejects.toThrow("ページ番号は1以上である必要があります");
      });

      test.each([
        { searchQuery: null as unknown as string, description: "null searchQuery" },
        { searchQuery: undefined as unknown as string, description: "undefined searchQuery" },
      ])("should throw error when $description", async ({ searchQuery }) => {
        const searchParams: ReviewSearchParams = {
          searchQuery,
          page: 1,
          tab: "search",
        };

        await expect(getCachedAllReviews(searchParams)).rejects.toThrow("検索クエリの定義がありません");
      });
    });

    test("should handle count query failure", async () => {
      const countError = new Error("Count query failed");

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockRejectedValue(countError);

      await expect(getCachedAllReviews(null)).rejects.toThrow("Count query failed");
    });

    test("should handle both findMany and count failures", async () => {
      const findManyError = new Error("FindMany query failed");

      prismaMock.auctionReview.findMany.mockRejectedValue(findManyError);
      prismaMock.auctionReview.count.mockRejectedValue(new Error("Count also failed"));

      await expect(getCachedAllReviews(null)).rejects.toThrow("FindMany query failed");
    });

    test("should handle unknown error types", async () => {
      const unknownError = { message: "Unknown error type" };

      prismaMock.auctionReview.findMany.mockRejectedValue(unknownError);

      await expect(getCachedAllReviews(null)).rejects.toThrow(unknownError.message);
    });

    test("should handle network timeout errors", async () => {
      const timeoutError = new Error("Request timeout");
      timeoutError.name = "TimeoutError";

      prismaMock.auctionReview.findMany.mockRejectedValue(timeoutError);

      await expect(getCachedAllReviews(null)).rejects.toThrow("Request timeout");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データ変換テスト", () => {
    test("should handle totalPages calculation correctly", async () => {
      // テストケース：totalCount = 0の場合
      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      const result1 = await getCachedAllReviews(null);
      expect(result1.data.totalPages).toBe(0);

      // テストケース：totalCount = ITEMS_PER_PAGE丁度の場合
      prismaMock.auctionReview.count.mockResolvedValue(REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE);
      const result2 = await getCachedAllReviews(null);
      expect(result2.data.totalPages).toBe(1);

      // テストケース：totalCount = ITEMS_PER_PAGE + 1の場合
      prismaMock.auctionReview.count.mockResolvedValue(REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE + 1);
      const result3 = await getCachedAllReviews(null);
      expect(result3.data.totalPages).toBe(2);
    });

    test("should handle review data with complex nested structure", async () => {
      const complexMockReview = {
        id: "complex-review-1",
        rating: 3,
        comment: "複雑なレビューデータのテスト\n改行\tタブ\"クォート'シングル",
        createdAt: new Date("2024-12-31T23:59:59.999Z"),
        updatedAt: new Date("2025-01-01T00:00:00.001Z"),
        reviewPosition: ReviewPosition.SELLER_TO_BUYER,
        auctionId: "complex-auction-1",
        reviewerId: "complex-reviewer-1",
        revieweeId: "complex-reviewee-1",
        completionProofUrl: null,
        reviewer: {
          id: "complex-reviewer-1",
          settings: {
            username: "レビュワー名前@test-user#123",
          },
        },
        reviewee: {
          id: "complex-reviewee-1",
          settings: {
            username: "レビュー対象者名前@test-user#456",
          },
        },
        auction: {
          id: "complex-auction-1",
          task: {
            id: "complex-task-1",
            task: "複雑なタスク名\nwith\nline\nbreaks",
            category: "特殊カテゴリ@#$%",
            group: {
              id: "complex-group-1",
              name: "複雑なグループ名!@#$%^&*()",
            },
          },
        },
      };

      prismaMock.auctionReview.findMany.mockResolvedValue([complexMockReview] as unknown as Awaited<
        ReturnType<typeof prismaMock.auctionReview.findMany>
      >);
      prismaMock.auctionReview.count.mockResolvedValue(1);

      const result = await getCachedAllReviews(null);

      expect(result.data.reviews).toHaveLength(1);
      expect(result.data.reviews[0]).toStrictEqual({
        id: "complex-review-1",
        rating: 3,
        comment: "複雑なレビューデータのテスト\n改行\tタブ\"クォート'シングル",
        createdAt: new Date("2024-12-31T23:59:59.999Z"),
        updatedAt: new Date("2025-01-01T00:00:00.001Z"),
        reviewPosition: ReviewPosition.SELLER_TO_BUYER,
        reviewer: {
          id: "complex-reviewer-1",
          username: "レビュワー名前@test-user#123",
        },
        reviewee: {
          id: "complex-reviewee-1",
          username: "レビュー対象者名前@test-user#456",
        },
        auction: {
          id: "complex-auction-1",
          task: {
            id: "complex-task-1",
            task: "複雑なタスク名\nwith\nline\nbreaks",
            category: "特殊カテゴリ@#$%",
            group: {
              id: "complex-group-1",
              name: "複雑なグループ名!@#$%^&*()",
            },
          },
        },
      });
    });
  });
});
