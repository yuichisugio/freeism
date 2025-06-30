"use server";

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

  // ヘルパー関数：テスト実行とPrisma呼び出し検証
  const executeTestAndVerifyPrismaCall = async (params: NotificationParams, expectedRecipientIds: string[]) => {
    const result = await sendEmailNotification(params);

    // Prismaの呼び出しを検証
    expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
      where: {
        userId: { in: expectedRecipientIds },
      },
      select: {
        isEmailEnabled: true,
      },
    });

    return result;
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
      const result = await executeTestAndVerifyPrismaCall(baseNotificationParams, [testUserId1, testUserId2]);
      expect(result).toStrictEqual({ success: true });
    });

    test("should return success with message when no email notification settings found", async () => {
      // モックの設定 - 空の配列
      prismaMock.userSettings.findMany.mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await executeTestAndVerifyPrismaCall(baseNotificationParams, [testUserId1, testUserId2]);

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.message).toBe("メール通知設定が見つかりません");
      expect(result.error).toBeUndefined();
    });

    test("should handle all email notifications disabled", async () => {
      // モックの設定 - 全て無効
      prismaMock.userSettings.findMany.mockResolvedValue([
        { isEmailEnabled: false },
        { isEmailEnabled: false },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>);

      // 関数を実行
      const result = await executeTestAndVerifyPrismaCall(baseNotificationParams, [testUserId1, testUserId2]);

      // 結果を検証
      expect(result).toStrictEqual({
        success: true,
        message: "メール通知設定が見つかりません",
      });
    });

    test("should handle mixed email notification settings", async () => {
      // 混在するメール通知設定のパラメータ
      const mixedParams = {
        ...baseNotificationParams,
        recipientUserIds: [testUserId1, testUserId2, "user-3", "user-4"],
      };

      // モックの設定 - 一部有効、一部無効
      prismaMock.userSettings.findMany.mockResolvedValue([
        { isEmailEnabled: true },
        { isEmailEnabled: false },
        { isEmailEnabled: true },
        { isEmailEnabled: false },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>);

      // 関数を実行と結果検証
      const result = await executeTestAndVerifyPrismaCall(mixedParams, [testUserId1, testUserId2, "user-3", "user-4"]);
      expect(result).toStrictEqual({ success: true });
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
      const result = await executeTestAndVerifyPrismaCall(nullOptionalParams, [testUserId1, testUserId2]);
      expect(result).toStrictEqual({ success: true });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test.each([
      {
        description: "empty recipient user ids array",
        recipientUserIds: [],
        expectedMessage: "メール通知設定が見つかりません",
        userSettings: [],
      },
      {
        description: "single recipient user",
        recipientUserIds: [testUserId1],
        expectedMessage: undefined,
        userSettings: [{ isEmailEnabled: true }],
      },
      {
        description: "large number of recipients",
        recipientUserIds: Array.from({ length: 100 }, (_, index) => `user-${index}`),
        expectedMessage: undefined,
        userSettings: Array.from({ length: 100 }, () => ({ isEmailEnabled: true })),
      },
    ])("should handle $description", async ({ recipientUserIds, expectedMessage, userSettings }) => {
      // パラメータの設定
      const params = {
        ...baseNotificationParams,
        recipientUserIds,
      };

      // モックの設定
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettings as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await executeTestAndVerifyPrismaCall(params, recipientUserIds);

      // 結果を検証
      expect(result.success).toBe(true);
      if (expectedMessage) {
        expect(result.message).toBe(expectedMessage);
      } else {
        expect(result.message).toBeUndefined();
      }
    });

    test("should handle special characters and long values in user ids", async () => {
      // 特殊文字と長いユーザーIDのパラメータ
      const specialUserId = "user-!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const longUserId = "a".repeat(1000);
      const specialParams = {
        ...baseNotificationParams,
        recipientUserIds: [specialUserId, longUserId],
      };

      // モックの設定
      prismaMock.userSettings.findMany.mockResolvedValue([
        { isEmailEnabled: true },
        { isEmailEnabled: true },
      ] as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>);

      // 関数を実行と結果検証
      const result = await executeTestAndVerifyPrismaCall(specialParams, [specialUserId, longUserId]);
      expect(result).toStrictEqual({ success: true });
    });

    test("should handle extreme content lengths", async () => {
      // 非常に長いタイトルとメッセージ、または空の値
      const extremeParams = {
        ...baseNotificationParams,
        title: "a".repeat(10000),
        message: "b".repeat(50000),
      };

      // モックの設定
      prismaMock.userSettings.findMany.mockResolvedValue([{ isEmailEnabled: true }] as unknown as Awaited<
        ReturnType<typeof prismaMock.userSettings.findMany>
      >);

      // 関数を実行と結果検証
      const result = await executeTestAndVerifyPrismaCall(extremeParams, [testUserId1, testUserId2]);
      expect(result).toStrictEqual({ success: true });
    });

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
      const result = await executeTestAndVerifyPrismaCall(nullUndefinedParams, [
        testUserId1,
        null as unknown as string,
        undefined as unknown as string,
        testUserId2,
      ]);
      expect(result).toStrictEqual({ success: true });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("パラメータバリデーションテスト", () => {
    test.each([{ targetType: NotificationTargetType.USER }, { targetType: NotificationTargetType.GROUP }])(
      "should handle notification target type: $targetType",
      async ({ targetType }) => {
        const params = { ...baseNotificationParams, targetType };

        // モックの設定
        prismaMock.userSettings.findMany.mockResolvedValue([{ isEmailEnabled: true }] as unknown as Awaited<
          ReturnType<typeof prismaMock.userSettings.findMany>
        >);

        // 関数を実行と結果検証
        const result = await executeTestAndVerifyPrismaCall(params, [testUserId1, testUserId2]);
        expect(result).toStrictEqual({ success: true });
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
      const result = await executeTestAndVerifyPrismaCall(params, [testUserId1, testUserId2]);
      expect(result).toStrictEqual({ success: true });
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
      const result = await executeTestAndVerifyPrismaCall(params, [testUserId1, testUserId2]);
      expect(result).toStrictEqual({ success: true });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle prisma database error", async () => {
      // Prismaエラーをモック
      const dbError = new Error("Database connection failed");
      prismaMock.userSettings.findMany.mockRejectedValue(dbError);

      // 関数を実行
      const result = await sendEmailNotification(baseNotificationParams);

      // 結果を検証
      expect(result.success).toBe(false);
      expect(result.error).toBe("メール通知を送信できませんでした");

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
      expect(result.success).toBe(false);
      expect(result.error).toBe("メール通知を送信できませんでした");

      // コンソールエラーの呼び出しを検証
      expect(console.error).toHaveBeenCalledWith("email-notification.ts_sendEmailNotification_error", unexpectedError);
    });
  });
});
