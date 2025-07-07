import type { PushSubscription } from "@prisma/client";
import type { Session } from "next-auth";
import type { SendResult } from "web-push";
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

// 統合されたテストデータ作成ヘルパー関数
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

// 統合されたユーザー設定モック作成関数
function createUserSettingsMock(data: Array<{ isPushEnabled: boolean; userId: string }>) {
  return data.map((item) =>
    userSettingsFactory.build({
      isPushEnabled: item.isPushEnabled,
      userId: item.userId,
    }),
  );
}

// 統合されたプッシュ購読情報モック作成関数
function createPushSubscriptionMock(overrides: Partial<PushSubscription> = {}) {
  return pushSubscriptionFactory.build({
    endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
    p256dh: "test-p256dh",
    auth: "test-auth",
    deviceId: "test-device-id",
    userId: "test-user-id",
    updatedAt: new Date("2024-01-01T10:00:00Z"),
    ...overrides,
  });
}

// 統合されたサブスクリプション作成データ関数
function createSubscriptionData(
  overrides: Partial<{
    endpoint: string;
    expirationTime: number | null | undefined;
    keys: { p256dh: string; auth: string };
    recordId?: string;
    deviceId?: string;
  }> = {},
) {
  return {
    endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
    expirationTime: 1234567890000,
    keys: {
      p256dh: "test-p256dh",
      auth: "test-auth",
    },
    deviceId: "test-device-id",
    ...overrides,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("sendPushNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
    process.env.VAPID_PRIVATE_KEY = "test-private-key";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should send push notification successfully to multiple users", async () => {
      // Arrange
      const params = createValidNotificationParams();
      const userSettings = createUserSettingsMock([
        { isPushEnabled: true, userId: "user-1" },
        { isPushEnabled: true, userId: "user-2" },
      ]);
      const pushSubscriptions = [
        createPushSubscriptionMock({
          id: "sub-1",
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          p256dh: "test-p256dh-1",
          auth: "test-auth-1",
          deviceId: "device-1",
        }),
        createPushSubscriptionMock({
          id: "sub-2",
          userId: "user-2",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint2",
          p256dh: "test-p256dh-2",
          auth: "test-auth-2",
          deviceId: "device-2",
        }),
      ];

      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);
      mockWebPush.sendNotification.mockResolvedValue({} as unknown as SendResult);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        sent: 2,
        failed: 0,
        totalTargets: 2,
        message: "通知の送信に成功しました",
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
      const userSettings = createUserSettingsMock([
        { isPushEnabled: true, userId: "user-1" },
        { isPushEnabled: false, userId: "user-2" },
      ]);
      const pushSubscriptions = [createPushSubscriptionMock({ userId: "user-1", deviceId: "device-1" })];

      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);
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
        message: "通知の送信に成功しました",
      });
      expect(prismaMock.pushSubscription.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: ["user-1"] },
          p256dh: { not: null },
          auth: { not: null },
        },
      });
      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(1);
    });

    test("should handle duplicate devices correctly", async () => {
      // Arrange
      const params = createValidNotificationParams();
      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      const pushSubscriptions = [
        createPushSubscriptionMock({
          id: "sub-1",
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          deviceId: "device-1",
          updatedAt: new Date("2024-01-01T09:00:00Z"), // 古い
        }),
        createPushSubscriptionMock({
          id: "sub-2",
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint2",
          deviceId: "device-1",
          updatedAt: new Date("2024-01-01T10:00:00Z"), // 新しい
        }),
      ];

      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);
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
        message: "通知の送信に成功しました",
      });
      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(1);
      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint2",
          keys: {
            p256dh: "test-p256dh",
            auth: "test-auth",
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
      const params = createValidNotificationParams({ actionUrl: null });
      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      const pushSubscriptions = [createPushSubscriptionMock({ userId: "user-1", deviceId: "device-1" })];

      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);
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
      expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(1);
      expect(mockWebPush.sendNotification).toHaveBeenCalledWith(
        expect.any(Object),
        JSON.stringify({
          title: "テスト通知",
          body: "テストメッセージ",
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
        sent: 0,
        failed: 0,
        totalTargets: 0,
        message: "プッシュ通知設定が見つかりません",
      });
      expect(prismaMock.pushSubscription.findMany).not.toHaveBeenCalled();
      expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
    });

    test("should return error when VAPID keys are not configured", async () => {
      // Arrange
      const params = createValidNotificationParams();
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;

      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        sent: 0,
        failed: 0,
        totalTargets: 0,
        message: "VAPIDキーが設定されていません。",
      });
    });

    test("should return success with zero sent when no valid subscriptions found", async () => {
      // Arrange
      const params = createValidNotificationParams();
      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);

      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);
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

    test("should handle webPush.sendNotification failure and expired subscriptions", async () => {
      // Arrange
      const params = createValidNotificationParams();
      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      const pushSubscriptions = [
        createPushSubscriptionMock({
          userId: "user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
          deviceId: "device-1",
        }),
      ];

      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      // 410 Gone エラー（購読が無効）をテスト
      const error = new Error("Gone") as Error & { statusCode?: number; body?: string };
      error.statusCode = 410;
      error.body = "Gone";
      mockWebPush.sendNotification.mockRejectedValue(error);
      prismaMock.pushSubscription.delete.mockResolvedValue(pushSubscriptions[0]);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false, // 修正: 送信が1件も成功していないため、successはfalse
        sent: 0,
        failed: 1,
        totalTargets: 1,
        message: "通知の送信に成功しました",
      });
      expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
        where: {
          endpoint: "https://fcm.googleapis.com/fcm/send/endpoint1",
        },
      });
    });

    test("should handle subscription with missing keys and general errors", async () => {
      // Arrange - missing keys test
      const params = createValidNotificationParams();
      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      const pushSubscriptions = [
        createPushSubscriptionMock({
          userId: "user-1",
          p256dh: null,
          deviceId: "device-1",
        }),
      ];

      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false, // 修正: 送信が1件も成功していないため、successはfalse
        sent: 0,
        failed: 1,
        totalTargets: 1,
        message: "通知の送信に成功しました",
      });
      expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
    });

    test("should handle general database error", async () => {
      // Arrange
      const params = createValidNotificationParams();
      prismaMock.userSettings.findMany.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await sendPushNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        sent: 0,
        failed: 0,
        totalTargets: 0,
        message: "通知の送信に失敗しました: Database error",
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle edge cases: empty recipients, missing deviceId", async () => {
      // 空のrecipientUserIds
      const emptyRecipientsParams = createValidNotificationParams({ recipientUserIds: [] });
      prismaMock.userSettings.findMany.mockResolvedValue([]);

      const emptyResult = await sendPushNotification(emptyRecipientsParams);
      expect(emptyResult).toStrictEqual({
        success: false,
        sent: 0,
        failed: 0,
        totalTargets: 0,
        message: "プッシュ通知設定が見つかりません",
      });
    });

    test("should handle edge cases: deviceId is null", async () => {
      const params = createValidNotificationParams();
      const userSettings = createUserSettingsMock([{ isPushEnabled: true, userId: "user-1" }]);
      const pushSubscriptions = [createPushSubscriptionMock({ userId: "user-1", deviceId: null })];

      prismaMock.userSettings.findMany.mockResolvedValue(userSettings);
      prismaMock.pushSubscription.findMany.mockResolvedValue(pushSubscriptions);

      const deviceIdResult = await sendPushNotification(params);
      expect(deviceIdResult).toStrictEqual({
        success: false, // deviceIdがnullの場合は送信対象が空になりsuccessCountが0のため、successはfalse
        sent: 0,
        failed: 0,
        totalTargets: 1,
        message: "通知の送信に成功しました",
      });
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("getRecordId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    test("should handle various endpoint scenarios", async () => {
      // Arrange
      const validEndpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
      const expectedId = "test-record-id";

      prismaMock.pushSubscription.findUnique.mockResolvedValue({ id: expectedId } as PushSubscription);

      // Act
      const validResult = await getRecordId(validEndpoint);

      // Assert
      expect(validResult).toStrictEqual({ success: true, data: expectedId, message: "購読情報のIDを取得しました" });
    });

    test("should handle edge cases: record not found", async () => {
      // Arrange
      const validEndpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
      prismaMock.pushSubscription.findUnique.mockResolvedValue(null);

      // Act
      const nullResult = await getRecordId(validEndpoint);

      // Assert
      expect(nullResult).toStrictEqual({ success: false, data: null, message: "購読情報が見つかりません" });
    });
  });

  describe("異常系", () => {
    test("should throw error when endpoint is empty", async () => {
      // Arrange
      const emptyEndpoint = "";

      // Act & Assert
      await expect(getRecordId(emptyEndpoint)).rejects.toThrow("エンドポイントがありません");
    });

    test("should throw error when database error occurs", async () => {
      // Arrange
      const validEndpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
      prismaMock.pushSubscription.findUnique.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(getRecordId(validEndpoint)).rejects.toThrow("Database error");
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("saveSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthSession.mockResolvedValue({
      user: { id: "test-user-id" },
    } as unknown as Session);
  });

  describe("正常系テスト", () => {
    test("should create new subscription when recordId is dummy", async () => {
      // Arrange
      const subscription = createSubscriptionData({
        recordId: "00000000000000000000000000000000", // ダミーID
      });
      const createdSubscription = createPushSubscriptionMock({ id: "new-subscription-id" });

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
          expirationTime: new Date(subscription.expirationTime!),
          deviceId: subscription.deviceId,
        },
      });
    });

    test("should update existing subscription when recordId is provided", async () => {
      // Arrange
      const subscription = createSubscriptionData({ recordId: "existing-record-id" });
      const updatedSubscription = createPushSubscriptionMock({ id: subscription.recordId });

      prismaMock.pushSubscription.update.mockResolvedValue(updatedSubscription);

      // Act
      const result = await saveSubscription(subscription);

      // Assert
      expect(result).toStrictEqual(updatedSubscription);
      expect(prismaMock.pushSubscription.update).toHaveBeenCalledWith({
        where: { id: subscription.recordId! },
        data: expect.objectContaining({
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userId: "test-user-id",
          deviceId: subscription.deviceId,
        }) as unknown as object,
      });
    });

    test.each([{ expirationTime: null }, { expirationTime: undefined }])(
      "should handle various expirationTime values and get recordId when not provided",
      async (subscription) => {
        // Arrange
        const subscription2 = createSubscriptionData(subscription);
        const createdSubscription = createPushSubscriptionMock();
        prismaMock.pushSubscription.create.mockResolvedValue(createdSubscription);

        // Act
        const nullResult = await saveSubscription(subscription2);

        // Assert
        expect(nullResult).toStrictEqual(createdSubscription);
      },
    );

    test("should handle various expirationTime values and get recordId when not provided", async () => {
      // Arrange
      const noRecordId = createSubscriptionData();
      delete (noRecordId as { recordId?: string }).recordId;
      const createdSubscription = createPushSubscriptionMock();

      prismaMock.pushSubscription.findUnique.mockResolvedValue({ id: "existing-id" } as PushSubscription);
      prismaMock.pushSubscription.update.mockResolvedValue(createdSubscription);

      // Act
      const getRecordIdResult = await saveSubscription(noRecordId);

      // Assert
      expect(getRecordIdResult).toStrictEqual(createdSubscription);
      expect(prismaMock.pushSubscription.findUnique).toHaveBeenCalledWith({
        where: { endpoint: noRecordId.endpoint },
        select: { id: true },
      });
    });
  });

  describe("異常系・境界値テスト", () => {
    test("should throw error when authentication fails", async () => {
      // Arrange
      mockGetAuthSession.mockRejectedValue(new Error("Auth error"));
      const subscription = createSubscriptionData();

      // Act & Assert
      await expect(saveSubscription(subscription)).rejects.toThrow("購読情報の保存に失敗しました: Auth error");
    });

    test("should throw error when database operation fails", async () => {
      // Arrange
      const subscription = createSubscriptionData({
        recordId: "00000000000000000000000000000000",
      });
      prismaMock.pushSubscription.create.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(saveSubscription(subscription)).rejects.toThrow("購読情報の保存に失敗しました: Database error");
    });

    test("should throw error when result is undefined", async () => {
      // Arrange
      const subscription = createSubscriptionData({
        recordId: "00000000000000000000000000000000",
      });
      prismaMock.pushSubscription.create.mockResolvedValue(undefined as unknown as PushSubscription);

      // Act & Assert
      await expect(saveSubscription(subscription)).rejects.toThrow("保存処理中にエラーが発生しました。");
    });

    test("should throw error when subscription data is incomplete", async () => {
      // Arrange
      const incompleteSubscription = createSubscriptionData({ endpoint: "" });

      // Act & Assert
      await expect(saveSubscription(incompleteSubscription)).rejects.toThrow(
        "購読情報の保存に失敗しました: 購読情報が不完全です",
      );
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("deleteSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    test("should delete subscription successfully", async () => {
      // 正常系: 削除成功
      const validEndpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
      const deletedSubscription = createPushSubscriptionMock({ endpoint: validEndpoint });

      prismaMock.pushSubscription.delete.mockResolvedValue(deletedSubscription);
      const successResult = await deleteSubscription(validEndpoint);
      expect(successResult).toStrictEqual({ success: true });
    });

    test("should handle record not found (P2025) as success", async () => {
      // 異常系: レコードが見つからない場合（P2025エラー）
      const validEndpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
      const notFoundError = new Error("Record not found") as Error & { code?: string };
      notFoundError.code = "P2025";
      prismaMock.pushSubscription.delete.mockRejectedValue(notFoundError);

      const notFoundResult = await deleteSubscription(validEndpoint);
      expect(notFoundResult).toStrictEqual({ success: true });
    });
  });

  describe("異常系", () => {
    test("should throw error when endpoint is empty", async () => {
      // Arrange
      const emptyEndpoint = "";

      // Act & Assert
      await expect(deleteSubscription(emptyEndpoint)).rejects.toThrow(
        "購読情報の削除に失敗しました: エンドポイントがありません",
      );
    });

    test("should throw error when database error occurs", async () => {
      // Arrange
      const validEndpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint";
      prismaMock.pushSubscription.delete.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(deleteSubscription(validEndpoint)).rejects.toThrow("購読情報の削除に失敗しました: Database error");
    });
  });
});
