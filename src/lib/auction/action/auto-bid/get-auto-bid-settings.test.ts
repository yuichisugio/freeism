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
        message: "自動入札設定が見つかりませんでした",
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

    test("should handle exception and return error message", async () => {
      // Arrange
      mockValidateAuction.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "Database error",
        autoBid: null,
      });
    });

    test("should handle prisma exception and return error message", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);
      prismaMock.autoBid.findFirst.mockRejectedValue(new Error("Prisma error"));

      // Act
      const result = await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "Prisma error",
        autoBid: null,
      });
    });

    test.each([
      {
        description: "空文字のauctionId",
        auctionId: "",
        currentHighestBid: 100,
        expectedMessage: "オークションIDまたは現在の最高入札額が無効です",
      },
      {
        description: "nullのauctionId",
        auctionId: null as unknown as string,
        currentHighestBid: 100,
        expectedMessage: "オークションIDまたは現在の最高入札額が無効です",
      },
      {
        description: "0のcurrentHighestBid",
        auctionId: testAuctionId,
        currentHighestBid: 0,
        expectedMessage: "オークションIDまたは現在の最高入札額が無効です",
      },
      {
        description: "undefinedのcurrentHighestBid",
        auctionId: testAuctionId,
        currentHighestBid: undefined as unknown as number,
        expectedMessage: "オークションIDまたは現在の最高入札額が無効です",
      },
      {
        description: "負の値のcurrentHighestBid",
        auctionId: testAuctionId,
        currentHighestBid: -100,
        expectedMessage: "オークションIDまたは現在の最高入札額が無効です",
      },
    ])("should handle invalid auctionId or currentHighestBid", async ({ auctionId, currentHighestBid, expectedMessage }) => {
      // Act
      const result = await getAutoBidByUserId(auctionId, currentHighestBid);
      expect(result).toStrictEqual({
        success: false,
        message: expectedMessage,
        autoBid: null,
      });

      // Assert
      expect(prismaMock.autoBid.findFirst).not.toHaveBeenCalled();
    });
  });
});
