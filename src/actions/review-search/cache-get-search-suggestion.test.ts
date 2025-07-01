import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedSearchSuggestions } from "./cache-get-search-suggestion";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cache-review-search_getCachedSearchSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe("正常系", () => {
    test("should return search suggestions for valid query", async () => {
      // Arrange
      const query = "テスト";
      const mockReviews = [
        {
          comment: "テストコメント1",
          reviewer: {
            settings: { username: "テストユーザー1" },
          },
          reviewee: {
            settings: { username: "レビュー受信者1" },
          },
          auction: {
            task: { task: "テストタスク1", group: { name: "テストグループ1" } },
          },
        },
        {
          comment: "テストコメント2",
          reviewer: {
            settings: { username: "テストユーザー2" },
          },
          reviewee: {
            settings: { username: "レビュー受信者2" },
          },
          auction: {
            task: { task: "テストタスク2", group: { name: "テストグループ2" } },
          },
        },
      ];

      prismaMock.auctionReview.findMany.mockResolvedValue(
        mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );

      // Act
      const result = await getCachedSearchSuggestions(query);

      // Assert
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
            label: "タスク: テストタスク1",
          },
          {
            value: "テストコメント1",
            label: "コメント: テストコメント1",
          },
        ]),
      );
    });

    test("should handle null values gracefully", async () => {
      // Arrange
      const query = "テスト";
      const mockReviews = [
        {
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

      // Act
      const result = await getCachedSearchSuggestions(query);

      // Assert
      expect(result).toStrictEqual([]);
    });

    test("should limit suggestions to 20 items", async () => {
      // Arrange
      const query = "テスト";
      const mockReviews = Array.from({ length: 30 }, (_, i) => ({
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

      // Act
      const result = await getCachedSearchSuggestions(query);

      // Assert
      expect(result.length).toBeLessThanOrEqual(20);
    });

    test("should remove duplicate suggestions", async () => {
      // Arrange
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

      // Act
      const result = await getCachedSearchSuggestions(query);

      // Assert
      const userSuggestions = result.filter((s) => s.label.startsWith("ユーザー: テストユーザー"));
      expect(userSuggestions.length).toBe(1);
    });

    test("should truncate long labels with ellipsis", async () => {
      // Arrange
      const query = "テスト";
      const longUsername = "テストユーザー名が非常に長い場合のテストケースですが、ちゃんと省略されるのでしょうか";
      const longGroupName = "テストグループ名が非常に長い場合のテストケースですが、ちゃんと省略されるのでしょうか";
      const longTaskName = "テストタスク名が非常に長い場合のテストケースですが、ちゃんと省略されるのでしょうか";
      const longComment = "テストコメントが非常に長い場合のテストケースですが、ちゃんと省略されるのでしょうか";
      const shortUsername = "テスト短いユーザー名"; // 検索クエリを含むように修正

      const mockReviews = [
        {
          comment: longComment,
          reviewer: {
            settings: { username: longUsername },
          },
          reviewee: {
            settings: { username: shortUsername },
          },
          auction: {
            task: {
              task: longTaskName,
              group: {
                name: longGroupName,
              },
            },
          },
        },
      ];

      prismaMock.auctionReview.findMany.mockResolvedValue(
        mockReviews as unknown as Awaited<ReturnType<typeof prismaMock.auctionReview.findMany>>,
      );

      // Act
      const result = await getCachedSearchSuggestions(query);

      // Assert
      const userSuggestion = result.find((s) => s.value === longUsername);
      const groupSuggestion = result.find((s) => s.value === longGroupName);
      const taskSuggestion = result.find((s) => s.value === longTaskName);
      const commentSuggestion = result.find((s) => s.value === longComment);
      const shortUserSuggestion = result.find((s) => s.value === shortUsername);

      // 長いラベルは省略記号付きで表示される
      expect(userSuggestion?.label).toBe(`ユーザー: テストユーザー名が非常に長い場合のテストケースですが、ちゃん...`);
      expect(groupSuggestion?.label).toBe(`グループ: テストグループ名が非常に長い場合のテストケースですが、ちゃん...`);
      expect(taskSuggestion?.label).toBe(`タスク: テストタスク名が非常に長い場合のテストケースですが、ちゃんと...`);
      expect(commentSuggestion?.label).toBe(
        `コメント: テストコメントが非常に長い場合のテストケースですが、ちゃんと...`,
      );

      // 短いラベルは省略記号なしで表示される
      expect(shortUserSuggestion?.label).toBe("ユーザー: テスト短いユーザー名");
    });

    test.each([
      { query: "" },
      { query: "    " },
      { query: "a" },
      { query: "  a  " },
      { query: null },
      { query: undefined },
    ])("should return empty array for $query", async ({ query }) => {
      // Act
      const result = await getCachedSearchSuggestions(query!);

      // Assert
      expect(result).toStrictEqual([]);
    });
  });

  describe("異常系", () => {
    test("should handle database error gracefully", async () => {
      // Arrange
      const query = "テスト";
      const dbError = new Error("Database error");

      prismaMock.auctionReview.findMany.mockRejectedValue(dbError);

      // Act
      const result = await getCachedSearchSuggestions(query);

      // Assert
      expect(result).toStrictEqual([]);
      expect(console.error).toHaveBeenCalledWith("Error fetching search suggestions:", dbError);
    });
  });
});
