import { validateAuction } from "@/lib/auction/action/bid-validation";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { autoBidFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getAutoBidByUserId } from "./get-auto-bid-settings";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の定義
 */
// bid-validationモジュールのモック
vi.mock("@/lib/auction/action/bid-validation", () => ({
  validateAuction: vi.fn(),
  __esModule: true,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト対象の関数をインポート
 */
const mockValidateAuction = vi.mocked(validateAuction);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAuction.mockReset();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの定義
 */
const testAuctionId = "test-auction-id";
const testUserId = "test-user-id";
const testTaskId = "test-task-id";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * バリデーション成功時のレスポンス
 */
const mockValidationSuccess = {
  success: true,
  message: "検証成功",
  userId: testUserId,
  auction: {
    status: TaskStatus.AUCTION_ACTIVE,
    currentHighestBid: 100,
    currentHighestBidderId: testUserId,
    endTime: new Date(Date.now() + 86400000),
    startTime: new Date(Date.now() - 86400000),
    taskId: testTaskId,
    task: {
      creator: { id: "creator-id" },
      executors: [],
      task: "テストタスク",
      detail: null,
      status: TaskStatus.AUCTION_ACTIVE,
    },
    bidHistories: null,
    version: 1,
    isExtension: false,
    extensionTotalCount: 0,
    extensionLimitCount: 5,
    extensionTime: 10,
    remainingTimeForExtension: 5,
  },
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストの実行
 */
describe("getAutoBidByUserId", () => {
  describe("正常系", () => {
    test("should return auto bid when found", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 200,
        bidIncrement: 10,
        isActive: true,
      });

      prismaMock.autoBid.findFirst.mockResolvedValue(mockAutoBid);

      // Act
      const result = await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札設定を取得しました",
        autoBid: {
          id: mockAutoBid.id,
          maxBidAmount: mockAutoBid.maxBidAmount,
          bidIncrement: mockAutoBid.bidIncrement,
        },
      });
      expect(prismaMock.autoBid.findFirst).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          userId: testUserId,
          isActive: true,
          maxBidAmount: {
            gt: 100,
          },
        },
      });
    });

    test("should return null when no auto bid found", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.autoBid.findFirst.mockResolvedValue(null);

      // Act
      const result = await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "",
        autoBid: null,
      });
    });

    test("should call validateAuction with correct parameters", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.autoBid.findFirst.mockResolvedValue(null);

      // Act
      await getAutoBidByUserId(testAuctionId, 150);

      // Assert
      expect(mockValidateAuction).toHaveBeenCalledWith(testAuctionId, {
        checkSelfListing: null,
        checkEndTime: null,
        checkCurrentBid: null,
        currentBid: null,
        requireActive: null,
        executeBid: null,
      });
    });
  });

  describe("異常系", () => {
    test("should return error when validation fails", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "認証が必要です",
        userId: "",
        auction: null,
      });

      // Act
      const result = await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "認証が必要です",
        autoBid: null,
      });
      expect(prismaMock.autoBid.findFirst).not.toHaveBeenCalled();
    });

    test("should return error when validation success is false", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションが見つかりません",
        userId: "",
        auction: null,
      });

      // Act
      const result = await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "オークションが見つかりません",
        autoBid: null,
      });
    });

    test("should return error when userId is not provided", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        userId: "", // userIdが空文字
        auction: mockValidationSuccess.auction,
      });

      // Act
      const result = await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "検証成功", // 実際のvalidation.messageが返される
        autoBid: null,
      });
    });

    test("should handle exception and return error", async () => {
      // Arrange
      mockValidateAuction.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "自動入札設定の取得中にエラーが発生しました",
        autoBid: null,
      });
    });

    test("should handle prisma exception and return error", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.autoBid.findFirst.mockRejectedValue(new Error("Prisma error"));

      // Act
      const result = await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "自動入札設定の取得中にエラーが発生しました",
        autoBid: null,
      });
    });
  });

  describe("境界値テスト", () => {
    test("should handle zero currentHighestBid", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.autoBid.findFirst.mockResolvedValue(null);

      // Act
      const result = await getAutoBidByUserId(testAuctionId, 0);

      // Assert
      expect(result.success).toBe(true);
      expect(prismaMock.autoBid.findFirst).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          userId: testUserId,
          isActive: true,
          maxBidAmount: {
            gt: 0,
          },
        },
      });
    });

    test("should handle negative currentHighestBid", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.autoBid.findFirst.mockResolvedValue(null);

      // Act
      const result = await getAutoBidByUserId(testAuctionId, -100);

      // Assert
      expect(result.success).toBe(true);
      expect(prismaMock.autoBid.findFirst).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          userId: testUserId,
          isActive: true,
          maxBidAmount: {
            gt: -100,
          },
        },
      });
    });

    test("should handle very large currentHighestBid", async () => {
      // Arrange
      const largeBid = 999999999;
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.autoBid.findFirst.mockResolvedValue(null);

      // Act
      const result = await getAutoBidByUserId(testAuctionId, largeBid);

      // Assert
      expect(result.success).toBe(true);
      expect(prismaMock.autoBid.findFirst).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          userId: testUserId,
          isActive: true,
          maxBidAmount: {
            gt: largeBid,
          },
        },
      });
    });
  });

  describe("引数の検証", () => {
    test("should handle empty auctionId", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションIDが無効です",
        userId: "",
        auction: null,
      });

      // Act
      const result = await getAutoBidByUserId("", 100);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "オークションIDが無効です",
        autoBid: null,
      });
    });

    test("should handle null auctionId", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションIDが無効です",
        userId: "",
        auction: null,
      });

      // Act
      // @ts-expect-error - Testing null input
      const result = await getAutoBidByUserId(null, 100);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "オークションIDが無効です",
        autoBid: null,
      });
    });

    test("should handle undefined currentHighestBid", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.autoBid.findFirst.mockResolvedValue(null);

      // Act
      // @ts-expect-error - Testing undefined input
      const result = await getAutoBidByUserId(testAuctionId, undefined);

      // Assert
      expect(result.success).toBe(true);
      expect(prismaMock.autoBid.findFirst).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          userId: testUserId,
          isActive: true,
          maxBidAmount: {
            gt: undefined,
          },
        },
      });
    });
  });

  describe("自動入札設定の条件テスト", () => {
    test("should only return active auto bids", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.autoBid.findFirst.mockResolvedValue(null);

      // Act
      await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(prismaMock.autoBid.findFirst).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          userId: testUserId,
          isActive: true, // 有効な自動入札のみ
          maxBidAmount: {
            gt: 100,
          },
        },
      });
    });

    test("should only return auto bids with higher max bid amount", async () => {
      // Arrange
      const currentBid = 500;
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.autoBid.findFirst.mockResolvedValue(null);

      // Act
      await getAutoBidByUserId(testAuctionId, currentBid);

      // Assert
      expect(prismaMock.autoBid.findFirst).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          userId: testUserId,
          isActive: true,
          maxBidAmount: {
            gt: currentBid, // 現在の入札額より高い上限額のみ
          },
        },
      });
    });

    test("should return auto bid for specific user", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.autoBid.findFirst.mockResolvedValue(null);

      // Act
      await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(prismaMock.autoBid.findFirst).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          userId: testUserId, // 特定のユーザーの自動入札のみ
          isActive: true,
          maxBidAmount: {
            gt: 100,
          },
        },
      });
    });
  });
});
