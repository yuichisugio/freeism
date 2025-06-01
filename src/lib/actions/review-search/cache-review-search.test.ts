import type { ReviewSearchParams } from "@/components/review-search/review-search";
import type { Prisma } from "@prisma/client";
import { REVIEW_CONSTANTS } from "@/lib/constants";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedAllReviews, getCachedMyReviews, getCachedSearchSuggestions, getCachedUserReviews } from "./cache-review-search";

// コンソールエラーをモック化
// eslint-disable-next-line @typescript-eslint/no-empty-function
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
// eslint-disable-next-line @typescript-eslint/no-empty-function
const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

describe("cache-review-search", () => {
  beforeEach(() => {
    consoleErrorSpy.mockClear();
    consoleLogSpy.mockClear();
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
      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
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
      expect(prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>).toHaveBeenCalledWith({
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

    test("should handle search query with OR conditions", async () => {
      const userId = "test-user-id";
      const searchParams: ReviewSearchParams = {
        searchQuery: "テスト",
        page: 1,
      };

      prismaMock.auctionReview.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedUserReviews(searchParams, userId);

      // OR条件が正しく設定されていることを確認
      expect(prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>).toHaveBeenCalledWith({
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

      prismaMock.auctionReview.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedUserReviews(searchParams, userId);

      // 2ページ目のオフセットが正しく計算されていることを確認
      expect(prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>).toHaveBeenCalledWith({
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

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
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

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
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
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching user reviews:", dbError);
    });

    test("should handle empty search query", async () => {
      const userId = "test-user-id";
      const searchParams: ReviewSearchParams = {
        searchQuery: "",
        page: 1,
      };

      prismaMock.auctionReview.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedUserReviews(searchParams, userId);

      // 空の検索クエリの場合、OR条件が追加されないことを確認
      expect(prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>).toHaveBeenCalledWith({
        where: { revieweeId: userId },
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: 0,
        take: REVIEW_CONSTANTS.ITEMS_PER_PAGE,
      });
    });
  });

  describe("getCachedSearchSuggestions", () => {
    test("should return search suggestions for valid query", async () => {
      const query = "テスト";
      const mockReviews = [
        {
          id: "review-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          auctionId: "auction-1",
          reviewerId: "reviewer-1",
          revieweeId: "reviewee-1",
          rating: 5,
          completionProofUrl: null,
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          comment: "テストコメント1",
          reviewer: {
            settings: { username: "テストユーザー1" },
          },
          reviewee: {
            settings: { username: "レビュー受信者1" },
          },
          auction: {
            task: {
              task: "テストタスク1",
              group: {
                name: "テストグループ1",
              },
            },
          },
        },
        {
          id: "review-2",
          createdAt: new Date(),
          updatedAt: new Date(),
          auctionId: "auction-2",
          reviewerId: "reviewer-2",
          revieweeId: "reviewee-2",
          rating: 4,
          completionProofUrl: null,
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          comment: "別のコメント",
          reviewer: {
            settings: { username: "ユーザー2" },
          },
          reviewee: {
            settings: { username: "テストユーザー2" },
          },
          auction: {
            task: {
              task: "タスク2",
              group: {
                name: "グループ2",
              },
            },
          },
        },
      ];

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);

      const result = await getCachedSearchSuggestions(query);

      expect(result).toEqual(
        expect.arrayContaining([
          {
            value: "テストユーザー1",
            label: "ユーザー: テストユーザー1",
          },
          {
            value: "テストユーザー2",
            label: "ユーザー: テストユーザー2",
          },
          {
            value: "テストグループ1",
            label: "グループ: テストグループ1",
          },
          {
            value: "テストタスク1",
            label: "タスク: テストタスク1...",
          },
          {
            value: "テストコメント1",
            label: "コメント: テストコメント1...",
          },
        ]),
      );
    });

    test("should return empty array for short query", async () => {
      const result = await getCachedSearchSuggestions("a");
      expect(result).toStrictEqual([]);
    });

    test("should return empty array for empty query", async () => {
      const result = await getCachedSearchSuggestions("");
      expect(result).toStrictEqual([]);
    });

    test("should handle null values gracefully", async () => {
      const query = "テスト";
      const mockReviews = [
        {
          id: "review-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          auctionId: "auction-1",
          reviewerId: "reviewer-1",
          revieweeId: "reviewee-1",
          rating: 5,
          completionProofUrl: null,
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          comment: null,
          reviewer: {
            settings: null,
          },
          reviewee: {
            settings: { username: null },
          },
          auction: {
            task: {
              task: null,
              group: {
                name: null,
              },
            },
          },
        },
      ];

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);

      const result = await getCachedSearchSuggestions(query);
      expect(result).toStrictEqual([]);
    });

    test("should limit suggestions to 10 items", async () => {
      const query = "テスト";
      const mockReviews = Array.from({ length: 20 }, (_, i) => ({
        id: `review-${i}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        auctionId: `auction-${i}`,
        reviewerId: `reviewer-${i}`,
        revieweeId: `reviewee-${i}`,
        rating: 5,
        completionProofUrl: null,
        reviewPosition: ReviewPosition.BUYER_TO_SELLER,
        comment: `テストコメント${i}`,
        reviewer: {
          settings: { username: `テストユーザー${i}` },
        },
        reviewee: {
          settings: { username: `レビュー受信者${i}` },
        },
        auction: {
          task: {
            task: `テストタスク${i}`,
            group: {
              name: `テストグループ${i}`,
            },
          },
        },
      }));

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);

      const result = await getCachedSearchSuggestions(query);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    test("should handle database error gracefully", async () => {
      const query = "テスト";
      const dbError = new Error("Database error");

      prismaMock.auctionReview.findMany.mockRejectedValue(dbError);

      const result = await getCachedSearchSuggestions(query);
      expect(result).toStrictEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching search suggestions:", dbError);
    });

    test("should remove duplicate suggestions", async () => {
      const query = "テスト";
      const mockReviews = [
        {
          id: "review-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          auctionId: "auction-1",
          reviewerId: "reviewer-1",
          revieweeId: "reviewee-1",
          rating: 5,
          completionProofUrl: null,
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          comment: "テストコメント",
          reviewer: {
            settings: { username: "テストユーザー" },
          },
          reviewee: {
            settings: { username: "テストユーザー" }, // 重複
          },
          auction: {
            task: {
              task: "テストタスク",
              group: {
                name: "テストグループ",
              },
            },
          },
        },
      ];

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);

      const result = await getCachedSearchSuggestions(query);
      const userSuggestions = result.filter((s) => s.label.startsWith("ユーザー: テストユーザー"));
      expect(userSuggestions.length).toBe(1);
    });
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

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(1);

      const result = await getCachedMyReviews(null, userId);

      expect(result.reviews[0].reviewer).toBeNull();
      expect(result.reviews[0].reviewee).toStrictEqual({
        id: "reviewee-1",
        username: "reviewee1",
      });

      // reviewerIdで検索されていることを確認
      expect(prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>).toHaveBeenCalledWith({
        where: { reviewerId: userId },
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" } as unknown as Prisma.AuctionReviewOrderByWithRelationInput,
        skip: 0,
        take: REVIEW_CONSTANTS.ITEMS_PER_PAGE,
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

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
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

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(1);

      const result = await getCachedMyReviews(null, userId);

      expect(result.reviews[0].reviewee?.username).toBe("未設定");
    });

    test("should handle search query for my reviews", async () => {
      const userId = "test-user-id";
      const searchParams: ReviewSearchParams = {
        searchQuery: "テスト",
        page: 1,
      };

      prismaMock.auctionReview.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedMyReviews(searchParams, userId);

      expect(prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>).toHaveBeenCalledWith({
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
        take: REVIEW_CONSTANTS.ITEMS_PER_PAGE,
      });
    });

    test("should throw error when database operation fails", async () => {
      const userId = "test-user-id";
      const dbError = new Error("Database connection failed");

      prismaMock.auctionReview.findMany.mockRejectedValue(dbError);

      await expect(getCachedMyReviews(null, userId)).rejects.toThrow("自分のレビューの取得に失敗しました");
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching my reviews:", dbError);
    });
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

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
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
      expect(prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object) as unknown as Prisma.AuctionReviewSelect,
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: REVIEW_CONSTANTS.ITEMS_PER_PAGE,
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

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
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

      prismaMock.auctionReview.findMany.mockResolvedValue(mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(1);

      const result = await getCachedAllReviews(null);

      expect(result.reviews[0].reviewer?.username).toBe("未設定");
      expect(result.reviews[0].reviewee?.username).toBe("未設定");
    });

    test("should handle search query for all reviews", async () => {
      const searchParams: ReviewSearchParams = {
        searchQuery: "全体",
        page: 1,
      };

      prismaMock.auctionReview.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedAllReviews(searchParams);

      expect(prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>).toHaveBeenCalledWith({
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
        take: REVIEW_CONSTANTS.ITEMS_PER_PAGE,
      });
    });

    test("should log debug information", async () => {
      const searchParams: ReviewSearchParams = {
        searchQuery: "デバッグ",
        page: 1,
      };

      prismaMock.auctionReview.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedAllReviews(searchParams);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "src/lib/actions/review-search/cache-review-search.ts_getCachedAllReviews_searchParams",
        searchParams,
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "src/lib/actions/review-search/cache-review-search.ts_getCachedAllReviews_whereCondition",
        expect.any(String) as unknown as string,
      );
      expect(consoleLogSpy).toHaveBeenCalledWith("src/lib/actions/review-search/cache-review-search.ts_getCachedAllReviews_reviews_length", 0);
      expect(consoleLogSpy).toHaveBeenCalledWith("src/lib/actions/review-search/cache-review-search.ts_getCachedAllReviews_totalCount", 0);
    });

    test("should throw error when database operation fails", async () => {
      const dbError = new Error("Database connection failed");

      prismaMock.auctionReview.findMany.mockRejectedValue(dbError);

      await expect(getCachedAllReviews(null)).rejects.toThrow("レビューの取得に失敗しました");
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching all reviews:", dbError);
    });

    test("should calculate total pages correctly", async () => {
      prismaMock.auctionReview.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(25); // 25件のレビュー

      const result = await getCachedAllReviews(null);

      // ITEMS_PER_PAGEが10の場合、25件なら3ページになる
      expect(result.totalPages).toBe(Math.ceil(25 / REVIEW_CONSTANTS.ITEMS_PER_PAGE));
      expect(result.totalCount).toBe(25);
    });
  });

  describe("Edge cases and boundary conditions", () => {
    test("should handle undefined searchParams", async () => {
      const userId = "test-user-id";

      prismaMock.auctionReview.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(0);

      // undefinedを渡してもエラーにならないことを確認
      await expect(getCachedUserReviews(undefined as unknown as ReviewSearchParams, userId)).resolves.toBeDefined();
      await expect(getCachedMyReviews(undefined as unknown as ReviewSearchParams, userId)).resolves.toBeDefined();
      await expect(getCachedAllReviews(undefined as unknown as ReviewSearchParams)).resolves.toBeDefined();
    });

    test("should handle page 0 or negative page numbers", async () => {
      const userId = "test-user-id";
      const searchParams: ReviewSearchParams = {
        searchQuery: "",
        page: 0, // 無効なページ番号
      };

      prismaMock.auctionReview.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await getCachedUserReviews(searchParams, userId);

      // page 0の場合、デフォルトで1として扱われ、skipが0になることを確認
      expect(prismaMock.auctionReview.findMany as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: -REVIEW_CONSTANTS.ITEMS_PER_PAGE, // (0-1) * ITEMS_PER_PAGE
        }),
      );
    });

    test("should handle very long search queries", async () => {
      const userId = "test-user-id";
      const longQuery = "a".repeat(1000); // 1000文字の検索クエリ
      const searchParams: ReviewSearchParams = {
        searchQuery: longQuery,
        page: 1,
      };

      prismaMock.auctionReview.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await expect(getCachedUserReviews(searchParams, userId)).resolves.toBeDefined();
    });

    test("should handle special characters in search query", async () => {
      const userId = "test-user-id";
      const specialQuery = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const searchParams: ReviewSearchParams = {
        searchQuery: specialQuery,
        page: 1,
      };

      prismaMock.auctionReview.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>);
      prismaMock.auctionReview.count.mockResolvedValue(0);

      await expect(getCachedUserReviews(searchParams, userId)).resolves.toBeDefined();
    });
  });
});
