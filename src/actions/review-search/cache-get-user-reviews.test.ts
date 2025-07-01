import type { ReviewSearchParams } from "@/components/review-search/review-search";
import type { Prisma } from "@prisma/client";
import { REVIEW_SEARCH_CONSTANTS } from "@/lib/constants";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedUserReviews } from "./cache-get-user-reviews";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cache-review-search_getCachedUserReviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    test("should return user reviews with pagination when valid userId is provided", async () => {
      // テストデータの準備
      const userId = "test-user-id";
      const mockReviews = [
        {
          id: "review-1",
          rating: 5,
          comment: "素晴らしい仕事でした",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          auctionId: "auction-1",
          reviewerId: "reviewer-1",
          revieweeId: userId,
          completionProofUrl: null,
          reviewer: {
            id: "reviewer-1",
            settings: { username: "reviewer1" },
          },
          reviewee: {
            id: userId,
            settings: { username: "reviewee1" },
          },
          auction: {
            id: "auction-1",
            task: {
              id: "task-1",
              task: "テストタスク",
              category: "開発",
              group: {
                id: "group-1",
                name: "テストグループ",
              },
            },
          },
        },
      ];

      // Prismaモックの設定
      prismaMock.auctionReview.findMany.mockResolvedValue(
        mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(1);

      // 実行
      const result = await getCachedUserReviews(null, userId);

      // 検証
      expect(result).toStrictEqual({
        reviews: [
          {
            id: "review-1",
            rating: 5,
            comment: "素晴らしい仕事でした",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            reviewPosition: ReviewPosition.BUYER_TO_SELLER,
            reviewer: {
              id: "reviewer-1",
              username: "reviewer1",
            },
            reviewee: {
              id: userId,
              username: "reviewee1",
            },
            auction: {
              id: "auction-1",
              task: {
                id: "task-1",
                task: "テストタスク",
                category: "開発",
                group: {
                  id: "group-1",
                  name: "テストグループ",
                },
              },
            },
          },
        ],
        totalCount: 1,
        totalPages: 1,
      });

      // Prismaメソッドが正しく呼ばれたことを確認
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: { revieweeId: userId },
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: 0,
        take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
      });
      expect(prismaMock.auctionReview.count).toHaveBeenCalledWith({
        where: { revieweeId: userId },
      });
    });

    test("should handle undefined searchParams", async () => {
      const userId = "test-user-id";

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      // undefinedを渡してもエラーにならないことを確認
      await expect(getCachedUserReviews(undefined as unknown as ReviewSearchParams, userId)).resolves.toBeDefined();
    });

    test("should handle search query with OR conditions", async () => {
      // Arrange
      const userId = "test-user-id";
      const searchParams: ReviewSearchParams = {
        searchQuery: "テスト",
        page: 1,
        tab: "search",
      };

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      // Act
      await getCachedUserReviews(searchParams, userId);

      // Assert
      // OR条件が正しく設定されていることを確認
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: {
          revieweeId: userId,
          OR: expect.arrayContaining([
            {
              reviewee: {
                settings: {
                  username: {
                    contains: "テスト",
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              reviewer: {
                settings: {
                  username: {
                    contains: "テスト",
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              comment: {
                contains: "テスト",
                mode: "insensitive",
              },
            },
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
      const userId = "test-user-id";
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
      await getCachedUserReviews(searchParams, userId);

      // Assert
      // 2ページ目のオフセットが正しく計算されていることを確認
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: { revieweeId: userId },
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE, // 1ページ分スキップ
        take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
      });
    });

    test("should handle null reviewer and reviewee gracefully", async () => {
      // Arrange
      const userId = "test-user-id";
      const mockReviews = [
        {
          id: "review-1",
          rating: 5,
          comment: "テストコメント",
          createdAt: new Date(),
          updatedAt: new Date(),
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          auctionId: "auction-1",
          reviewerId: "reviewer-1",
          revieweeId: userId,
          completionProofUrl: null,
          reviewer: null,
          reviewee: null,
          auction: {
            id: "auction-1",
            task: {
              id: "task-1",
              task: "テストタスク",
              category: "開発",
              group: {
                id: "group-1",
                name: "テストグループ",
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
      const result = await getCachedUserReviews(null, userId);

      // Assert
      expect(result.reviews[0].reviewer).toBeNull();
      expect(result.reviews[0].reviewee).toBeNull();
    });

    test("should handle missing username in settings", async () => {
      // Arrange
      const userId = "test-user-id";
      const mockReviews = [
        {
          id: "review-1",
          rating: 5,
          comment: "テストコメント",
          createdAt: new Date(),
          updatedAt: new Date(),
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          auctionId: "auction-1",
          reviewerId: "reviewer-1",
          revieweeId: userId,
          completionProofUrl: null,
          reviewer: {
            id: "reviewer-1",
            settings: null,
          },
          reviewee: {
            id: userId,
            settings: { username: null },
          },
          auction: {
            id: "auction-1",
            task: {
              id: "task-1",
              task: "テストタスク",
              category: "開発",
              group: {
                id: "group-1",
                name: "テストグループ",
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
      const result = await getCachedUserReviews(null, userId);

      // Assert
      expect(result.reviews[0].reviewer?.username).toBe("未設定");
      expect(result.reviews[0].reviewee?.username).toBe("未設定");
    });

    test("should handle empty searchQuery as valid input", async () => {
      // Arrange
      const userId = "test-user-id";
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
      const result = await getCachedUserReviews(searchParams, userId);

      // Assert
      expect(result).toBeDefined();
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: { revieweeId: userId },
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: 0,
        take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
      });
    });

    test.each(REVIEW_SEARCH_CONSTANTS.TAB_TYPES)("should handle all valid tab types", async (tab) => {
      // Arrange
      const userId = "test-user-id";

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
      const result = await getCachedUserReviews(searchParams, userId);

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe("異常系", () => {
    test("should throw error when database operation fails", async () => {
      // Arrange
      const userId = "test-user-id";
      const dbError = new Error("Database connection failed");

      prismaMock.auctionReview.findMany.mockRejectedValue(dbError);

      await expect(getCachedUserReviews(null, userId)).rejects.toThrow("レビューの取得に失敗しました");
      expect(console.error).toHaveBeenCalledWith("Error fetching user reviews:", dbError);
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("バリデーションエラーテスト", () => {
      test.each([
        { userId: "", description: "empty string userId" },
        { userId: null as unknown as string, description: "null userId" },
        { userId: undefined as unknown as string, description: "undefined userId" },
      ])("should throw error when $description", async ({ userId }) => {
        await expect(getCachedUserReviews(null, userId)).rejects.toThrow("ユーザーIDが存在しません");
      });

      test("should throw error when invalid tab is provided", async () => {
        const userId = "test-user-id";
        const searchParams: ReviewSearchParams = {
          searchQuery: "",
          page: 1,
          tab: "invalid-tab" as unknown as "search" | "edit" | "received",
        };

        await expect(getCachedUserReviews(searchParams, userId)).rejects.toThrow("無効なタブが指定されました");
      });

      test.each([
        { page: 0, description: "page 0" },
        { page: -1, description: "negative page" },
      ])("should throw error when $description", async ({ page }) => {
        const userId = "test-user-id";
        const searchParams: ReviewSearchParams = {
          searchQuery: "searchしたいキーワード",
          page, // 無効なページ番号
          tab: "search",
        };

        // page 0の場合、エラーが発生することを確認
        await expect(getCachedUserReviews(searchParams, userId)).rejects.toThrow(
          "ページ番号は1以上である必要があります",
        );
      });

      test.each([
        { searchQuery: null as unknown as string, description: "null searchQuery" },
        { searchQuery: undefined as unknown as string, description: "undefined searchQuery" },
      ])("should throw error when $description", async ({ searchQuery }) => {
        const userId = "test-user-id";
        const searchParams: ReviewSearchParams = {
          searchQuery,
          page: 1,
          tab: "search",
        };

        await expect(getCachedUserReviews(searchParams, userId)).rejects.toThrow("検索クエリの定義がありません");
      });
    });

    test("should handle count query failure", async () => {
      const userId = "test-user-id";
      const countError = new Error("Count query failed");

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockRejectedValue(countError);

      await expect(getCachedUserReviews(null, userId)).rejects.toThrow("レビューの取得に失敗しました");
      expect(console.error).toHaveBeenCalledWith("Error fetching user reviews:", countError);
    });

    test("should handle both findMany and count failures", async () => {
      const userId = "test-user-id";
      const findManyError = new Error("FindMany query failed");

      prismaMock.auctionReview.findMany.mockRejectedValue(findManyError);
      prismaMock.auctionReview.count.mockRejectedValue(new Error("Count also failed"));

      await expect(getCachedUserReviews(null, userId)).rejects.toThrow("レビューの取得に失敗しました");
      expect(console.error).toHaveBeenCalledWith("Error fetching user reviews:", findManyError);
    });

    test("should handle unknown error types", async () => {
      const userId = "test-user-id";
      const unknownError = { message: "Unknown error type" };

      prismaMock.auctionReview.findMany.mockRejectedValue(unknownError);

      await expect(getCachedUserReviews(null, userId)).rejects.toThrow("不明なエラー:レビューの取得に失敗しました");
      expect(console.error).toHaveBeenCalledWith("Error fetching user reviews:", unknownError);
    });

    test("should handle network timeout errors", async () => {
      const userId = "test-user-id";
      const timeoutError = new Error("Request timeout");
      timeoutError.name = "TimeoutError";

      prismaMock.auctionReview.findMany.mockRejectedValue(timeoutError);

      await expect(getCachedUserReviews(null, userId)).rejects.toThrow("レビューの取得に失敗しました");
      expect(console.error).toHaveBeenCalledWith("Error fetching user reviews:", timeoutError);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データ変換テスト", () => {
    test("should handle totalPages calculation correctly", async () => {
      const userId = "test-user-id";

      // テストケース：totalCount = 0の場合
      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      const result1 = await getCachedUserReviews(null, userId);
      expect(result1.totalPages).toBe(0);

      // テストケース：totalCount = ITEMS_PER_PAGE丁度の場合
      prismaMock.auctionReview.count.mockResolvedValue(REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE);
      const result2 = await getCachedUserReviews(null, userId);
      expect(result2.totalPages).toBe(1);

      // テストケース：totalCount = ITEMS_PER_PAGE + 1の場合
      prismaMock.auctionReview.count.mockResolvedValue(REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE + 1);
      const result3 = await getCachedUserReviews(null, userId);
      expect(result3.totalPages).toBe(2);
    });

    test("should handle review data with complex nested structure", async () => {
      const userId = "test-user-id";
      const complexMockReview = {
        id: "complex-review-1",
        rating: 3,
        comment: "複雑なレビューデータのテスト\n改行\tタブ\"クォート'シングル",
        createdAt: new Date("2024-12-31T23:59:59.999Z"),
        updatedAt: new Date("2025-01-01T00:00:00.001Z"),
        reviewPosition: ReviewPosition.SELLER_TO_BUYER,
        auctionId: "complex-auction-1",
        reviewerId: "complex-reviewer-1",
        revieweeId: userId,
        completionProofUrl: null,
        reviewer: {
          id: "complex-reviewer-1",
          settings: {
            username: "レビュワー名前@test-user#123",
          },
        },
        reviewee: {
          id: userId,
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

      const result = await getCachedUserReviews(null, userId);

      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0]).toStrictEqual({
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
          id: userId,
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
