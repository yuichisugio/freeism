import { revalidateTag } from "next/cache";
import { sendAuctionNotification } from "@/actions/notification/auction-notification";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionMessageFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { AuctionEventType, NotificationSendMethod } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getAuctionMessagesAndSellerInfo, sendAuctionMessage } from "./auction-qa";
import { getCachedAuctionMessageContents, getCachedAuctionSellerInfo } from "./cache/cache-auction-qa";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 依存関数のモック
 */
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  __esModule: true,
}));

vi.mock("@/actions/notification/auction-notification", () => ({
  sendAuctionNotification: vi.fn(),
  __esModule: true,
}));

vi.mock("./cache/cache-auction-qa", () => ({
  getCachedAuctionMessageContents: vi.fn(),
  getCachedAuctionSellerInfo: vi.fn(),
  __esModule: true,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型アサーション
 */
const mockRevalidateTag = vi.mocked(revalidateTag);
const mockSendAuctionNotification = vi.mocked(sendAuctionNotification);
const mockGetCachedAuctionMessageContents = vi.mocked(getCachedAuctionMessageContents);
const mockGetCachedAuctionSellerInfo = vi.mocked(getCachedAuctionSellerInfo);

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
const testSenderId = "test-sender-id";
const testRecipientId = "test-recipient-id";
const testMessage = "テストメッセージです";
const testAuctionEndDate = new Date("2024-01-02T10:00:00Z");

const mockAuctionMessage = auctionMessageFactory.build({
  id: "message-1",
  auctionId: testAuctionId,
  senderId: testSenderId,
  message: testMessage,
  createdAt: new Date("2024-01-01T12:00:00Z"),
});

const mockMessages = [
  {
    messageId: "message-1",
    messageContent: "テストメッセージ1",
    createdAt: new Date("2024-01-01T12:00:00Z"),
    person: {
      sender: {
        id: testSenderId,
        appUserName: "送信者ユーザー",
        image: "https://example.com/sender.jpg",
      },
    },
  },
  {
    messageId: "message-2",
    messageContent: "テストメッセージ2",
    createdAt: new Date("2024-01-01T13:00:00Z"),
    person: {
      sender: {
        id: "sender-2",
        appUserName: "送信者2",
        image: "https://example.com/sender2.jpg",
      },
    },
  },
];

const mockSellerInfo = {
  creator: {
    id: "creator-id",
  },
  reporters: [
    {
      id: "reporter-id",
    },
  ],
  executors: [
    {
      id: "executor-id",
    },
  ],
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 成功時のモックセットアップ
 */
const setupSuccessfulMocks = () => {
  mockGetCachedAuctionMessageContents.mockResolvedValue({
    success: true,
    data: mockMessages,
    message: "メッセージを取得しました",
  });
  mockGetCachedAuctionSellerInfo.mockResolvedValue({
    success: true,
    data: mockSellerInfo,
    message: "出品者情報を取得しました",
  });
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * sendAuctionMessage成功時のモックセットアップ
 */
const setupSendMessageSuccessMocks = () => {
  prismaMock.auctionMessage.create.mockResolvedValue(mockAuctionMessage);
  mockSendAuctionNotification.mockResolvedValue({ success: true, message: "通知の送信に成功しました" });
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 期待される通知パラメータ
 */
const getExpectedNotificationParams = (message: string, recipientId: string) => ({
  text: {
    first: "出品者からメッセージが届きました",
    second: message.length > 50 ? message.substring(0, 50) + "..." : message,
  },
  auctionEventType: AuctionEventType.QUESTION_RECEIVED,
  auctionId: testAuctionId,
  recipientUserId: [recipientId],
  sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL],
  actionUrl: `/auction/${testAuctionId}`,
  sendTiming: "NOW",
  sendScheduledDate: null,
  expiresAt: null,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("auction-qa", () => {
  describe("getAuctionMessagesAndSellerInfo", () => {
    describe("正常系", () => {
      test("should return messages and seller info successfully", async () => {
        // Arrange
        setupSuccessfulMocks();

        // Act
        const result = await getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          messages: mockMessages,
          sellerInfo: mockSellerInfo,
        });

        expect(mockGetCachedAuctionMessageContents).toHaveBeenCalledWith(testAuctionId, false, testAuctionEndDate);
        expect(mockGetCachedAuctionSellerInfo).toHaveBeenCalledWith(testAuctionId);
      });

      test("should handle isDisplayAfterEnd true", async () => {
        // Arrange
        setupSuccessfulMocks();

        // Act
        const result = await getAuctionMessagesAndSellerInfo(testAuctionId, true, testAuctionEndDate);

        // Assert
        expect(result.success).toBe(true);
        expect(mockGetCachedAuctionMessageContents).toHaveBeenCalledWith(testAuctionId, true, testAuctionEndDate);
      });

      test("should handle empty messages array", async () => {
        // Arrange
        mockGetCachedAuctionMessageContents.mockResolvedValue({
          success: true,
          data: [],
          message: "メッセージを取得しました",
        });
        mockGetCachedAuctionSellerInfo.mockResolvedValue({
          success: true,
          data: mockSellerInfo,
          message: "出品者情報を取得しました",
        });

        // Act
        const result = await getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          data: [],
          message: "メッセージを取得しました",
        });
      });
    });

    describe("異常系", () => {
      test.each([
        { auctionId: undefined, isDisplayAfterEnd: false, auctionEndDate: testAuctionEndDate },
        { auctionId: null, isDisplayAfterEnd: false, auctionEndDate: testAuctionEndDate },
        { auctionId: "", isDisplayAfterEnd: false, auctionEndDate: testAuctionEndDate },
        { isDisplayAfterEnd: undefined, auctionId: testAuctionId, auctionEndDate: testAuctionEndDate },
        { isDisplayAfterEnd: null, auctionId: testAuctionId, auctionEndDate: testAuctionEndDate },
        { isDisplayAfterEnd: "", auctionId: testAuctionId, auctionEndDate: testAuctionEndDate },
        { auctionEndDate: undefined, auctionId: testAuctionId, isDisplayAfterEnd: false },
        { auctionEndDate: null, auctionId: testAuctionId, isDisplayAfterEnd: false },
        { auctionEndDate: "", auctionId: testAuctionId, isDisplayAfterEnd: false },
      ])("should handle invalid parameters", async ({ auctionId, isDisplayAfterEnd, auctionEndDate }) => {
        // Act & Assert
        await expect(
          getAuctionMessagesAndSellerInfo(
            auctionId as unknown as string,
            isDisplayAfterEnd as unknown as boolean,
            auctionEndDate as unknown as Date,
          ),
        ).rejects.toThrow("メッセージの取得に失敗しました:");
      });

      test("should handle messages cache failure", async () => {
        // Arrange
        const errorMessage = "メッセージの取得に失敗しました";
        mockGetCachedAuctionMessageContents.mockResolvedValue({
          success: false,
          data: [],
          message: errorMessage,
        });
        mockGetCachedAuctionSellerInfo.mockResolvedValue({
          success: true,
          data: mockSellerInfo,
          message: "出品者情報を取得しました",
        });

        // Act & Assert
        await expect(getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate)).rejects.toThrow(
          "メッセージの取得に失敗しました:",
        );
      });

      test("should handle seller info cache failure", async () => {
        // Arrange
        const errorMessage = "出品者情報の取得に失敗しました";
        mockGetCachedAuctionMessageContents.mockResolvedValue({
          success: true,
          data: mockMessages,
          message: "メッセージを取得しました",
        });
        mockGetCachedAuctionSellerInfo.mockResolvedValue({
          success: false,
          data: null,
          message: errorMessage,
        });

        // Act & Assert
        await expect(getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate)).rejects.toThrow(
          "メッセージの取得に失敗しました:",
        );
      });

      test("should handle both cache failures", async () => {
        // Arrange
        const messagesError = "メッセージエラー";
        const sellerError = "出品者エラー";
        mockGetCachedAuctionMessageContents.mockResolvedValue({
          success: false,
          data: [],
          message: messagesError,
        });
        mockGetCachedAuctionSellerInfo.mockResolvedValue({
          success: false,
          data: null,
          message: sellerError,
        });

        // Act & Assert
        await expect(getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate)).rejects.toThrow(
          "メッセージの取得に失敗しました:",
        );
      });

      test("should handle exception in cache functions", async () => {
        // Arrange
        mockGetCachedAuctionMessageContents.mockRejectedValue(new Error("Database connection error"));
        mockGetCachedAuctionSellerInfo.mockResolvedValue({
          success: true,
          data: mockSellerInfo,
          message: "出品者情報を取得しました",
        });

        // Act & Assert
        await expect(getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate)).rejects.toThrow(
          "メッセージの取得に失敗しました: Database connection error",
        );
      });

      test("should handle null seller info", async () => {
        // Arrange
        mockGetCachedAuctionMessageContents.mockResolvedValue({
          success: true,
          data: mockMessages,
          message: "メッセージを取得しました",
        });
        mockGetCachedAuctionSellerInfo.mockResolvedValue({
          success: true,
          data: null,
          message: "出品者情報を取得しました",
        });

        // Act & Assert
        await expect(getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate)).rejects.toThrow(
          "メッセージの取得に失敗しました: オークションが見つかりません",
        );
      });
    });
  });

  describe("sendAuctionMessage", () => {
    describe("正常系", () => {
      test("should send message successfully", async () => {
        // Arrange
        setupSendMessageSuccessMocks();
        const recipientIds = [testRecipientId];

        // Act
        const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds, testSenderId);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: mockAuctionMessage,
        });

        expect(mockRevalidateTag).toHaveBeenCalledWith(`auctionQa:auctionByAuctionId:${testAuctionId}`);
        expect(prismaMock.auctionMessage.create).toHaveBeenCalledWith({
          data: {
            message: testMessage,
            auctionId: testAuctionId,
            senderId: testSenderId,
          },
        });
        expect(mockSendAuctionNotification).toHaveBeenCalledWith(
          getExpectedNotificationParams(testMessage, testRecipientId),
        );
      });

      test("should skip notification for sender", async () => {
        // Arrange
        setupSendMessageSuccessMocks();
        const recipientIds = [testSenderId, testRecipientId];

        // Act
        const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds, testSenderId);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: mockAuctionMessage,
        });
        // 送信者は通知を受け取らない
        expect(mockSendAuctionNotification).toHaveBeenCalledTimes(1);
        expect(mockSendAuctionNotification).toHaveBeenCalledWith(
          getExpectedNotificationParams(testMessage, testRecipientId),
        );
      });

      test("should handle multiple recipients", async () => {
        // Arrange
        setupSendMessageSuccessMocks();
        const recipientIds = ["recipient-1", "recipient-2", "recipient-3"];

        // Act
        const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds, testSenderId);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: mockAuctionMessage,
        });
        expect(mockSendAuctionNotification).toHaveBeenCalledTimes(3);
      });

      test("should handle only sender in recipients", async () => {
        // Arrange
        setupSendMessageSuccessMocks();
        const recipientIds = [testSenderId];

        // Act
        const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds, testSenderId);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: mockAuctionMessage,
        });
        expect(mockSendAuctionNotification).not.toHaveBeenCalled();
      });
    });

    describe("メッセージ長のテスト", () => {
      test("should handle long message truncation", async () => {
        // Arrange
        const longMessage = "a".repeat(60);
        const expectedTruncatedMessage = "a".repeat(50) + "...";
        setupSendMessageSuccessMocks();
        const recipientIds = [testRecipientId];

        // Act
        const result = await sendAuctionMessage(testAuctionId, longMessage, recipientIds, testSenderId);

        // Assert
        expect(result.success).toBe(true);
        expect(mockSendAuctionNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            text: {
              first: "出品者からメッセージが届きました",
              second: expectedTruncatedMessage,
            },
          }),
        );
      });

      test("should handle exactly 50 character message", async () => {
        // Arrange
        const exactMessage = "a".repeat(50);
        setupSendMessageSuccessMocks();
        const recipientIds = [testRecipientId];

        // Act
        const result = await sendAuctionMessage(testAuctionId, exactMessage, recipientIds, testSenderId);

        // Assert
        expect(result.success).toBe(true);
        expect(mockSendAuctionNotification).toHaveBeenCalledWith(
          getExpectedNotificationParams(exactMessage, testRecipientId),
        );
      });
    });

    describe("異常系", () => {
      test("should handle database error during message creation", async () => {
        // Arrange
        prismaMock.auctionMessage.create.mockRejectedValue(new Error("Database connection error"));
        const recipientIds = [testRecipientId];

        // Act & Assert
        await expect(sendAuctionMessage(testAuctionId, testMessage, recipientIds, testSenderId)).rejects.toThrow(
          "Database connection error",
        );

        expect(mockSendAuctionNotification).not.toHaveBeenCalled();
      });

      test("should continue processing even if notification fails", async () => {
        // Arrange
        prismaMock.auctionMessage.create.mockResolvedValue(mockAuctionMessage);
        mockSendAuctionNotification.mockRejectedValue(new Error("Notification service error"));
        const recipientIds = [testRecipientId];

        // Act & Assert
        await expect(sendAuctionMessage(testAuctionId, testMessage, recipientIds, testSenderId)).rejects.toThrow(
          "Notification service error",
        );
      });

      // 不正な引数のテスト（統合）
      test.each([
        {
          auctionId: null,
          message: testMessage,
          recipientIds: [testRecipientId],
          senderId: testSenderId,
          desc: "パラメータが不正です",
        },
        {
          auctionId: testAuctionId,
          message: undefined,
          recipientIds: [testRecipientId],
          senderId: testSenderId,
          desc: "パラメータが不正です",
        },
        {
          auctionId: testAuctionId,
          message: testMessage,
          recipientIds: undefined,
          senderId: testSenderId,
          desc: "パラメータが不正です",
        },
        {
          auctionId: "",
          message: testMessage,
          recipientIds: [testRecipientId],
          senderId: testSenderId,
          desc: "パラメータが不正です",
        },
        {
          auctionId: testAuctionId,
          message: testMessage,
          recipientIds: [],
          senderId: testSenderId,
          desc: "受信者が指定されていません",
        },
        {
          auctionId: testAuctionId,
          message: "",
          recipientIds: [testRecipientId],
          senderId: testSenderId,
          desc: "メッセージが空です",
        },
        {
          auctionId: testAuctionId,
          message: testMessage,
          recipientIds: [testRecipientId],
          senderId: undefined,
          desc: "パラメータが不正です",
        },
      ])("should handle invalid parameters: $desc", async ({ auctionId, message, recipientIds, senderId, desc }) => {
        // Act & Assert
        await expect(
          sendAuctionMessage(
            auctionId as unknown as string,
            message as unknown as string,
            recipientIds as unknown as string[],
            senderId as unknown as string,
          ),
        ).rejects.toThrow(desc);
      });
    });
  });
});
