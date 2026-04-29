import type { DisplayUserInfo } from "@/components/auction/common/auction-rating";
import { revalidateTag } from "next/cache";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionReviewFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, it, test, vi } from "vitest";

import { createAuctionReview, getDisplayUserInfo } from "./auction-rating";
import { getCachedDisplayUserInfo } from "./cache/cache-auction-rating";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// revalidateTagのモック
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

// getCachedDisplayUserInfoのモック
vi.mock("./cache/cache-auction-rating", () => ({
  getCachedDisplayUserInfo: vi.fn(),
}));

// モック関数の型定義
const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);
const mockRevalidateTag = vi.mocked(revalidateTag);
const mockGetCachedDisplayUserInfo = vi.mocked(getCachedDisplayUserInfo);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通テストデータ
 */
const TEST_AUCTION_ID = "cmb0e9xnm0001mchbj6ler4py";
const TEST_USER_ID = "cmb0e9xnm0001mchbj6ler4py";
const TEST_REVIEWEE_ID = "cmb0e9xnm0001mchbj6ler4py";

/**
 * テストヘルパー関数
 */
const createMockDisplayUserInfo = (overrides: Partial<DisplayUserInfo> = {}): DisplayUserInfo =>
  ({
    userId: "user-1",
    appUserName: "テストユーザー",
    userImage: "https://example.com/image.jpg",
    creatorId: null,
    reporterId: null,
    executorId: null,
    rating: 4.5,
    ratingCount: 10,
    hasReviewed: false,
    auctionId: TEST_AUCTION_ID,
    reviewComment: null,
    ...overrides,
  }) as DisplayUserInfo;

