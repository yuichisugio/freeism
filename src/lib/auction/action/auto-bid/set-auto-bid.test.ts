import type { Prisma } from "@prisma/client";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { autoBidFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { validateAuction } from "../bid-validation";
import { executeAutoBid } from "./auto-bid";
import { setAutoBid } from "./set-auto-bid";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の定義
 */
// bid-validationモジュールのモック
vi.mock("../bid-validation", () => ({
  validateAuction: vi.fn(),
  __esModule: true,
}));

// auto-bidモジュールのモック
vi.mock("./auto-bid", () => ({
  executeAutoBid: vi.fn(),
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
const mockExecuteAutoBid = vi.mocked(executeAutoBid);
const mockSendAuctionNotification = vi.mocked(sendAuctionNotification);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAuction.mockReset();
  mockExecuteAutoBid.mockReset();
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
    currentHighestBidderId: "other-user-id",
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
describe("setAutoBid", () => {
  describe("正常系", () => {
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

      mockExecuteAutoBid.mockResolvedValue({
        success: true,
        message: "自動入札が完了しました",
        autoBid: {
          id: mockAutoBid.id,
          maxBidAmount: mockAutoBid.maxBidAmount,
          bidIncrement: mockAutoBid.bidIncrement,
        },
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

      mockExecuteAutoBid.mockResolvedValue({
        success: true,
        message: "自動入札が完了しました",
        autoBid: {
          id: updatedAutoBid.id,
          maxBidAmount: updatedAutoBid.maxBidAmount,
          bidIncrement: updatedAutoBid.bidIncrement,
        },
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

    test("should not execute auto bid when current highest bidder is the same user", async () => {
      // Arrange
      const mockValidationWithSameUser = {
        ...mockValidationSuccess,
        auction: {
          ...mockValidationSuccess.auction,
          currentHighestBidderId: testUserId, // 同じユーザーが最高入札者
        },
      };

      mockValidateAuction.mockResolvedValue(mockValidationWithSameUser);

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

      // executeAutoBidが呼ばれていないことを確認
      expect(mockExecuteAutoBid).not.toHaveBeenCalled();
    });

    test("should handle auto bid execution error gracefully", async () => {
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

      // executeAutoBidでエラーが発生する場合
      mockExecuteAutoBid.mockRejectedValue(new Error("Auto bid execution failed"));

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      // 自動入札処理でエラーが発生しても設定自体は成功している
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
  });

  describe("異常系", () => {
    test("should return error when validation fails", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: false,
        message: "オークションが見つかりません",
        userId: "",
        auction: null,
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

    test("should return error when validation success but userId is empty", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        userId: "", // userIdが空文字
        auction: mockValidationSuccess.auction,
      });

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "検証成功",
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

    test("should return error when max bid amount is equal to current highest bid", async () => {
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

    test("should return error when max bid amount is lower than current highest bid", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      // Act
      const result = await setAutoBid(testAuctionId, 50, 10); // 現在の最高入札額より低い

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "最大入札額は現在の最高入札額より高く設定してください",
        autoBid: null,
      });
    });

    test("should return error when bid increment is zero", async () => {
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

    test("should return error when bid increment is negative", async () => {
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

    test("should handle validation exception and return error", async () => {
      // Arrange
      mockValidateAuction.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "Database error",
        autoBid: null,
      });
    });

    test("should handle transaction error", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      // トランザクションでエラーが発生する場合
      prismaMock.$transaction.mockRejectedValue(new Error("Transaction failed"));

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "Transaction failed",
        autoBid: null,
      });
    });
  });

  describe("境界値テスト", () => {
    test("should handle minimum valid bid increment (1)", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      const mockAutoBid = autoBidFactory.build({
        id: "new-auto-bid",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 200,
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

      mockExecuteAutoBid.mockResolvedValue({
        success: true,
        message: "自動入札が完了しました",
        autoBid: {
          id: mockAutoBid.id,
          maxBidAmount: mockAutoBid.maxBidAmount,
          bidIncrement: mockAutoBid.bidIncrement,
        },
      });

      // Act
      const result = await setAutoBid(testAuctionId, 200, 1);

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

    test("should handle minimum valid max bid amount (current highest bid + 1)", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      const mockAutoBid = autoBidFactory.build({
        id: "new-auto-bid",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 101, // 現在の最高入札額(100) + 1
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

      mockExecuteAutoBid.mockResolvedValue({
        success: true,
        message: "自動入札が完了しました",
        autoBid: {
          id: mockAutoBid.id,
          maxBidAmount: mockAutoBid.maxBidAmount,
          bidIncrement: mockAutoBid.bidIncrement,
        },
      });

      // Act
      const result = await setAutoBid(testAuctionId, 101, 10);

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

    test("should handle large bid amounts", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      const mockAutoBid = autoBidFactory.build({
        id: "new-auto-bid",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 999999999, // 大きな値
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

      mockExecuteAutoBid.mockResolvedValue({
        success: true,
        message: "自動入札が完了しました",
        autoBid: {
          id: mockAutoBid.id,
          maxBidAmount: mockAutoBid.maxBidAmount,
          bidIncrement: mockAutoBid.bidIncrement,
        },
      });

      // Act
      const result = await setAutoBid(testAuctionId, 999999999, 1000);

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
  });

  describe("パラメータ化テスト", () => {
    test.each([
      {
        description: "オークションが見つからない場合",
        validationResponse: {
          success: false,
          message: "オークションが見つかりません",
          userId: "",
          auction: null,
        },
        expected: {
          success: false,
          message: "オークションが見つかりません",
          autoBid: null,
        },
      },
      {
        description: "自分の出品に対する操作の場合",
        validationResponse: {
          success: false,
          message: "自分の出品に対して操作はできません",
          userId: testUserId,
          auction: null,
        },
        expected: {
          success: false,
          message: "自分の出品に対して操作はできません",
          autoBid: null,
        },
      },
      {
        description: "オークション終了の場合",
        validationResponse: {
          success: false,
          message: "このオークションは終了しています",
          userId: testUserId,
          auction: null,
        },
        expected: {
          success: false,
          message: "このオークションは終了しています",
          autoBid: null,
        },
      },
      {
        description: "非アクティブオークションの場合",
        validationResponse: {
          success: false,
          message: "このオークションはアクティブではありません",
          userId: testUserId,
          auction: null,
        },
        expected: {
          success: false,
          message: "このオークションはアクティブではありません",
          autoBid: null,
        },
      },
      {
        description: "メッセージが空文字の場合",
        validationResponse: {
          success: false,
          message: "",
          userId: testUserId,
          auction: null,
        },
        expected: {
          success: false,
          message: "検証エラー",
          autoBid: null,
        },
      },
    ])("should handle validation failure - $description", async ({ validationResponse, expected }) => {
      // Arrange
      mockValidateAuction.mockResolvedValue(validationResponse);

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      expect(result).toStrictEqual(expected);
    });

    test.each([
      { bidIncrement: -10, description: "負の値" },
      { bidIncrement: -1, description: "マイナス1" },
      { bidIncrement: 0, description: "ゼロ" },
      { bidIncrement: 0.5, description: "小数点" },
    ])("should return error for invalid bid increment - $description", async ({ bidIncrement }) => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      // Act
      const result = await setAutoBid(testAuctionId, 200, bidIncrement);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "入札単位は1以上の整数で設定してください",
        autoBid: null,
      });
    });

    test.each([
      { maxBidAmount: 50, description: "現在の最高入札額より低い" },
      { maxBidAmount: 100, description: "現在の最高入札額と同じ" },
      { maxBidAmount: 99, description: "現在の最高入札額より1低い" },
    ])("should return error for invalid max bid amount - $description", async ({ maxBidAmount }) => {
      // Arrange
      mockValidateAuction.mockResolvedValue(mockValidationSuccess);

      // Act
      const result = await setAutoBid(testAuctionId, maxBidAmount, 10);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "最大入札額は現在の最高入札額より高く設定してください",
        autoBid: null,
      });
    });
  });
});
