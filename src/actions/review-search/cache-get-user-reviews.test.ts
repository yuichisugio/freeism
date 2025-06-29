import type { ReviewSearchParams } from "@/components/review-search/review-search";
import type { Prisma } from "@prisma/client";
import { REVIEW_CONSTANTS } from "@/lib/constants";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedUserReviews } from "./cache-get-user-reviews";

describe("cache-review-search", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  describe("getCachedUserReviews", () => {
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
        take: REVIEW_CONSTANTS.ITEMS_PER_PAGE,
      });
      expect(prismaMock.auctionReview.count).toHaveBeenCalledWith({
        where: { revieweeId: userId },
      });
    });

    test("should handle page 0 or negative page numbers", async () => {
      const userId = "test-user-id";
      const searchParams: ReviewSearchParams = {
        searchQuery: "",
        page: 0, // 無効なページ番号
      };

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedUserReviews(searchParams, userId);

      // page 0の場合、デフォルトで1として扱われ、skipが0になることを確認
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: -REVIEW_CONSTANTS.ITEMS_PER_PAGE, // (0-1) * ITEMS_PER_PAGE
        }),
      );
    });

    describe("Edge cases and boundary conditions", () => {
      test("should handle undefined searchParams", async () => {
        const userId = "test-user-id";

        prismaMock.auctionReview.findMany.mockResolvedValue(
          [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        );
        prismaMock.auctionReview.count.mockResolvedValue(0);

        // undefinedを渡してもエラーにならないことを確認
        await expect(getCachedUserReviews(undefined as unknown as ReviewSearchParams, userId)).resolves.toBeDefined();
      });
    });

    test("should handle search query with OR conditions", async () => {
      const userId = "test-user-id";
      const searchParams: ReviewSearchParams = {
        searchQuery: "テスト",
        page: 1,
      };

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedUserReviews(searchParams, userId);

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
        take: REVIEW_CONSTANTS.ITEMS_PER_PAGE,
      });
    });

    test("should handle pagination correctly", async () => {
      const userId = "test-user-id";
      const searchParams: ReviewSearchParams = {
        searchQuery: "",
        page: 2,
      };

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedUserReviews(searchParams, userId);

      // 2ページ目のオフセットが正しく計算されていることを確認
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: { revieweeId: userId },
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: REVIEW_CONSTANTS.ITEMS_PER_PAGE, // 1ページ分スキップ
        take: REVIEW_CONSTANTS.ITEMS_PER_PAGE,
      });
    });

    test("should handle null reviewer and reviewee gracefully", async () => {
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

      const result = await getCachedUserReviews(null, userId);

      expect(result.reviews[0].reviewer).toBeNull();
      expect(result.reviews[0].reviewee).toBeNull();
    });

    test("should handle missing username in settings", async () => {
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

      const result = await getCachedUserReviews(null, userId);

      expect(result.reviews[0].reviewer?.username).toBe("未設定");
      expect(result.reviews[0].reviewee?.username).toBe("未設定");
    });

    test("should throw error when database operation fails", async () => {
      const userId = "test-user-id";
      const dbError = new Error("Database connection failed");

      prismaMock.auctionReview.findMany.mockRejectedValue(dbError);

      await expect(getCachedUserReviews(null, userId)).rejects.toThrow("レビューの取得に失敗しました");
      expect(console.error).toHaveBeenCalledWith("Error fetching user reviews:", dbError);
    });

    test("should handle empty search query", async () => {
      const userId = "test-user-id";
      const searchParams: ReviewSearchParams = {
        searchQuery: "",
        page: 1,
      };

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedUserReviews(searchParams, userId);

      // 空の検索クエリの場合、OR条件が追加されないことを確認
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: { revieweeId: userId },
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: 0,
        take: REVIEW_CONSTANTS.ITEMS_PER_PAGE,
      });
    });
  });
});
