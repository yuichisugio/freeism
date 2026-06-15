import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { autoBidFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ValidateAuctionResult } from "../bid-validation";
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
describe("cancelAutoBid", () => {
  describe("正常系", () => {
    test("should cancel auto bid successfully", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        data: mockValidationSuccess,
      });

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

      prismaMock.autoBid.update.mockResolvedValue(canceledAutoBid);

      // Act
      const result = await cancelAutoBid(testAuctionId, true);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札を取り消しました",
        data: {
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

      expect(prismaMock.autoBid.update).toHaveBeenCalledWith({
        where: { userId_auctionId: { userId: testUserId, auctionId: testAuctionId } },
        data: { isActive: false },
      });
    });
  });

  describe("異常系", () => {
    test("should return error when validation fails", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "認証が必要です",
        data: null as unknown as ValidateAuctionResult,
      });

      // Act
      const result = await cancelAutoBid(testAuctionId, true);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "認証が必要です",
        data: null,
      });

      // Prismaが呼ばれていないことを確認
      expect(prismaMock.autoBid.update).not.toHaveBeenCalled();
    });

    test("should return error when validation message is null (fallback to default)", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: null as unknown as string, // 型アサーションでnullを渡す
        data: null as unknown as ValidateAuctionResult,
      });

      // Act
      const result = await cancelAutoBid(testAuctionId, true);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "検証エラー",
        data: null,
      });
    });

    test("should return error when validation fails with no userId", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        data: { ...mockValidationSuccess, userId: undefined as unknown as string },
      });

      // Act
      const result = await cancelAutoBid(testAuctionId, true);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "検証成功",
        data: null,
      });
    });

    test("should handle database error", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        data: mockValidationSuccess,
      });
      prismaMock.autoBid.update.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      try {
        await cancelAutoBid(testAuctionId, true);
        expect.fail("Expected function to throw error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Database error");
      }
    });

    test("should handle unknown error", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        data: mockValidationSuccess,
      });
      prismaMock.autoBid.update.mockRejectedValue("Unknown error");

      // Act & Assert
      try {
        await cancelAutoBid(testAuctionId, true);
        expect.fail("Expected function to throw error");
      } catch (error) {
        expect(error).toBe("Unknown error");
      }
    });

    test("should handle empty auctionId", async () => {
      // Act & Assert
      try {
        await cancelAutoBid("", true);
        expect.fail("Expected function to throw error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("オークションIDが無効です");
      }

      // バリデーションが呼ばれていないことを確認
      expect(mockValidateAuction).not.toHaveBeenCalled();
    });

    test("should handle false isDisplayAutoBidding", async () => {
      // Act
      const result = await cancelAutoBid(testAuctionId, false);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "自動入札中フラグが無効です",
        data: null,
      });

      // バリデーションが呼ばれていないことを確認
      expect(mockValidateAuction).not.toHaveBeenCalled();
    });
  });
});
