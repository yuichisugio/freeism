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

// getCachedDisplayUserInfoのモック
vi.mock("./cache/cache-auction-rating", () => ({
  getCachedDisplayUserInfo: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getDisplayUserInfo関数のテスト
 */
describe("getDisplayUserInfo", () => {
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
    it("should return display user info for SELLER_TO_BUYER position", async () => {
      // Arrange
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const expectedDisplayUserInfo: DisplayUserInfo[] = [
        {
          userId: "user-1",
          appUserName: "テストユーザー1",
          userImage: "https://example.com/image1.jpg",
          creatorId: null,
          reporterId: null,
          executorId: null,
          rating: 4.5,
          ratingCount: 10,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        },
      ];

      // getCachedDisplayUserInfoのモック設定
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockResolvedValue(expectedDisplayUserInfo);

      // Act
      const result = await getDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(auctionId, reviewPosition);
      expect(result).toStrictEqual(expectedDisplayUserInfo);
    });

    it("should return display user info for BUYER_TO_SELLER position", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;
      const expectedDisplayUserInfo: DisplayUserInfo[] = [
        {
          userId: "cmb0e9xnm0001mchbj6ler4py",
          appUserName: "テストユーザー2",
          userImage: "https://example.com/image2.jpg",
          creatorId: "cmb0e9xnm0001mchbj6ler4py",
          reporterId: null,
          executorId: null,
          rating: 3.8,
          ratingCount: 5,
          hasReviewed: true,
          auctionId,
          reviewComment: "良い取引でした",
        },
      ];

      // getCachedDisplayUserInfoのモック設定
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockResolvedValue(expectedDisplayUserInfo);

      // Act
      const result = await getDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(auctionId, reviewPosition);
      expect(result).toStrictEqual(expectedDisplayUserInfo);
    });

    it("should return empty array when no users found", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const expectedDisplayUserInfo: DisplayUserInfo[] = [];

      // getCachedDisplayUserInfoのモック設定
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockResolvedValue(expectedDisplayUserInfo);

      // Act
      const result = await getDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(auctionId, reviewPosition);
      expect(result).toStrictEqual(expectedDisplayUserInfo);
    });

    it("should return multiple users for BUYER_TO_SELLER position", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;
      const expectedDisplayUserInfo: DisplayUserInfo[] = [
        {
          userId: "cmb0e9xnm0001mchbj6ler4py",
          appUserName: "作成者",
          userImage: "https://example.com/creator.jpg",
          creatorId: "cmb0e9xnm0001mchbj6ler4py",
          reporterId: null,
          executorId: null,
          rating: 4.2,
          ratingCount: 8,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        },
        {
          userId: "cmb0e9xnm0001mchbj6ler4py",
          appUserName: "報告者",
          userImage: "https://example.com/reporter.jpg",
          creatorId: null,
          reporterId: "cmb0e9xnm0001mchbj6ler4py",
          executorId: null,
          rating: 3.9,
          ratingCount: 12,
          hasReviewed: true,
          auctionId,
          reviewComment: "報告ありがとうございました",
        },
      ];

      // getCachedDisplayUserInfoのモック設定
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockResolvedValue(expectedDisplayUserInfo);

      // Act
      const result = await getDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(auctionId, reviewPosition);
      expect(result).toStrictEqual(expectedDisplayUserInfo);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    it("should handle empty string auctionId", async () => {
      // Arrange
      const auctionId = "";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const expectedDisplayUserInfo: DisplayUserInfo[] = [];

      // getCachedDisplayUserInfoのモック設定
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockResolvedValue(expectedDisplayUserInfo);

      // Act
      const result = await getDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(auctionId, reviewPosition);
      expect(result).toStrictEqual(expectedDisplayUserInfo);
    });

    it("should handle very long auctionId", async () => {
      // Arrange
      const auctionId = "a".repeat(1000);
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;
      const expectedDisplayUserInfo: DisplayUserInfo[] = [];

      // getCachedDisplayUserInfoのモック設定
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockResolvedValue(expectedDisplayUserInfo);

      // Act
      const result = await getDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(auctionId, reviewPosition);
      expect(result).toStrictEqual(expectedDisplayUserInfo);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    it("should throw error when getCachedDisplayUserInfo fails", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const expectedError = new Error("キャッシュエラー");

      // getCachedDisplayUserInfoのモック設定（エラーを投げる）
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockRejectedValue(expectedError);

      // Act & Assert
      await expect(getDisplayUserInfo(auctionId, reviewPosition)).rejects.toThrow("キャッシュエラー");

      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(auctionId, reviewPosition);
    });

    it("should handle database connection error", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;
      const expectedError = new Error("Database connection failed");

      // getCachedDisplayUserInfoのモック設定（エラーを投げる）
      const { getCachedDisplayUserInfo } = await import("./cache/cache-auction-rating");
      vi.mocked(getCachedDisplayUserInfo).mockRejectedValue(expectedError);

      // Act & Assert
      await expect(getDisplayUserInfo(auctionId, reviewPosition)).rejects.toThrow("Database connection failed");

      expect(vi.mocked(getCachedDisplayUserInfo)).toHaveBeenCalledWith(auctionId, reviewPosition);
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * createAuctionReview関数のテスト
 */
describe("createAuctionReview", () => {
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
    it("should create auction review successfully with SELLER_TO_BUYER position", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "素晴らしい取引でした";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const expectedReview = auctionReviewFactory.build({
        auctionId,
        reviewerId: mockUserId,
        revieweeId,
        rating,
        comment,
        reviewPosition,
      });

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定
      vi.mocked(prismaMock).auctionReview.create.mockResolvedValue(expectedReview);

      // Act
      const result = await createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition);

      // Assert
      expect(vi.mocked(getAuthenticatedSessionUserId)).toHaveBeenCalledOnce();
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`DisplayUserInfo:${auctionId}:${reviewPosition}`);
      expect(result).toStrictEqual(expectedReview);
    });

    it("should create auction review successfully with BUYER_TO_SELLER position", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 4;
      const comment = "良い取引でした";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      const expectedReview = auctionReviewFactory.build({
        auctionId,
        reviewerId: mockUserId,
        revieweeId,
        rating,
        comment,
        reviewPosition,
      });

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定
      vi.mocked(prismaMock).auctionReview.create.mockResolvedValue(expectedReview);

      // Act
      const result = await createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition);

      // Assert
      expect(vi.mocked(getAuthenticatedSessionUserId)).toHaveBeenCalledOnce();
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`DisplayUserInfo:${auctionId}:${reviewPosition}`);
      expect(result).toStrictEqual(expectedReview);
    });

    it("should create auction review successfully with null comment", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 3;
      const comment = null;
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const expectedReview = auctionReviewFactory.build({
        auctionId,
        reviewerId: mockUserId,
        revieweeId,
        rating,
        comment,
        reviewPosition,
      });

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定
      vi.mocked(prismaMock).auctionReview.create.mockResolvedValue(expectedReview);

      // Act
      const result = await createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition);

      // Assert
      expect(vi.mocked(getAuthenticatedSessionUserId)).toHaveBeenCalledOnce();
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`DisplayUserInfo:${auctionId}:${reviewPosition}`);
      expect(result).toStrictEqual(expectedReview);
    });

    it("should create auction review successfully with empty string comment", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 2;
      const comment = "";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      const expectedReview = auctionReviewFactory.build({
        auctionId,
        reviewerId: mockUserId,
        revieweeId,
        rating,
        comment,
        reviewPosition,
      });

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定
      vi.mocked(prismaMock).auctionReview.create.mockResolvedValue(expectedReview);

      // Act
      const result = await createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition);

      // Assert
      expect(vi.mocked(getAuthenticatedSessionUserId)).toHaveBeenCalledOnce();
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`DisplayUserInfo:${auctionId}:${reviewPosition}`);
      expect(result).toStrictEqual(expectedReview);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    it("should create auction review with minimum rating (1)", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 1;
      const comment = "最低評価";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const expectedReview = auctionReviewFactory.build({
        auctionId,
        reviewerId: mockUserId,
        revieweeId,
        rating,
        comment,
        reviewPosition,
      });

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定
      vi.mocked(prismaMock).auctionReview.create.mockResolvedValue(expectedReview);

      // Act
      const result = await createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition);

      // Assert
      expect(result).toStrictEqual(expectedReview);
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
    });

    it("should create auction review with maximum rating (5)", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "最高評価";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      const expectedReview = auctionReviewFactory.build({
        auctionId,
        reviewerId: mockUserId,
        revieweeId,
        rating,
        comment,
        reviewPosition,
      });

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定
      vi.mocked(prismaMock).auctionReview.create.mockResolvedValue(expectedReview);

      // Act
      const result = await createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition);

      // Assert
      expect(result).toStrictEqual(expectedReview);
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
    });

    it("should create auction review with very long comment", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 4;
      const comment = "a".repeat(1000); // 非常に長いコメント
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const expectedReview = auctionReviewFactory.build({
        auctionId,
        reviewerId: mockUserId,
        revieweeId,
        rating,
        comment,
        reviewPosition,
      });

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定
      vi.mocked(prismaMock).auctionReview.create.mockResolvedValue(expectedReview);

      // Act
      const result = await createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition);

      // Assert
      expect(result).toStrictEqual(expectedReview);
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 引数の境界値・異常値テスト
   */
  describe("引数の境界値・異常値テスト", () => {
    it("should handle empty string auctionId", async () => {
      // Arrange
      const auctionId = "";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow("オークションIDは必須です");

      expect(vi.mocked(getAuthenticatedSessionUserId)).not.toHaveBeenCalled();
      expect(vi.mocked(prismaMock).auctionReview.create).not.toHaveBeenCalled();
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });

    it("should handle empty string revieweeId", async () => {
      // Arrange
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "";
      const rating = 5;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow("レビュー対象者IDは必須です");

      expect(vi.mocked(getAuthenticatedSessionUserId)).not.toHaveBeenCalled();
      expect(vi.mocked(prismaMock).auctionReview.create).not.toHaveBeenCalled();
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });

    it("should handle zero rating", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 0;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const expectedReview = auctionReviewFactory.build({
        auctionId,
        reviewerId: mockUserId,
        revieweeId,
        rating,
        comment,
        reviewPosition,
      });

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定
      vi.mocked(prismaMock).auctionReview.create.mockResolvedValue(expectedReview);

      // Act
      const result = await createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition);

      // Assert
      expect(result).toStrictEqual(expectedReview);
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
    });

    it("should handle null reviewPosition", async () => {
      // Arrange
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "テストコメント";
      // TypeScriptの型チェックを回避するため、nullを直接渡す
      const reviewPosition = null;

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition as unknown as ReviewPosition)).rejects.toThrow(
        "レビューポジションは必須です",
      );

      expect(vi.mocked(getAuthenticatedSessionUserId)).not.toHaveBeenCalled();
      expect(vi.mocked(prismaMock).auctionReview.create).not.toHaveBeenCalled();
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });

    it("should handle undefined reviewPosition", async () => {
      // Arrange
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "テストコメント";
      // TypeScriptの型チェックを回避するため、undefinedを直接渡す
      const reviewPosition = undefined;

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition as unknown as ReviewPosition)).rejects.toThrow(
        "レビューポジションは必須です",
      );

      expect(vi.mocked(getAuthenticatedSessionUserId)).not.toHaveBeenCalled();
      expect(vi.mocked(prismaMock).auctionReview.create).not.toHaveBeenCalled();
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 関数呼び出し順序のテスト
   */
  describe("関数呼び出し順序のテスト", () => {
    it("should call functions in correct order", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const expectedReview = auctionReviewFactory.build({
        auctionId,
        reviewerId: mockUserId,
        revieweeId,
        rating,
        comment,
        reviewPosition,
      });

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定
      vi.mocked(prismaMock).auctionReview.create.mockResolvedValue(expectedReview);

      // Act
      await createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition);

      // Assert - 関数が正しい順序で呼ばれることを確認
      const getAuthenticatedSessionUserIdCall = vi.mocked(getAuthenticatedSessionUserId).mock.invocationCallOrder[0];
      const prismaCreateCall = vi.mocked(prismaMock).auctionReview.create.mock.invocationCallOrder[0];
      const revalidateTagCall = vi.mocked(revalidateTag).mock.invocationCallOrder[0];

      expect(getAuthenticatedSessionUserIdCall).toBeLessThan(prismaCreateCall);
      expect(prismaCreateCall).toBeLessThan(revalidateTagCall);
    });

    it("should not call revalidateTag when prisma.create fails", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定（エラーを投げる）
      vi.mocked(prismaMock).auctionReview.create.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow("Database error");

      expect(vi.mocked(getAuthenticatedSessionUserId)).toHaveBeenCalledOnce();
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledOnce();
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    it("should throw error when auctionId is whitespace only", async () => {
      // Arrange
      const auctionId = "   ";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow("オークションIDは必須です");

      expect(vi.mocked(getAuthenticatedSessionUserId)).not.toHaveBeenCalled();
      expect(vi.mocked(prismaMock).auctionReview.create).not.toHaveBeenCalled();
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });

    it("should throw error when revieweeId is whitespace only", async () => {
      // Arrange
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "   ";
      const rating = 5;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow("レビュー対象者IDは必須です");

      expect(vi.mocked(getAuthenticatedSessionUserId)).not.toHaveBeenCalled();
      expect(vi.mocked(prismaMock).auctionReview.create).not.toHaveBeenCalled();
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });

    it("should handle negative rating", async () => {
      // Arrange
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = -1;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow("評価は0から5の間で指定してください");

      expect(vi.mocked(getAuthenticatedSessionUserId)).not.toHaveBeenCalled();
      expect(vi.mocked(prismaMock).auctionReview.create).not.toHaveBeenCalled();
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });

    it("should handle rating greater than 5", async () => {
      // Arrange
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 10;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow("評価は0から5の間で指定してください");

      expect(vi.mocked(getAuthenticatedSessionUserId)).not.toHaveBeenCalled();
      expect(vi.mocked(prismaMock).auctionReview.create).not.toHaveBeenCalled();
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });

    it("should throw error when getAuthenticatedSessionUserId fails", async () => {
      // Arrange
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const expectedError = new Error("認証エラー");

      // getAuthenticatedSessionUserIdのモック設定（エラーを投げる）
      vi.mocked(getAuthenticatedSessionUserId).mockRejectedValue(expectedError);

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow("認証エラー");

      expect(vi.mocked(getAuthenticatedSessionUserId)).toHaveBeenCalledOnce();
      expect(vi.mocked(prismaMock).auctionReview.create).not.toHaveBeenCalled();
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });

    it("should throw error when prisma.auctionReview.create fails", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      const expectedError = new Error("データベースエラー");

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定（エラーを投げる）
      vi.mocked(prismaMock).auctionReview.create.mockRejectedValue(expectedError);

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow("データベースエラー");

      expect(vi.mocked(getAuthenticatedSessionUserId)).toHaveBeenCalledOnce();
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });

    it("should handle database constraint violation error", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const constraintError = new Error("Unique constraint failed");

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定（制約違反エラーを投げる）
      vi.mocked(prismaMock).auctionReview.create.mockRejectedValue(constraintError);

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow("Unique constraint failed");

      expect(vi.mocked(getAuthenticatedSessionUserId)).toHaveBeenCalledOnce();
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });

    it("should handle Prisma foreign key constraint error", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "non-existent-auction-id";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      const foreignKeyError = new Error("Foreign key constraint failed on the field: `auctionId`");

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定（外部キー制約エラーを投げる）
      vi.mocked(prismaMock).auctionReview.create.mockRejectedValue(foreignKeyError);

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow(
        "Foreign key constraint failed on the field: `auctionId`",
      );

      expect(vi.mocked(getAuthenticatedSessionUserId)).toHaveBeenCalledOnce();
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });

    it("should handle Prisma required field missing error", async () => {
      // Arrange
      const mockUserId = "cmb0e9xnm0001mchbj6ler4py";
      const auctionId = "cmb0e9xnm0001mchbj6ler4py";
      const revieweeId = "cmb0e9xnm0001mchbj6ler4py";
      const rating = 5;
      const comment = "テストコメント";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const requiredFieldError = new Error("Argument `rating` is missing");

      // getAuthenticatedSessionUserIdのモック設定
      vi.mocked(getAuthenticatedSessionUserId).mockResolvedValue(mockUserId);

      // Prismaのモック設定（必須フィールド不足エラーを投げる）
      vi.mocked(prismaMock).auctionReview.create.mockRejectedValue(requiredFieldError);

      // Act & Assert
      await expect(createAuctionReview(auctionId, revieweeId, rating, comment, reviewPosition)).rejects.toThrow("Argument `rating` is missing");

      expect(vi.mocked(getAuthenticatedSessionUserId)).toHaveBeenCalledOnce();
      expect(vi.mocked(prismaMock).auctionReview.create).toHaveBeenCalledWith({
        data: {
          auctionId,
          reviewerId: mockUserId,
          revieweeId,
          rating,
          comment,
          reviewPosition,
        },
      });
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });
  });
});
