import type { ReviewSearchParams } from "@/components/review-search/review-search";
import type { Prisma } from "@prisma/client";
import { REVIEW_SEARCH_CONSTANTS } from "@/lib/constants";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedAllReviews } from "./cache-get-all-review";

describe("cache-review-search", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  describe("getCachedAllReviews", () => {
    test("should return all reviews without user filtering", async () => {
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

      const result = await getCachedAllReviews(null);

      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].reviewer).toStrictEqual({
        id: "reviewer-1",
        username: "reviewer1",
      });
      expect(result.reviews[0].reviewee).toStrictEqual({
        id: "reviewee-1",
        username: "reviewee1",
      });

      // 全レビューを対象とするため、where条件が空オブジェクトであることを確認
      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
      });
    });

    test("should handle null reviewer and reviewee in all reviews", async () => {
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

      const result = await getCachedAllReviews(null);

      expect(result.reviews[0].reviewer).toBeNull();
      expect(result.reviews[0].reviewee).toBeNull();
    });

    test("should handle missing username in settings for all reviews", async () => {
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

      const result = await getCachedAllReviews(null);

      expect(result.reviews[0].reviewer?.username).toBe("未設定");
      expect(result.reviews[0].reviewee?.username).toBe("未設定");
    });

    test("should handle search query for all reviews", async () => {
      const searchParams: ReviewSearchParams = {
        searchQuery: "全体",
        page: 1,
        tab: "search",
      };

      prismaMock.auctionReview.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedAllReviews(searchParams);

      expect(
        prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      ).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
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
            { revieweeId: "全体" },
            { reviewerId: "全体" },
          ]) as unknown as unknown[],
        },
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: 0,
        take: REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE,
      });
    });
  });

  test("should throw error when database operation fails", async () => {
    const dbError = new Error("Database connection failed");

    prismaMock.auctionReview.findMany.mockRejectedValue(dbError);

    await expect(getCachedAllReviews(null)).rejects.toThrow("レビューの取得に失敗しました");
    expect(console.error).toHaveBeenCalledWith("Error fetching all reviews:", dbError);
  });

  test("should calculate total pages correctly", async () => {
    prismaMock.auctionReview.findMany.mockResolvedValue(
      [] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
    );
    prismaMock.auctionReview.count.mockResolvedValue(25); // 25件のレビュー

    const result = await getCachedAllReviews(null);

    // ITEMS_PER_PAGEが10の場合、25件なら3ページになる
    expect(result.totalPages).toBe(Math.ceil(25 / REVIEW_SEARCH_CONSTANTS.ITEMS_PER_PAGE));
    expect(result.totalCount).toBe(25);
  });
});
