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

/**
 * テストデータのファクトリー関数
 * @param overrides 上書きするパラメータ
 * @returns テストデータ
 */
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("sendGeneralNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockGetNotificationTargetUserIds.mockResolvedValue(["user-1", "user-2"]);
    mockSendInAppNotification.mockResolvedValue({ success: true, message: "通知を作成しました" });
    mockSendEmailNotification.mockResolvedValue({ success: true, message: "メール通知を送信しました" });
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
      expect(result).toStrictEqual({ success: true, message: "通知の登録を完了しました" });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(NotificationTargetType.USER, {
        userIds: ["user-1", "user-2"],
        groupId: undefined,
        taskId: undefined,
      });
      expectNotificationMethodCalls(expectedCalls.inApp, expectedCalls.email, expectedCalls.push);

      // 呼び出された通知メソッドのパラメータ確認
      const expectedParams = {
        recipientUserIds: ["user-1", "user-2"],
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
        params: { recipientUserIds: ["user-1"], groupId: "group-1", taskId: null },
        expectedCall: { userIds: ["user-1"], groupId: "group-1", taskId: undefined },
      },
      {
        description: "should handle TASK target type correctly",
        targetType: NotificationTargetType.TASK,
        params: { recipientUserIds: ["user-1"], groupId: null, taskId: "task-1" },
        expectedCall: { userIds: ["user-1"], groupId: undefined, taskId: "task-1" },
      },
      {
        description: "should handle SYSTEM target type correctly",
        targetType: NotificationTargetType.SYSTEM,
        params: { recipientUserIds: ["user-1"], groupId: null, taskId: null },
        expectedCall: { userIds: ["user-1"], groupId: undefined, taskId: undefined },
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
      expect(result).toStrictEqual({ success: true, message: "通知の登録を完了しました" });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(targetType, expectedCall);
    });

    test.each([
      {
        description: "should handle scheduled notification with past date and notificationId",
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: new Date(Date.now() - 1000 * 60 * 60), // 1時間前
        notificationId: "notification-1",
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        expectedCalls: { inApp: true, email: true, push: true }, // 過去の予約送信（メールのみ送信、Pushは送信しない）
        expectedMessage: "通知の登録を完了しました",
      },
      {
        description: "should handle scheduled notification with future date",
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: new Date(Date.now() + 1000 * 60 * 60), // 1時間後
        notificationId: "notification-2",
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        expectedCalls: { inApp: true, email: false, push: false }, // 未来の予約送信（登録のみ）
        expectedMessage: "スケジュール通知の登録を完了しました",
      },
    ])(
      "$description",
      async ({ sendTiming, sendScheduledDate, notificationId, sendMethods, expectedCalls, expectedMessage }) => {
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
        expect(result).toStrictEqual({ success: true, message: expectedMessage });
        expectNotificationMethodCalls(expectedCalls.inApp, expectedCalls.email, expectedCalls.push);
      },
    );
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test.each([
      {
        description: "should handle empty title",
        overrides: { title: "" },
      },
      {
        description: "should handle null title",
        overrides: { title: null },
      },
      {
        description: "should handle undefined title",
        overrides: { title: undefined },
      },

      {
        description: "should handle empty message",
        overrides: { message: "" },
      },
      {
        description: "should handle undefined message",
        overrides: { message: undefined },
      },
      {
        description: "should handle null message",
        overrides: { message: null },
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
        description: "should handle invalid targetType",
        overrides: { targetType: "" },
      },
      {
        description: "should handle invalid targetType",
        overrides: { targetType: undefined },
      },
      {
        description: "should handle invalid targetType",
        overrides: { targetType: null },
      },
      {
        description: "should handle invalid targetType",
        overrides: { targetType: "invalid-type" as unknown as NotificationTargetType },
      },
      {
        description: "should handle empty recipientUserIds",
        overrides: { recipientUserIds: [] },
      },
      {
        description: "should handle undefined recipientUserIds",
        overrides: { recipientUserIds: undefined },
      },
      {
        description: "should handle null recipientUserIds",
        overrides: { recipientUserIds: null },
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
    ])("$description", async ({ overrides }) => {
      // Arrange
      const params = createValidGeneralNotificationParams(overrides as unknown as Partial<GeneralNotificationParams>);

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: false, message: "必須パラメータが不足しています" });
      expect(mockGetNotificationTargetUserIds).not.toHaveBeenCalled();
      expectNotificationMethodCalls(false, false, false);
    });

    test("should return error when no target users found", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams();
      mockGetNotificationTargetUserIds.mockResolvedValue([]);

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: false, message: "通知の対象者が見つかりません" });
      expectNotificationMethodCalls(false, false, false);
    });

    test.each([
      {
        description: "should return error when in-app notification fails",
        sendMethods: [NotificationSendMethod.IN_APP],
        mockSetup: () => {
          mockSendInAppNotification.mockResolvedValue({ success: false, message: "アプリ内通知エラー" });
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
          mockSendEmailNotification.mockResolvedValue({ success: false, message: "メール通知エラー" });
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
      expect(result).toStrictEqual({ success: false, message: expectedError });
      expectNotificationMethodCalls(expectedCalls.inApp, expectedCalls.email, expectedCalls.push);
    });

    test.each([
      {
        description: "should return error when getNotificationTargetUserIds throws error",
        mockSetup: () => {
          mockGetNotificationTargetUserIds.mockRejectedValue(new Error("データベースエラー"));
        },
        expectedError: "データベースエラー",
      },
      {
        description: "should return error when sendInAppNotification throws error",
        mockSetup: () => {
          mockSendInAppNotification.mockRejectedValue(new Error("予期しないエラー"));
        },
        expectedError: "予期しないエラー",
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
      expect(result).toStrictEqual({ success: false, message: expectedError });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値・エッジケーステスト", () => {
    test.each([
      {
        description: "should handle null values in optional fields",
        overrides: {
          recipientUserIds: ["user-1"],
          groupId: null,
          taskId: null,
          auctionId: null,
          actionUrl: null,
          sendScheduledDate: null,
          expiresAt: null,
          notificationId: null,
        },
        expectedCall: {
          userIds: ["user-1"],
          groupId: undefined,
          taskId: undefined,
        },
      },
      {
        description: "should handle undefined values gracefully",
        overrides: {
          recipientUserIds: ["user-1"],
          groupId: undefined as unknown as string,
          taskId: undefined as unknown as string,
          auctionId: undefined as unknown as string,
          actionUrl: undefined as unknown as string,
          sendScheduledDate: undefined as unknown as Date,
          expiresAt: undefined as unknown as Date,
          notificationId: undefined as unknown as string,
        },
        expectedCall: {
          userIds: ["user-1"],
          groupId: undefined,
          taskId: undefined,
        },
      },
    ])("$description", async ({ overrides, expectedCall }) => {
      // Arrange
      const params = createValidGeneralNotificationParams(overrides as unknown as Partial<GeneralNotificationParams>);

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true, message: "通知の登録を完了しました" });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(NotificationTargetType.USER, expectedCall);
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
      expect(result1).toStrictEqual({ success: true, message: "通知の登録を完了しました" });
      expect(result2).toStrictEqual({ success: true, message: "通知の登録を完了しました" });
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
      expect(result).toStrictEqual({ success: true, message: "通知の登録を完了しました" });
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
        message: "アプリ内通知エラー",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: false, message: "アプリ内通知の送信に失敗しました" });
      // 最初の失敗で処理が停止するため、後続の通知は呼ばれない
      expectNotificationMethodCalls(true, false, false);
    });

    test.each([
      {
        description: "should handle scheduled notification without notificationId",
        pastDate: new Date(Date.now() - 1000 * 60 * 60), // 1時間前
        notificationId: null,
        expectedCalls: { inApp: true, email: true, push: false }, // 通常の送信処理
        expectedMessage: "通知の登録を完了しました",
      },
      {
        description: "should handle scheduled notification with future date and notificationId",
        pastDate: new Date(Date.now() + 1000 * 60 * 60), // 1時間後
        notificationId: "notification-1",
        expectedCalls: { inApp: true, email: false, push: false }, // 未来の日付では他の通知は送信されない
        expectedMessage: "スケジュール通知の登録を完了しました",
      },
    ])("$description", async ({ pastDate, notificationId, expectedCalls, expectedMessage }) => {
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
      expect(result).toStrictEqual({ success: true, message: expectedMessage });
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
      expect(result).toStrictEqual({ success: true, message: "通知の登録を完了しました" });
    });
  });
});
