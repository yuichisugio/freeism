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
vi.mock("@/actions/notification/auction-notification", () => ({
  sendAuctionNotification: vi.fn(),
  __esModule: true,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト対象の関数をインポート
 */
const mockValidateAuction = vi.mocked(validateAuction);
const mockExecuteAutoBid = vi.mocked(executeAutoBid);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAuction.mockReset();
  mockExecuteAutoBid.mockReset();
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
 * 共通のヘルパー関数
 * 期待される失敗レスポンスを生成する
 * @param message エラーメッセージ
 * @returns 期待される失敗レスポンス
 */
function createExpectedErrorResponse(message: string) {
  return {
    success: false,
    message,
    data: null,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストの実行
 */
describe("setAutoBid", () => {
  describe("正常系", () => {
    test.each([
      {
        description: "新規自動入札設定",
        maxBidAmount: 200,
        bidIncrement: 10,
        autoBidId: "new-auto-bid",
      },
      {
        description: "既存自動入札更新",
        maxBidAmount: 300,
        bidIncrement: 15,
        autoBidId: "existing-auto-bid",
      },
      {
        description: "最小有効入札単位(1)",
        maxBidAmount: 200,
        bidIncrement: 1,
        autoBidId: "min-increment-auto-bid",
      },
      {
        description: "最小有効上限入札額(現在の最高入札額+1)",
        maxBidAmount: 101,
        bidIncrement: 10,
        autoBidId: "min-amount-auto-bid",
      },
      {
        description: "大きな入札額",
        maxBidAmount: 999999999,
        bidIncrement: 1000,
        autoBidId: "large-amount-auto-bid",
      },
    ])("should successfully set auto bid - $description", async ({ maxBidAmount, bidIncrement, autoBidId }) => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        data: mockValidationSuccess,
      });

      const mockAutoBid = autoBidFactory.build({
        id: autoBidId,
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount,
        bidIncrement,
      });

      prismaMock.autoBid.upsert.mockResolvedValue(mockAutoBid);

      mockExecuteAutoBid.mockResolvedValue({
        success: true,
        message: "自動入札が完了しました",
        data: {
          id: mockAutoBid.id,
          maxBidAmount: mockAutoBid.maxBidAmount,
          bidIncrement: mockAutoBid.bidIncrement,
        },
      });

      // Act
      const result = await setAutoBid(testAuctionId, maxBidAmount, bidIncrement);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札を設定しました",
        data: {
          id: autoBidId,
          maxBidAmount,
          bidIncrement,
        },
      });
      expect(mockExecuteAutoBid).toHaveBeenCalledWith({
        auctionId: testAuctionId,
        currentHighestBid: mockValidationSuccess.auction.currentHighestBid,
        currentHighestBidderId: mockValidationSuccess.auction.currentHighestBidderId,
        validationDone: true,
        paramsValidationResult: mockValidationSuccess,
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

      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        data: mockValidationWithSameUser,
      });

      const mockAutoBid = autoBidFactory.build({
        id: "same-user-auto-bid",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 200,
        bidIncrement: 10,
      });

      prismaMock.autoBid.upsert.mockResolvedValue(mockAutoBid);

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札を設定しました",
        data: {
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
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        data: mockValidationSuccess,
      });

      const mockAutoBid = autoBidFactory.build({
        id: "error-handling-auto-bid",
        userId: testUserId,
        auctionId: testAuctionId,
        maxBidAmount: 200,
        bidIncrement: 10,
      });

      prismaMock.autoBid.upsert.mockResolvedValue(mockAutoBid);

      // executeAutoBidでエラーが発生する場合
      mockExecuteAutoBid.mockRejectedValue(new Error("Auto bid execution failed"));

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      // 自動入札処理でエラーが発生しても設定自体は成功している
      expect(result).toStrictEqual({
        success: true,
        message: "自動入札を設定しました",
        data: {
          id: mockAutoBid.id,
          maxBidAmount: mockAutoBid.maxBidAmount,
          bidIncrement: mockAutoBid.bidIncrement,
        },
      });
    });
  });

  describe("異常系", () => {
    test.each([
      {
        description: "入札単位が負の値",
        maxBidAmount: 200,
        bidIncrement: -5,
        expectedMessage: "入札単位・上限入札額は1以上の整数で設定してください",
      },
      {
        description: "入札単位がゼロ",
        maxBidAmount: 200,
        bidIncrement: 0,
        expectedMessage: "入札単位・上限入札額は1以上の整数で設定してください",
      },
      {
        description: "上限入札額が負の値",
        maxBidAmount: -100,
        bidIncrement: 10,
        expectedMessage: "入札単位・上限入札額は1以上の整数で設定してください",
      },
      {
        description: "上限入札額がゼロ",
        maxBidAmount: 0,
        bidIncrement: 10,
        expectedMessage: "入札単位・上限入札額は1以上の整数で設定してください",
      },
    ])(
      "should return error for invalid parameters - $description",
      async ({ maxBidAmount, bidIncrement, expectedMessage }) => {
        // Arrange
        mockValidateAuction.mockResolvedValue({
          success: true,
          message: "検証成功",
          data: mockValidationSuccess,
        });

        // Act
        const result = await setAutoBid(testAuctionId, maxBidAmount, bidIncrement);

        // Assert
        expect(result).toStrictEqual(createExpectedErrorResponse(expectedMessage));
      },
    );

    test.each([
      {
        description: "上限入札額が現在の最高入札額より低い",
        maxBidAmount: 50,
        expectedMessage: "最大入札額は現在の最高入札額より高く設定してください",
      },
      {
        description: "上限入札額が現在の最高入札額と同じ",
        maxBidAmount: 100,
        expectedMessage: "最大入札額は現在の最高入札額より高く設定してください",
      },
    ])("should return error for invalid max bid amount - $description", async ({ maxBidAmount, expectedMessage }) => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        data: mockValidationSuccess,
      });

      // Act
      const result = await setAutoBid(testAuctionId, maxBidAmount, 10);

      // Assert
      expect(result).toStrictEqual(createExpectedErrorResponse(expectedMessage));
    });

    test.each([
      {
        description: "バリデーション失敗",
        validationResponse: {
          success: false,
          message: "オークションが見つかりません",
          userId: "",
          auction: null,
        },
        expectedMessage: "オークションが見つかりません",
      },
      {
        description: "ユーザーIDが空",
        validationResponse: {
          success: true,
          message: "検証成功",
          userId: "",
          auction: mockValidationSuccess.auction,
        },
        expectedMessage: "検証成功",
      },
      {
        description: "オークション情報がnull",
        validationResponse: {
          success: true,
          message: "検証成功",
          userId: testUserId,
          auction: null,
        },
        expectedMessage: "オークション情報が取得できませんでした",
      },
      {
        description: "メッセージが空文字の場合",
        validationResponse: {
          success: false,
          message: "",
          userId: testUserId,
          auction: null,
        },
        expectedMessage: "検証エラー",
      },
    ])("should handle validation errors - $description", async ({ validationResponse, expectedMessage }) => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: validationResponse.success,
        message: validationResponse.message,
        data: {
          userId: validationResponse.userId,
          auction: validationResponse.auction,
        },
      });

      // Act
      const result = await setAutoBid(testAuctionId, 200, 10);

      // Assert
      expect(result).toStrictEqual(createExpectedErrorResponse(expectedMessage));
    });

    test("should handle validation exception", async () => {
      // Arrange
      mockValidateAuction.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(setAutoBid(testAuctionId, 200, 10)).rejects.toThrow("Database error");
    });

    test("should handle database transaction error", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        data: mockValidationSuccess,
      });
      prismaMock.autoBid.upsert.mockRejectedValue(new Error("Transaction failed"));

      // Act & Assert
      await expect(setAutoBid(testAuctionId, 200, 10)).rejects.toThrow("Transaction failed");
    });

    test("should handle empty auction ID", async () => {
      // Arrange
      mockValidateAuction.mockResolvedValue({
        success: true,
        message: "検証成功",
        data: mockValidationSuccess,
      });

      // Act
      const result = await setAutoBid("", 200, 10);

      // Assert
      expect(result).toStrictEqual(createExpectedErrorResponse("オークションIDが無効です"));
    });
  });
});
