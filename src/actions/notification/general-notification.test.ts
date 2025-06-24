import { NotificationSendMethod, NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { GeneralNotificationParams } from "./general-notification";
import { sendEmailNotification } from "./email-notification";
import { sendGeneralNotification } from "./general-notification";
import { sendInAppNotification } from "./in-app-notification";
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数のインポート
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

describe("sendGeneralNotification", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockGetNotificationTargetUserIds.mockResolvedValue(["user-1", "user-2"]);
    mockSendInAppNotification.mockResolvedValue({ success: true });
    mockSendEmailNotification.mockResolvedValue({ success: true });
    mockSendPushNotification.mockResolvedValue({ success: true });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should send in-app notification successfully", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [NotificationSendMethod.IN_APP],
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(NotificationTargetType.USER, {
        userIds: ["user-1", "user-2"],
        groupId: undefined,
        taskId: undefined,
      });
      expect(mockSendInAppNotification).toHaveBeenCalledWith({
        recipientUserIds: ["user-1", "user-2"],
        title: "テスト通知",
        message: "テストメッセージ",
        senderUserId: null,
        actionUrl: "https://example.com",
        targetType: NotificationTargetType.USER,
        groupId: null,
        taskId: null,
        auctionId: null,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
        sendMethods: [NotificationSendMethod.IN_APP],
        notificationId: null,
        sentAt: null,
      });
      expect(mockSendEmailNotification).not.toHaveBeenCalled();
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    test("should send email notification successfully", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [NotificationSendMethod.EMAIL],
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockSendEmailNotification).toHaveBeenCalledWith({
        recipientUserIds: ["user-1", "user-2"],
        title: "テスト通知",
        message: "テストメッセージ",
        senderUserId: null,
        actionUrl: "https://example.com",
        targetType: NotificationTargetType.USER,
        groupId: null,
        taskId: null,
        auctionId: null,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
        sendMethods: [NotificationSendMethod.EMAIL],
        notificationId: null,
        sentAt: null,
      });
      expect(mockSendInAppNotification).not.toHaveBeenCalled();
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    test("should send push notification successfully", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [NotificationSendMethod.WEB_PUSH],
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockSendPushNotification).toHaveBeenCalledWith({
        recipientUserIds: ["user-1", "user-2"],
        title: "テスト通知",
        message: "テストメッセージ",
        senderUserId: null,
        actionUrl: "https://example.com",
        targetType: NotificationTargetType.USER,
        groupId: null,
        taskId: null,
        auctionId: null,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
        sendMethods: [NotificationSendMethod.WEB_PUSH],
        notificationId: null,
        sentAt: null,
      });
      expect(mockSendInAppNotification).not.toHaveBeenCalled();
      expect(mockSendEmailNotification).not.toHaveBeenCalled();
    });

    test("should send multiple notification methods successfully", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockSendInAppNotification).toHaveBeenCalled();
      expect(mockSendEmailNotification).toHaveBeenCalled();
      expect(mockSendPushNotification).toHaveBeenCalled();
    });

    test("should handle GROUP target type correctly", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        targetType: NotificationTargetType.GROUP,
        recipientUserIds: null,
        groupId: "group-1",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(NotificationTargetType.GROUP, {
        userIds: undefined,
        groupId: "group-1",
        taskId: undefined,
      });
    });

    test("should handle TASK target type correctly", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        targetType: NotificationTargetType.TASK,
        recipientUserIds: null,
        taskId: "task-1",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(NotificationTargetType.TASK, {
        userIds: undefined,
        groupId: undefined,
        taskId: "task-1",
      });
    });

    test("should handle SYSTEM target type correctly", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        targetType: NotificationTargetType.SYSTEM,
        recipientUserIds: null,
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(NotificationTargetType.SYSTEM, {
        userIds: undefined,
        groupId: undefined,
        taskId: undefined,
      });
    });

    test("should handle scheduled notification with past date and notificationId", async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1時間前
      const params = createValidGeneralNotificationParams({
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: pastDate,
        notificationId: "notification-1",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      // 予約送信で過去の日時かつnotificationIdがある場合は、他の通知は送信されない
      expect(mockSendInAppNotification).toHaveBeenCalled();
      expect(mockSendEmailNotification).not.toHaveBeenCalled();
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    test("should handle scheduled notification with future date", async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1時間後
      const params = createValidGeneralNotificationParams({
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: futureDate,
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      // 未来の予約送信の場合は、すべての通知が送信される
      expect(mockSendInAppNotification).toHaveBeenCalled();
      expect(mockSendEmailNotification).toHaveBeenCalled();
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
      expect(result).toStrictEqual({
        success: false,
        error: "通知の対象者が見つかりません",
      });
      expect(mockSendInAppNotification).not.toHaveBeenCalled();
      expect(mockSendEmailNotification).not.toHaveBeenCalled();
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    test("should return error when in-app notification fails", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [NotificationSendMethod.IN_APP],
      });
      mockSendInAppNotification.mockResolvedValue({
        success: false,
        error: "アプリ内通知エラー",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "アプリ内通知の送信に失敗しました",
      });
      expect(mockSendInAppNotification).toHaveBeenCalled();
      expect(mockSendEmailNotification).not.toHaveBeenCalled();
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    test("should return error when push notification fails", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.WEB_PUSH],
      });
      mockSendPushNotification.mockResolvedValue({
        success: false,
        message: "プッシュ通知エラー",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "プッシュ通知の送信に失敗しました",
      });
      expect(mockSendInAppNotification).toHaveBeenCalled();
      expect(mockSendPushNotification).toHaveBeenCalled();
      expect(mockSendEmailNotification).not.toHaveBeenCalled();
    });

    test("should return error when email notification fails", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
      });
      mockSendEmailNotification.mockResolvedValue({
        success: false,
        error: "メール通知エラー",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "メール通知の送信に失敗しました",
      });
      expect(mockSendInAppNotification).toHaveBeenCalled();
      expect(mockSendEmailNotification).toHaveBeenCalled();
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    test("should return error when getNotificationTargetUserIds throws error", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams();
      mockGetNotificationTargetUserIds.mockRejectedValue(new Error("データベースエラー"));

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "通知エラーが発生しました",
      });
      expect(mockSendInAppNotification).not.toHaveBeenCalled();
      expect(mockSendEmailNotification).not.toHaveBeenCalled();
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    test("should return error when sendInAppNotification throws error", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [NotificationSendMethod.IN_APP],
      });
      mockSendInAppNotification.mockRejectedValue(new Error("予期しないエラー"));

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        error: "通知エラーが発生しました",
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty sendMethods array", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        sendMethods: [],
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockSendInAppNotification).not.toHaveBeenCalled();
      expect(mockSendEmailNotification).not.toHaveBeenCalled();
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });

    test("should handle null values in optional fields", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        recipientUserIds: null,
        groupId: null,
        taskId: null,
        auctionId: null,
        actionUrl: null,
        sendScheduledDate: null,
        expiresAt: null,
        notificationId: null,
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(NotificationTargetType.USER, {
        userIds: undefined,
        groupId: undefined,
        taskId: undefined,
      });
    });

    test("should handle single user in recipientUserIds", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        recipientUserIds: ["user-1"],
      });
      mockGetNotificationTargetUserIds.mockResolvedValue(["user-1"]);

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(NotificationTargetType.USER, {
        userIds: ["user-1"],
        groupId: undefined,
        taskId: undefined,
      });
    });

    test("should handle large number of users", async () => {
      // Arrange
      const largeUserList = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
      const params = createValidGeneralNotificationParams({
        recipientUserIds: largeUserList,
      });
      mockGetNotificationTargetUserIds.mockResolvedValue(largeUserList);

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockSendInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserIds: largeUserList,
        }),
      );
    });

    test("should handle very long title and message", async () => {
      // Arrange
      const longTitle = "a".repeat(1000);
      const longMessage = "b".repeat(5000);
      const params = createValidGeneralNotificationParams({
        title: longTitle,
        message: longMessage,
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockSendInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: longTitle,
          message: longMessage,
        }),
      );
    });

    test("should handle scheduled notification with exact current time", async () => {
      // Arrange
      const now = new Date();
      const params = createValidGeneralNotificationParams({
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: now,
        notificationId: "notification-1",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      // 現在時刻と同じ場合は過去として扱われる可能性があるため、アプリ内通知のみ送信される
      expect(mockSendInAppNotification).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("引数パターンテスト", () => {
    test("should handle all NotificationTargetType values", async () => {
      // Arrange & Act & Assert
      const targetTypes = [
        NotificationTargetType.USER,
        NotificationTargetType.GROUP,
        NotificationTargetType.TASK,
        NotificationTargetType.SYSTEM,
      ];

      for (const targetType of targetTypes) {
        const params = createValidGeneralNotificationParams({
          targetType,
          recipientUserIds: targetType === NotificationTargetType.USER ? ["user-1"] : null,
          groupId: targetType === NotificationTargetType.GROUP ? "group-1" : null,
          taskId: targetType === NotificationTargetType.TASK ? "task-1" : null,
        });

        const result = await sendGeneralNotification(params);
        expect(result).toStrictEqual({ success: true });
      }
    });

    test("should handle all NotificationSendMethod values", async () => {
      // Arrange & Act & Assert
      const sendMethods = [
        [NotificationSendMethod.IN_APP],
        [NotificationSendMethod.EMAIL],
        [NotificationSendMethod.WEB_PUSH],
        [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
        [NotificationSendMethod.IN_APP, NotificationSendMethod.WEB_PUSH],
        [NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
      ];

      for (const methods of sendMethods) {
        const params = createValidGeneralNotificationParams({
          sendMethods: methods,
        });

        const result = await sendGeneralNotification(params);
        expect(result).toStrictEqual({ success: true });
      }
    });

    test("should handle all NotificationSendTiming values", async () => {
      // Arrange & Act & Assert
      const sendTimings = [NotificationSendTiming.NOW, NotificationSendTiming.SCHEDULED];

      for (const timing of sendTimings) {
        const params = createValidGeneralNotificationParams({
          sendTiming: timing,
          sendScheduledDate: timing === NotificationSendTiming.SCHEDULED ? new Date(Date.now() + 1000 * 60) : null,
        });

        const result = await sendGeneralNotification(params);
        expect(result).toStrictEqual({ success: true });
      }
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
      expect(result).toStrictEqual({
        success: false,
        error: "アプリ内通知の送信に失敗しました",
      });
      // 最初の失敗で処理が停止するため、後続の通知は呼ばれない
      expect(mockSendInAppNotification).toHaveBeenCalled();
      expect(mockSendPushNotification).not.toHaveBeenCalled();
      expect(mockSendEmailNotification).not.toHaveBeenCalled();
    });

    test("should handle scheduled notification without notificationId", async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1時間前
      const params = createValidGeneralNotificationParams({
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: pastDate,
        notificationId: null, // notificationIdがnull
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      // notificationIdがnullの場合は、通常の送信処理が実行される
      expect(mockSendInAppNotification).toHaveBeenCalled();
      expect(mockSendEmailNotification).toHaveBeenCalled();
    });

    test("should handle scheduled notification with future date and notificationId", async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1時間後
      const params = createValidGeneralNotificationParams({
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: futureDate,
        notificationId: "notification-1",
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      // 未来の日時の場合は、通常の送信処理が実行される
      expect(mockSendInAppNotification).toHaveBeenCalled();
      expect(mockSendEmailNotification).toHaveBeenCalled();
    });
  });

  describe("エッジケースとエラーハンドリング", () => {
    test("should handle undefined values gracefully", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        recipientUserIds: undefined as unknown as string[],
        groupId: undefined as unknown as string,
        taskId: undefined as unknown as string,
        auctionId: undefined as unknown as string,
        actionUrl: undefined as unknown as string,
        sendScheduledDate: undefined as unknown as Date,
        expiresAt: undefined as unknown as Date,
        notificationId: undefined as unknown as string,
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockGetNotificationTargetUserIds).toHaveBeenCalledWith(NotificationTargetType.USER, {
        userIds: undefined,
        groupId: undefined,
        taskId: undefined,
      });
    });

    test("should handle empty string values", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        title: "",
        message: "",
        actionUrl: "",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockSendInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "",
          message: "",
          actionUrl: "",
        }),
      );
    });

    test("should handle special characters in title and message", async () => {
      // Arrange
      const params = createValidGeneralNotificationParams({
        title: "特殊文字テスト!@#$%^&*()_+-=[]{}|;':\",./<>?",
        message: "改行\nタブ\t特殊文字🎉📧💌",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      expect(mockSendInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "特殊文字テスト!@#$%^&*()_+-=[]{}|;':\",./<>?",
          message: "改行\nタブ\t特殊文字🎉📧💌",
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

    test("should handle notification with very old scheduled date", async () => {
      // Arrange
      const veryOldDate = new Date("2000-01-01T00:00:00Z");
      const params = createValidGeneralNotificationParams({
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: veryOldDate,
        notificationId: "old-notification",
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      // 過去の日時なので、プッシュ通知とメール通知はスキップされる
      expect(mockSendInAppNotification).toHaveBeenCalled();
    });

    test("should handle notification with future scheduled date but no notificationId", async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24時間後
      const params = createValidGeneralNotificationParams({
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: futureDate,
        notificationId: null,
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
      });

      // Act
      const result = await sendGeneralNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: true });
      // 未来の日時でnotificationIdがnullの場合は、通常の送信処理が実行される
      expect(mockSendInAppNotification).toHaveBeenCalled();
      expect(mockSendEmailNotification).toHaveBeenCalled();
    });
  });
});
