import type { Prisma } from "@prisma/client";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { autoBidFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { validateAuction } from "../bid-validation";
import { cancelAutoBid } from "./cancel-auto-bid";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の定義
 */
// bid-validationモジュールのモック
vi.mock("../bid-validation", () => ({
  validateAuction: vi.fn(),
  __esModule: true,
}));

// sendAuctionNotificationのモック
vi.mock("@/lib/actions/notification/auction-notification", () => ({
  sendAuctionNotification: vi.fn(),
  __esModule: true,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト対象の関数をインポート
 */
const mockValidateAuction = vi.mocked(validateAuction);
const mockSendAuctionNotification = vi.mocked(sendAuctionNotification);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAuction.mockReset();
  mockSendAuctionNotification.mockReset();
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
describe("cancelAutoBid", () => {
  describe("正常系", () => {
    test("should cancel auto bid successfully", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      const existingAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 200,
        bidIncrement: 10,
        isActive: true,
      });

      const canceledAutoBid = autoBidFactory.build({
        ...existingAutoBid,
        isActive: false,
      });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          autoBid: {
            findFirst: vi.fn().mockResolvedValue(existingAutoBid),
            update: vi.fn().mockResolvedValue(canceledAutoBid),
          },
        };
        return await callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await cancelAutoBid(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札を取り消しました",
        autoBid: {
          id: canceledAutoBid.id,
          maxBidAmount: canceledAutoBid.maxBidAmount,
          bidIncrement: canceledAutoBid.bidIncrement,
        },
      });

      // モック関数が正しく呼ばれたことを確認
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
    test("should return error when no active auto bid found", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          autoBid: {
            findFirst: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
        };
        return await callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await cancelAutoBid(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "有効な自動入札設定が見つかりません",
        autoBid: null,
      });
    });

    test("should return error when validation fails", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "認証が必要です",
        userId: "",
        auction: null,
      });

      // Act
      const result = await cancelAutoBid(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "認証が必要です",
        autoBid: null,
      });

      // トランザクションが実行されていないことを確認
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    test("should return error when validation message is empty", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "",
        userId: "",
        auction: null,
      });

      // Act
      const result = await cancelAutoBid(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "",
        autoBid: null,
      });
    });

    test("should return error when validation message is null (fallback to default)", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: null as unknown as string, // 型アサーションでnullを渡す
        userId: "",
        auction: null,
      });

      // Act
      const result = await cancelAutoBid(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "検証エラー",
        autoBid: null,
      });
    });

    test("should return error when validation fails with no userId", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        userId: "",
        auction: mockValidationSuccess.auction,
      });

      // Act
      const result = await cancelAutoBid(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "検証成功",
        autoBid: null,
      });
    });

    test("should handle exception and return error", async () => {
      // Arrange
      mockValidateAuction.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await cancelAutoBid(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "自動入札の取り消し中にエラーが発生しました",
        autoBid: null,
      });
    });

    test("should handle transaction error", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.$transaction.mockRejectedValue(new Error("Transaction error"));

      // Act
      const result = await cancelAutoBid(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "自動入札の取り消し中にエラーが発生しました",
        autoBid: null,
      });
    });
  });

  describe("境界値テスト", () => {
    test("should handle empty auctionId", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションIDが無効です",
        userId: "",
        auction: null,
      });

      // Act
      const result = await cancelAutoBid("");

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "オークションIDが無効です",
        autoBid: null,
      });
    });

    test("should handle very long auctionId", async () => {
      // Arrange
      const longAuctionId = "a".repeat(1000);
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      const existingAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId,
        auctionId: longAuctionId,
        maxBidAmount: 200,
        bidIncrement: 10,
        isActive: true,
      });

      const canceledAutoBid = autoBidFactory.build({
        ...existingAutoBid,
        isActive: false,
      });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          autoBid: {
            findFirst: vi.fn().mockResolvedValue(existingAutoBid),
            update: vi.fn().mockResolvedValue(canceledAutoBid),
          },
        };
        return await callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await cancelAutoBid(longAuctionId);

      // Assert
      expect(result.success).toBe(true);
      expect(mockValidateAuction).toHaveBeenCalledWith(longAuctionId, expect.any(Object));
    });
  });
});
