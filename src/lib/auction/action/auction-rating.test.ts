import type { DisplayUserInfo } from "@/components/auction/common/auction-rating";
import { revalidateTag } from "next/cache";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionReviewFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuctionReview, getDisplayUserInfo } from "./auction-rating";

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

const createSuccessfulReviewTest = async (reviewPosition: ReviewPosition, rating: number, comment: string | null = "テストコメント") => {
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
  expect(mockRevalidateTag).toHaveBeenCalledWith(`DisplayUserInfo:${TEST_AUCTION_ID}:${reviewPosition}`);
  expect(result).toStrictEqual(expectedReview);
};

const expectValidationError = async (
  auctionId: string,
  revieweeId: string,
  rating: number,
  comment: string | null,
  reviewPosition: ReviewPosition | null | undefined,
  expectedError: string,
) => {
  await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition!)).rejects.toThrow(expectedError);

  expect(mockGetAuthenticatedSessionUserId).not.toHaveBeenCalled();
  expect(prismaMock.auctionReview.create).not.toHaveBeenCalled();
  expect(mockRevalidateTag).not.toHaveBeenCalled();
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
    it("should return display user info for both review positions", async () => {
      const expectedDisplayUserInfo = [createMockDisplayUserInfo()];
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockResolvedValue(expectedDisplayUserInfo);

      // SELLER_TO_BUYERのテスト
      const resultSeller = await getDisplayUserInfo(TEST_AUCTION_ID, ReviewPosition.SELLER_TO_BUYER);
      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(TEST_AUCTION_ID, ReviewPosition.SELLER_TO_BUYER);
      expect(resultSeller).toStrictEqual(expectedDisplayUserInfo);

      // BUYER_TO_SELLERのテスト
      const resultBuyer = await getDisplayUserInfo(TEST_AUCTION_ID, ReviewPosition.BUYER_TO_SELLER);
      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(TEST_AUCTION_ID, ReviewPosition.BUYER_TO_SELLER);
      expect(resultBuyer).toStrictEqual(expectedDisplayUserInfo);
    });

    it("should return empty array when no users found", async () => {
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockResolvedValue([]);

      const result = await getDisplayUserInfo(TEST_AUCTION_ID, ReviewPosition.SELLER_TO_BUYER);
      expect(result).toStrictEqual([]);
    });

    it("should return multiple users", async () => {
      const expectedUsers = [
        createMockDisplayUserInfo({ userId: "user-1", appUserName: "ユーザー1" }),
        createMockDisplayUserInfo({ userId: "user-2", appUserName: "ユーザー2" }),
      ];
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockResolvedValue(expectedUsers);

      const result = await getDisplayUserInfo(TEST_AUCTION_ID, ReviewPosition.BUYER_TO_SELLER);
      expect(result).toStrictEqual(expectedUsers);
    });
  });

  describe("境界値テスト", () => {
    it("should handle empty or very long auctionId", async () => {
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockResolvedValue([]);

      // 空文字列のテスト
      await getDisplayUserInfo("", ReviewPosition.SELLER_TO_BUYER);
      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith("", ReviewPosition.SELLER_TO_BUYER);

      // 非常に長いIDのテスト
      const longId = "a".repeat(1000);
      await getDisplayUserInfo(longId, ReviewPosition.BUYER_TO_SELLER);
      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(longId, ReviewPosition.BUYER_TO_SELLER);
    });
  });

  describe("異常系", () => {
    it("should handle getCachedDisplayUserInfo errors", async () => {
      const errorMessages = ["キャッシュエラー", "Database connection failed"];
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");

      for (const errorMessage of errorMessages) {
        const expectedError = new Error(errorMessage);
        vi.mocked(getCachedDisplayUserInfo).mockRejectedValue(expectedError);

        await expect(getDisplayUserInfo(TEST_AUCTION_ID, ReviewPosition.SELLER_TO_BUYER)).rejects.toThrow(errorMessage);
        expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(TEST_AUCTION_ID, ReviewPosition.SELLER_TO_BUYER);

        vi.clearAllMocks();
      }
    });
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
    it("should create auction review successfully for all review positions and comment types", async () => {
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

    it("should create auction review with boundary ratings", async () => {
      const boundaryRatings = [0, 1, 5];

      for (const rating of boundaryRatings) {
        await createSuccessfulReviewTest(ReviewPosition.SELLER_TO_BUYER, rating);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.auctionReview.create).toHaveBeenCalledOnce();
        vi.clearAllMocks();
      }
    });

    it("should create auction review with very long comment", async () => {
      const longComment = "a".repeat(1000);
      await createSuccessfulReviewTest(ReviewPosition.SELLER_TO_BUYER, 4, longComment);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
    });
  });

  describe("バリデーションエラー", () => {
    it("should throw validation errors for invalid inputs", async () => {
      const validationTestCases = [
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
          rating: 5,
          comment: "テスト",
          position: null,
          error: "レビューポジションは必須です",
        },
        {
          auctionId: TEST_AUCTION_ID,
          revieweeId: TEST_REVIEWEE_ID,
          rating: 5,
          comment: "テスト",
          position: undefined,
          error: "レビューポジションは必須です",
        },
      ];

      for (const testCase of validationTestCases) {
        await expectValidationError(testCase.auctionId, testCase.revieweeId, testCase.rating, testCase.comment, testCase.position, testCase.error);
        expect(mockGetAuthenticatedSessionUserId).not.toHaveBeenCalled();
        vi.clearAllMocks();
      }
    });

    it("should handle null and undefined rating", async () => {
      // ratingがnullの場合
      await expect(
        createAuctionReview(TEST_AUCTION_ID, TEST_REVIEWEE_ID, null as unknown as number, "テスト", ReviewPosition.SELLER_TO_BUYER),
      ).rejects.toThrow("評価は必須です");

      // ratingがundefinedの場合
      await expect(
        createAuctionReview(TEST_AUCTION_ID, TEST_REVIEWEE_ID, undefined as unknown as number, "テスト", ReviewPosition.SELLER_TO_BUYER),
      ).rejects.toThrow("評価は必須です");
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

      await expect(createAuctionReview(TEST_AUCTION_ID, TEST_REVIEWEE_ID, 5, "テスト", ReviewPosition.SELLER_TO_BUYER)).rejects.toThrow("認証エラー");

      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.create).not.toHaveBeenCalled();
      expect(mockRevalidateTag).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // prisma.create失敗時
      mockGetAuthenticatedSessionUserId.mockResolvedValue(TEST_USER_ID);
      prismaMock.auctionReview.create.mockRejectedValue(new Error("Database error"));

      await expect(createAuctionReview(TEST_AUCTION_ID, TEST_REVIEWEE_ID, 5, "テスト", ReviewPosition.BUYER_TO_SELLER)).rejects.toThrow(
        "Database error",
      );

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
        { error: new Error("Foreign key constraint failed on the field: `auctionId`"), description: "外部キー制約違反" },
        { error: new Error("Argument `rating` is missing"), description: "必須フィールド不足" },
      ];

      mockGetAuthenticatedSessionUserId.mockResolvedValue(TEST_USER_ID);

      for (const { error } of databaseErrors) {
        prismaMock.auctionReview.create.mockRejectedValue(error);

        await expect(createAuctionReview(TEST_AUCTION_ID, TEST_REVIEWEE_ID, 5, "テスト", ReviewPosition.SELLER_TO_BUYER)).rejects.toThrow(
          error.message,
        );

        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.auctionReview.create).toHaveBeenCalledOnce();
        expect(mockRevalidateTag).not.toHaveBeenCalled();

        vi.clearAllMocks();
        mockGetAuthenticatedSessionUserId.mockResolvedValue(TEST_USER_ID);
      }
    });
  });
});
