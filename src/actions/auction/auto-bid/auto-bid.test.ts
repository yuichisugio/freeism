import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { autoBidFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { AuctionEventType, NotificationSendMethod, NotificationSendTiming, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ExecuteAutoBidParams } from "./auto-bid";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の定義
 */
const mockExecuteBid = vi.fn();
const mockValidateAuction = vi.fn();
const mockSendAuctionNotification = vi.fn();

// モジュールのモック設定
vi.mock("../bid/bid-common", () => ({
  executeBid: mockExecuteBid,
  __esModule: true,
}));

vi.mock("../bid-validation", () => ({
  validateAuction: mockValidateAuction,
  __esModule: true,
}));

vi.mock("@/actions/notification/auction-notification", () => ({
  sendAuctionNotification: mockSendAuctionNotification,
  __esModule: true,
}));

// テスト対象関数をimport（mockの後に実行）
const { executeAutoBid } = await import("./auto-bid");

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
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
describe("auto-bid_executeAutoBid", () => {
  describe("正常系", () => {
    test("(no auto bids)should return success", async () => {
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
        message: "自動入札の設定はありません。処理をスキップします",
        autoBid: null,
      });
    });

    test("(single auto bid)should execute auto bid", async () => {
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

      // 100 + 10 = 110pointを入札
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 110, true, testUserId2);

      // 現在の最高入札額より高い設定を取得できるフィルターになっているか確認
      expect(prismaMock.autoBid.findMany).toHaveBeenCalledWith({
        where: {
          auctionId: testAuctionId, // オークションID
          maxBidAmount: { gt: 100 }, // 現在の最高入札額より高い設定
          ...(testUserId ? { userId: { not: testUserId } } : {}), // 現在の最高入札者の自動入札は除外して取得
          isActive: true, // 有効な自動入札設定
        },
        select: {
          id: true,
          maxBidAmount: true,
          bidIncrement: true,
          userId: true,
        },
        orderBy: [
          { maxBidAmount: "desc" }, // 上限額の降順で取得
          { createdAt: "asc" }, // 同額の場合は先に設定したものを優先
        ],
      });
    });

    test("(multiple auto bids)should execute auto bid with second highest bid amount", async () => {
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
      mockExecuteBid.mockImplementation(async () => ({ success: true, message: "入札成功" }));

      // Act
      const result = await executeAutoBid(params);

      // Assert
      // 戻り値
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札が完了しました",
        autoBid: {
          id: mockAutoBid1.id,
          maxBidAmount: mockAutoBid1.maxBidAmount,
          bidIncrement: mockAutoBid1.bidIncrement,
        },
      });
      // 入札額。200+10=210point(2番目の方に、最高額設定者のbidIncrementを足した額)を入札
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 210, true, testUserId2);
    });

    test("(single auto bid)should limit bid amount to max bid amount when calculated amount exceeds it", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 190, // 上限額(maxBidAmount)を超える計算になるように設定
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
      mockExecuteBid.mockImplementation(async () => ({ success: true, message: "入札成功" }));

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
      // 上限額に制限
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 200, true, testUserId2);
    });

    test("(multiple auto bids)should limit bid amount to max bid amount when calculated amount exceeds it", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 180, // 上限額(maxBidAmount)を超える計算になるように設定
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid1 = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: 200,
        bidIncrement: 50,
      });

      const mockAutoBid2 = autoBidFactory.build({
        id: "auto-bid-2",
        userId: "user-3",
        maxBidAmount: 190,
        bidIncrement: 10,
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid1, mockAutoBid2]);
      mockExecuteBid.mockImplementation(async () => ({ success: true, message: "入札成功" }));

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
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 200, true, testUserId2); // 上限額に制限
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
      mockExecuteBid.mockImplementation(async () => ({ success: true, message: "入札成功" }));
      prismaMock.autoBid.update.mockResolvedValue(mockAutoBid);
      mockSendAuctionNotification.mockImplementation(async () => ({ success: true }));

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

    test("(currentHighestBidderId is null)should return success", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: null, // 入札者が最高入札者の場合
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      prismaMock.autoBid.findMany.mockResolvedValue([]);

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札の設定はありません。処理をスキップします",
        autoBid: null,
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("(executeBid fails)should return error", async () => {
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
      mockExecuteBid.mockImplementation(async () => ({ success: false, message: "入札に失敗しました" }));

      // Act & Assert
      await expect(executeAutoBid(params)).rejects.toThrow("入札に失敗しました");
    });

    // もしautoBidの関数がバグって、現在の最高入札額より低い自動入札の設定を取得してしまっていた場合でも、エラーを出せるか確認
    test("(maxBidAmount is very small)should return error", async () => {
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

      // Act & Assert
      await expect(executeAutoBid(params)).rejects.toThrow("現在の最高入札額より高い自動入札の設定がありません");
    });

    test("(auctionId is undefined)should return error", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: undefined as unknown as string,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: false,
        paramsValidationResult: null,
      };

      mockValidateAuction.mockImplementation(async () => ({
        success: false,
        message: "オークションIDが無効です",
        userId: "",
        auction: null,
      }));

      // Act & Assert
      await expect(executeAutoBid(params)).rejects.toThrow("オークションIDが無効です");
    });

    test("(bidIncrement is negative)should return error", async () => {
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

      // Act & Assert
      await expect(executeAutoBid(params)).rejects.toThrow("現在の最高入札額が0以下か、入札単位が0以下です");
    });

    test("(currentHighestBid is negative)should return error", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: testAuctionId,
        currentHighestBid: -100,
        currentHighestBidderId: testUserId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
      };

      const mockAutoBid = autoBidFactory.build({
        id: "auto-bid-1",
        userId: testUserId2,
        maxBidAmount: 200,
        bidIncrement: 5, // 負の値でもテスト
      });

      prismaMock.autoBid.findMany.mockResolvedValue([mockAutoBid]);

      // Act & Assert
      await expect(executeAutoBid(params)).rejects.toThrow("現在の最高入札額が0以下か、入札単位が0以下です");
    });

    test("(auctionId is null)should return error", async () => {
      // Arrange
      const params: ExecuteAutoBidParams = {
        auctionId: null as unknown as string,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        validationDone: false,
        paramsValidationResult: null,
      };

      mockValidateAuction.mockImplementation(async () => ({
        success: false,
        message: "オークションIDが無効です",
        userId: "",
        auction: null,
      }));

      // Act & Assert
      await expect(executeAutoBid(params)).rejects.toThrow("オークションIDが無効です");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("(currentHighestBid is 0)should return success", async () => {
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
      mockExecuteBid.mockImplementation(async () => ({ success: true, message: "入札成功" }));

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, 1, true, testUserId2); // 0 + 1
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
      mockExecuteBid.mockImplementation(async () => ({ success: true, message: "入札成功" }));

      // Act
      const result = await executeAutoBid(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockExecuteBid).toHaveBeenCalledWith(testAuctionId, largeBidAmount - 1000 + 1000, true, testUserId2);
    });
  });
});
