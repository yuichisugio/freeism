import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { autoBidFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { AuctionEventType, NotificationSendMethod, NotificationSendTiming, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ExecuteAutoBidParams } from "./auto-bid";
import { executeBid } from "../bid-common";
import { validateAuction } from "../bid-validation";
import { executeAutoBid } from "./auto-bid";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の定義
 */
// bid-commonモジュールのモック
vi.mock("../bid-common", () => ({
  executeBid: vi.fn(),
  __esModule: true,
}));

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
const mockExecuteBid = vi.mocked(executeBid);
const mockSendAuctionNotification = vi.mocked(sendAuctionNotification);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAuction.mockReset();
  mockExecuteBid.mockReset();
  mockSendAuctionNotification.mockReset();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの定義
 */
const testAuctionId = "test-auction-id";
const testUserId = "test-user-id";
const testUserId2 = "test-user-id-2";
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
describe("auto-bid", () => {
  describe("executeAutoBid", () => {
    test("should return success when no auto bids exist", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      prismaMock.autoBid.findMany.mockResolvedValue([]);

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札がありません",
        autoBid: null,
      });
      expect(prismaMock.autoBid.findMany).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          maxBidAmount: { gt: 100 },
          userId: { not: testUserId },
          isActive: true,
        },
        select: {
          id: true,
          maxBidAmount: true,
          bidIncrement: true,
          userId: true,
        },
        orderBy: [{ maxBidAmount: "desc" }, { createdAt: "asc" }],
      });
    });

    test("should execute auto bid when single auto bid exists", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: 200,
        bidIncrement: 10,
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid]);
      mockExecuteBid.mockResolvedValue({ success: true, message: "入札成功" });

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札が完了しました",
        autoBid: {
          id: mockAutoBid.id,
          maxBidAmount: mockAutoBid.maxBidAmount,
          bidIncrement: mockAutoBid.bidIncrement,
        },
      });
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 110, true); // 100 + 10
    });

    test("should execute auto bid with second highest bid amount when multiple auto bids exist", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid1 = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: 300,
        bidIncrement: 10,
      });

      const mockAutoBid2 = autoBidFactory.build({
        id: "auto-bid-2",
        userId: "user-3",
        maxBidAmount: 200,
        bidIncrement: 5,
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid1, mockAutoBid2]);
      mockExecuteBid.mockResolvedValue({ success: true, message: "入札成功" });

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札が完了しました",
        autoBid: {
          id: mockAutoBid1.id,
          maxBidAmount: mockAutoBid1.maxBidAmount,
          bidIncrement: mockAutoBid1.bidIncrement,
        },
      });
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 210, true); // 200 + 10
    });

    test("should limit bid amount to max bid amount when calculated amount exceeds it", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 190, // 上限額を超える計算になるように設定
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: 200,
        bidIncrement: 20,
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid]);
      mockExecuteBid.mockResolvedValue({ success: true, message: "入札成功" });

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 200, true); // 上限額に制限
    });

    test("should deactivate auto bid and send notification when bid reaches max amount", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 180, // 上限額に達するように設定
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: 200,
        bidIncrement: 20,
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid]);
      mockExecuteBid.mockResolvedValue({ success: true, message: "入札成功" });
      prismaMock.autoBid.update.mockResolvedValue(mockAutoBid);
      mockSendAuctionNotification.mockResolvedValue({ success: true });

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result.success).toBe(true);
      expect(prismaMock.autoBid.update).toHaveBeenCalledWith({
        where: { id: mockAutoBid.id },
        data: { isActive: false },
      });
      expect(mockSendAuctionNotification).toHaveBeenCalledWith({
        text: {
          first: "テストタスク",
          second: "200",
        },
        auctionEventType: AuctionEventType.AUTO_BID_LIMIT_REACHED,
        auctionId: testAuctionId,
        recipientUserId: [testUserId2],
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        actionUrl: `/dashboard/auction/${testTaskId}`,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
      });
    });

    test("should return error when validation fails", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: false,
        paramsValidationResult: null,
      };

      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションが見つかりません",
        userId: "",
        auction: null,
      });

      // Act & Assert
      await expect(executeAutoBid(params)).rejects.toThrow("オークションが見つかりません");
    });

    test("should return error when executeBid fails", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: 200,
        bidIncrement: 10,
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid]);
      mockExecuteBid.mockResolvedValue({ success: false, message: "入札に失敗しました" });

      // Act & Assert
      await expect(executeAutoBid(params)).rejects.toThrow("入札に失敗しました");
    });

    test("should handle exception and return error", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      prismaMock.autoBid.findMany.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(executeAutoBid(params)).rejects.toThrow("自動入札処理でエラーが発生しました: Database error");
    });

    test("should exclude current highest bidder from auto bid search", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: null, // 最高入札者がいない場合
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      prismaMock.autoBid.findMany.mockResolvedValue([]);

      // Act
      await executeAutoBid(params);

      // Assert
      expect(prismaMock.autoBid.findMany).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId,
          maxBidAmount: { gt: 100 },
          isActive: true,
        },
        select: {
          id: true,
          maxBidAmount: true,
          bidIncrement: true,
          userId: true,
        },
        orderBy: [{ maxBidAmount: "desc" }, { createdAt: "asc" }],
      });
    });
  });

  // 境界値テスト
  describe("boundary value tests", () => {
    test("should handle zero current highest bid in executeAutoBid", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 0,
        currentHighestBidderId: null,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: 10,
        bidIncrement: 1,
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid]);
      mockExecuteBid.mockResolvedValue({ success: true, message: "入札成功" });

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 1, true); // 0 + 1
      expect(result.success).toBe(true);
    });

    test("should handle minimum bid increment in executeAutoBid", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 0,
        currentHighestBidderId: null,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: 1,
        bidIncrement: 1,
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid]);
      mockExecuteBid.mockResolvedValue({ success: true, message: "入札成功" });

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 1, true); // 0 + 1
    });

    test("should handle large bid amounts in executeAutoBid", async () => {
      // Arrange
      const largeBidAmount = 999999999;
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: largeBidAmount - 1000,
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: largeBidAmount,
        bidIncrement: 1000,
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid]);
      mockExecuteBid.mockResolvedValue({ success: true, message: "入札成功" });

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, largeBidAmount - 1000 + 1000, true);
    });
  });

  // 異常系テスト（不正な引数）
  describe("invalid input tests", () => {
    test("should handle undefined auctionId in executeAutoBid", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: undefined as unknown as string,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: false,
        paramsValidationResult: null,
      };

      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションIDが無効です",
        userId: "",
        auction: null,
      });

      // Act & Assert
      await expect(executeAutoBid(params)).rejects.toThrow("オークションIDが無効です");
    });

    test("should handle negative bid increment in executeAutoBid", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: 200,
        bidIncrement: -5, // 負の値でもテスト
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid]);
      mockExecuteBid.mockResolvedValue({ success: true, message: "入札成功" });

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 95, true); // 100 + (-5)
    });

    test("should handle very small max bid amount in executeAutoBid", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: 50, // 現在の入札額より低い上限額
        bidIncrement: 10,
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid]);
      mockExecuteBid.mockResolvedValue({ success: true, message: "入札成功" });

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 50, true); // 上限額に制限
    });

    test("should handle null auctionId in executeAutoBid", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: null as unknown as string,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: false,
        paramsValidationResult: null,
      };

      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションIDが無効です",
        userId: "",
        auction: null,
      });

      // Act & Assert
      await expect(executeAutoBid(params)).rejects.toThrow("オークションIDが無効です");
    });
  });
});
