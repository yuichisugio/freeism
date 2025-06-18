import {
  AuctionEventType,
  NotificationSendMethod,
  NotificationSendTiming,
  NotificationTargetType,
} from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AuctionNotificationParams } from "./auction-notification";
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

describe("auction-notification", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getAuctionNotificationMessage", () => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("正常系", () => {
      test("should return correct message for AUCTION_WIN event", async () => {
        const messageData = { first: "テスト商品", second: "テスト商品詳細" };
        const result = await getAuctionNotificationMessage(AuctionEventType.AUCTION_WIN, messageData);

        expect(result).toStrictEqual({
          title: "[テスト商品] を落札しました！",
          body: "おめでとうございます！「テスト商品詳細」を落札しました。",
          targetType: NotificationTargetType.AUCTION_BIDDER,
        });
      });

      test("should return correct message for OUTBID event", async () => {
        const messageData = { first: "テスト商品", second: "100" };
        const result = await getAuctionNotificationMessage(AuctionEventType.OUTBID, messageData);

        expect(result).toStrictEqual({
          title: "[テスト商品] の最高入札額が更新されました",
          body: "他ユーザーが 100 ポイントで最高入札額を更新したため、あなたは最高入札者ではなくなりました。",
          targetType: NotificationTargetType.AUCTION_BIDDER,
        });
      });

      test("should return correct message for POINT_RETURNED event", async () => {
        const messageData = { first: "テスト商品", second: "50" };
        const result = await getAuctionNotificationMessage(AuctionEventType.POINT_RETURNED, messageData);

        expect(result).toStrictEqual({
          title: "オークションポイントが返還されました",
          body: "[テスト商品] のオークションで預けていたポイント50ptが返還されました。",
          targetType: NotificationTargetType.AUCTION_BIDDER,
        });
      });

      test("should return correct message for AUCTION_LOST event", async () => {
        const messageData = { first: "テスト商品", second: "テスト商品詳細" };
        const result = await getAuctionNotificationMessage(AuctionEventType.AUCTION_LOST, messageData);

        expect(result).toStrictEqual({
          title: "[テスト商品] は落札できませんでした",
          body: "あなたが入札していた「テスト商品詳細」のオークションは他のユーザーが落札しました。",
          targetType: NotificationTargetType.AUCTION_BIDDER,
        });
      });

      test("should return correct message for AUTO_BID_LIMIT_REACHED event", async () => {
        const messageData = { first: "テスト商品", second: "200" };
        const result = await getAuctionNotificationMessage(AuctionEventType.AUTO_BID_LIMIT_REACHED, messageData);

        expect(result).toStrictEqual({
          title: "[テスト商品] の自動入札が上限に達しました",
          body: "設定した自動入札の上限額(200pt)に達したため、自動入札を停止しました。",
          targetType: NotificationTargetType.AUCTION_BIDDER,
        });
      });

      test("should return correct message for QUESTION_RECEIVED event", async () => {
        const messageData = { first: "テスト商品", second: "テスト商品詳細" };
        const result = await getAuctionNotificationMessage(AuctionEventType.QUESTION_RECEIVED, messageData);

        expect(result).toStrictEqual({
          title: "[テスト商品] に新しい質問が届きました",
          body: "「テスト商品詳細」に新しい質問が届きました。",
          targetType: NotificationTargetType.AUCTION_SELLER,
        });
      });

      test("should return correct message for ENDED event", async () => {
        const messageData = { first: "テスト商品", second: "テスト商品詳細" };
        const result = await getAuctionNotificationMessage(AuctionEventType.ENDED, messageData);

        expect(result).toStrictEqual({
          title: "[テスト商品] のオークションが終了しました",
          body: "出品した商品「テスト商品詳細」のオークション期間が終了しました。結果を確認してください。",
          targetType: NotificationTargetType.AUCTION_SELLER,
        });
      });

      test("should return correct message for ITEM_SOLD event", async () => {
        const messageData = { first: "テスト商品", second: "テスト商品詳細" };
        const result = await getAuctionNotificationMessage(AuctionEventType.ITEM_SOLD, messageData);

        expect(result).toStrictEqual({
          title: "[テスト商品] が落札されました",
          body: "出品した商品「テスト商品詳細」が落札されました。",
          targetType: NotificationTargetType.AUCTION_SELLER,
        });
      });

      test("should return correct message for NO_WINNER event", async () => {
        const messageData = { first: "テスト商品", second: "テスト商品詳細" };
        const result = await getAuctionNotificationMessage(AuctionEventType.NO_WINNER, messageData);

        expect(result).toStrictEqual({
          title: "[テスト商品] のオークションは落札者がいませんでした",
          body: "「テスト商品詳細」のオークションは落札者が現れませんでした。",
          targetType: NotificationTargetType.AUCTION_SELLER,
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test("should throw error for unsupported auction event type", async () => {
        const messageData = { first: "テスト商品", second: "テスト商品詳細" };
        const invalidEventType = "INVALID_EVENT" as AuctionEventType;

        await expect(getAuctionNotificationMessage(invalidEventType, messageData)).rejects.toThrow(
          "オークション通知のメッセージを作成できませんでした",
        );
      });

      test("should handle empty message data", async () => {
        const messageData = { first: "", second: "" };
        const result = await getAuctionNotificationMessage(AuctionEventType.AUCTION_WIN, messageData);

        expect(result).toStrictEqual({
          title: "[] を落札しました！",
          body: "おめでとうございます！「」を落札しました。",
          targetType: NotificationTargetType.AUCTION_BIDDER,
        });
      });

      test("should handle null message data", async () => {
        const messageData = { first: null as unknown as string, second: null as unknown as string };
        const result = await getAuctionNotificationMessage(AuctionEventType.AUCTION_WIN, messageData);

        expect(result).toStrictEqual({
          title: "[null] を落札しました！",
          body: "おめでとうございます！「null」を落札しました。",
          targetType: NotificationTargetType.AUCTION_BIDDER,
        });
      });

      test("should handle undefined message data", async () => {
        const messageData = { first: undefined as unknown as string, second: undefined as unknown as string };
        const result = await getAuctionNotificationMessage(AuctionEventType.AUCTION_WIN, messageData);

        expect(result).toStrictEqual({
          title: "[undefined] を落札しました！",
          body: "おめでとうございます！「undefined」を落札しました。",
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
      test("should send all notification types successfully when sendTiming is NOW", async () => {
        // モックの戻り値を設定
        mockSendPushNotification.mockResolvedValue({ success: true });
        mockSendEmailNotification.mockResolvedValue({ success: true });
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1", "user-2"],
          sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({ success: true });
        expect(mockSendPushNotification).toHaveBeenCalledTimes(1);
        expect(mockSendEmailNotification).toHaveBeenCalledTimes(1);
        expect(mockSendInAppNotification).toHaveBeenCalledTimes(1);
      });

      test("should send only IN_APP notification when sendMethods contains only IN_APP", async () => {
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({ success: true });
        expect(mockSendPushNotification).not.toHaveBeenCalled();
        expect(mockSendEmailNotification).not.toHaveBeenCalled();
        expect(mockSendInAppNotification).toHaveBeenCalledTimes(1);
      });

      test("should not send WEB_PUSH and EMAIL when sendTiming is SCHEDULED", async () => {
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.SCHEDULED,
          sendScheduledDate: new Date("2024-12-31"),
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({ success: true });
        expect(mockSendPushNotification).not.toHaveBeenCalled();
        expect(mockSendEmailNotification).not.toHaveBeenCalled();
        expect(mockSendInAppNotification).toHaveBeenCalledTimes(1);
      });

      test("should handle null actionUrl", async () => {
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: null,
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: null,
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({ success: true });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            actionUrl: null,
          }),
        );
      });

      test("should handle null expiresAt", async () => {
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: null,
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({ success: true });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            expiresAt: expect.any(Date) as unknown as Date,
          }),
        );
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test("should return error when recipientUserId is empty array", async () => {
        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: [],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({
          success: false,
          error: "オークション通知の送信に失敗しました",
        });
        expect(mockSendPushNotification).not.toHaveBeenCalled();
        expect(mockSendEmailNotification).not.toHaveBeenCalled();
        expect(mockSendInAppNotification).not.toHaveBeenCalled();
      });

      test("should return error when push notification fails", async () => {
        mockSendPushNotification.mockResolvedValue({ success: false });

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.WEB_PUSH],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({
          success: false,
          error: "プッシュ通知の送信に失敗しました",
        });
        expect(mockSendPushNotification).toHaveBeenCalledTimes(1);
      });

      test("should return error when email notification fails", async () => {
        mockSendEmailNotification.mockResolvedValue({ success: false });

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.EMAIL],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({
          success: false,
          error: "メール通知の送信に失敗しました",
        });
        expect(mockSendEmailNotification).toHaveBeenCalledTimes(1);
      });

      test("should return error when in-app notification fails", async () => {
        mockSendInAppNotification.mockResolvedValue({ success: false });

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({
          success: false,
          error: "アプリ内通知の送信に失敗しました",
        });
        expect(mockSendInAppNotification).toHaveBeenCalledTimes(1);
      });

      test("should return error when getAuctionNotificationMessage throws error", async () => {
        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: "INVALID_EVENT" as AuctionEventType,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({
          success: false,
          error: "オークション通知の送信に失敗しました",
        });
      });

      test("should handle push notification throwing exception", async () => {
        mockSendPushNotification.mockRejectedValue(new Error("Push notification error"));

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.WEB_PUSH],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({
          success: false,
          error: "オークション通知の送信に失敗しました",
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("境界値テスト", () => {
      test("should handle single recipient user", async () => {
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({ success: true });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientUserIds: ["user-1"],
          }),
        );
      });

      test("should handle multiple recipient users", async () => {
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1", "user-2", "user-3", "user-4", "user-5"],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({ success: true });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientUserIds: ["user-1", "user-2", "user-3", "user-4", "user-5"],
          }),
        );
      });

      test("should handle very long auction ID", async () => {
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const longAuctionId = "a".repeat(1000);
        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: longAuctionId,
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({ success: true });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            auctionId: longAuctionId,
          }),
        );
      });

      test("should handle very long action URL", async () => {
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const longUrl = "https://example.com/" + "a".repeat(2000);
        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: longUrl,
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({ success: true });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            actionUrl: longUrl,
          }),
        );
      });

      test("should handle future expiry date", async () => {
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const futureDate = new Date("2030-12-31");
        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: futureDate,
        };

        const result = await sendAuctionNotification(params);

        expect(result).toStrictEqual({ success: true });
        expect(mockSendInAppNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            expiresAt: expect.any(Date) as unknown as Date,
          }),
        );
      });

      test("should handle past expiry date", async () => {
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const pastDate = new Date("2020-01-01");
        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: pastDate,
        };

        const result = await sendAuctionNotification(params);

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
        mockSendPushNotification.mockResolvedValue({ success: true });
        mockSendEmailNotification.mockResolvedValue({ success: false });
        mockSendInAppNotification.mockResolvedValue({ success: true });

        const params: AuctionNotificationParams = {
          text: { first: "テスト商品", second: "テスト商品詳細" },
          auctionEventType: AuctionEventType.AUCTION_WIN,
          auctionId: "auction-123",
          recipientUserId: ["user-1"],
          sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP],
          actionUrl: "https://example.com/auction/123",
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: new Date("2024-12-31"),
        };

        const result = await sendAuctionNotification(params);

        // 最初に失敗した通知でエラーが返される（この場合はEMAIL）
        expect(result).toStrictEqual({
          success: false,
          error: "メール通知の送信に失敗しました",
        });
        expect(mockSendPushNotification).toHaveBeenCalledTimes(1);
        expect(mockSendEmailNotification).toHaveBeenCalledTimes(1);
        expect(mockSendInAppNotification).not.toHaveBeenCalled(); // エラーで処理が止まるため
      });

      test("should handle all notification types for different auction events", async () => {
        mockSendPushNotification.mockResolvedValue({ success: true });
        mockSendEmailNotification.mockResolvedValue({ success: true });
        mockSendInAppNotification.mockResolvedValue({ success: true });

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

        for (const eventType of auctionEvents) {
          const params: AuctionNotificationParams = {
            text: { first: "テスト商品", second: "テスト商品詳細" },
            auctionEventType: eventType,
            auctionId: "auction-123",
            recipientUserId: ["user-1"],
            sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP],
            actionUrl: "https://example.com/auction/123",
            sendTiming: NotificationSendTiming.NOW,
            sendScheduledDate: null,
            expiresAt: new Date("2024-12-31"),
          };

          const result = await sendAuctionNotification(params);
          expect(result).toStrictEqual({ success: true });
        }

        // 各イベントタイプで3つの通知方法が呼ばれるため、合計27回
        expect(mockSendPushNotification).toHaveBeenCalledTimes(9);
        expect(mockSendEmailNotification).toHaveBeenCalledTimes(9);
        expect(mockSendInAppNotification).toHaveBeenCalledTimes(9);
      });
    });
  });
});
