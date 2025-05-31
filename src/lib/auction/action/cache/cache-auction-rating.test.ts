import { type prisma } from "@/lib/prisma";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionReviewFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCachedDisplayUserInfo } from "./cache-auction-rating";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// next/cacheのモック
vi.mock("next/cache", () => ({
  unstable_cacheTag: vi.fn(),
  unstable_cacheLife: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */

/**
 * 基本的なモックデータを作成
 */
function createBasicMockData() {
  const auctionId = "test-auction-id";
  const winnerId = "winner-user-id";
  const creatorId = "creator-user-id";
  const reporterId = "reporter-user-id";
  const executorId = "executor-user-id";

  return { auctionId, winnerId, creatorId, reporterId, executorId };
}

/**
 * SELLER_TO_BUYER用のモックオークションデータを作成
 */
function createSellerToBuyerMockAuction(
  auctionId: string,
  winnerId: string,
  winnerData?: Partial<{ image: string | null; settings: { username: string } | null }>,
) {
  return {
    id: auctionId,
    winner: {
      id: winnerId,
      image: winnerData?.image ?? null,
      settings: winnerData?.hasOwnProperty("settings") ? winnerData.settings : { username: "テストユーザー" },
    },
  } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>;
}

/**
 * BUYER_TO_SELLER用のモックオークションデータを作成
 */
function createBuyerToSellerMockAuction(
  auctionId: string,
  taskData?: {
    creator?: { id: string; image?: string | null; username?: string } | null;
    reporters?: { id: string; image?: string | null; username?: string }[];
    executors?: { id: string; image?: string | null; username?: string }[];
  },
) {
  return {
    id: auctionId,
    task: taskData
      ? {
          id: "task-id",
          creator: taskData.creator
            ? {
                id: taskData.creator.id,
                image: taskData.creator.image ?? null,
                settings: { username: taskData.creator.username ?? "作成者" },
              }
            : null,
          reporters:
            taskData.reporters?.map((r) => ({
              user: {
                id: r.id,
                image: r.image ?? null,
                settings: { username: r.username ?? "報告者" },
              },
            })) ?? [],
          executors:
            taskData.executors?.map((e) => ({
              user: {
                id: e.id,
                image: e.image ?? null,
                settings: { username: e.username ?? "実行者" },
              },
            })) ?? [],
        }
      : null,
  } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getCachedDisplayUserInfo関数のテスト
 */
describe("getCachedDisplayUserInfo", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テスト前の初期化
   */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    describe("SELLER_TO_BUYER position", () => {
      it("should return display user info for winner with reviews and comments", async () => {
        // Arrange
        const { auctionId, winnerId } = createBasicMockData();
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

        const mockReviews = [
          auctionReviewFactory.build({ revieweeId: winnerId, rating: 5, auctionId: "other-auction-1" }),
          auctionReviewFactory.build({ revieweeId: winnerId, rating: 4, auctionId: "other-auction-2" }),
        ];

        const mockReviewsForThisAuction = [
          auctionReviewFactory.build({
            auctionId,
            revieweeId: winnerId,
            reviewPosition,
            comment: "素晴らしい落札者でした",
          }),
        ];

        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(
          createSellerToBuyerMockAuction(auctionId, winnerId, {
            image: "https://example.com/winner.jpg",
            settings: { username: "落札者ユーザー" },
          }),
        );

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(mockReviews).mockResolvedValueOnce(mockReviewsForThisAuction);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toStrictEqual({
          userId: winnerId,
          appUserName: "落札者ユーザー",
          userImage: "https://example.com/winner.jpg",
          creatorId: null,
          reporterId: null,
          executorId: null,
          rating: 4, // (5 + 4) / 2 = 4.5 → 4（小数点以下切り捨て）
          ratingCount: 2,
          hasReviewed: true,
          auctionId,
          reviewComment: "素晴らしい落札者でした",
        });

        expect(vi.mocked(prismaMock.auction.findUnique)).toHaveBeenCalledWith({
          where: { id: auctionId },
          select: {
            id: true,
            winner: {
              select: {
                id: true,
                image: true,
                settings: { select: { username: true } },
              },
            },
          },
        });
      });

      it("should handle winner with null/undefined data", async () => {
        // Arrange
        const { auctionId, winnerId } = createBasicMockData();
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

        // null settings, undefined image
        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(
          createSellerToBuyerMockAuction(auctionId, winnerId, {
            image: undefined,
            settings: null,
          }),
        );

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toStrictEqual({
          userId: winnerId,
          appUserName: "未設定",
          userImage: null,
          creatorId: null,
          reporterId: null,
          executorId: null,
          rating: 0,
          ratingCount: 0,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });
      });

      it("should return empty array when no winner exists", async () => {
        // Arrange
        const auctionId = "test-auction-id";
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

        // Prismaのモック設定
        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          winner: null,
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toStrictEqual([]);
        expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
      });
    });

    describe("BUYER_TO_SELLER position", () => {
      it("should return display user info for creator, reporter, and executor", async () => {
        // Arrange
        const { auctionId, creatorId, reporterId, executorId } = createBasicMockData();
        const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(
          createBuyerToSellerMockAuction(auctionId, {
            creator: { id: creatorId, image: "https://example.com/creator.jpg", username: "作成者" },
            reporters: [{ id: reporterId, image: "https://example.com/reporter.jpg", username: "報告者" }],
            executors: [{ id: executorId, image: null, username: "実行者" }],
          }),
        );

        const mockReviews = [
          auctionReviewFactory.build({ revieweeId: creatorId, rating: 5, auctionId: "other-auction-1" }),
          auctionReviewFactory.build({ revieweeId: reporterId, rating: 4, auctionId: "other-auction-2" }),
          auctionReviewFactory.build({ revieweeId: executorId, rating: 3, auctionId: "other-auction-3" }),
        ];

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(mockReviews).mockResolvedValueOnce([]);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toHaveLength(3);

        const creatorResult = result.find((r) => r.userId === creatorId);
        expect(creatorResult).toStrictEqual({
          userId: creatorId,
          appUserName: "作成者",
          userImage: "https://example.com/creator.jpg",
          creatorId,
          reporterId: null,
          executorId: null,
          rating: 5.0,
          ratingCount: 1,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });

        const reporterResult = result.find((r) => r.userId === reporterId);
        expect(reporterResult).toStrictEqual({
          userId: reporterId,
          appUserName: "報告者",
          userImage: "https://example.com/reporter.jpg",
          creatorId: null,
          reporterId,
          executorId: null,
          rating: 4.0,
          ratingCount: 1,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });

        const executorResult = result.find((r) => r.userId === executorId);
        expect(executorResult).toStrictEqual({
          userId: executorId,
          appUserName: "実行者",
          userImage: null,
          creatorId: null,
          reporterId: null,
          executorId,
          rating: 3.0,
          ratingCount: 1,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });
      });

      it("should handle user with multiple roles", async () => {
        // Arrange
        const { auctionId } = createBasicMockData();
        const userId = "multi-role-user-id";
        const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(
          createBuyerToSellerMockAuction(auctionId, {
            creator: { id: userId, image: "https://example.com/user.jpg", username: "マルチロールユーザー" },
            reporters: [{ id: userId, image: "https://example.com/user.jpg", username: "マルチロールユーザー" }],
            executors: [],
          }),
        );

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toStrictEqual({
          userId,
          appUserName: "マルチロールユーザー",
          userImage: "https://example.com/user.jpg",
          creatorId: userId,
          reporterId: userId,
          executorId: null,
          rating: 0,
          ratingCount: 0,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });
      });

      it("should handle null users in reporters and executors", async () => {
        // Arrange
        const { auctionId, creatorId } = createBasicMockData();
        const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          task: {
            id: "task-id",
            creator: {
              id: creatorId,
              image: null,
              settings: { username: "作成者のみ" },
            },
            reporters: [{ user: null }],
            executors: [{ user: null }],
          },
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toStrictEqual({
          userId: creatorId,
          appUserName: "作成者のみ",
          userImage: null,
          creatorId,
          reporterId: null,
          executorId: null,
          rating: 0,
          ratingCount: 0,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });
      });

      it("should return empty array when no task exists", async () => {
        // Arrange
        const auctionId = "test-auction-id";
        const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

        // Prismaのモック設定
        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          task: null,
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toStrictEqual([]);
        expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
      });
    });

    describe("Rating calculation", () => {
      it("should calculate rating correctly with various scenarios", async () => {
        // Arrange
        const { auctionId, winnerId } = createBasicMockData();
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

        const testCases = [
          {
            name: "decimal precision (4.333... → 4)",
            reviews: [
              { rating: 4, auctionId: "other-1" },
              { rating: 5, auctionId: "other-2" },
              { rating: 4, auctionId: "other-3" },
            ],
            expectedRating: 4,
            expectedCount: 3,
          },
          {
            name: "exact average (4.5 → 4)",
            reviews: [
              { rating: 4, auctionId: "other-1" },
              { rating: 5, auctionId: "other-2" },
            ],
            expectedRating: 4,
            expectedCount: 2,
          },
          {
            name: "whole number average",
            reviews: [
              { rating: 1, auctionId: "other-1" },
              { rating: 3, auctionId: "other-2" },
              { rating: 5, auctionId: "other-3" },
            ],
            expectedRating: 3,
            expectedCount: 3,
          },
          {
            name: "single review",
            reviews: [{ rating: 3, auctionId: "other-1" }],
            expectedRating: 3,
            expectedCount: 1,
          },
          {
            name: "no reviews",
            reviews: [],
            expectedRating: 0,
            expectedCount: 0,
          },
        ];

        for (const testCase of testCases) {
          vi.clearAllMocks();

          vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(createSellerToBuyerMockAuction(auctionId, winnerId));

          const mockReviews = testCase.reviews.map((r) =>
            auctionReviewFactory.build({
              revieweeId: winnerId,
              rating: r.rating,
              auctionId: r.auctionId,
            }),
          );

          vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(mockReviews).mockResolvedValueOnce([]);

          // Act
          const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

          // Assert
          expect(result).toHaveLength(1);
          expect(result[0].rating).toBe(testCase.expectedRating);
          expect(result[0].ratingCount).toBe(testCase.expectedCount);
          expect(Number.isInteger(result[0].rating)).toBe(true);
          expect(result[0].rating).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値・エッジケーステスト
   */
  describe("境界値・エッジケース", () => {
    describe("Empty results", () => {
      it("should return empty array for various null/missing data scenarios", async () => {
        const { auctionId } = createBasicMockData();

        const testCases = [
          {
            name: "no winner exists (SELLER_TO_BUYER)",
            reviewPosition: ReviewPosition.SELLER_TO_BUYER,
            mockData: { id: auctionId, winner: null },
          },
          {
            name: "no task exists (BUYER_TO_SELLER)",
            reviewPosition: ReviewPosition.BUYER_TO_SELLER,
            mockData: { id: auctionId, task: null },
          },
          {
            name: "empty task data (BUYER_TO_SELLER)",
            reviewPosition: ReviewPosition.BUYER_TO_SELLER,
            mockData: createBuyerToSellerMockAuction(auctionId, {
              creator: null,
              reporters: [],
              executors: [],
            }),
          },
          {
            name: "null auction result",
            reviewPosition: ReviewPosition.SELLER_TO_BUYER,
            mockData: null,
          },
        ];

        for (const testCase of testCases) {
          vi.clearAllMocks();

          vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(testCase.mockData as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

          // Act
          const result = await getCachedDisplayUserInfo(auctionId, testCase.reviewPosition);

          // Assert
          expect(result).toStrictEqual([]);
          expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
        }
      });
    });

    describe("Invalid input validation", () => {
      it("should throw error for invalid auctionId or reviewPosition", async () => {
        const invalidInputs = [
          { auctionId: "", reviewPosition: ReviewPosition.SELLER_TO_BUYER },
          { auctionId: "test-auction-id", reviewPosition: null as unknown as ReviewPosition },
          { auctionId: undefined as unknown as string, reviewPosition: ReviewPosition.SELLER_TO_BUYER },
        ];

        for (const input of invalidInputs) {
          await expect(getCachedDisplayUserInfo(input.auctionId, input.reviewPosition)).rejects.toThrow("Invalid auctionId or reviewPosition");
        }

        expect(vi.mocked(prismaMock.auction.findUnique)).not.toHaveBeenCalled();
      });

      it("should handle very long auctionId", async () => {
        // Arrange
        const auctionId = "a".repeat(1000);
        const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(null);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toStrictEqual([]);
      });

      it("should handle invalid review position", async () => {
        // Arrange
        const { auctionId } = createBasicMockData();
        const reviewPosition = "INVALID_POSITION" as ReviewPosition;

        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toStrictEqual([]);
        expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
      });
    });

    describe("Null/undefined data handling", () => {
      it("should handle various null/undefined user data scenarios", async () => {
        const { auctionId, winnerId } = createBasicMockData();
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

        const testCases = [
          {
            name: "null user.settings",
            winnerData: { image: null, settings: null },
            expectedUserName: "未設定",
          },
          {
            name: "undefined username in settings",
            winnerData: { image: null, settings: {} as { username: string } },
            expectedUserName: "未設定",
          },
          {
            name: "undefined user.image with valid username",
            winnerData: { image: undefined, settings: { username: "テストユーザー" } },
            expectedUserName: "テストユーザー",
          },
        ];

        for (const testCase of testCases) {
          vi.clearAllMocks();

          vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(createSellerToBuyerMockAuction(auctionId, winnerId, testCase.winnerData));

          vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

          // Act
          const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

          // Assert
          expect(result).toHaveLength(1);
          expect(result[0].appUserName).toBe(testCase.expectedUserName);
          expect(result[0].userImage).toBe(null);
        }
      });

      it("should handle null/undefined review comments", async () => {
        // Arrange
        const { auctionId, winnerId } = createBasicMockData();
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(createSellerToBuyerMockAuction(auctionId, winnerId));

        const mockReviewsForThisAuction = [
          auctionReviewFactory.build({
            auctionId,
            revieweeId: winnerId,
            reviewPosition,
            comment: null,
          }),
        ];

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce(mockReviewsForThisAuction);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].reviewComment).toBe(null);
        expect(result[0].hasReviewed).toBe(true);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    it("should throw error when database operations fail", async () => {
      const { auctionId } = createBasicMockData();
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const testCases = [
        {
          name: "auction.findUnique fails",
          setupMock: () => {
            vi.mocked(prismaMock.auction.findUnique).mockRejectedValue(new Error("Database connection failed"));
          },
          expectedError: "Database connection failed",
        },
        {
          name: "auctionReview.findMany fails for reviews",
          setupMock: () => {
            vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(createSellerToBuyerMockAuction(auctionId, "winner-id"));
            vi.mocked(prismaMock.auctionReview.findMany).mockRejectedValue(new Error("Review query failed"));
          },
          expectedError: "Review query failed",
        },
        {
          name: "auctionReview.findMany fails for this auction reviews",
          setupMock: () => {
            vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(createSellerToBuyerMockAuction(auctionId, "winner-id"));
            vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockRejectedValue(new Error("This auction review query failed"));
          },
          expectedError: "This auction review query failed",
        },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        testCase.setupMock();

        await expect(getCachedDisplayUserInfo(auctionId, reviewPosition)).rejects.toThrow(testCase.expectedError);
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュ機能のテスト
   */
  describe("キャッシュ機能", () => {
    it("should call cache functions with correct parameters", async () => {
      // Arrange
      const { auctionId } = createBasicMockData();
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const { unstable_cacheTag, unstable_cacheLife } = await import("next/cache");

      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: null,
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // Act
      await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(unstable_cacheTag)).toHaveBeenCalledWith(`DisplayUserInfo:${auctionId}:${reviewPosition}`);
      expect(vi.mocked(unstable_cacheLife)).toHaveBeenCalledWith("max");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データベースクエリのテスト
   */
  describe("データベースクエリ", () => {
    it("should call correct queries for different positions", async () => {
      const { auctionId } = createBasicMockData();

      const testCases = [
        {
          name: "SELLER_TO_BUYER position",
          reviewPosition: ReviewPosition.SELLER_TO_BUYER,
          expectedSelect: {
            id: true,
            winner: {
              select: {
                id: true,
                image: true,
                settings: { select: { username: true } },
              },
            },
          },
        },
        {
          name: "BUYER_TO_SELLER position",
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          expectedSelect: {
            id: true,
            task: {
              select: {
                id: true,
                creator: {
                  select: {
                    id: true,
                    image: true,
                    settings: { select: { username: true } },
                  },
                },
                reporters: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        image: true,
                        settings: { select: { username: true } },
                      },
                    },
                  },
                },
                executors: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        image: true,
                        settings: { select: { username: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(
          testCase.reviewPosition === ReviewPosition.SELLER_TO_BUYER
            ? ({ id: auctionId, winner: null } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>)
            : ({ id: auctionId, task: null } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>),
        );

        // Act
        await getCachedDisplayUserInfo(auctionId, testCase.reviewPosition);

        // Assert
        expect(vi.mocked(prismaMock.auction.findUnique)).toHaveBeenCalledWith({
          where: { id: auctionId },
          select: testCase.expectedSelect,
        });
      }
    });

    it("should call review queries with correct parameters when users exist", async () => {
      // Arrange
      const { auctionId, winnerId } = createBasicMockData();
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(createSellerToBuyerMockAuction(auctionId, winnerId));

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      // Act
      await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(prismaMock.auctionReview.findMany)).toHaveBeenCalledTimes(2);

      // 1回目の呼び出し（全レビュー取得）
      expect(vi.mocked(prismaMock.auctionReview.findMany)).toHaveBeenNthCalledWith(1, {
        where: { revieweeId: { in: [winnerId] } },
        select: { revieweeId: true, rating: true, auctionId: true },
      });

      // 2回目の呼び出し（このオークションのレビュー取得）
      expect(vi.mocked(prismaMock.auctionReview.findMany)).toHaveBeenNthCalledWith(2, {
        where: { auctionId, revieweeId: { in: [winnerId] }, reviewPosition },
        select: { revieweeId: true, comment: true },
      });
    });
  });
});
