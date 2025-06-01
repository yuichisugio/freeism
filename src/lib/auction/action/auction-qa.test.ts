import { revalidateTag } from "next/cache";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
// 既存のPrismaモックセットアップを使用
import { prismaMock } from "@/test/setup/prisma-orm-setup";
// テストユーティリティのインポート
import { auctionMessageFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { AuctionEventType, NotificationSendMethod } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象の関数をインポート（モック設定後）
import { getAuctionMessagesAndSellerInfo, sendAuctionMessage } from "./auction-qa";
import { getCachedAuctionMessageContents, getCachedAuctionSellerInfo } from "./cache/cache-auction-qa";

// 依存関数のモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
  __esModule: true,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  __esModule: true,
}));

vi.mock("@/lib/actions/notification/auction-notification", () => ({
  sendAuctionNotification: vi.fn(),
  __esModule: true,
}));

vi.mock("./cache/cache-auction-qa", () => ({
  getCachedAuctionMessageContents: vi.fn(),
  getCachedAuctionSellerInfo: vi.fn(),
  __esModule: true,
}));

// モック関数の型アサーション
const mockGetAuthenticatedSessionUserId = getAuthenticatedSessionUserId as ReturnType<typeof vi.fn>;
const mockRevalidateTag = revalidateTag as ReturnType<typeof vi.fn>;
const mockSendAuctionNotification = sendAuctionNotification as ReturnType<typeof vi.fn>;
const mockGetCachedAuctionMessageContents = getCachedAuctionMessageContents as ReturnType<typeof vi.fn>;
const mockGetCachedAuctionSellerInfo = getCachedAuctionSellerInfo as ReturnType<typeof vi.fn>;

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthenticatedSessionUserId.mockReset();
  mockRevalidateTag.mockReset();
  mockSendAuctionNotification.mockReset();
  mockGetCachedAuctionMessageContents.mockReset();
  mockGetCachedAuctionSellerInfo.mockReset();
});

// テストデータの定義
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

