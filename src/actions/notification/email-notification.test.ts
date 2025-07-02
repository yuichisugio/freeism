import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { NotificationSendMethod, NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { NotificationParams } from "./email-notification";
import { sendEmailNotification } from "./email-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("sendEmailNotification", () => {
  // テスト用のデータを準備
  const testUserId1 = "test-user-id-1";
  const testUserId2 = "test-user-id-2";
  const testGroupId = "test-group-id";
  const testTaskId = "test-task-id";
  const testAuctionId = "test-auction-id";
  const testNotificationId = "test-notification-id";

  // 基本的な通知パラメータ
  const baseNotificationParams: NotificationParams = {
    recipientUserIds: [testUserId1, testUserId2],
    title: "テスト通知",
    message: "これはテスト用の通知メッセージです",
    sendMethods: [NotificationSendMethod.EMAIL],
    senderUserId: "sender-user-id",
    actionUrl: "https://example.com/action",
    targetType: NotificationTargetType.USER,
    groupId: testGroupId,
    taskId: testTaskId,
    auctionId: testAuctionId,
    sendTiming: NotificationSendTiming.NOW,
    sendScheduledDate: null,
    expiresAt: new Date("2024-12-31T23:59:59Z"),
    fromEmail: "test@example.com",
    subjectEmail: "テスト件名",
    usernameEmail: "testuser",
    notificationId: testNotificationId,
    sentAt: new Date(),
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {
      // 何もしない
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should return success when email notification settings are found", async () => {
      // モックの設定
      prismaMock.userSettings.findMany.mockResolvedValue([
        { isEmailEnabled: true },
        { isEmailEnabled: true },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>);

      // 関数を実行と結果検証
      const result = await sendEmailNotification(baseNotificationParams);

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [testUserId1, testUserId2] },
          isEmailEnabled: true,
        },
        select: {
          isEmailEnabled: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      });

      expect(result).toStrictEqual({ success: true, message: "メール通知を送信しました" });
    });

    test("should return success with message when no email notification settings found", async () => {
      // モックの設定 - 空の配列
      prismaMock.userSettings.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(baseNotificationParams);

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [testUserId1, testUserId2] },
          isEmailEnabled: true,
        },
        select: {
          isEmailEnabled: true,
        },
      });

      // 結果を検証
      expect(result).toStrictEqual({ success: true, message: "メール通知設定が見つかりません" });
    });

    test("should handle optional parameters as null", async () => {
      // オプションパラメータをnullにしたパラメータ
      const nullOptionalParams: NotificationParams = {
        ...baseNotificationParams,
        senderUserId: null,
        actionUrl: null,
        groupId: null,
        taskId: null,
        auctionId: null,
        sendScheduledDate: null,
        expiresAt: null,
        fromEmail: undefined,
        subjectEmail: undefined,
        usernameEmail: undefined,
        notificationId: null,
        sentAt: null,
      };

      // モックの設定
      prismaMock.userSettings.findMany.mockResolvedValue([{ isEmailEnabled: true }] as unknown as Awaited<
        ReturnType<typeof prismaMock.userSettings.findMany>
      >);

      // 関数を実行と結果検証
      const result = await sendEmailNotification(nullOptionalParams);

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [testUserId1, testUserId2] },
          isEmailEnabled: true,
        },
      });
      expect(result).toStrictEqual({ success: true, message: "メール通知を送信しました" });
    });

    test.each([{ targetType: NotificationTargetType.USER }, { targetType: NotificationTargetType.GROUP }])(
      "should handle notification target type: $targetType",
      async ({ targetType }) => {
        const params = { ...baseNotificationParams, targetType };

        // モックの設定
        prismaMock.userSettings.findMany.mockResolvedValue([{ isEmailEnabled: true }] as unknown as Awaited<
          ReturnType<typeof prismaMock.userSettings.findMany>
        >);

        // 関数を実行と結果検証
        const result = await sendEmailNotification(params);
        // Prismaの呼び出しを検証
        expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
          where: {
            userId: { in: [testUserId1, testUserId2] },
            isEmailEnabled: true,
          },
        });
        expect(result).toStrictEqual({ success: true, message: "メール通知を送信しました" });
      },
    );

    test.each([
      { sendTiming: NotificationSendTiming.NOW, sendScheduledDate: null },
      { sendTiming: NotificationSendTiming.SCHEDULED, sendScheduledDate: new Date("2024-12-25T10:00:00Z") },
    ])("should handle send timing: $sendTiming", async ({ sendTiming, sendScheduledDate }) => {
      const params = { ...baseNotificationParams, sendTiming, sendScheduledDate };

      // モックの設定
      prismaMock.userSettings.findMany.mockResolvedValue([{ isEmailEnabled: true }] as unknown as Awaited<
        ReturnType<typeof prismaMock.userSettings.findMany>
      >);

      // 関数を実行と結果検証
      const result = await sendEmailNotification(params);
      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [testUserId1, testUserId2] },
          isEmailEnabled: true,
        },
      });
      expect(result).toStrictEqual({ success: true, message: "メール通知を送信しました" });
    });

    test.each([
      { sendMethods: [NotificationSendMethod.EMAIL] },
      { sendMethods: [NotificationSendMethod.IN_APP] },
      { sendMethods: [NotificationSendMethod.WEB_PUSH] },
      { sendMethods: [NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP] },
      { sendMethods: [NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH] },
      { sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.WEB_PUSH] },
      { sendMethods: [NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP, NotificationSendMethod.WEB_PUSH] },
    ])("should handle send methods: $sendMethods", async ({ sendMethods }) => {
      const params = { ...baseNotificationParams, sendMethods };

      // モックの設定
      prismaMock.userSettings.findMany.mockResolvedValue([{ isEmailEnabled: true }] as unknown as Awaited<
        ReturnType<typeof prismaMock.userSettings.findMany>
      >);

      // 関数を実行と結果検証
      const result = await sendEmailNotification(params);
      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [testUserId1, testUserId2] },
          isEmailEnabled: true,
        },
      });
      expect(result).toStrictEqual({ success: true, message: "メール通知を送信しました" });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle null and undefined values in recipient ids", async () => {
      // null/undefinedを含む受信者配列のパラメータ
      const nullUndefinedParams = {
        ...baseNotificationParams,
        recipientUserIds: [testUserId1, null as unknown as string, undefined as unknown as string, testUserId2],
      };

      // モックの設定
      prismaMock.userSettings.findMany.mockResolvedValue([{ isEmailEnabled: true }] as unknown as Awaited<
        ReturnType<typeof prismaMock.userSettings.findMany>
      >);

      // 関数を実行と結果検証
      const result = await sendEmailNotification(nullUndefinedParams);
      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [testUserId1, null as unknown as string, undefined as unknown as string, testUserId2] },
          isEmailEnabled: true,
        },
      });
      expect(result).toStrictEqual({ success: true, message: "メール通知を送信しました" });
    });
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
      const params = { ...baseNotificationParams, ...overrides } as NotificationParams;

      // Act
      const result = await sendEmailNotification(params);

      // Assert
      expect(result).toStrictEqual({ success: false, message: "必須パラメータが不足しています" });
    });

    test("should handle prisma database error", async () => {
      // Prismaエラーをモック
      const dbError = new Error("Database connection failed");
      prismaMock.userSettings.findMany.mockRejectedValue(dbError);

      // 関数を実行
      const result = await sendEmailNotification(baseNotificationParams);

      // 結果を検証
      expect(result).toStrictEqual({ success: false, message: "メール通知を送信できませんでした" });
      expect(result.message).toBe("メール通知を送信できませんでした");

      // コンソールエラーの呼び出しを検証
      expect(console.error).toHaveBeenCalledWith("email-notification.ts_sendEmailNotification_error", dbError);
    });

    test("should handle unexpected error during execution", async () => {
      // 予期しないエラーをモック
      const unexpectedError = new Error("Unexpected error");
      prismaMock.userSettings.findMany.mockImplementation(() => {
        throw unexpectedError;
      });

      // 関数を実行
      const result = await sendEmailNotification(baseNotificationParams);

      // 結果を検証
      expect(result).toStrictEqual({ success: false, message: "メール通知を送信できませんでした" });

      // コンソールエラーの呼び出しを検証
      expect(console.error).toHaveBeenCalledWith("email-notification.ts_sendEmailNotification_error", unexpectedError);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
});
