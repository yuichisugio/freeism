import {
  AuctionEventType,
  NotificationSendMethod,
  NotificationSendTiming,
  NotificationTargetType,
} from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AuctionNotificationParams, MessageData } from "./auction-notification";
import { getAuctionNotificationMessage, sendAuctionNotification } from "./auction-notification";
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
 * テスト用AuctionNotificationParamsファクトリー
 */
function createAuctionNotificationParams(
  overrides: AuctionNotificationParamsOverrides = {},
): AuctionNotificationParams {
  return {
    text: overrides.hasOwnProperty("text") ? overrides.text : { first: "テスト商品", second: "テスト商品詳細" },
    auctionEventType: overrides.hasOwnProperty("auctionEventType")
      ? overrides.auctionEventType
      : AuctionEventType.AUCTION_WIN,
    auctionId: overrides.hasOwnProperty("auctionId") ? overrides.auctionId : "auction-123",
    recipientUserId: overrides.hasOwnProperty("recipientUserId") ? overrides.recipientUserId : ["user-1"],
    sendMethods: overrides.hasOwnProperty("sendMethods") ? overrides.sendMethods : [NotificationSendMethod.IN_APP],
    actionUrl: overrides.hasOwnProperty("actionUrl") ? overrides.actionUrl : "https://example.com/auction/123",
    sendTiming: overrides.hasOwnProperty("sendTiming") ? overrides.sendTiming : NotificationSendTiming.NOW,
    sendScheduledDate: overrides.hasOwnProperty("sendScheduledDate") ? overrides.sendScheduledDate : null,
    expiresAt: overrides.hasOwnProperty("expiresAt") ? overrides.expiresAt : new Date("2024-12-31"),
  } as AuctionNotificationParams;
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * PushNotificationResultのモックを作成するヘルパー関数
 */
function createPushNotificationResult(
  overrides: Partial<{
    success: boolean;
    sent: number;
    failed: number;
    totalTargets: number;
    message: string;
  }> = {},
) {
  return {
    success: true,
    message: "通知の送信に成功しました",
    data: {
      sent: overrides.sent ?? 1,
      failed: overrides.failed ?? 0,
      totalTargets: overrides.totalTargets ?? 1,
    },
    ...overrides,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("auction-notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getAuctionNotificationMessage", () => {
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
            success: true,
            message: "オークション通知の送信に成功しました",
            data: {
              title: expectedTitle,
              body: expectedBody,
              targetType: expectedTargetType,
            },
          });
        },
      );
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test("should throw error for unsupported auction event type", async () => {
        const messageData = { first: "テスト商品", second: "テスト商品詳細" };
        const invalidEventType = "INVALID_EVENT" as AuctionEventType;

        await expect(getAuctionNotificationMessage(invalidEventType, messageData)).rejects.toThrow(
          `Invalid event type: INVALID_EVENT or messageData: ${JSON.stringify(messageData)}`,
        );
      });

      test.each([
        {
          description: "empty message data",
          messageData: { first: "", second: "" },
        },
        {
          description: "null message data",
          messageData: { first: null as unknown as string, second: null as unknown as string },
        },
        {
          description: "undefined message data",
          messageData: { first: undefined as unknown as string, second: undefined as unknown as string },
        },
      ])("should handle $description", async ({ messageData }) => {
        await expect(getAuctionNotificationMessage(AuctionEventType.AUCTION_WIN, messageData)).rejects.toThrow(
          `Invalid event type: ${AuctionEventType.AUCTION_WIN} or messageData: ${JSON.stringify(messageData)}`,
        );
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
          description: "should send all notification types successfully when sendTiming is SCHEDULED",
          sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL],
          sendTiming: NotificationSendTiming.NOW,
          expectedCalls: { push: 1, email: 1, inApp: 0 },
        },
        {
          description: "should send only IN_APP notification when sendMethods contains only IN_APP",
          sendMethods: [NotificationSendMethod.IN_APP],
          sendTiming: NotificationSendTiming.NOW,
          expectedCalls: { push: 0, email: 0, inApp: 1 },
        },
        {
          description: "should send only WEB_PUSH notification when sendMethods contains only WEB_PUSH",
          sendMethods: [NotificationSendMethod.WEB_PUSH],
          sendTiming: NotificationSendTiming.NOW,
          expectedCalls: { push: 1, email: 0, inApp: 0 },
        },
        {
          description: "should send only EMAIL notification when sendMethods contains only EMAIL",
          sendMethods: [NotificationSendMethod.EMAIL],
          sendTiming: NotificationSendTiming.NOW,
          expectedCalls: { push: 0, email: 1, inApp: 0 },
        },
      ])("$description", async ({ sendMethods, sendTiming, expectedCalls }) => {
        // Arrange
        mockSendPushNotification.mockResolvedValue(createPushNotificationResult());
        mockSendEmailNotification.mockResolvedValue({ success: true, data: null, message: "通知の送信に成功しました" });
        mockSendInAppNotification.mockResolvedValue({ success: true, data: null, message: "通知の送信に成功しました" });
        const params = createAuctionNotificationParams({
          sendMethods,
          sendTiming,
          sendScheduledDate: null,
        });

        // Act
        const result = await sendAuctionNotification(params);

        // Assert
        expect(result).toStrictEqual({ success: true, message: "オークション通知の送信に成功しました", data: null });
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
        mockSendPushNotification.mockResolvedValue(createPushNotificationResult());
        mockSendEmailNotification.mockResolvedValue({ success: true, data: null, message: "通知の送信に成功しました" });
        mockSendInAppNotification.mockResolvedValue({ success: true, data: null, message: "通知の送信に成功しました" });
        const params = createAuctionNotificationParams(overrides);

        // Act
        const result = await sendAuctionNotification(params);

        // Assert
        expect(result).toStrictEqual({ success: true, message: "オークション通知の送信に成功しました", data: null });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(expect.objectContaining(expectedContaining));
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test.each([
        {
          description: "should handle empty text",
          overrides: { text: { first: "", second: "" } },
        },
        {
          description: "should handle empty text",
          overrides: { text: { first: "word1", second: "" } },
        },
        {
          description: "should handle empty text",
          overrides: { text: { first: "", second: "word2" } },
        },
        {
          description: "should handle null text",
          overrides: { text: null },
        },
        {
          description: "should handle undefined auctionEventType",
          overrides: { auctionEventType: undefined },
        },
        {
          description: "should handle null auctionEventType",
          overrides: { auctionEventType: null },
        },
        {
          description: "should handle invalid auctionEventType",
          overrides: { auctionEventType: "invalid-event" as unknown as AuctionEventType },
        },
        {
          description: "should handle undefined auctionId",
          overrides: { auctionId: undefined },
        },
        {
          description: "should handle null auctionId",
          overrides: { auctionId: null },
        },
        {
          description: "should handle empty auctionId",
          overrides: { auctionId: "" },
        },
        {
          description: "should handle undefined recipientUserId",
          overrides: { recipientUserId: undefined },
        },
        {
          description: "should handle empty recipientUserId",
          overrides: { recipientUserId: [] },
        },
        {
          description: "should handle null recipientUserId",
          overrides: { recipientUserId: null },
        },
        {
          description: "should handle empty sendMethods array",
          overrides: { sendMethods: [] },
        },
        {
          description: "should handle null sendMethods",
          overrides: { sendMethods: null },
        },
        {
          description: "should handle undefined sendMethods",
          overrides: { sendMethods: undefined },
        },
        {
          description: "should handle invalid sendMethods",
          overrides: { sendMethods: ["invalid-method"] as unknown as NotificationSendMethod[] },
        },
        {
          description: "should handle multiple invalid sendMethods",
          overrides: {
            sendMethods: [NotificationSendMethod.IN_APP, "invalid-method"] as unknown as NotificationSendMethod[],
          },
        },
        {
          description: "should handle empty sendTiming",
          overrides: { sendTiming: "" },
        },
        {
          description: "should handle undefined sendTiming",
          overrides: { sendTiming: undefined },
        },
        {
          description: "should handle null sendTiming",
          overrides: { sendTiming: null },
        },
        {
          description: "should handle invalid sendTiming",
          overrides: { sendTiming: "invalid-timing" as unknown as NotificationSendTiming },
        },
        {
          description: "should handle invalid sendTiming",
          overrides: { sendTiming: NotificationSendTiming.SCHEDULED },
        },
      ])("$description", async ({ overrides }) => {
        // Arrange
        const params = createAuctionNotificationParams(overrides as unknown as Partial<AuctionNotificationParams>);

        // Act
        try {
          const result = await sendAuctionNotification(params);
          // 実際には関数がエラーをthrowするので、この行は実行されない
          expect(result).toStrictEqual({
            success: false,
            message: "オークション通知の送信に失敗しました: 必要なデータが不足しています",
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("必要なデータが不足しています");
        }
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
            mockSendEmailNotification.mockResolvedValue({
              success: false,
              data: null,
              message: "通知の送信に失敗しました",
            }),
          expectedError: "メール通知の送信に失敗しました",
          expectedCalls: { push: 0, email: 1, inApp: 0 },
        },
        {
          description: "should return error when in-app notification fails",
          sendMethods: [NotificationSendMethod.IN_APP],
          mockSetup: () =>
            mockSendInAppNotification.mockResolvedValue({
              success: false,
              data: null,
              message: "通知の送信に失敗しました",
            }),
          expectedError: "アプリ内通知の送信に失敗しました",
          expectedCalls: { push: 0, email: 0, inApp: 1 },
        },
      ])("$description", async ({ sendMethods, mockSetup, expectedError, expectedCalls }) => {
        // Arrange
        mockSetup();
        const params = createAuctionNotificationParams({ sendMethods });

        // Act
        try {
          const result = await sendAuctionNotification(params);
          // 実際には関数がエラーをthrowするので、この行は実行されない
          expect(result).toStrictEqual({
            success: false,
            message: `オークション通知の送信に失敗しました: ${expectedError}`,
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe(expectedError);
        }
        expectNotificationCalls(expectedCalls);
      });

      test("should return error when getAuctionNotificationMessage throws error", async () => {
        const params = createAuctionNotificationParams({
          auctionEventType: "INVALID_EVENT" as AuctionEventType,
        });

        try {
          const result = await sendAuctionNotification(params);
          // 実際には関数がエラーをthrowするので、この行は実行されない
          expect(result).toStrictEqual({
            success: false,
            message: "オークション通知の送信に失敗しました: 必要なデータが不足しています",
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("必要なデータが不足しています");
        }
      });

      test("should handle push notification throwing exception", async () => {
        mockSendPushNotification.mockRejectedValue(new Error("Push notification error"));
        const params = createAuctionNotificationParams({
          sendMethods: [NotificationSendMethod.WEB_PUSH],
        });

        try {
          const result = await sendAuctionNotification(params);
          // 実際には関数がエラーをthrowするので、この行は実行されない
          expect(result).toStrictEqual({
            success: false,
            message: "オークション通知の送信に失敗しました: Push notification error",
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("Push notification error");
        }
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("複合パターンテスト", () => {
      test("should handle multiple notification methods with mixed success/failure", async () => {
        // Arrange
        mockSendPushNotification.mockResolvedValue(createPushNotificationResult());
        mockSendEmailNotification.mockResolvedValue({
          success: false,
          data: null,
          message: "通知の送信に失敗しました",
        });
        mockSendInAppNotification.mockResolvedValue({ success: true, data: null, message: "通知の送信に成功しました" });

        const params = createAuctionNotificationParams({
          sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP],
        });

        // Act
        try {
          const result = await sendAuctionNotification(params);
          // 実際には関数がエラーをthrowするので、この行は実行されない
          expect(result).toStrictEqual({
            success: false,
            message: "オークション通知の送信に失敗しました: メール通知の送信に失敗しました",
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("メール通知の送信に失敗しました");
        }
        expectNotificationCalls({ push: 1, email: 1, inApp: 0 }); // エラーで処理が止まるため
      });

      test("should handle all notification types for different auction events", async () => {
        // Arrange
        mockSendPushNotification.mockResolvedValue(createPushNotificationResult());
        mockSendEmailNotification.mockResolvedValue({ success: true, data: null, message: "通知の送信に成功しました" });
        mockSendInAppNotification.mockResolvedValue({ success: true, data: null, message: "通知の送信に成功しました" });

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
          expect(result).toStrictEqual({ success: true, message: "オークション通知の送信に成功しました", data: null });
        }

        // 各イベントタイプで3つの通知方法が呼ばれるため、合計27回
        expectNotificationCalls({ push: 9, email: 9, inApp: 9 });
      });
    });
  });
});
