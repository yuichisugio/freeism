import type { Prisma } from "@prisma/client";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
// Prismaモックのインポート
import { prismaMock } from "@/test/setup/prisma-orm-setup";
// テストユーティリティのインポート
import { autoBidFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { AuctionEventType, NotificationSendMethod, NotificationSendTiming, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ProcessAutoBidParams } from "./auto-bid";
import { cancelAutoBid, getAutoBidByUserId, processAutoBid, setAutoBid } from "./auto-bid";
// モック関数の取得
import { executeBid, validateAuction } from "./bid-common";

// bid-commonモジュールのモック
vi.mock("./bid-common", () => ({
  validateAuction: vi.fn(),
  executeBid: vi.fn(),
  __esModule: true,
}));

// sendAuctionNotificationのモック
vi.mock("@/lib/actions/notification/auction-notification", () => ({
  sendAuctionNotification: vi.fn(),
  __esModule: true,
}));

// テスト対象の関数をインポート

const mockValidateAuction = vi.mocked(validateAuction);
const mockExecuteBid = vi.mocked(executeBid);
const mockSendAuctionNotification = vi.mocked(sendAuctionNotification);

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAuction.mockReset();
  mockExecuteBid.mockReset();
  mockSendAuctionNotification.mockReset();
});

// テストデータの定義
const testAuctionId = "test-auction-id";
const testUserId = "test-user-id";
const testUserId2 = "test-user-id-2";
const testTaskId = "test-task-id";

// バリデーション成功時のレスポンス
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
  session: null,
};

