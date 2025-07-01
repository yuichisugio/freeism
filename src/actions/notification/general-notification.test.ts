import { NotificationSendMethod, NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { GeneralNotificationParams } from "./general-notification";
import { sendEmailNotification } from "./email-notification";
import { sendGeneralNotification } from "./general-notification";
import { sendInAppNotification } from "./in-app-notification";
import { getNotificationTargetUserIds } from "./notification-utilities";
import { sendPushNotification } from "./push-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 依存関数のモック
vi.mock("./notification-utilities", () => ({
  getNotificationTargetUserIds: vi.fn(),
}));

vi.mock("./email-notification", () => ({
  sendEmailNotification: vi.fn(),
}));

vi.mock("./in-app-notification", () => ({
  sendInAppNotification: vi.fn(),
}));

vi.mock("./push-notification", () => ({
  sendPushNotification: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数の型定義
const mockGetNotificationTargetUserIds = vi.mocked(getNotificationTargetUserIds);
const mockSendEmailNotification = vi.mocked(sendEmailNotification);
const mockSendInAppNotification = vi.mocked(sendInAppNotification);
const mockSendPushNotification = vi.mocked(sendPushNotification);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テストデータのファクトリー関数
function createValidGeneralNotificationParams(
  overrides: Partial<GeneralNotificationParams> = {},
): GeneralNotificationParams {
  return {
    title: "テスト通知",
    message: "テストメッセージ",
    sendMethods: [NotificationSendMethod.IN_APP],
    targetType: NotificationTargetType.USER,
    recipientUserIds: ["user-1", "user-2"],
    groupId: null,
    taskId: null,
    auctionId: null,
    actionUrl: "https://example.com",
    sendTiming: NotificationSendTiming.NOW,
    sendScheduledDate: null,
    expiresAt: null,
    notificationId: null,
    ...overrides,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

// ヘルパー関数：通知メソッドの呼び出し確認
function expectNotificationMethodCalls(inApp: boolean, email: boolean, push: boolean) {
  if (inApp) {
    expect(mockSendInAppNotification).toHaveBeenCalled();
  } else {
    expect(mockSendInAppNotification).not.toHaveBeenCalled();
  }

  if (email) {
    expect(mockSendEmailNotification).toHaveBeenCalled();
  } else {
    expect(mockSendEmailNotification).not.toHaveBeenCalled();
  }

  if (push) {
    expect(mockSendPushNotification).toHaveBeenCalled();
  } else {
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  }
}

// ヘルパー関数：期待されるNotificationParamsオブジェクトを作成
function createExpectedNotificationParams(params: GeneralNotificationParams, recipientUserIds: string[]) {
  return {
    recipientUserIds,
    title: params.title,
    message: params.message,
    senderUserId: null,
    actionUrl: params.actionUrl,
    targetType: params.targetType,
    groupId: params.groupId,
    taskId: params.taskId,
    auctionId: params.auctionId,
    sendTiming: params.sendTiming,
    sendScheduledDate: params.sendScheduledDate,
    expiresAt: params.expiresAt,
    sendMethods: params.sendMethods,
    notificationId: params.notificationId,
    sentAt: null,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("sendGeneralNotification", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockGetNotificationTargetUserIds.mockResolvedValue(["user-1", "user-2"]);
    mockSendInAppNotification.mockResolvedValue({ success: true });
    mockSendEmailNotification.mockResolvedValue({ success: true });
    mockSendPushNotification.mockResolvedValue(createPushNotificationResult());
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test.each([
      {
        description: "should send in-app notification successfully",
        sendMethods: [NotificationSendMethod.IN_APP],
        expectedCalls: { inApp: true, email: false, push: false },
      },
      {
        description: "should send email notification successfully",
        sendMethods: [NotificationSendMethod.EMAIL],
        expectedCalls: { inApp: false, email: true, push: false },
      },
      {
        description: "should send push notification successfully",
        sendMethods: [NotificationSendMethod.WEB_PUSH],
        expectedCalls: { inApp: false, email: false, push: true },
      },
      {
        description: "should send multiple notification methods successfully",
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        expectedCalls: { inApp: true, email: true, push: true },
      },
    ])("$description", async ({ sendMethods, expectedCalls }) => {
      // Arrange
      const params = createValidGeneralNotificationParams({ sendMethods });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(NotificationTargetType.USER, {
        userIds: ["user-1", "user-2"],
        groupId: undefined,
        taskId: undefined,
      });
      expectNotificationMethodCalls(expectedCalls.inApp, expectedCalls.email, expectedCalls.push);

      // 呼び出された通知メソッドのパラメータ確認
      const expectedParams = createExpectedNotificationParams(params, ["user-1", "user-2"]);
      if (expectedCalls.inApp) {
        expect(mockSendInAppNotification).toHaveBeenCalledWith(expectedParams);
      }
      if (expectedCalls.email) {
        expect(mockSendEmailNotification).toHaveBeenCalledWith(expectedParams);
      }
      if (expectedCalls.push) {
        expect(mockSendPushNotification).toHaveBeenCalledWith(expectedParams);
      }
    });

    test.each([
      {
        description: "should handle GROUP target type correctly",
        targetType: NotificationTargetType.GROUP,
        params: { recipientUserIds: null, groupId: "group-1", taskId: null },
        expectedCall: { userIds: undefined, groupId: "group-1", taskId: undefined },
      },
      {
        description: "should handle TASK target type correctly",
        targetType: NotificationTargetType.TASK,
        params: { recipientUserIds: null, groupId: null, taskId: "task-1" },
        expectedCall: { userIds: undefined, groupId: undefined, taskId: "task-1" },
      },
      {
        description: "should handle SYSTEM target type correctly",
        targetType: NotificationTargetType.SYSTEM,
        params: { recipientUserIds: null, groupId: null, taskId: null },
        expectedCall: { userIds: undefined, groupId: undefined, taskId: undefined },
      },
      {
        description: "should handle USER target type correctly",
        targetType: NotificationTargetType.USER,
        params: { recipientUserIds: ["user-1", "user-2"], groupId: null, taskId: null },
        expectedCall: { userIds: ["user-1", "user-2"], groupId: undefined, taskId: undefined },
      },
    ])("$description", async ({ targetType, params, expectedCall }) => {
      // Arrange
      const notificationParams = createValidGeneralNotificationParams({
        targetType,
        ...params,
      });

      // Act
      const result = await sendGeneralNotification(notificationParams);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(targetType, expectedCall);
    });

    test.each([
      {
        description: "should handle scheduled notification with past date and notificationId",
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: new Date(Date.now() - 1000 * 60 * 60), // 1時間前
        notificationId: "notification-1",
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
        expectedCalls: { inApp: true, email: false, push: false }, // 過去の予約送信
      },
      {
        description: "should handle scheduled notification with future date",
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: new Date(Date.now() + 1000 * 60 * 60), // 1時間後
        notificationId: null,
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
        expectedCalls: { inApp: true, email: true, push: false }, // 未来の予約送信
      },
    ])("$description", async ({ sendTiming, sendScheduledDate, notificationId, sendMethods, expectedCalls }) => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendTiming,
        sendScheduledDate,
        notificationId,
        sendMethods,
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expectNotificationMethodCalls(expectedCalls.inApp, expectedCalls.email, expectedCalls.push);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should return error when no target users found", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams();
      mockGetNotificationTargetUserIds.mockResolvedValue([]);

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: false, error: "通知の対象者が見つかりません" });
      expectNotificationMethodCalls(false, false, false);
    });

    test.each([
      {
        description: "should return error when in-app notification fails",
        sendMethods: [NotificationSendMethod.IN_APP],
        mockSetup: () => {
          mockSendInAppNotification.mockResolvedValue({ success: false, error: "アプリ内通知エラー" });
        },
        expectedError: "アプリ内通知の送信に失敗しました",
        expectedCalls: { inApp: true, email: false, push: false },
      },
      {
        description: "should return error when push notification fails",
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.WEB_PUSH],
        mockSetup: () => {
          mockSendPushNotification.mockResolvedValue(
            createPushNotificationResult({ success: false, message: "プッシュ通知エラー" }),
          );
        },
        expectedError: "プッシュ通知の送信に失敗しました",
        expectedCalls: { inApp: true, email: false, push: true },
      },
      {
        description: "should return error when email notification fails",
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
        mockSetup: () => {
          mockSendEmailNotification.mockResolvedValue({ success: false, error: "メール通知エラー" });
        },
        expectedError: "メール通知の送信に失敗しました",
        expectedCalls: { inApp: true, email: true, push: false },
      },
    ])("$description", async ({ sendMethods, mockSetup, expectedError, expectedCalls }) => {
      // Arrange
      const params = createValidGeneralNotificationParams({ sendMethods });
      mockSetup();

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: false, error: expectedError });
      expectNotificationMethodCalls(expectedCalls.inApp, expectedCalls.email, expectedCalls.push);
    });

    test.each([
      {
        description: "should return error when getNotificationTargetUserIds throws error",
        mockSetup: () => {
          mockGetNotificationTargetUserIds.mockRejectedValue(new Error("データベースエラー"));
        },
        expectedError: "通知エラーが発生しました",
      },
      {
        description: "should return error when sendInAppNotification throws error",
        mockSetup: () => {
          mockSendInAppNotification.mockRejectedValue(new Error("予期しないエラー"));
        },
        expectedError: "通知エラーが発生しました",
      },
    ])("$description", async ({ mockSetup, expectedError }) => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [NotificationSendMethod.IN_APP],
      });
      mockSetup();

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: false, error: expectedError });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値・エッジケーステスト", () => {
    test("should handle empty sendMethods array", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [],
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expectNotificationMethodCalls(false, false, false);
    });

    test.each([
      {
        description: "should handle null values in optional fields",
        overrides: {
          recipientUserIds: null,
          groupId: null,
          taskId: null,
          auctionId: null,
          actionUrl: null,
          sendScheduledDate: null,
          expiresAt: null,
          notificationId: null,
        },
        expectedCall: {
          userIds: undefined,
          groupId: undefined,
          taskId: undefined,
        },
      },
      {
        description: "should handle undefined values gracefully",
        overrides: {
          recipientUserIds: undefined as unknown as string[],
          groupId: undefined as unknown as string,
          taskId: undefined as unknown as string,
          auctionId: undefined as unknown as string,
          actionUrl: undefined as unknown as string,
          sendScheduledDate: undefined as unknown as Date,
          expiresAt: undefined as unknown as Date,
          notificationId: undefined as unknown as string,
        },
        expectedCall: {
          userIds: undefined,
          groupId: undefined,
          taskId: undefined,
        },
      },
    ])("$description", async ({ overrides, expectedCall }) => {
      // Arrange
      const params = createValidGeneralNotificationParams(overrides);

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(NotificationTargetType.USER, expectedCall);
    });

    test.each([
      {
        description: "should handle single user in recipientUserIds",
        recipientUserIds: ["user-1"],
        expectedUserIds: ["user-1"],
      },
      {
        description: "should handle large number of users",
        recipientUserIds: Array.from({ length: 1000 }, (_, i) => `user-${i}`),
        expectedUserIds: Array.from({ length: 1000 }, (_, i) => `user-${i}`),
      },
    ])("$description", async ({ recipientUserIds, expectedUserIds }) => {
      // Arrange
      const params = createValidGeneralNotificationParams({ recipientUserIds });
      mockGetNotificationTargetUserIds.mockResolvedValue(expectedUserIds);

      // Act
      const result = await sendGeneralNotification(params);

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
        description: "should handle empty string values",
        title: "",
        message: "",
        actionUrl: "",
      },
      {
        description: "should handle very long title and message",
        title: "a".repeat(1000),
        message: "b".repeat(5000),
        actionUrl: "https://example.com",
      },
      {
        description: "should handle special characters in title and message",
        title: "特殊文字テスト!@#$%^&*()_+-=[]{}|;':\",./<>?",
        message: "改行\nタブ\t特殊文字🎉📧💌",
        actionUrl: "https://example.com",
      },
    ])("$description", async ({ title, message, actionUrl }) => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        title,
        message,
        actionUrl,
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockSendInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title,
          message,
          actionUrl,
        }),
      );
    });

    test("should handle concurrent notification sending", async () => {
      // Arrange
      const params1 = createValidGeneralNotificationParams({ title: "通知1" });
      const params2 = createValidGeneralNotificationParams({ title: "通知2" });

      // Act
      const [result1, result2] = await Promise.all([
        sendGeneralNotification(params1),
        sendGeneralNotification(params2),
      ]);

      // Assert
      expect(result1).toStrictEqual({ success: true });
      expect(result2).toStrictEqual({ success: true });
    });

    test.each([
      {
        description: "should handle scheduled notification with exact current time",
        sendScheduledDate: new Date(),
        notificationId: "notification-1",
      },
      {
        description: "should handle notification with very old scheduled date",
        sendScheduledDate: new Date("2000-01-01T00:00:00Z"),
        notificationId: "old-notification",
      },
    ])("$description", async ({ sendScheduledDate, notificationId }) => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate,
        notificationId,
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockSendInAppNotification).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("複合条件テスト", () => {
    test("should handle multiple failures in sequence", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
      });

      // 最初のアプリ内通知が失敗
      mockSendInAppNotification.mockResolvedValue({
        success: false,
        error: "アプリ内通知エラー",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: false, error: "アプリ内通知の送信に失敗しました" });
      // 最初の失敗で処理が停止するため、後続の通知は呼ばれない
      expectNotificationMethodCalls(true, false, false);
    });

    test.each([
      {
        description: "should handle scheduled notification without notificationId",
        pastDate: new Date(Date.now() - 1000 * 60 * 60), // 1時間前
        notificationId: null,
        expectedCalls: { inApp: true, email: true, push: false }, // 通常の送信処理
      },
      {
        description: "should handle scheduled notification with future date and notificationId",
        pastDate: new Date(Date.now() + 1000 * 60 * 60), // 1時間後
        notificationId: "notification-1",
        expectedCalls: { inApp: true, email: true, push: false }, // 通常の送信処理
      },
    ])("$description", async ({ pastDate, notificationId, expectedCalls }) => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: pastDate,
        notificationId,
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expectNotificationMethodCalls(expectedCalls.inApp, expectedCalls.email, expectedCalls.push);
    });

    test("should handle notification with all optional fields as null", async () => {
      // Arrange
      const params: GeneralNotificationParams = {
        title: "必須フィールドのみ",
        message: "必須フィールドのみのメッセージ",
        sendMethods: [NotificationSendMethod.IN_APP],
        targetType: NotificationTargetType.USER,
        recipientUserIds: ["user-1"],
        groupId: null,
        taskId: null,
        auctionId: null,
        actionUrl: null,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
        notificationId: null,
      };

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
    });
  });
});
