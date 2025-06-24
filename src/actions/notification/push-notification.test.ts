import type { PushSubscription } from "@prisma/client";
import type { Session } from "next-auth";
import type { SendResult } from "web-push";
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数のインポート
import { getAuthSession } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { pushSubscriptionFactory, userSettingsFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { NotificationSendMethod, NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import webPush from "web-push";

import type { NotificationParams } from "./email-notification";
import { deleteSubscription, getRecordId, saveSubscription, sendPushNotification } from "./push-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 外部依存のモック
vi.mock("@/lib/utils", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数の型定義
const mockGetAuthSession = vi.mocked(getAuthSession);
const mockWebPush = vi.mocked(webPush);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テストデータのファクトリー関数
function createValidNotificationParams(overrides: Partial<NotificationParams> = {}): NotificationParams {
  return {
    recipientUserIds: ["user-1", "user-2"],
    title: "テスト通知",
    message: "テストメッセージ",
    sendMethods: [NotificationSendMethod.WEB_PUSH],
    senderUserId: null,
    actionUrl: "https://example.com",
    targetType: NotificationTargetType.USER,
    groupId: null,
    taskId: null,
    auctionId: null,
    sendTiming: NotificationSendTiming.NOW,
    sendScheduledDate: null,
    expiresAt: null,
    notificationId: null,
    sentAt: null,
    ...overrides,
  };
}

// ユーザー設定のモックデータを作成するヘルパー関数
function createUserSettingsMock(data: Array<{ isPushEnabled: boolean; userId: string }>) {
  return data.map((item) =>
    userSettingsFactory.build({
      isPushEnabled: item.isPushEnabled,
      userId: item.userId,
    }),
  );
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("sendPushNotification", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // 環境変数のモック設定
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
    process.env.VAPID_PRIVATE_KEY = "test-private-key";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should send push notification successfully", async () => {
      // Arrange
      const params = createValidNotificationParams();

      // ユーザー設定のモック（正しい型で作成）
      const userSettings = [
        userSettingsFactory.build({ isPushEnabled: true, userId: "user-1" }),
        userSettingsFactory.build({ isPushEnabled: true, userId: "user-2" }),
      ];
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      // プッシュ購読情報のモック
      const pushSubscriptions = [
        pushSubscriptionFactory.build({
          id: "sub-1",
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          p256dh: "test-p256dh-1",
          auth: "test-auth-1",
          deviceId: "device-1",
          updatedAt: new Date("2024-01-01T10:00:00Z"),
        }),
        pushSubscriptionFactory.build({
          id: "sub-2",
          userId: "user-2",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint2",
          p256dh: "test-p256dh-2",
          auth: "test-auth-2",
          deviceId: "device-2",
          updatedAt: new Date("2024-01-01T10:00:00Z"),
        }),
      ];
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      // webPush.sendNotificationのモック（正しい戻り値の型）
      mockWebPush.sendNotification.mockResolvedValue({} as unknown as SendResult);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        sent: 2,
        failed: 0,
        totalTargets: 2,
      });

      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: ["user-1", "user-2"] },
        },
        select: {
          isPushEnabled: true,
          userId: true,
        },
      });

      expect(prismaMock.pushSubscription.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: ["user-1", "user-2"] },
          p256dh: { not: null },
          auth: { not: null },
        },
      });

      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(2);
    });

    test("should handle users with push notifications disabled", async () => {
      // Arrange
      const params = createValidNotificationParams();

      // 一部のユーザーがプッシュ通知を無効にしている
      const userSettings = [
        userSettingsFactory.build({ isPushEnabled: true, userId: "user-1" }),
        userSettingsFactory.build({ isPushEnabled: false, userId: "user-2" }),
      ];
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      // プッシュ購読情報のモック（有効なユーザーのみ）
      const pushSubscriptions = [
        pushSubscriptionFactory.build({
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          p256dh: "test-p256dh-1",
          auth: "test-auth-1",
          deviceId: "device-1",
        }),
      ];
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      mockWebPush.sendNotification.mockResolvedValue({} as unknown as SendResult);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        sent: 1,
        failed: 0,
        totalTargets: 1,
      });

      // 有効なユーザーのみが対象になることを確認
      expect(prismaMock.pushSubscription.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: ["user-1"] }, // user-2は除外される
          p256dh: { not: null },
          auth: { not: null },
        },
      });
    });

    test("should handle duplicate devices correctly", async () => {
      // Arrange
      const params = createValidNotificationParams();

      const userSettings = [userSettingsFactory.build({ isPushEnabled: true, userId: "user-1" })];
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      // 同じデバイスIDで複数の購読情報がある場合
      const pushSubscriptions = [
        pushSubscriptionFactory.build({
          id: "sub-1",
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          p256dh: "test-p256dh-1",
          auth: "test-auth-1",
          deviceId: "device-1",
          updatedAt: new Date("2024-01-01T09:00:00Z"), // 古い
        }),
        pushSubscriptionFactory.build({
          id: "sub-2",
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint2",
          p256dh: "test-p256dh-2",
          auth: "test-auth-2",
          deviceId: "device-1",
          updatedAt: new Date("2024-01-01T10:00:00Z"), // 新しい
        }),
      ];
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      mockWebPush.sendNotification.mockResolvedValue({} as unknown as SendResult);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        sent: 1,
        failed: 0,
        totalTargets: 2,
      });

      // 最新の購読情報のみに送信されることを確認
      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(1);
      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint2",
          keys: {
            p256dh: "test-p256dh-2",
            auth: "test-auth-2",
          },
        },
        JSON.stringify({
          title: "テスト通知",
          body: "テストメッセージ",
          data: { url: "https://example.com" },
        }),
      );
    });

    test("should create payload without actionUrl when not provided", async () => {
      // Arrange
      const params = createValidNotificationParams({
        actionUrl: null,
      });

      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      const pushSubscriptions = [
        pushSubscriptionFactory.build({
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          p256dh: "test-p256dh-1",
          auth: "test-auth-1",
          deviceId: "device-1",
        }),
      ];
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      mockWebPush.sendNotification.mockResolvedValue({} as unknown as SendResult);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        JSON.stringify({
          title: "テスト通知",
          body: "テストメッセージ",
          // actionUrlがnullの場合はdataプロパティが含まれない
        }),
      );
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should return error when no push notification settings found", async () => {
      // Arrange
      const params = createValidNotificationParams();
      prismaMock.userSettings.findMany.mockResolvedValue([]);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "プッシュ通知設定が見つかりません",
      });

      expect(prismaMock.pushSubscription.findMany).not.toHaveBeenCalled();
      expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
    });

    test("should return error when VAPID keys are not configured", async () => {
      // Arrange
      const params = createValidNotificationParams();

      // VAPID キーを削除
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;

      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      // VAPIDキーが設定されていない場合のエラーメッセージを確認
      expect(result).toStrictEqual({
        success: false,
        message: "VAPIDキーが設定されていません。",
      });
    });

    test("should return success with zero sent when no valid subscriptions found", async () => {
      // Arrange
      const params = createValidNotificationParams();

      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      // 有効な購読情報がない
      prismaMock.pushSubscription.findMany.mockResolvedValue([]);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        sent: 0,
        failed: 0,
        totalTargets: 0,
        message: "有効な購読者が見つかりませんでした",
      });
    });

    test("should handle webPush.sendNotification failure", async () => {
      // Arrange
      const params = createValidNotificationParams();

      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      const pushSubscriptions = [
        pushSubscriptionFactory.build({
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          p256dh: "test-p256dh-1",
          auth: "test-auth-1",
          deviceId: "device-1",
        }),
      ];
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      // webPush.sendNotificationが失敗
      const error = new Error("Network error") as Error & { statusCode?: number; body?: string };
      error.statusCode = 500;
      error.body = "Internal Server Error";
      mockWebPush.sendNotification.mockRejectedValue(error);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        sent: 0,
        failed: 1,
        totalTargets: 1,
      });
    });

    test("should delete expired subscription when receiving 410 error", async () => {
      // Arrange
      const params = createValidNotificationParams();

      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      const pushSubscriptions = [
        pushSubscriptionFactory.build({
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          p256dh: "test-p256dh-1",
          auth: "test-auth-1",
          deviceId: "device-1",
        }),
      ];
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      // 410 Gone エラー（購読が無効）
      const error = new Error("Gone") as Error & { statusCode?: number; body?: string };
      error.statusCode = 410;
      error.body = "Gone";
      mockWebPush.sendNotification.mockRejectedValue(error);

      // deleteSubscriptionのモック
      prismaMock.pushSubscription.delete.mockResolvedValue(pushSubscriptions[0]);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        sent: 0,
        failed: 1,
        totalTargets: 1,
      });

      // 無効な購読情報が削除されることを確認
      expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
        where: {
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
        },
      });
    });

    test("should handle subscription with missing keys", async () => {
      // Arrange
      const params = createValidNotificationParams();

      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      // p256dhがnullの購読情報
      const pushSubscriptions = [
        pushSubscriptionFactory.build({
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          p256dh: null,
          auth: "test-auth-1",
          deviceId: "device-1",
        }),
      ];
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        sent: 0,
        failed: 1,
        totalTargets: 1,
      });

      // webPush.sendNotificationは呼ばれない
      expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
    });

    test("should handle general error in try-catch", async () => {
      // Arrange
      const params = createValidNotificationParams();

      // prismaMock.userSettings.findManyでエラーが発生
      prismaMock.userSettings.findMany.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "通知の送信に失敗しました",
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty recipientUserIds array", async () => {
      // Arrange
      const params = createValidNotificationParams({
        recipientUserIds: [],
      });

      prismaMock.userSettings.findMany.mockResolvedValue([]);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "プッシュ通知設定が見つかりません",
      });
    });

    test("should handle subscription without deviceId", async () => {
      // Arrange
      const params = createValidNotificationParams();

      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      // deviceIdがnullの購読情報
      const pushSubscriptions = [
        pushSubscriptionFactory.build({
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          p256dh: "test-p256dh-1",
          auth: "test-auth-1",
          deviceId: null,
        }),
      ];
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      // deviceIdがnullの場合、noDuplicationTargetSubscriptionsが空になり、
      // 結果的にsuccess: falseになる（送信対象が0件のため）
      expect(result).toStrictEqual({
        success: false,
        sent: 0,
        failed: 0,
        totalTargets: 1,
      });

      // deviceIdがnullの場合は送信されない
      expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
    });

    test("should handle very long title and message", async () => {
      // Arrange
      const longTitle = "a".repeat(1000);
      const longMessage = "b".repeat(5000);
      const params = createValidNotificationParams({
        title: longTitle,
        message: longMessage,
      });

      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      const pushSubscriptions = [
        pushSubscriptionFactory.build({
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          p256dh: "test-p256dh-1",
          auth: "test-auth-1",
          deviceId: "device-1",
        }),
      ];
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      mockWebPush.sendNotification.mockResolvedValue({} as unknown as SendResult);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        JSON.stringify({
          title: longTitle,
          body: longMessage,
          data: { url: "https://example.com" },
        }),
      );
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getRecordId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系テスト", () => {
    test("should return record id when subscription exists", async () => {
      // Arrange
      const endpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
      const expectedId = "test-record-id";

      prismaMock.pushSubscription.findUnique.mockResolvedValue({
        id: expectedId,
      } as PushSubscription);

      // Act
      const result = await getRecordId(endpoint);

      // Assert
      expect(result).toBe(expectedId);
      expect(prismaMock.pushSubscription.findUnique).toHaveBeenCalledWith({
        where: {
          endpoint: endpoint,
        },
        select: {
          id: true,
        },
      });
    });

    test("should return null when subscription does not exist", async () => {
      // Arrange
      const endpoint = "https://fcm.googleapis.com/fcm/send/nonexistent-endpoint";

      prismaMock.pushSubscription.findUnique.mockResolvedValue(null);

      // Act
      const result = await getRecordId(endpoint);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("異常系テスト", () => {
    test("should throw error when database query fails", async () => {
      // Arrange
      const endpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";

      prismaMock.pushSubscription.findUnique.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(getRecordId(endpoint)).rejects.toThrow("Database error");
    });
  });

  describe("境界値テスト", () => {
    test("should handle empty endpoint string", async () => {
      // Arrange
      const endpoint = "";

      prismaMock.pushSubscription.findUnique.mockResolvedValue(null);

      // Act
      const result = await getRecordId(endpoint);

      // Assert
      expect(result).toBeNull();
    });

    test("should handle very long endpoint string", async () => {
      // Arrange
      const endpoint = "https://fcm.googleapis.com/fcm/send/" + "a".repeat(1000);

      prismaMock.pushSubscription.findUnique.mockResolvedValue(null);

      // Act
      const result = await getRecordId(endpoint);

      // Assert
      expect(result).toBeNull();
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("saveSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // getAuthSessionのモック設定
    mockGetAuthSession.mockResolvedValue({
      user: { id: "test-user-id" },
    } as unknown as Session);
  });

  describe("正常系テスト", () => {
    test("should create new subscription when recordId is dummy", async () => {
      // Arrange
      const subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
        expirationTime: 1234567890000,
        keys: {
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        recordId: "00000000000000000000000000000000", // ダミーID
        deviceId: "test-device-id",
      };

      const createdSubscription = pushSubscriptionFactory.build({
        id: "new-subscription-id",
        userId: "test-user-id",
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        deviceId: subscription.deviceId,
      });

      prismaMock.pushSubscription.create.mockResolvedValue(createdSubscription);

      // Act
      const result = await saveSubscription(subscription);

      // Assert
      expect(result).toStrictEqual(createdSubscription);
      expect(prismaMock.pushSubscription.create).toHaveBeenCalledWith({
        data: {
          userId: "test-user-id",
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          expirationTime: new Date(subscription.expirationTime),
          deviceId: subscription.deviceId,
        },
      });
    });

    test("should update existing subscription when recordId is provided", async () => {
      // Arrange
      const subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
        expirationTime: 1234567890000,
        keys: {
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        recordId: "existing-record-id",
        deviceId: "test-device-id",
      };

      const updatedSubscription = pushSubscriptionFactory.build({
        id: subscription.recordId,
        userId: "test-user-id",
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        deviceId: subscription.deviceId,
      });

      prismaMock.pushSubscription.update.mockResolvedValue(updatedSubscription);

      // Act
      const result = await saveSubscription(subscription);

      // Assert
      expect(result).toStrictEqual(updatedSubscription);
      expect(prismaMock.pushSubscription.update).toHaveBeenCalledWith({
        where: {
          id: subscription.recordId,
        },
        data: {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          expirationTime: new Date(subscription.expirationTime),
          userId: "test-user-id",
          deviceId: subscription.deviceId,
        },
      });
    });

    test("should handle null expirationTime", async () => {
      // Arrange
      const subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
        expirationTime: null,
        keys: {
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        recordId: "00000000000000000000000000000000",
        deviceId: "test-device-id",
      };

      const createdSubscription = pushSubscriptionFactory.build();
      prismaMock.pushSubscription.create.mockResolvedValue(createdSubscription);

      // Act
      const result = await saveSubscription(subscription);

      // Assert
      expect(result).toStrictEqual(createdSubscription);
      expect(prismaMock.pushSubscription.create).toHaveBeenCalledWith({
        data: {
          userId: "test-user-id",
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          expirationTime: null,
          deviceId: subscription.deviceId,
        },
      });
    });

    test("should get recordId when not provided", async () => {
      // Arrange
      const subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
        expirationTime: 1234567890000,
        keys: {
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        deviceId: "test-device-id",
      };

      // getRecordIdが既存のIDを返す
      prismaMock.pushSubscription.findUnique.mockResolvedValue({
        id: "existing-id",
      } as PushSubscription);

      const updatedSubscription = pushSubscriptionFactory.build();
      prismaMock.pushSubscription.update.mockResolvedValue(updatedSubscription);

      // Act
      const result = await saveSubscription(subscription);

      // Assert
      expect(result).toStrictEqual(updatedSubscription);
      expect(prismaMock.pushSubscription.findUnique).toHaveBeenCalledWith({
        where: {
          endpoint: subscription.endpoint,
        },
        select: {
          id: true,
        },
      });
      expect(prismaMock.pushSubscription.update).toHaveBeenCalledWith({
        where: {
          id: "existing-id",
        },
        data: expect.any(Object) as unknown as object,
      });
    });
  });

  describe("異常系テスト", () => {
    test("should return error when getAuthSession fails", async () => {
      // Arrange
      const subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
        expirationTime: 1234567890000,
        keys: {
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
      };

      mockGetAuthSession.mockRejectedValue(new Error("Auth error"));

      // Act
      const result = await saveSubscription(subscription);

      // Assert
      expect(result).toStrictEqual({
        error: "購読情報の保存に失敗しました",
      });
    });

    test("should return error when database operation fails", async () => {
      // Arrange
      const subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
        expirationTime: 1234567890000,
        keys: {
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        recordId: "00000000000000000000000000000000",
      };

      prismaMock.pushSubscription.create.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await saveSubscription(subscription);

      // Assert
      expect(result).toStrictEqual({
        error: "購読情報の保存に失敗しました",
      });
    });

    test("should return error when result is undefined", async () => {
      // Arrange
      const subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
        expirationTime: 1234567890000,
        keys: {
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        recordId: "00000000000000000000000000000000",
      };

      prismaMock.pushSubscription.create.mockResolvedValue(undefined as unknown as PushSubscription);

      // Act
      const result = await saveSubscription(subscription);

      // Assert
      expect(result).toStrictEqual({
        error: "保存処理中にエラーが発生しました。",
      });
    });
  });

  describe("境界値テスト", () => {
    test("should handle undefined expirationTime", async () => {
      // Arrange
      const subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
        expirationTime: undefined,
        keys: {
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        recordId: "00000000000000000000000000000000",
      };

      const createdSubscription = pushSubscriptionFactory.build();
      prismaMock.pushSubscription.create.mockResolvedValue(createdSubscription);

      // Act
      const result = await saveSubscription(subscription);

      // Assert
      expect(result).toStrictEqual(createdSubscription);
      expect(prismaMock.pushSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expirationTime: null,
        }) as unknown as object,
      });
    });

    test("should handle empty endpoint string", async () => {
      // Arrange
      const subscription = {
        endpoint: "",
        expirationTime: 1234567890000,
        keys: {
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        recordId: "00000000000000000000000000000000",
      };

      const createdSubscription = pushSubscriptionFactory.build();
      prismaMock.pushSubscription.create.mockResolvedValue(createdSubscription);

      // Act
      const result = await saveSubscription(subscription);

      // Assert
      expect(result).toStrictEqual(createdSubscription);
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("deleteSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系テスト", () => {
    test("should delete subscription successfully", async () => {
      // Arrange
      const endpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
      const deletedSubscription = pushSubscriptionFactory.build({
        endpoint: endpoint,
      });

      prismaMock.pushSubscription.delete.mockResolvedValue(deletedSubscription);

      // Act
      const result = await deleteSubscription(endpoint);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
        where: {
          endpoint: endpoint,
        },
      });
    });
  });

  describe("異常系テスト", () => {
    test("should return success when subscription not found (P2025)", async () => {
      // Arrange
      const endpoint = "https://fcm.googleapis.com/fcm/send/nonexistent-endpoint";
      const error = new Error("Record not found") as Error & { code?: string };
      error.code = "P2025";

      prismaMock.pushSubscription.delete.mockRejectedValue(error);

      // Act
      const result = await deleteSubscription(endpoint);

      // Assert
      expect(result).toStrictEqual({ success: true });
    });

    test("should throw error when database operation fails with other error", async () => {
      // Arrange
      const endpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
      const error = new Error("Database connection error");

      prismaMock.pushSubscription.delete.mockRejectedValue(error);

      // Act & Assert
      await expect(deleteSubscription(endpoint)).rejects.toThrow("購読情報の削除に失敗しました");
    });
  });

  describe("境界値テスト", () => {
    test("should handle empty endpoint string", async () => {
      // Arrange
      const endpoint = "";
      const deletedSubscription = pushSubscriptionFactory.build();

      prismaMock.pushSubscription.delete.mockResolvedValue(deletedSubscription);

      // Act
      const result = await deleteSubscription(endpoint);

      // Assert
      expect(result).toStrictEqual({ success: true });
    });

    test("should handle very long endpoint string", async () => {
      // Arrange
      const endpoint = "https://fcm.googleapis.com/fcm/send/" + "a".repeat(1000);
      const deletedSubscription = pushSubscriptionFactory.build();

      prismaMock.pushSubscription.delete.mockResolvedValue(deletedSubscription);

      // Act
      const result = await deleteSubscription(endpoint);

      // Assert
      expect(result).toStrictEqual({ success: true });
    });
  });
});