const createSuccessfulReviewTest = async (
  reviewPosition: ReviewPosition,
  rating: number,
  comment: string | null = "テストコメント",
) => {
  const expectedReview = auctionReviewFactory.build({
    auctionId: TEST_AUCTION_ID,
    reviewerId: TEST_USER_ID,
    revieweeId: TEST_REVIEWEE_ID,
    rating,
    comment,
    reviewPosition,
  });

  mockGetAuthenticatedSessionUserId.mockResolvedValue(TEST_USER_ID);
  prismaMock.auctionReview.create.mockResolvedValue(expectedReview);

  const result = await createAuctionReview(TEST_AUCTION_ID, TEST_REVIEWEE_ID, rating, comment, reviewPosition);

  expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
  expect(prismaMock.auctionReview.create).toHaveBeenCalledWith({
    data: {
      auctionId: TEST_AUCTION_ID,
      reviewerId: TEST_USER_ID,
      revieweeId: TEST_REVIEWEE_ID,
      rating,
      comment,
      reviewPosition,
    },
  });
  expect(mockRevalidateTag).toHaveBeenCalledWith(
    `auctionRating:auctionByAuctionId:${TEST_AUCTION_ID}:${reviewPosition}`,
  );
  expect(result).toStrictEqual({
    success: true,
    data: expectedReview,
    message: "レビューを作成しました",
  });
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getDisplayUserInfo関数のテスト
 */
describe("getDisplayUserInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    test("should return display user info for both review positions", async () => {
      const expectedDisplayUserInfo = [createMockDisplayUserInfo()];

      mockGetCachedDisplayUserInfo.mockResolvedValue({
        success: true,
        message: "ユーザー情報を取得しました",
        data: expectedDisplayUserInfo,
      });

      const result = await getDisplayUserInfo(TEST_AUCTION_ID, ReviewPosition.SELLER_TO_BUYER);

      expect(mockGetCachedDisplayUserInfo).toHaveBeenCalledWith(TEST_AUCTION_ID, ReviewPosition.SELLER_TO_BUYER);
      expect(result).toStrictEqual({
        success: true,
        message: "ユーザー情報を取得しました",
        data: expectedDisplayUserInfo,
      });
    });
  });

  describe("異常系", () => {
    test.each(["キャッシュエラー", "Database connection failed"])(
      "should handle getCachedDisplayUserInfo errors",
      async (errorMessage) => {
        mockGetCachedDisplayUserInfo.mockRejectedValue(new Error(errorMessage));

        // Act & Assert
        await expect(getDisplayUserInfo(TEST_AUCTION_ID, ReviewPosition.SELLER_TO_BUYER)).rejects.toThrow(errorMessage);
        expect(mockGetCachedDisplayUserInfo).toHaveBeenCalledWith(TEST_AUCTION_ID, ReviewPosition.SELLER_TO_BUYER);
        expect(mockRevalidateTag).not.toHaveBeenCalled();
      },
    );
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * createAuctionReview関数のテスト
 */
describe("createAuctionReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    test("should create auction review successfully for all review positions and comment types", async () => {
      const testCases = [
        { position: ReviewPosition.SELLER_TO_BUYER, rating: 5, comment: "素晴らしい取引でした" },
        { position: ReviewPosition.BUYER_TO_SELLER, rating: 4, comment: "良い取引でした" },
        { position: ReviewPosition.SELLER_TO_BUYER, rating: 3, comment: null },
        { position: ReviewPosition.BUYER_TO_SELLER, rating: 2, comment: "" },
      ];

      for (const testCase of testCases) {
        await createSuccessfulReviewTest(testCase.position, testCase.rating, testCase.comment);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        vi.clearAllMocks();
      }
    });

    test("should create auction review with boundary ratings", async () => {
      const boundaryRatings = [0, 1, 5];

      for (const rating of boundaryRatings) {
        await createSuccessfulReviewTest(ReviewPosition.SELLER_TO_BUYER, rating);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.auctionReview.create).toHaveBeenCalledOnce();
        vi.clearAllMocks();
      }
    });

    test("should create auction review with very long comment", async () => {
      const longComment = "a".repeat(1000);
      await createSuccessfulReviewTest(ReviewPosition.SELLER_TO_BUYER, 4, longComment);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
    });
  });

  describe("異常系", () => {
    describe("バリデーションエラー", () => {
      test.each([
        {
          auctionId: "",
          revieweeId: TEST_REVIEWEE_ID,
          rating: 5,
          comment: "テスト",
          position: ReviewPosition.SELLER_TO_BUYER,
          error: "オークションIDは必須です",
        },
        {
          auctionId: "   ",
          revieweeId: TEST_REVIEWEE_ID,
          rating: 5,
          comment: "テスト",
          position: ReviewPosition.SELLER_TO_BUYER,
          error: "オークションIDは必須です",
        },
        {
          auctionId: TEST_AUCTION_ID,
          revieweeId: "",
          rating: 5,
          comment: "テスト",
          position: ReviewPosition.BUYER_TO_SELLER,
          error: "レビュー対象者IDは必須です",
        },
        {
          auctionId: TEST_AUCTION_ID,
          revieweeId: "   ",
          rating: 5,
          comment: "テスト",
          position: ReviewPosition.BUYER_TO_SELLER,
          error: "レビュー対象者IDは必須です",
        },
        {
          auctionId: TEST_AUCTION_ID,
          revieweeId: TEST_REVIEWEE_ID,
          rating: -1,
          comment: "テスト",
          position: ReviewPosition.BUYER_TO_SELLER,
          error: "評価は0から5の間の整数で指定してください",
        },
        {
          auctionId: TEST_AUCTION_ID,
          revieweeId: TEST_REVIEWEE_ID,
          rating: 10,
          comment: "テスト",
          position: ReviewPosition.SELLER_TO_BUYER,
          error: "評価は0から5の間の整数で指定してください",
        },
        {
          auctionId: TEST_AUCTION_ID,
          revieweeId: TEST_REVIEWEE_ID,
          rating: 2.5,
          comment: "テスト",
          position: ReviewPosition.SELLER_TO_BUYER,
          error: "評価は0から5の間の整数で指定してください",
        },
        {
          auctionId: TEST_AUCTION_ID,
          revieweeId: TEST_REVIEWEE_ID,
          rating: null!,
          comment: "テスト",
          position: ReviewPosition.SELLER_TO_BUYER,
          error: "評価は0から5の間の整数で指定してください",
        },
        {
          auctionId: TEST_AUCTION_ID,
          revieweeId: TEST_REVIEWEE_ID,
          rating: undefined!,
          comment: "テスト",
          position: ReviewPosition.SELLER_TO_BUYER,
          error: "評価は0から5の間の整数で指定してください",
        },
        {
          auctionId: TEST_AUCTION_ID,
          revieweeId: TEST_REVIEWEE_ID,
          rating: 5,
          comment: "テスト",
          position: null!,
          error: "レビューポジションは必須です",
        },
        {
          auctionId: TEST_AUCTION_ID,
          revieweeId: TEST_REVIEWEE_ID,
          rating: 5,
          comment: "テスト",
          position: undefined!,
          error: "レビューポジションは必須です",
        },
      ])(
        "should throw validation errors for invalid inputs",
        async ({ auctionId, revieweeId, rating, comment, position, error }) => {
          await expect(
            createAuctionReview(auctionId, revieweeId, rating, comment, position as ReviewPosition),
          ).rejects.toThrow(error);
          expect(mockGetAuthenticatedSessionUserId).not.toHaveBeenCalled();
          expect(prismaMock.auctionReview.create).not.toHaveBeenCalled();
          expect(mockRevalidateTag).not.toHaveBeenCalled();
        },
      );
    });
  });

  describe("関数呼び出し順序と依存関係", () => {
    it("should call functions in correct order", async () => {
      const expectedReview = auctionReviewFactory.build({
        auctionId: TEST_AUCTION_ID,
        reviewerId: TEST_USER_ID,
        revieweeId: TEST_REVIEWEE_ID,
        rating: 5,
        comment: "テスト",
        reviewPosition: ReviewPosition.SELLER_TO_BUYER,
      });

      mockGetAuthenticatedSessionUserId.mockResolvedValue(TEST_USER_ID);
      prismaMock.auctionReview.create.mockResolvedValue(expectedReview);

      await createAuctionReview(TEST_AUCTION_ID, TEST_REVIEWEE_ID, 5, "テスト", ReviewPosition.SELLER_TO_BUYER);

      const getUserIdCall = mockGetAuthenticatedSessionUserId.mock.invocationCallOrder[0];
      const createCall = prismaMock.auctionReview.create.mock.invocationCallOrder[0];
      const revalidateCall = mockRevalidateTag.mock.invocationCallOrder[0];

      expect(getUserIdCall).toBeLessThan(createCall);
      expect(createCall).toBeLessThan(revalidateCall);
    });

    it("should not call subsequent functions when earlier ones fail", async () => {
      // getAuthenticatedSessionUserId失敗時
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("認証エラー"));

      await expect(
        createAuctionReview(TEST_AUCTION_ID, TEST_REVIEWEE_ID, 5, "テスト", ReviewPosition.SELLER_TO_BUYER),
      ).rejects.toThrow("認証エラー");

      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.create).not.toHaveBeenCalled();
      expect(mockRevalidateTag).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // prisma.create失敗時
      mockGetAuthenticatedSessionUserId.mockResolvedValue(TEST_USER_ID);
      prismaMock.auctionReview.create.mockRejectedValue(new Error("Database error"));

      await expect(
        createAuctionReview(TEST_AUCTION_ID, TEST_REVIEWEE_ID, 5, "テスト", ReviewPosition.BUYER_TO_SELLER),
      ).rejects.toThrow("Database error");

      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.create).toHaveBeenCalledOnce();
      expect(mockRevalidateTag).not.toHaveBeenCalled();
    });
  });

  describe("データベースエラーハンドリング", () => {
    it("should handle various database errors", async () => {
      const databaseErrors = [
        { error: new Error("データベースエラー"), description: "一般的なデータベースエラー" },
        { error: new Error("Unique constraint failed"), description: "一意制約違反" },
        {
          error: new Error("Foreign key constraint failed on the field: `auctionId`"),
          description: "外部キー制約違反",
        },
        { error: new Error("Argument `rating` is missing"), description: "必須フィールド不足" },
      ];

      mockGetAuthenticatedSessionUserId.mockResolvedValue(TEST_USER_ID);

      for (const { error } of databaseErrors) {
        prismaMock.auctionReview.create.mockRejectedValue(error);

        await expect(
          createAuctionReview(TEST_AUCTION_ID, TEST_REVIEWEE_ID, 5, "テスト", ReviewPosition.SELLER_TO_BUYER),
        ).rejects.toThrow(error.message);

        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.auctionReview.create).toHaveBeenCalledOnce();
        expect(mockRevalidateTag).not.toHaveBeenCalled();

        vi.clearAllMocks();
        mockGetAuthenticatedSessionUserId.mockResolvedValue(TEST_USER_ID);
      }
    });
  });
});