describe("auction-qa", () => {
  describe("getAuctionMessagesAndSellerInfo", () => {
    test("should return messages and seller info successfully", async () => {
      // Arrange
      mockGetCachedAuctionMessageContents.mockResolvedValue({
        success: true,
        messages: mockMessages,
        error: "",
      });
      mockGetCachedAuctionSellerInfo.mockResolvedValue({
        success: true,
        auctionPersonInfo: mockSellerInfo,
        error: "",
      });

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

    test("should handle messages cache failure", async () => {
      // Arrange
      const errorMessage = "メッセージの取得に失敗しました";
      mockGetCachedAuctionMessageContents.mockResolvedValue({
        success: false,
        messages: [],
        error: errorMessage,
      });
      mockGetCachedAuctionSellerInfo.mockResolvedValue({
        success: true,
        auctionPersonInfo: mockSellerInfo,
        error: "",
      });

      // Act
      const result = await getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: errorMessage,
      });
    });

    test("should handle seller info cache failure", async () => {
      // Arrange
      const errorMessage = "出品者情報の取得に失敗しました";
      mockGetCachedAuctionMessageContents.mockResolvedValue({
        success: true,
        messages: mockMessages,
        error: "",
      });
      mockGetCachedAuctionSellerInfo.mockResolvedValue({
        success: false,
        auctionPersonInfo: null,
        error: errorMessage,
      });

      // Act
      const result = await getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: errorMessage,
      });
    });

    test("should handle both cache failures", async () => {
      // Arrange
      const messagesError = "メッセージエラー";
      const sellerError = "出品者エラー";
      mockGetCachedAuctionMessageContents.mockResolvedValue({
        success: false,
        messages: [],
        error: messagesError,
      });
      mockGetCachedAuctionSellerInfo.mockResolvedValue({
        success: false,
        auctionPersonInfo: null,
        error: sellerError,
      });

      // Act
      const result = await getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: messagesError, // 最初のエラーが返される
      });
    });

    test("should handle exception in cache functions", async () => {
      // Arrange
      mockGetCachedAuctionMessageContents.mockRejectedValue(new Error("Database connection error"));
      mockGetCachedAuctionSellerInfo.mockResolvedValue({
        success: true,
        auctionPersonInfo: mockSellerInfo,
        error: "",
      });

      // Act
      const result = await getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メッセージの取得に失敗しました",
      });
    });

    test("should handle isDisplayAfterEnd true", async () => {
      // Arrange
      mockGetCachedAuctionMessageContents.mockResolvedValue({
        success: true,
        messages: mockMessages,
        error: "",
      });
      mockGetCachedAuctionSellerInfo.mockResolvedValue({
        success: true,
        auctionPersonInfo: mockSellerInfo,
        error: "",
      });

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
        messages: [],
        error: "",
      });
      mockGetCachedAuctionSellerInfo.mockResolvedValue({
        success: true,
        auctionPersonInfo: mockSellerInfo,
        error: "",
      });

      // Act
      const result = await getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: [],
        sellerInfo: mockSellerInfo,
      });
    });

    test("should handle null seller info", async () => {
      // Arrange
      mockGetCachedAuctionMessageContents.mockResolvedValue({
        success: true,
        messages: mockMessages,
        error: "",
      });
      mockGetCachedAuctionSellerInfo.mockResolvedValue({
        success: true,
        auctionPersonInfo: null,
        error: "",
      });

      // Act
      const result = await getAuctionMessagesAndSellerInfo(testAuctionId, false, testAuctionEndDate);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        messages: mockMessages,
        sellerInfo: null,
      });
    });

    test("should handle undefined auctionId in getAuctionMessagesAndSellerInfo", async () => {
      // Arrange
      mockGetCachedAuctionMessageContents.mockRejectedValue(new Error("Invalid auction ID"));

      // Act
      const result = await getAuctionMessagesAndSellerInfo(undefined as unknown as string, false, testAuctionEndDate);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("メッセージの取得に失敗しました");
    });
  });

  describe("sendAuctionMessage", () => {
    test("should send message successfully", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockResolvedValue(mockAuctionMessage);
      mockSendAuctionNotification.mockResolvedValue({ success: true });

      const recipientIds = [testRecipientId];

      // Act
      const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: mockAuctionMessage,
      });

      expect(mockRevalidateTag).toHaveBeenCalledWith(`auction-messages-${testAuctionId}`);
      expect(prismaMock.auctionMessage.create).toHaveBeenCalledWith({
        data: {
          message: testMessage,
          auctionId: testAuctionId,
          senderId: testSenderId,
        },
      });
      expect(mockSendAuctionNotification).toHaveBeenCalledWith({
        text: {
          first: "出品者からメッセージが届きました",
          second: testMessage,
        },
        auctionEventType: AuctionEventType.QUESTION_RECEIVED,
        auctionId: testAuctionId,
        recipientUserId: [testRecipientId],
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL],
        actionUrl: `/auction/${testAuctionId}`,
        sendTiming: "NOW",
        sendScheduledDate: null,
        expiresAt: null,
      });
    });

    test("should handle long message truncation", async () => {
      // Arrange
      const longMessage = "a".repeat(60); // 50文字を超えるメッセージ
      const expectedTruncatedMessage = "a".repeat(50) + "...";

      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      const mockLongMessage = auctionMessageFactory.build({
        message: longMessage,
        auctionId: testAuctionId,
        senderId: testSenderId,
      });
      prismaMock.auctionMessage.create.mockResolvedValue(mockLongMessage);
      mockSendAuctionNotification.mockResolvedValue({ success: true });

      const recipientIds = [testRecipientId];

      // Act
      const result = await sendAuctionMessage(testAuctionId, longMessage, recipientIds);

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

    test("should skip notification for sender", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockResolvedValue(mockAuctionMessage);
      mockSendAuctionNotification.mockResolvedValue({ success: true });

      // 送信者自身も受信者リストに含まれている場合
      const recipientIds = [testSenderId, testRecipientId];

      // Act
      const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds);

      // Assert
      expect(result.success).toBe(true);
      // 送信者以外の受信者にのみ通知が送信される
      expect(mockSendAuctionNotification).toHaveBeenCalledTimes(1);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: [testRecipientId],
        }),
      );
    });

    test("should handle multiple recipients", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockResolvedValue(mockAuctionMessage);
      mockSendAuctionNotification.mockResolvedValue({ success: true });

      const recipientIds = ["recipient-1", "recipient-2", "recipient-3"];

      // Act
      const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSendAuctionNotification).toHaveBeenCalledTimes(3);
    });

    test("should handle empty recipients array", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockResolvedValue(mockAuctionMessage);

      const recipientIds: string[] = [];

      // Act
      const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSendAuctionNotification).not.toHaveBeenCalled();
    });

    test("should handle authentication error", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("認証が必要です"));

      const recipientIds = [testRecipientId];

      // Act
      const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メッセージの送信に失敗しました",
      });

      expect(prismaMock.auctionMessage.create).not.toHaveBeenCalled();
      expect(mockSendAuctionNotification).not.toHaveBeenCalled();
    });

    test("should handle database error during message creation", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockRejectedValue(new Error("Database connection error"));

      const recipientIds = [testRecipientId];

      // Act
      const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メッセージの送信に失敗しました",
      });

      expect(mockSendAuctionNotification).not.toHaveBeenCalled();
    });

    test("should continue processing even if notification fails", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockResolvedValue(mockAuctionMessage);
      mockSendAuctionNotification.mockRejectedValue(new Error("Notification service error"));

      const recipientIds = [testRecipientId];

      // Act
      const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メッセージの送信に失敗しました",
      });
    });

    test("should handle only sender in recipients", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockResolvedValue(mockAuctionMessage);

      const recipientIds = [testSenderId]; // 送信者のみ

      // Act
      const result = await sendAuctionMessage(testAuctionId, testMessage, recipientIds);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSendAuctionNotification).not.toHaveBeenCalled();
    });

    test("should handle null auctionId in sendAuctionMessage", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockRejectedValue(new Error("Invalid auction ID"));

      const recipientIds = [testRecipientId];

      // Act
      const result = await sendAuctionMessage(null as unknown as string, testMessage, recipientIds);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("メッセージの送信に失敗しました");
    });

    test("should handle undefined message", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockRejectedValue(new Error("Invalid message"));

      const recipientIds = [testRecipientId];

      // Act
      const result = await sendAuctionMessage(testAuctionId, undefined as unknown as string, recipientIds);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("メッセージの送信に失敗しました");
    });

    test("should handle undefined recipientIds", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockResolvedValue(mockAuctionMessage);

      // Act
      const result = await sendAuctionMessage(testAuctionId, testMessage, undefined as unknown as string[]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("メッセージの送信に失敗しました");
    });

    test("should handle invalid date in getAuctionMessagesAndSellerInfo", async () => {
      // Arrange
      mockGetCachedAuctionMessageContents.mockRejectedValue(new Error("Invalid date"));

      // Act
      const result = await getAuctionMessagesAndSellerInfo(testAuctionId, false, new Date("invalid"));

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("メッセージの取得に失敗しました");
    });
  });

  // 境界値テスト
  describe("boundary value tests", () => {
    test("should handle exactly 50 character message", async () => {
      // Arrange
      const exactMessage = "a".repeat(50); // ちょうど50文字
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      const mockExactMessage = auctionMessageFactory.build({
        message: exactMessage,
        auctionId: testAuctionId,
        senderId: testSenderId,
      });
      prismaMock.auctionMessage.create.mockResolvedValue(mockExactMessage);
      mockSendAuctionNotification.mockResolvedValue({ success: true });

      const recipientIds = [testRecipientId];

      // Act
      const result = await sendAuctionMessage(testAuctionId, exactMessage, recipientIds);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          text: {
            first: "出品者からメッセージが届きました",
            second: exactMessage, // 切り詰められない
          },
        }),
      );
    });

    test("should handle empty message", async () => {
      // Arrange
      const emptyMessage = "";
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      const mockEmptyMessage = auctionMessageFactory.build({
        message: emptyMessage,
        auctionId: testAuctionId,
        senderId: testSenderId,
      });
      prismaMock.auctionMessage.create.mockResolvedValue(mockEmptyMessage);
      mockSendAuctionNotification.mockResolvedValue({ success: true });

      const recipientIds = [testRecipientId];

      // Act
      const result = await sendAuctionMessage(testAuctionId, emptyMessage, recipientIds);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSendAuctionNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          text: {
            first: "出品者からメッセージが届きました",
            second: emptyMessage,
          },
        }),
      );
    });

    test("should handle very long auction ID", async () => {
      // Arrange
      const longAuctionId = "a".repeat(1000);
      mockGetCachedAuctionMessageContents.mockResolvedValue({
        success: true,
        messages: mockMessages,
        error: "",
      });
      mockGetCachedAuctionSellerInfo.mockResolvedValue({
        success: true,
        auctionPersonInfo: mockSellerInfo,
        error: "",
      });

      // Act
      const result = await getAuctionMessagesAndSellerInfo(longAuctionId, false, testAuctionEndDate);

      // Assert
      expect(result.success).toBe(true);
      expect(mockGetCachedAuctionMessageContents).toHaveBeenCalledWith(longAuctionId, false, testAuctionEndDate);
    });
  });

  // 異常系テスト（不正な引数）
  describe("invalid input tests", () => {
    test("should handle undefined auctionId in getAuctionMessagesAndSellerInfo", async () => {
      // Arrange
      mockGetCachedAuctionMessageContents.mockRejectedValue(new Error("Invalid auction ID"));

      // Act
      const result = await getAuctionMessagesAndSellerInfo(undefined as unknown as string, false, testAuctionEndDate);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("メッセージの取得に失敗しました");
    });

    test("should handle null auctionId in sendAuctionMessage", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockRejectedValue(new Error("Invalid auction ID"));

      const recipientIds = [testRecipientId];

      // Act
      const result = await sendAuctionMessage(null as unknown as string, testMessage, recipientIds);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("メッセージの送信に失敗しました");
    });

    test("should handle undefined message", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockRejectedValue(new Error("Invalid message"));

      const recipientIds = [testRecipientId];

      // Act
      const result = await sendAuctionMessage(testAuctionId, undefined as unknown as string, recipientIds);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("メッセージの送信に失敗しました");
    });

    test("should handle undefined recipientIds", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testSenderId);
      prismaMock.auctionMessage.create.mockResolvedValue(mockAuctionMessage);

      // Act
      const result = await sendAuctionMessage(testAuctionId, testMessage, undefined as unknown as string[]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("メッセージの送信に失敗しました");
    });

    test("should handle invalid date in getAuctionMessagesAndSellerInfo", async () => {
      // Arrange
      mockGetCachedAuctionMessageContents.mockRejectedValue(new Error("Invalid date"));

      // Act
      const result = await getAuctionMessagesAndSellerInfo(testAuctionId, false, new Date("invalid"));

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("メッセージの取得に失敗しました");
    });
  });
});
