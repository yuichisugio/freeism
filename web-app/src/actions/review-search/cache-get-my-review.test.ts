import type { ReviewSearchParams } from "@/components/review-search/review-search";
import type { Prisma } from "@prisma/client";
import { REVIEW_SEARCH_CONSTANTS } from "@/lib/constants";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedMyReviews } from "./cache-get-my-review";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * next/cacheのモック
 */
vi.mock("next/cache", () => ({
  unstable_cacheTag: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cache-review-search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCachedMyReviews", () => {
    describe("正常系", () => {
      test("should return my reviews with correct reviewer field as null", async () => {
        // Arrange
        const userId = "test-user-id";
        const mockReviews = [
          {
            id: "review-1",
            rating: 4,
            comment: "良い仕事でした",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            reviewPosition: ReviewPosition.BUYER_TO_SELLER,
            auctionId: "auction-1",
            reviewerId: userId,
            revieweeId: "reviewee-1",
            completionProofUrl: null,
            reviewee: {
              id: "reviewee-1",
              settings: { username: "reviewee1" },
            },
            auction: {
              id: "auction-1",
              task: {
                id: "task-1",
                task: "マイタスク",
                category: "開発",
                group: {
                  id: "group-1",
                  name: "マイグループ",
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
        const result = await getCachedMyReviews(null, userId);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "自分のレビューを取得しました",
          data: {
            reviews: [
              {
                id: "review-1",
                rating: 4,
                comment: "良い仕事でした",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
                reviewPosition: ReviewPosition.BUYER_TO_SELLER,
                reviewer: null,
                reviewee: {
                  id: "reviewee-1",
                  username: "reviewee1",
                },
                auction: {
                  id: "auction-1",
                  task: {
                    id: "task-1",
                    task: "マイタスク",
                    category: "開発",
                    group: {
                      id: "group-1",
                      name: "マイグループ",
                    },
                  },
                },
              },
            ],
            totalCount: 1,
            totalPages: 1,
          },
        });

        // reviewerIdで検索されていることを確認
        expect(
          prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        ).toHaveBeenCalledWith({
          where: { reviewerId: userId },
          select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
          orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
          skip: 0,
          take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
        });
        expect(prismaMock.auctionReview.count).toHaveBeenCalledWith({
          where: { reviewerId: userId },
        });
      });

      test("should handle undefined searchParams", async () => {
        const userId = "test-user-id";

        prismaMock.auctionReview.findMany.mockResolvedValue(
          [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        );
        prismaMock.auctionReview.count.mockResolvedValue(0);

        // undefinedを渡してもエラーにならないことを確認
        await expect(getCachedMyReviews(undefined as unknown as ReviewSearchParams, userId)).resolves.toBeDefined();
      });

      test("should handle null reviewee in my reviews", async () => {
        const userId = "test-user-id";
        const mockReviews = [
          {
            id: "review-1",
            rating: 4,
            comment: "良い仕事でした",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            reviewPosition: ReviewPosition.BUYER_TO_SELLER,
            auctionId: "auction-1",
            reviewerId: userId,
            revieweeId: "reviewee-1",
            completionProofUrl: null,
            reviewee: null, // nullの場合をテスト
            auction: {
              id: "auction-1",
              task: {
                id: "task-1",
                task: "マイタスク",
                category: "開発",
                group: {
                  id: "group-1",
                  name: "マイグループ",
                },
              },
            },
          },
        ];

        prismaMock.auctionReview.findMany.mockResolvedValue(
          mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        );
        prismaMock.auctionReview.count.mockResolvedValue(1);

        const result = await getCachedMyReviews(null, userId);

        expect(result.data.reviews[0].reviewer).toBeNull();
        expect(result.data.reviews[0].reviewee).toBeNull();
      });

      test("should handle missing username in reviewee settings for my reviews", async () => {
        const userId = "test-user-id";
        const mockReviews = [
          {
            id: "review-1",
            rating: 4,
            comment: "良い仕事でした",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            reviewPosition: ReviewPosition.BUYER_TO_SELLER,
            auctionId: "auction-1",
            reviewerId: userId,
            revieweeId: "reviewee-1",
            completionProofUrl: null,
            reviewee: {
              id: "reviewee-1",
              settings: null, // settingsがnullの場合をテスト
            },
            auction: {
              id: "auction-1",
              task: {
                id: "task-1",
                task: "マイタスク",
                category: "開発",
                group: {
                  id: "group-1",
                  name: "マイグループ",
                },
              },
            },
          },
        ];

        prismaMock.auctionReview.findMany.mockResolvedValue(
          mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        );
        prismaMock.auctionReview.count.mockResolvedValue(1);

        const result = await getCachedMyReviews(null, userId);

        expect(result.data.reviews[0].reviewee?.username).toBe("未設定:reviewee-1");
      });

      test("should handle search query for my reviews", async () => {
        // Arrange
        const userId = "test-user-id";
        const searchParams: ReviewSearchParams = {
          q: "テスト",
          page: 1,
          tab: "received",
        };

        prismaMock.auctionReview.findMany.mockResolvedValue(
          [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        );
        prismaMock.auctionReview.count.mockResolvedValue(0);

        // Act
        await getCachedMyReviews(searchParams, userId);

        // Assert
        expect(
          prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        ).toHaveBeenCalledWith({
          where: {
            reviewerId: userId,
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
                comment: {
                  contains: "テスト",
                  mode: "insensitive",
                },
              },
            ]) as unknown as unknown[],
          },
          select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
        });
      });

      test("should handle pagination correctly", async () => {
        // Arrange
        const userId = "test-user-id";
        const searchParams: ReviewSearchParams = {
          q: "",
          page: 2,
          tab: "edit",
        };

        prismaMock.auctionReview.findMany.mockResolvedValue(
          [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        );
        prismaMock.auctionReview.count.mockResolvedValue(0);

        // Act
        await getCachedMyReviews(searchParams, userId);

        // Assert
        expect(
          prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        ).toHaveBeenCalledWith({
          where: { reviewerId: userId },
          select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
          orderBy: { createdAt: "desc" },
          skip: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE, // 1ページ分スキップ
          take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
        });
      });

      test("should handle empty searchQuery as valid input", async () => {
        // Arrange
        const userId = "test-user-id";
        const searchParams: ReviewSearchParams = {
          q: "",
          page: 1,
          tab: "edit",
        };

        prismaMock.auctionReview.findMany.mockResolvedValue(
          [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        );
        prismaMock.auctionReview.count.mockResolvedValue(0);

        // Act
        const result = await getCachedMyReviews(searchParams, userId);

        // Assert
        expect(result).toBeDefined();
        expect(
          prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        ).toHaveBeenCalledWith({
          where: { reviewerId: userId },
          select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
          orderBy: { createdAt: "desc" },
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
          q: "",
          page: 1,
          tab,
        };

        // Act
        const result = await getCachedMyReviews(searchParams, userId);

        // Assert
        expect(result).toBeDefined();
      });

      test("should handle missing username in settings gracefully", async () => {
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
            reviewerId: userId,
            revieweeId: "reviewee-1",
            completionProofUrl: null,
            reviewee: {
              id: "reviewee-1",
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
        const result = await getCachedMyReviews(null, userId);

        // Assert
        expect(result.data.reviews[0].reviewee?.username).toBe("未設定:reviewee-1");
      });
    });

    describe("異常系", () => {
      test("should throw error when database operation fails", async () => {
        // Arrange
        const userId = "test-user-id";
        const dbError = new Error("Database connection failed");

        prismaMock.auctionReview.findMany.mockRejectedValue(dbError);

        // Act & Assert
        await expect(getCachedMyReviews(null, userId)).rejects.toThrow("Database connection failed");
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      describe("バリデーションエラーテスト", () => {
        test.each([
          { userId: "", description: "empty string userId" },
          { userId: null as unknown as string, description: "null userId" },
          { userId: undefined as unknown as string, description: "undefined userId" },
        ])("should throw error when $description", async ({ userId }) => {
          await expect(getCachedMyReviews(null, userId)).rejects.toThrow("ユーザーIDが存在しません");
        });

        test("should throw error when invalid tab is provided", async () => {
          const userId = "test-user-id";
          const searchParams: ReviewSearchParams = {
            q: "",
            page: 1,
            tab: "invalid-tab" as unknown as "search" | "edit" | "received",
          };

          await expect(getCachedMyReviews(searchParams, userId)).rejects.toThrow("無効なタブが指定されました");
        });

        test.each([
          { page: 0, description: "page 0" },
          { page: -1, description: "negative page" },
        ])("should throw error when $description", async ({ page }) => {
          const userId = "test-user-id";
          const searchParams: ReviewSearchParams = {
            q: "searchしたいキーワード",
            page, // 無効なページ番号
            tab: "edit",
          };

          // page 0の場合、エラーが発生することを確認
          await expect(getCachedMyReviews(searchParams, userId)).rejects.toThrow(
            "ページ番号は1以上である必要があります",
          );
        });

        test.each([
          { q: null as unknown as string, description: "null searchQuery" },
          { q: undefined as unknown as string, description: "undefined searchQuery" },
        ])("should throw error when $description", async ({ q }) => {
          const userId = "test-user-id";
          const searchParams: ReviewSearchParams = {
            q,
            page: 1,
            tab: "edit",
          };

          await expect(getCachedMyReviews(searchParams, userId)).rejects.toThrow("検索クエリの定義がありません");
        });
      });

      test("should handle count query failure", async () => {
        const userId = "test-user-id";
        const countError = new Error("Count query failed");

        prismaMock.auctionReview.findMany.mockResolvedValue(
          [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        );
        prismaMock.auctionReview.count.mockRejectedValue(countError);

        await expect(getCachedMyReviews(null, userId)).rejects.toThrow("Count query failed");
      });

      test("should handle both findMany and count failures", async () => {
        const userId = "test-user-id";
        const findManyError = new Error("FindMany query failed");

        prismaMock.auctionReview.findMany.mockRejectedValue(findManyError);
        prismaMock.auctionReview.count.mockRejectedValue(new Error("Count also failed"));

        await expect(getCachedMyReviews(null, userId)).rejects.toThrow("FindMany query failed");
      });

      test("should handle unknown error types", async () => {
        const userId = "test-user-id";
        const unknownError = { message: "Unknown error type" };

        prismaMock.auctionReview.findMany.mockRejectedValue(unknownError);

        await expect(getCachedMyReviews(null, userId)).rejects.toThrow("Unknown error type");
      });

      test("should handle network timeout errors", async () => {
        const userId = "test-user-id";
        const timeoutError = new Error("Request timeout");
        timeoutError.name = "TimeoutError";

        prismaMock.auctionReview.findMany.mockRejectedValue(timeoutError);

        await expect(getCachedMyReviews(null, userId)).rejects.toThrow("Request timeout");
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("データ変換テスト", () => {
      describe("totalPagesの計算", () => {
        test("totalCount = 0の場合", async () => {
          // Arrange
          const userId = "test-user-id";

          // テストケース：totalCount = 0の場合
          prismaMock.auctionReview.findMany.mockResolvedValue(
            [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
          );
          prismaMock.auctionReview.count.mockResolvedValue(0);

          // Act
          const result1 = await getCachedMyReviews(null, userId);
          expect(result1.data.totalPages).toBe(0);
        });

        test("totalCount = ITEMS_PER_PAGE丁度の場合", async () => {
          // Arrange
          const userId = "test-user-id";

          // テストケース：totalCount = ITEMS_PER_PAGE丁度の場合
          prismaMock.auctionReview.findMany.mockResolvedValue(
            [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
          );
          prismaMock.auctionReview.count.mockResolvedValue(REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE);

          // Act
          const result = await getCachedMyReviews(null, userId);
          expect(result.data.totalPages).toBe(1);
        });

        test("totalCount = ITEMS_PER_PAGE + 1の場合", async () => {
          // Arrange
          const userId = "test-user-id";

          // テストケース：totalCount = ITEMS_PER_PAGE + 1の場合
          prismaMock.auctionReview.findMany.mockResolvedValue(
            [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
          );
          prismaMock.auctionReview.count.mockResolvedValue(REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE + 1);

          // Act
          const result = await getCachedMyReviews(null, userId);

          // Assert
          expect(result.data.totalPages).toBe(2);
        });
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
          reviewerId: userId,
          revieweeId: "complex-reviewee-1",
          completionProofUrl: null,
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

        const result = await getCachedMyReviews(null, userId);

        expect(result.data.reviews).toHaveLength(1);
        expect(result.data.reviews[0]).toStrictEqual({
          id: "complex-review-1",
          rating: 3,
          comment: "複雑なレビューデータのテスト\n改行\tタブ\"クォート'シングル",
          createdAt: new Date("2024-12-31T23:59:59.999Z"),
          updatedAt: new Date("2025-01-01T00:00:00.001Z"),
          reviewPosition: ReviewPosition.SELLER_TO_BUYER,
          reviewer: null, // 編集タブでは送信者情報は不要
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
});
