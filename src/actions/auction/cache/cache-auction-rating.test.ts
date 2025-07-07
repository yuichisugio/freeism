import { type prisma } from "@/library-setting/prisma";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionReviewFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, it, test, vi } from "vitest";

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

/**
 * 期待値を生成するヘルパー関数
 */
function createExpectedUserInfo(options: {
  userId: string;
  appUserName: string;
  userImage: string | null;
  creatorId?: string | null;
  reporterId?: string | null;
  executorId?: string | null;
  rating: number;
  ratingCount: number;
  hasReviewed: boolean;
  auctionId: string;
  reviewComment?: string | null;
}) {
  return {
    userId: options.userId,
    appUserName: options.appUserName,
    userImage: options.userImage,
    creatorId: options.creatorId ?? null,
    reporterId: options.reporterId ?? null,
    executorId: options.executorId ?? null,
    rating: options.rating,
    ratingCount: options.ratingCount,
    hasReviewed: options.hasReviewed,
    auctionId: options.auctionId,
    reviewComment: options.reviewComment ?? null,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getCachedDisplayUserInfo関数のテスト
 */
describe("getCachedDisplayUserInfo", () => {
  /**
   * テスト前の初期化
   */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト（統合版）
   */
  describe("異常系", () => {
    test.each([
      {
        name: "auctionId is empty",
        auctionId: "",
        reviewPosition: ReviewPosition.SELLER_TO_BUYER,
        expectedError: "Invalid auctionId or reviewPosition",
      },
      {
        name: "auctionId is null",
        auctionId: null,
        reviewPosition: ReviewPosition.SELLER_TO_BUYER,
        expectedError: "Invalid auctionId or reviewPosition",
      },
      {
        name: "auctionId is undefined",
        auctionId: undefined,
        reviewPosition: ReviewPosition.SELLER_TO_BUYER,
        expectedError: "Invalid auctionId or reviewPosition",
      },
      {
        name: "reviewPosition is empty",
        auctionId: "test-auction-id",
        reviewPosition: "",
        expectedError: "Invalid auctionId or reviewPosition",
      },
      {
        name: "reviewPosition is null",
        auctionId: "test-auction-id",
        reviewPosition: null,
        expectedError: "Invalid auctionId or reviewPosition",
      },
      {
        name: "reviewPosition is undefined",
        auctionId: "test-auction-id",
        reviewPosition: undefined,
        expectedError: "Invalid auctionId or reviewPosition",
      },
      {
        name: "reviewPosition is invalid",
        auctionId: "test-auction-id",
        reviewPosition: "INVALID_POSITION" as ReviewPosition,
        expectedError: "Invalid auctionId or reviewPosition",
      },
    ])("should throw error when invalid input parameters", async ({ auctionId, reviewPosition, expectedError }) => {
      // Act
      await expect(
        getCachedDisplayUserInfo(auctionId as unknown as string, reviewPosition as unknown as ReviewPosition),
      ).rejects.toThrow(expectedError);
    });
  });

  describe("正常系", () => {
    describe("SELLER_TO_BUYER position", () => {
      it("should return display user info for winner with reviews and comments", async () => {
        // Arrange
        const { auctionId, winnerId } = createBasicMockData();
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

        const allReviews = [
          auctionReviewFactory.build({ revieweeId: winnerId, rating: 5, auctionId: "other-auction-1" }),
          auctionReviewFactory.build({ revieweeId: winnerId, rating: 4, auctionId: "other-auction-2" }),
        ];

        const thisAuctionReviews = [
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

        vi.mocked(prismaMock.auctionReview.findMany)
          .mockResolvedValueOnce(allReviews)
          .mockResolvedValueOnce(thisAuctionReviews);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(vi.mocked(prismaMock.auction.findUnique)).toHaveBeenCalledWith({
          where: { id: auctionId },
          select: {
            id: true,
            winner: {
              select: {
                id: true,
                image: true,
                settings: {
                  select: {
                    username: true,
                  },
                },
              },
            },
          },
        });
        expect(vi.mocked(prismaMock.auctionReview.findMany)).toHaveBeenCalledWith({
          where: { auctionId, revieweeId: { in: [winnerId] }, reviewPosition },
          select: { revieweeId: true, comment: true },
        });
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toStrictEqual(
          createExpectedUserInfo({
            userId: winnerId,
            appUserName: "落札者ユーザー",
            userImage: "https://example.com/winner.jpg",
            rating: 4, // (5 + 4) / 2 = 4.5 → 4（小数点以下切り捨て）
            ratingCount: 2,
            hasReviewed: true,
            auctionId,
            reviewComment: "素晴らしい落札者でした",
          }),
        );
      });

      it("should handle winner with null/undefined data", async () => {
        // Arrange
        const { auctionId, winnerId } = createBasicMockData();
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

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
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toStrictEqual(
          createExpectedUserInfo({
            userId: winnerId,
            appUserName: "未設定",
            userImage: null,
            rating: 0,
            ratingCount: 0,
            hasReviewed: false,
            auctionId,
          }),
        );
      });

      it("should return empty array when no winner exists", async () => {
        // Arrange
        const { auctionId } = createBasicMockData();
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          winner: null,
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          data: [],
          message: "ユーザー情報を取得しました",
        });
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

        const allReviews = [
          auctionReviewFactory.build({ revieweeId: creatorId, rating: 5, auctionId: "other-auction-1" }),
          auctionReviewFactory.build({ revieweeId: reporterId, rating: 4, auctionId: "other-auction-2" }),
          auctionReviewFactory.build({ revieweeId: executorId, rating: 3, auctionId: "other-auction-3" }),
        ];

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(allReviews).mockResolvedValueOnce([]);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(3);

        const creatorResult = result.data.find((r) => r.userId === creatorId);
        expect(creatorResult).toStrictEqual(
          createExpectedUserInfo({
            userId: creatorId,
            appUserName: "作成者",
            userImage: "https://example.com/creator.jpg",
            creatorId,
            rating: 5,
            ratingCount: 1,
            hasReviewed: false,
            auctionId,
          }),
        );

        const reporterResult = result.data.find((r) => r.userId === reporterId);
        expect(reporterResult).toStrictEqual(
          createExpectedUserInfo({
            userId: reporterId,
            appUserName: "報告者",
            userImage: "https://example.com/reporter.jpg",
            reporterId,
            rating: 4,
            ratingCount: 1,
            hasReviewed: false,
            auctionId,
          }),
        );

        const executorResult = result.data.find((r) => r.userId === executorId);
        expect(executorResult).toStrictEqual(
          createExpectedUserInfo({
            userId: executorId,
            appUserName: "実行者",
            userImage: null,
            executorId,
            rating: 3,
            ratingCount: 1,
            hasReviewed: false,
            auctionId,
          }),
        );
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
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data).toStrictEqual([
          createExpectedUserInfo({
            userId,
            appUserName: "マルチロールユーザー",
            userImage: "https://example.com/user.jpg",
            creatorId: userId,
            reporterId: userId,
            rating: 0,
            ratingCount: 0,
            hasReviewed: false,
            auctionId,
          }),
        ]);
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
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toStrictEqual(
          createExpectedUserInfo({
            userId: creatorId,
            appUserName: "作成者のみ",
            userImage: null,
            creatorId,
            rating: 0,
            ratingCount: 0,
            hasReviewed: false,
            auctionId,
          }),
        );
      });

      it("should return empty array when no task exists", async () => {
        // Arrange
        const { auctionId } = createBasicMockData();
        const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          task: null,
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          data: [],
          message: "ユーザー情報を取得しました",
        });
        expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
      });
    });

    describe("Rating calculation", () => {
      test.each([
        {
          name: "decimal precision (4.333... → 4)",
          reviews: [{ rating: 4 }, { rating: 5 }, { rating: 4 }],
          expectedRating: 4,
          expectedCount: 3,
        },
        {
          name: "exact average (4.5 → 4)",
          reviews: [{ rating: 4 }, { rating: 5 }],
          expectedRating: 4,
          expectedCount: 2,
        },
        {
          name: "whole number average",
          reviews: [{ rating: 1 }, { rating: 3 }, { rating: 5 }],
          expectedRating: 3,
          expectedCount: 3,
        },
        {
          name: "single review",
          reviews: [{ rating: 3 }],
          expectedRating: 3,
          expectedCount: 1,
        },
        {
          name: "no reviews",
          reviews: [],
          expectedRating: 0,
          expectedCount: 0,
        },
      ])(
        "should calculate rating correctly with various scenarios",
        async ({ reviews, expectedRating, expectedCount }) => {
          // Arrange
          const { auctionId, winnerId } = createBasicMockData();
          const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

          vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(
            createSellerToBuyerMockAuction(auctionId, winnerId),
          );

          const allReviews = reviews.map((r, index) =>
            auctionReviewFactory.build({
              revieweeId: winnerId,
              rating: r.rating,
              auctionId: `other-auction-${index}`,
            }),
          );

          vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(allReviews).mockResolvedValueOnce([]);

          // Act
          const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

          // Assert
          expect(result.success).toBe(true);
          expect(result.data).toHaveLength(1);
          expect(result.data[0].rating).toBe(expectedRating);
          expect(result.data[0].ratingCount).toBe(expectedCount);
          expect(Number.isInteger(result.data[0].rating)).toBe(true);
          expect(result.data[0].rating).toBeGreaterThanOrEqual(0);
        },
      );
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値・エッジケーステスト（統合版）
   */
  describe("境界値・エッジケース", () => {
    it("should return empty array for various null/missing data scenarios", async () => {
      const { auctionId } = createBasicMockData();

      const testCases = [
        {
          name: "no winner exists (SELLER_TO_BUYER)",
          reviewPosition: ReviewPosition.SELLER_TO_BUYER,
          mockData: { id: auctionId, winner: null },
          expectedMessage: "ユーザー情報を取得しました",
        },
        {
          name: "no task exists (BUYER_TO_SELLER)",
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          mockData: { id: auctionId, task: null },
          expectedMessage: "ユーザー情報を取得しました",
        },
        {
          name: "empty task data (BUYER_TO_SELLER)",
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
          mockData: createBuyerToSellerMockAuction(auctionId, {
            creator: null,
            reporters: [],
            executors: [],
          }),
          expectedMessage: "ユーザー情報はありませんでした",
        },
        {
          name: "null auction result",
          reviewPosition: ReviewPosition.SELLER_TO_BUYER,
          mockData: null,
          expectedMessage: "ユーザー情報はありませんでした",
        },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(
          testCase.mockData as Awaited<ReturnType<typeof prisma.auction.findUnique>>,
        );

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, testCase.reviewPosition);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          data: [],
          message: testCase.expectedMessage,
        });
        expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
      }
    });

    test.each([
      {
        name: "null user.settings",
        winnerData: { image: null, settings: null },
        expectedUserName: "未設定",
        expectedResult: {
          userId: "winner-user-id",
          appUserName: "未設定",
          userImage: null,
          creatorId: null,
          reporterId: null,
          executorId: null,
          rating: 0,
          ratingCount: 0,
          hasReviewed: false,
          auctionId: "test-auction-id",
          reviewComment: null,
        },
      },
      {
        name: "undefined username in settings",
        winnerData: { image: null, settings: {} as { username: string } },
        expectedUserName: "未設定",
        expectedResult: {
          userId: "winner-user-id",
          appUserName: "未設定",
          userImage: null,
          creatorId: null,
          reporterId: null,
          executorId: null,
          rating: 0,
          ratingCount: 0,
          hasReviewed: false,
          auctionId: "test-auction-id",
          reviewComment: null,
        },
      },
      {
        name: "undefined user.image with valid username",
        winnerData: { image: undefined, settings: { username: "テストユーザー" } },
        expectedUserName: "テストユーザー",
        expectedResult: {
          userId: "winner-user-id",
          appUserName: "テストユーザー",
          userImage: null,
          creatorId: null,
          reporterId: null,
          executorId: null,
          rating: 0,
          ratingCount: 0,
          hasReviewed: false,
          auctionId: "test-auction-id",
          reviewComment: null,
        },
      },
    ])("should handle various null/undefined user data scenarios", async ({ winnerData, expectedResult }) => {
      // Arrange
      const { auctionId, winnerId } = createBasicMockData();
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(
        createSellerToBuyerMockAuction(auctionId, winnerId, winnerData),
      );

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toStrictEqual(expectedResult);
    });

    test.each([
      {
        name: "null review comment",
        reviewComment: null,
        expectedHasReviewed: true,
      },
      {
        name: "undefined review comment",
        reviewComment: undefined,
        expectedHasReviewed: true,
      },
      {
        name: "empty review comment",
        reviewComment: "",
        expectedHasReviewed: true,
      },
    ])("should handle null/undefined review comments", async ({ reviewComment, expectedHasReviewed }) => {
      // Arrange
      const { auctionId, winnerId } = createBasicMockData();
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(createSellerToBuyerMockAuction(auctionId, winnerId));

      const thisAuctionReviews = [
        auctionReviewFactory.build({
          auctionId,
          revieweeId: winnerId,
          reviewPosition,
          comment: reviewComment,
        }),
      ];

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce(thisAuctionReviews);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].reviewComment).toBe(reviewComment === undefined ? null : reviewComment);
      expect(result.data[0].hasReviewed).toBe(expectedHasReviewed);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レーティング値の型安全性テスト
   */
  describe("レーティング値の型安全性", () => {
    it("should ensure rating is always a number and never undefined", async () => {
      // Arrange
      const { auctionId, winnerId } = createBasicMockData();
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(createSellerToBuyerMockAuction(auctionId, winnerId));

      // 評価データなしでレビューを空配列として設定
      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      // ratingが必ずnumber型であることを確認
      expect(typeof result.data[0].rating).toBe("number");
      expect(result.data[0].rating).toBe(0); // 評価がない場合は0になることを確認
      expect(result.data[0].rating).not.toBeUndefined();
      expect(result.data[0].rating).not.toBeNull();
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
      expect(vi.mocked(unstable_cacheTag)).toHaveBeenCalledWith(
        `auctionRating:auctionByAuctionId:${auctionId}:${reviewPosition}`,
      );
      expect(vi.mocked(unstable_cacheLife)).toHaveBeenCalledWith("max");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データベースクエリのテスト
   */
  describe("データベースクエリ", () => {
    test.each([
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
    ])("should call correct queries for different positions", async ({ reviewPosition, expectedSelect }) => {
      // Arrange
      const { auctionId } = createBasicMockData();

      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(
        reviewPosition === ReviewPosition.SELLER_TO_BUYER
          ? ({ id: auctionId, winner: null } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>)
          : ({ id: auctionId, task: null } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>),
      );

      // Act
      await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(prismaMock.auction.findUnique)).toHaveBeenCalledWith({
        where: { id: auctionId },
        select: expectedSelect,
      });
    });
  });
});
