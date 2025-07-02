import {
  AuctionEventType,
  NotificationSendMethod,
  NotificationSendTiming,
  NotificationTargetType,
} from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AuctionNotificationParams, MessageData } from "./auction-notification";
import { getAuctionNotificationMessage, sendAuctionNotification } from "./auction-notification";
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数のインポート
import { sendEmailNotification } from "./email-notification";
import { sendInAppNotification } from "./in-app-notification";
import { sendPushNotification } from "./push-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 依存関係のモック
vi.mock("./push-notification", () => ({
  sendPushNotification: vi.fn(),
}));

vi.mock("./email-notification", () => ({
  sendEmailNotification: vi.fn(),
}));

vi.mock("./in-app-notification", () => ({
  sendInAppNotification: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数の型定義
const mockSendPushNotification = vi.mocked(sendPushNotification);
const mockSendEmailNotification = vi.mocked(sendEmailNotification);
const mockSendInAppNotification = vi.mocked(sendInAppNotification);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テストデータファクトリー
type AuctionNotificationParamsOverrides = {
  text?: MessageData;
  auctionEventType?: AuctionEventType;
  auctionId?: string;
  recipientUserId?: string[];
  sendMethods?: NotificationSendMethod[];
  actionUrl?: string | null;
  sendTiming?: NotificationSendTiming;
  sendScheduledDate?: Date | null;
  expiresAt?: Date | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用メッセージデータファクトリー
 */
function createMessageData(overrides: MessageData) {
  return {
    first: overrides.first ?? "テスト商品",
    second: overrides.second ?? "テスト商品詳細",
  };
}

/**
 * テスト用AuctionNotificationParamsファクトリー
 */
function createAuctionNotificationParams(
  overrides: AuctionNotificationParamsOverrides = {},
): AuctionNotificationParams {
  return {
    text: createMessageData(overrides.text ?? { first: "テスト商品", second: "テスト商品詳細" }),
    auctionEventType: overrides.auctionEventType ?? AuctionEventType.AUCTION_WIN,
    auctionId: overrides.auctionId ?? "auction-123",
    recipientUserId: overrides.recipientUserId ?? ["user-1"],
    sendMethods: overrides.sendMethods ?? [NotificationSendMethod.IN_APP],
    actionUrl: overrides.actionUrl !== undefined ? overrides.actionUrl : "https://example.com/auction/123",
    sendTiming: overrides.sendTiming ?? NotificationSendTiming.NOW,
    sendScheduledDate: overrides.sendScheduledDate !== undefined ? overrides.sendScheduledDate : null,
    expiresAt: overrides.expiresAt !== undefined ? overrides.expiresAt : new Date("2024-12-31"),
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知メソッドの呼び出し確認ヘルパー
 */
function expectNotificationCalls(options: { push?: number; email?: number; inApp?: number }) {
  if (options.push !== undefined) {
    expect(mockSendPushNotification).toHaveBeenCalledTimes(options.push);
  }
  if (options.email !== undefined) {
    expect(mockSendEmailNotification).toHaveBeenCalledTimes(options.email);
  }
  if (options.inApp !== undefined) {
    expect(mockSendInAppNotification).toHaveBeenCalledTimes(options.inApp);
  }
}

/**
 * PushNotificationResultのモックを作成するヘルパー関数
 */
function createPushNotificationResult(
  overrides: Partial<{ success: boolean; sent: number; failed: number; totalTargets: number; message: string }> = {},
) {
  return {
    success: true,
    sent: 1,
    failed: 0,
    totalTargets: 1,
    message: "通知の送信に成功しました",
    ...overrides,
  };
}

/**
 * モック成功設定ヘルパー
 */
function setupSuccessMocks() {
  mockSendPushNotification.mockResolvedValue(createPushNotificationResult());
  mockSendEmailNotification.mockResolvedValue({ success: true, message: "通知の送信に成功しました" });
  mockSendInAppNotification.mockResolvedValue({ success: true, message: "通知の送信に成功しました" });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("auction-notification", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getAuctionNotificationMessage", () => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("正常系", () => {
      test.each([
        {
          eventType: AuctionEventType.AUCTION_WIN,
          messageData: { first: "テスト商品", second: "テスト商品詳細" },
          expectedTitle: "[テスト商品] を落札しました！",
          expectedBody: "おめでとうございます！「テスト商品詳細」を落札しました。",
          expectedTargetType: NotificationTargetType.AUCTION_BIDDER,
        },
        {
          eventType: AuctionEventType.OUTBID,
          messageData: { first: "テスト商品", second: "100" },
          expectedTitle: "[テスト商品] の最高入札額が更新されました",
          expectedBody: "他ユーザーが 100 ポイントで最高入札額を更新したため、あなたは最高入札者ではなくなりました。",
          expectedTargetType: NotificationTargetType.AUCTION_BIDDER,
        },
        {
          eventType: AuctionEventType.POINT_RETURNED,
          messageData: { first: "テスト商品", second: "50" },
          expectedTitle: "オークションポイントが返還されました",
          expectedBody: "[テスト商品] のオークションで預けていたポイント50ptが返還されました。",
          expectedTargetType: NotificationTargetType.AUCTION_BIDDER,
        },
        {
          eventType: AuctionEventType.AUCTION_LOST,
          messageData: { first: "テスト商品", second: "テスト商品詳細" },
          expectedTitle: "[テスト商品] は落札できませんでした",
          expectedBody: "あなたが入札していた「テスト商品詳細」のオークションは他のユーザーが落札しました。",
          expectedTargetType: NotificationTargetType.AUCTION_BIDDER,
        },
        {
          eventType: AuctionEventType.AUTO_BID_LIMIT_REACHED,
          messageData: { first: "テスト商品", second: "200" },
          expectedTitle: "[テスト商品] の自動入札が上限に達しました",
          expectedBody: "設定した自動入札の上限額(200pt)に達したため、自動入札を停止しました。",
          expectedTargetType: NotificationTargetType.AUCTION_BIDDER,
        },
        {
          eventType: AuctionEventType.QUESTION_RECEIVED,
          messageData: { first: "テスト商品", second: "テスト商品詳細" },
          expectedTitle: "[テスト商品] に新しい質問が届きました",
          expectedBody: "「テスト商品詳細」に新しい質問が届きました。",
          expectedTargetType: NotificationTargetType.AUCTION_SELLER,
        },
        {
          eventType: AuctionEventType.ENDED,
          messageData: { first: "テスト商品", second: "テスト商品詳細" },
          expectedTitle: "[テスト商品] のオークションが終了しました",
          expectedBody: "出品した商品「テスト商品詳細」のオークション期間が終了しました。結果を確認してください。",
          expectedTargetType: NotificationTargetType.AUCTION_SELLER,
        },
        {
          eventType: AuctionEventType.ITEM_SOLD,
          messageData: { first: "テスト商品", second: "テスト商品詳細" },
          expectedTitle: "[テスト商品] が落札されました",
          expectedBody: "出品した商品「テスト商品詳細」が落札されました。",
          expectedTargetType: NotificationTargetType.AUCTION_SELLER,
        },
        {
          eventType: AuctionEventType.NO_WINNER,
          messageData: { first: "テスト商品", second: "テスト商品詳細" },
          expectedTitle: "[テスト商品] のオークションは落札者がいませんでした",
          expectedBody: "「テスト商品詳細」のオークションは落札者が現れませんでした。",
          expectedTargetType: NotificationTargetType.AUCTION_SELLER,
        },
      ])(
        "should return correct message for $eventType event",
        async ({ eventType, messageData, expectedTitle, expectedBody, expectedTargetType }) => {
          const result = await getAuctionNotificationMessage(eventType, messageData);

          expect(result).toStrictEqual({
            title: expectedTitle,
            body: expectedBody,
            targetType: expectedTargetType,
          });
        },
      );
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test("should throw error for unsupported auction event type", async () => {
        const messageData = createMessageData({ first: "テスト商品", second: "テスト商品詳細" });
        const invalidEventType = "INVALID_EVENT" as AuctionEventType;

        await expect(getAuctionNotificationMessage(invalidEventType, messageData)).rejects.toThrow(
          "オークション通知のメッセージを作成できませんでした",
        );
      });

      test.each([
        {
          description: "empty message data",
          messageData: { first: "", second: "" },
          expectedTitle: "[] を落札しました！",
          expectedBody: "おめでとうございます！「」を落札しました。",
        },
        {
          description: "null message data",
          messageData: { first: null as unknown as string, second: null as unknown as string },
          expectedTitle: "[null] を落札しました！",
          expectedBody: "おめでとうございます！「null」を落札しました。",
        },
        {
          description: "undefined message data",
          messageData: { first: undefined as unknown as string, second: undefined as unknown as string },
          expectedTitle: "[undefined] を落札しました！",
          expectedBody: "おめでとうございます！「undefined」を落札しました。",
        },
      ])("should handle $description", async ({ messageData, expectedTitle, expectedBody }) => {
        const result = await getAuctionNotificationMessage(AuctionEventType.AUCTION_WIN, messageData);

        expect(result).toStrictEqual({
          title: expectedTitle,
          body: expectedBody,
          targetType: NotificationTargetType.AUCTION_BIDDER,
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("境界値テスト", () => {
      test("should handle very long message data", async () => {
        const longString = "a".repeat(1000);
        const messageData = { first: longString, second: longString };
        const result = await getAuctionNotificationMessage(AuctionEventType.AUCTION_WIN, messageData);

        expect(result.title).toContain(longString);
        expect(result.body).toContain(longString);
        expect(result.targetType).toBe(NotificationTargetType.AUCTION_BIDDER);
      });

      test("should handle special characters in message data", async () => {
        const messageData = { first: "テスト商品!@#$%^&*()", second: "特殊文字<>&\"'" };
        const result = await getAuctionNotificationMessage(AuctionEventType.AUCTION_WIN, messageData);

        expect(result.title).toBe("[テスト商品!@#$%^&*()] を落札しました！");
        expect(result.body).toBe("おめでとうございます！「特殊文字<>&\"'」を落札しました。");
        expect(result.targetType).toBe(NotificationTargetType.AUCTION_BIDDER);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("sendAuctionNotification", () => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("正常系", () => {
      test.each([
        {
          description: "should send all notification types successfully when sendTiming is NOW",
          sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP],
          sendTiming: NotificationSendTiming.NOW,
          expectedCalls: { push: 1, email: 1, inApp: 1 },
        },
        {
          description: "should send only IN_APP notification when sendMethods contains only IN_APP",
          sendMethods: [NotificationSendMethod.IN_APP],
          sendTiming: NotificationSendTiming.NOW,
          expectedCalls: { push: 0, email: 0, inApp: 1 },
        },
        {
          description: "should not send WEB_PUSH and EMAIL when sendTiming is SCHEDULED",
          sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP],
          sendTiming: NotificationSendTiming.SCHEDULED,
          expectedCalls: { push: 0, email: 0, inApp: 1 },
        },
      ])("$description", async ({ sendMethods, sendTiming, expectedCalls }) => {
        // Arrange
        setupSuccessMocks();
        const params = createAuctionNotificationParams({
          sendMethods,
          sendTiming,
          sendScheduledDate: sendTiming === NotificationSendTiming.SCHEDULED ? new Date("2024-12-31") : null,
        });

        // Act
        const result = await sendAuctionNotification(params);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expectNotificationCalls(expectedCalls);
      });

      test.each([
        {
          description: "should handle null actionUrl",
          overrides: { actionUrl: null },
          expectedContaining: { actionUrl: null },
        },
        {
          description: "should handle null expiresAt",
          overrides: { expiresAt: null },
          expectedContaining: { expiresAt: expect.any(Date) as unknown as Date },
        },
      ])("$description", async ({ overrides, expectedContaining }) => {
        // Arrange
        setupSuccessMocks();
        const params = createAuctionNotificationParams(overrides);

        // Act
        const result = await sendAuctionNotification(params);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(expect.objectContaining(expectedContaining));
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test("should return error when recipientUserId is empty array", async () => {
        const params = createAuctionNotificationParams({ recipientUserId: [] });

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({
          success: false,
          error: "オークション通知の送信に失敗しました",
        });
        expectNotificationCalls({ push: 0, email: 0, inApp: 0 });
      });

      test.each([
        {
          description: "should return error when push notification fails",
          sendMethods: [NotificationSendMethod.WEB_PUSH],
          mockSetup: () => mockSendPushNotification.mockResolvedValue(createPushNotificationResult({ success: false })),
          expectedError: "プッシュ通知の送信に失敗しました",
          expectedCalls: { push: 1, email: 0, inApp: 0 },
        },
        {
          description: "should return error when email notification fails",
          sendMethods: [NotificationSendMethod.EMAIL],
          mockSetup: () =>
            mockSendEmailNotification.mockResolvedValue({ success: false, message: "通知の送信に失敗しました" }),
          expectedError: "メール通知の送信に失敗しました",
          expectedCalls: { push: 0, email: 1, inApp: 0 },
        },
        {
          description: "should return error when in-app notification fails",
          sendMethods: [NotificationSendMethod.IN_APP],
          mockSetup: () =>
            mockSendInAppNotification.mockResolvedValue({ success: false, message: "通知の送信に失敗しました" }),
          expectedError: "アプリ内通知の送信に失敗しました",
          expectedCalls: { push: 0, email: 0, inApp: 1 },
        },
      ])("$description", async ({ sendMethods, mockSetup, expectedError, expectedCalls }) => {
        // Arrange
        mockSetup();
        const params = createAuctionNotificationParams({ sendMethods });

        // Act
        const result = await sendAuctionNotification(params);

        // Assert
        expect(result).toStrictEqual({ success: false, error: expectedError });
        expectNotificationCalls(expectedCalls);
      });

      test("should return error when getAuctionNotificationMessage throws error", async () => {
        const params = createAuctionNotificationParams({
          auctionEventType: "INVALID_EVENT" as AuctionEventType,
        });

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({
          success: false,
          error: "オークション通知の送信に失敗しました",
        });
      });

      test("should handle push notification throwing exception", async () => {
        mockSendPushNotification.mockRejectedValue(new Error("Push notification error"));
        const params = createAuctionNotificationParams({
          sendMethods: [NotificationSendMethod.WEB_PUSH],
        });

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({
          success: false,
          error: "オークション通知の送信に失敗しました",
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("境界値テスト", () => {
      test.each([
        {
          description: "should handle single recipient user",
          recipientUserId: ["user-1"],
          expectedUserIds: ["user-1"],
        },
        {
          description: "should handle multiple recipient users",
          recipientUserId: ["user-1", "user-2", "user-3", "user-4", "user-5"],
          expectedUserIds: ["user-1", "user-2", "user-3", "user-4", "user-5"],
        },
      ])("$description", async ({ recipientUserId, expectedUserIds }) => {
        // Arrange
        setupSuccessMocks();
        const params = createAuctionNotificationParams({ recipientUserId });

        // Act
        const result = await sendAuctionNotification(params);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientUserIds: expectedUserIds,
          }),
        );
      });

      test.each([
        {
          description: "should handle very long auction ID",
          auctionId: "a".repeat(1000),
        },
        {
          description: "should handle very long action URL",
          actionUrl: "https://example.com/" + "a".repeat(2000),
        },
      ])("$description", async ({ auctionId, actionUrl }) => {
        // Arrange
        setupSuccessMocks();
        const params = createAuctionNotificationParams({
          ...(auctionId && { auctionId }),
          ...(actionUrl && { actionUrl }),
        });

        // Act
        const result = await sendAuctionNotification(params);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            ...(auctionId && { auctionId }),
            ...(actionUrl && { actionUrl }),
          }),
        );
      });

      test.each([
        {
          description: "should handle future expiry date",
          expiresAt: new Date("2030-12-31"),
        },
        {
          description: "should handle past expiry date",
          expiresAt: new Date("2020-01-01"),
        },
      ])("$description", async ({ expiresAt }) => {
        // Arrange
        setupSuccessMocks();
        const params = createAuctionNotificationParams({ expiresAt });

        // Act
        const result = await sendAuctionNotification(params);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            expiresAt: expect.any(Date) as unknown as Date,
          }),
        );
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("複合パターンテスト", () => {
      test("should handle multiple notification methods with mixed success/failure", async () => {
        // Arrange
        mockSendPushNotification.mockResolvedValue(createPushNotificationResult());
        mockSendEmailNotification.mockResolvedValue({ success: false, message: "通知の送信に失敗しました" });
        mockSendInAppNotification.mockResolvedValue({ success: true, message: "通知の送信に成功しました" });

        const params = createAuctionNotificationParams({
          sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP],
        });

        // Act
        const result = await sendAuctionNotification(params);

        // Assert - 最初に失敗した通知でエラーが返される（この場合はEMAIL）
        expect(result).toStrictEqual({
          success: false,
          error: "メール通知の送信に失敗しました",
        });
        expectNotificationCalls({ push: 1, email: 1, inApp: 0 }); // エラーで処理が止まるため
      });

      test("should handle all notification types for different auction events", async () => {
        // Arrange
        setupSuccessMocks();

        const auctionEvents = [
          AuctionEventType.AUCTION_WIN,
          AuctionEventType.OUTBID,
          AuctionEventType.POINT_RETURNED,
          AuctionEventType.AUCTION_LOST,
          AuctionEventType.AUTO_BID_LIMIT_REACHED,
          AuctionEventType.QUESTION_RECEIVED,
          AuctionEventType.ENDED,
          AuctionEventType.ITEM_SOLD,
          AuctionEventType.NO_WINNER,
        ];

        // Act & Assert
        for (const eventType of auctionEvents) {
          const params = createAuctionNotificationParams({
            auctionEventType: eventType,
            sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP],
          });

          const result = await sendAuctionNotification(params);
          expect(result).toStrictEqual({ success: true });
        }

        // 各イベントタイプで3つの通知方法が呼ばれるため、合計27回
        expectNotificationCalls({ push: 9, email: 9, inApp: 9 });
      });
    });
  });
});