describe("auto-bid", () => {
  // processAutoBidのテスト
  describe("processAutoBid", () => {
    test("should return success when no auto bids exist", async () => {
      // Arrange
      const params: ProcessAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      prismaMock.autoBid.findMany.mockResolvedValue([]);

      // Act
      const result = await processAutoBid(params);

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
      const params: ProcessAutoBidParams = {
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
      const result = await processAutoBid(params);

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
      const params: ProcessAutoBidParams = {
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
      const result = await processAutoBid(params);

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
      const params: ProcessAutoBidParams = {
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
      const result = await processAutoBid(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 200, true); // 上限額に制限
    });

    test("should deactivate auto bid and send notification when bid reaches max amount", async () => {
      // Arrange
      const params: ProcessAutoBidParams = {
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
      const result = await processAutoBid(params);

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
      const params: ProcessAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: false,
        paramsValidationResult: null,
      };

      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションが見つかりません",
        userId: null,
        auction: null,
        session: null,
      });

      // Act
      const result = await processAutoBid(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "オークションが見つかりません",
        autoBid: null,
      });
    });

    test("should return error when executeBid fails", async () => {
      // Arrange
      const params: ProcessAutoBidParams = {
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

      // Act
      const result = await processAutoBid(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "入札に失敗しました",
        autoBid: null,
      });
    });

    test("should handle exception and return error", async () => {
      // Arrange
      const params: ProcessAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      prismaMock.autoBid.findMany.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await processAutoBid(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "自動入札処理でエラーが発生しました",
        autoBid: null,
      });
    });

    test("should exclude current highest bidder from auto bid search", async () => {
      // Arrange
      const params: ProcessAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: null, // 最高入札者がいない場合
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      prismaMock.autoBid.findMany.mockResolvedValue([]);

      // Act
      await processAutoBid(params);

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

  // setAutoBidのテスト
  describe("setAutoBid", () => {
    test("should create new auto bid when no existing auto bid", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      const mockAutoBid = autoBidFactory.build({
        id: "new-auto-bid",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 200,
        bidIncrement: 10,
      });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          autoBid: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockAutoBid),
            update: vi.fn(),
          },
        };
        return await callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札を設定しました",
        autoBid: {
          id: mockAutoBid.id,
          maxBidAmount: mockAutoBid.maxBidAmount,
          bidIncrement: mockAutoBid.bidIncrement,
        },
      });
    });

    test("should update existing auto bid", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      const existingAutoBid = autoBidFactory.build({
        id: "existing-auto-bid",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 150,
        bidIncrement: 5,
      });

      const updatedAutoBid = autoBidFactory.build({
        id: "existing-auto-bid",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 200,
        bidIncrement: 10,
      });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          autoBid: {
            findFirst: vi.fn().mockResolvedValue(existingAutoBid),
            create: vi.fn(),
            update: vi.fn().mockResolvedValue(updatedAutoBid),
          },
        };
        return await callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札を設定しました",
        autoBid: {
          id: updatedAutoBid.id,
          maxBidAmount: updatedAutoBid.maxBidAmount,
          bidIncrement: updatedAutoBid.bidIncrement,
        },
      });
    });

    test("should return error when validation fails", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションが見つかりません",
        userId: null,
        auction: null,
        session: null,
      });

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "オークションが見つかりません",
        autoBid: null,
      });
    });

    test("should return error when auction data is null", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        userId: testUserId,
        auction: null,
        session: null,
      });

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "オークション情報が取得できませんでした",
        autoBid: null,
      });
    });

    test("should return error when max bid amount is not higher than current highest bid", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      // Act
      const result = await setAutoBid(testAuctionId, 100, 10); // 現在の最高入札額と同じ

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "最大入札額は現在の最高入札額より高く設定してください",
        autoBid: null,
      });
    });

    test("should return error when bid increment is less than 1", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      // Act
      const result = await setAutoBid(testAuctionId, 200, 0);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "入札単位は1以上の整数で設定してください",
        autoBid: null,
      });
    });

    test("should handle exception and return error", async () => {
      // Arrange
      mockValidateAuction.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "自動入札の設定中にエラーが発生しました",
        autoBid: null,
      });
    });
  });

  // getAutoBidByUserIdのテスト
  describe("getAutoBidByUserId", () => {
    test("should return auto bid when found", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 200,
        bidIncrement: 10,
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

    test("should return error when validation fails", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "認証が必要です",
        userId: null,
        auction: null,
        session: null,
      });

      // Act
      const result = await getAutoBidByUserId(testAuctionId, 100);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "認証が必要です",
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
  });

  // cancelAutoBidのテスト
  describe("cancelAutoBid", () => {
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
    });

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
        userId: null,
        auction: null,
        session: null,
      });

      // Act
      const result = await cancelAutoBid(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "認証が必要です",
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
  });

  // 境界値テスト
  describe("boundary value tests", () => {
    test("should handle zero current highest bid in processAutoBid", async () => {
      // Arrange
      const params: ProcessAutoBidParams = {
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
      const result = await processAutoBid(params);

      // Assert
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 1, true); // 0 + 1
      expect(result.success).toBe(true);
    });

    test("should handle minimum bid increment in setAutoBid", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 101,
        bidIncrement: 1,
      });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          autoBid: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockAutoBid),
            update: vi.fn(),
          },
        };
        return await callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await setAutoBid(testAuctionId, 101, 1);

      // Assert
      expect(result.success).toBe(true);
      expect(result.autoBid?.bidIncrement).toBe(1);
    });

    test("should handle large bid amounts", async () => {
      // Arrange
      const largeBidAmount = 999999999;
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: largeBidAmount,
        bidIncrement: 1000,
      });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          autoBid: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockAutoBid),
            update: vi.fn(),
          },
        };
        return await callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await setAutoBid(testAuctionId, largeBidAmount, 1000);

      // Assert
      expect(result.success).toBe(true);
      expect(result.autoBid?.maxBidAmount).toBe(largeBidAmount);
    });
  });

  // 異常系テスト（不正な引数）
  describe("invalid input tests", () => {
    test("should handle undefined auctionId in processAutoBid", async () => {
      // Arrange
      const params: ProcessAutoBidParams = {
        auctionId: undefined as unknown as string,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: false,
        paramsValidationResult: null,
      };

      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションIDが無効です",
        userId: null,
        auction: null,
        session: null,
      });

      // Act
      const result = await processAutoBid(params);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("オークションIDが無効です");
    });

    test("should handle negative bid increment in setAutoBid", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      // Act
      const result = await setAutoBid(testAuctionId, 200, -5);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "入札単位は1以上の整数で設定してください",
        autoBid: null,
      });
    });

    test("should handle negative max bid amount in setAutoBid", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      // Act
      const result = await setAutoBid(testAuctionId, -100, 10);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "最大入札額は現在の最高入札額より高く設定してください",
        autoBid: null,
      });
    });

    test("should handle empty string auctionId in setAutoBid", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションIDが無効です",
        userId: null,
        auction: null,
        session: null,
      });

      // Act
      const result = await setAutoBid("", 200, 10);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});
