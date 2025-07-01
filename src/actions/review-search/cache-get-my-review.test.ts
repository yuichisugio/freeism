import type { ReviewSearchParams } from "@/components/review-search/review-search";
import type { Prisma } from "@prisma/client";
import { REVIEW_SEARCH_CONSTANTS } from "@/lib/constants";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedMyReviews } from "./cache-get-my-review";

describe("cache-review-search", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  describe("getCachedMyReviews", () => {
    test("should return my reviews with correct reviewer field as null", async () => {
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

      const result = await getCachedMyReviews(null, userId);

      expect(result.reviews[0].reviewer).toBeNull();
      expect(result.reviews[0].reviewee).toStrictEqual({
        id: "reviewee-1",
        username: "reviewee1",
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
    });

    describe("Edge cases and boundary conditions", () => {
      test("should handle undefined searchParams", async () => {
        const userId = "test-user-id";

        prismaMock.auctionReview.findMany.mockResolvedValue(
          [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
        );
        prismaMock.auctionReview.count.mockResolvedValue(0);

        // undefinedを渡してもエラーにならないことを確認
        await expect(getCachedMyReviews(undefined as unknown as ReviewSearchParams, userId)).resolves.toBeDefined();
      });
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

      expect(result.reviews[0].reviewer).toBeNull();
      expect(result.reviews[0].reviewee).toBeNull();
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

      expect(result.reviews[0].reviewee?.username).toBe("未設定");
    });

    test("should handle search query for my reviews", async () => {
      const userId = "test-user-id";
      const searchParams: ReviewSearchParams = {
        searchQuery: "テスト",
        page: 1,
        tab: "received",
      };

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedMyReviews(searchParams, userId);

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

    test("should throw error when database operation fails", async () => {
      const userId = "test-user-id";
      const dbError = new Error("Database connection failed");

      prismaMock.auctionReview.findMany.mockRejectedValue(dbError);

      await expect(getCachedMyReviews(null, userId)).rejects.toThrow("自分のレビューの取得に失敗しました");
      expect(console.error).toHaveBeenCalledWith("Error fetching my reviews:", dbError);
    });
  });
});
