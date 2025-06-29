import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedSearchSuggestions } from "./cache-get-search-suggestion";

describe("cache-review-search", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
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

      prismaMock.auctionReview.findMany.mockResolvedValue(
        mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );

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

      prismaMock.auctionReview.findMany.mockResolvedValue(
        mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );

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

      prismaMock.auctionReview.findMany.mockResolvedValue(
        mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );

      const result = await getCachedSearchSuggestions(query);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    test("should handle database error gracefully", async () => {
      const query = "テスト";
      const dbError = new Error("Database error");

      prismaMock.auctionReview.findMany.mockRejectedValue(dbError);

      const result = await getCachedSearchSuggestions(query);
      expect(result).toStrictEqual([]);
      expect(console.error).toHaveBeenCalledWith("Error fetching search suggestions:", dbError);
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

      prismaMock.auctionReview.findMany.mockResolvedValue(
        mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );

      const result = await getCachedSearchSuggestions(query);
      const userSuggestions = result.filter((s) => s.label.startsWith("ユーザー: テストユーザー"));
      expect(userSuggestions.length).toBe(1);
    });
  });
});
