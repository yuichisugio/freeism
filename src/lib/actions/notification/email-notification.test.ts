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

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
    // コンソールログをモック
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.spyOn(console, "log").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should return success when email notification settings are found", async () => {
      // モックの設定 - メール通知が有効なユーザー設定
      const userSettingsFromDb = [{ isEmailEnabled: true }, { isEmailEnabled: true }];

      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(baseNotificationParams);

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.message).toBeUndefined();

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [testUserId1, testUserId2] },
        },
        select: {
          isEmailEnabled: true,
        },
      });
    });

    test("should return success with message when no email notification settings found", async () => {
      // モックの設定 - 空の配列
      prismaMock.userSettings.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>);

      // 関数を実行
      const result = await sendEmailNotification(baseNotificationParams);

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.message).toBe("メール通知設定が見つかりません");
      expect(result.error).toBeUndefined();

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledOnce();
    });

    test("should handle single recipient user", async () => {
      // 単一受信者のパラメータ
      const singleRecipientParams: NotificationParams = {
        ...baseNotificationParams,
        recipientUserIds: [testUserId1],
      };

      // モックの設定
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(singleRecipientParams);

      // 結果を検証
      expect(result.success).toBe(true);

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [testUserId1] },
        },
        select: {
          isEmailEnabled: true,
        },
      });
    });

    test("should handle multiple recipients", async () => {
      // 複数受信者のパラメータ
      const multipleRecipientsParams: NotificationParams = {
        ...baseNotificationParams,
        recipientUserIds: [testUserId1, testUserId2, "user-3", "user-4", "user-5"],
      };

      // モックの設定
      const userSettingsFromDb = [
        { isEmailEnabled: true },
        { isEmailEnabled: false },
        { isEmailEnabled: true },
        { isEmailEnabled: true },
        { isEmailEnabled: false },
      ];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(multipleRecipientsParams);

      // 結果を検証
      expect(result.success).toBe(true);

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [testUserId1, testUserId2, "user-3", "user-4", "user-5"] },
        },
        select: {
          isEmailEnabled: true,
        },
      });
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
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(nullOptionalParams);

      // 結果を検証
      expect(result.success).toBe(true);
    });

    test("should handle different notification target types", async () => {
      // グループターゲットのパラメータ
      const groupTargetParams: NotificationParams = {
        ...baseNotificationParams,
        targetType: NotificationTargetType.GROUP,
      };

      // モックの設定
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(groupTargetParams);

      // 結果を検証
      expect(result.success).toBe(true);
    });

    test("should handle different send timing types", async () => {
      // スケジュール送信のパラメータ
      const scheduledParams: NotificationParams = {
        ...baseNotificationParams,
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: new Date("2024-12-25T10:00:00Z"),
      };

      // モックの設定
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(scheduledParams);

      // 結果を検証
      expect(result.success).toBe(true);
    });

    test("should handle different send methods", async () => {
      // 複数送信方法のパラメータ
      const multipleSendMethodsParams: NotificationParams = {
        ...baseNotificationParams,
        sendMethods: [NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP, NotificationSendMethod.WEB_PUSH],
      };

      // モックの設定
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(multipleSendMethodsParams);

      // 結果を検証
      expect(result.success).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty recipient user ids array", async () => {
      // 空の受信者配列のパラメータ
      const emptyRecipientsParams: NotificationParams = {
        ...baseNotificationParams,
        recipientUserIds: [],
      };

      // モックの設定
      prismaMock.userSettings.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>);

      // 関数を実行
      const result = await sendEmailNotification(emptyRecipientsParams);

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.message).toBe("メール通知設定が見つかりません");

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [] },
        },
        select: {
          isEmailEnabled: true,
        },
      });
    });

    test("should handle very long recipient user ids", async () => {
      // 非常に長いユーザーIDのパラメータ
      const longUserId = "a".repeat(1000);
      const longUserIdParams: NotificationParams = {
        ...baseNotificationParams,
        recipientUserIds: [longUserId],
      };

      // モックの設定
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(longUserIdParams);

      // 結果を検証
      expect(result.success).toBe(true);

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [longUserId] },
        },
        select: {
          isEmailEnabled: true,
        },
      });
    });

    test("should handle special characters in user ids", async () => {
      // 特殊文字を含むユーザーIDのパラメータ
      const specialUserId = "user-!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const specialUserIdParams: NotificationParams = {
        ...baseNotificationParams,
        recipientUserIds: [specialUserId],
      };

      // モックの設定
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(specialUserIdParams);

      // 結果を検証
      expect(result.success).toBe(true);

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [specialUserId] },
        },
        select: {
          isEmailEnabled: true,
        },
      });
    });

    test("should handle very long title and message", async () => {
      // 非常に長いタイトルとメッセージのパラメータ
      const longTitle = "a".repeat(10000);
      const longMessage = "b".repeat(50000);
      const longContentParams: NotificationParams = {
        ...baseNotificationParams,
        title: longTitle,
        message: longMessage,
      };

      // モックの設定
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(longContentParams);

      // 結果を検証
      expect(result.success).toBe(true);
    });

    test("should handle empty title and message", async () => {
      // 空のタイトルとメッセージのパラメータ
      const emptyContentParams: NotificationParams = {
        ...baseNotificationParams,
        title: "",
        message: "",
      };

      // モックの設定
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(emptyContentParams);

      // 結果を検証
      expect(result.success).toBe(true);
    });

    test("should handle large number of recipients", async () => {
      // 大量の受信者のパラメータ
      const largeRecipientList = Array.from({ length: 1000 }, (_, index) => `user-${index}`);
      const largeRecipientsParams: NotificationParams = {
        ...baseNotificationParams,
        recipientUserIds: largeRecipientList,
      };

      // モックの設定
      const userSettingsFromDb = Array.from({ length: 1000 }, () => ({ isEmailEnabled: true }));
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(largeRecipientsParams);

      // 結果を検証
      expect(result.success).toBe(true);

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: largeRecipientList },
        },
        select: {
          isEmailEnabled: true,
        },
      });
    });

    test("should handle null and undefined values in recipient ids", async () => {
      // null/undefinedを含む受信者配列のパラメータ
      const nullUndefinedParams: NotificationParams = {
        ...baseNotificationParams,
        recipientUserIds: [testUserId1, null as unknown as string, undefined as unknown as string, testUserId2],
      };

      // モックの設定
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(nullUndefinedParams);

      // 結果を検証
      expect(result.success).toBe(true);

      // Prismaの呼び出しを検証
      expect(prismaMock.userSettings.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [testUserId1, null, undefined, testUserId2] },
        },
        select: {
          isEmailEnabled: true,
        },
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("パラメータバリデーションテスト", () => {
    test("should handle all notification target types", async () => {
      // 全ての通知ターゲットタイプをテスト
      const targetTypes = [NotificationTargetType.USER, NotificationTargetType.GROUP];

      for (const targetType of targetTypes) {
        const params: NotificationParams = {
          ...baseNotificationParams,
          targetType,
        };

        // モックの設定
        const userSettingsFromDb = [{ isEmailEnabled: true }];
        prismaMock.userSettings.findMany.mockResolvedValue(
          userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
        );

        // 関数を実行
        const result = await sendEmailNotification(params);

        // 結果を検証
        expect(result.success).toBe(true);
      }
    });

    test("should handle all send timing types", async () => {
      // 全ての送信タイミングタイプをテスト
      const sendTimings = [NotificationSendTiming.NOW, NotificationSendTiming.SCHEDULED];

      for (const sendTiming of sendTimings) {
        const params: NotificationParams = {
          ...baseNotificationParams,
          sendTiming,
          sendScheduledDate: sendTiming === NotificationSendTiming.SCHEDULED ? new Date() : null,
        };

        // モックの設定
        const userSettingsFromDb = [{ isEmailEnabled: true }];
        prismaMock.userSettings.findMany.mockResolvedValue(
          userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
        );

        // 関数を実行
        const result = await sendEmailNotification(params);

        // 結果を検証
        expect(result.success).toBe(true);
      }
    });

    test("should handle all send method types", async () => {
      // 全ての送信方法タイプをテスト
      const sendMethods = [
        [NotificationSendMethod.EMAIL],
        [NotificationSendMethod.IN_APP],
        [NotificationSendMethod.WEB_PUSH],
        [NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP],
        [NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        [NotificationSendMethod.IN_APP, NotificationSendMethod.WEB_PUSH],
        [NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP, NotificationSendMethod.WEB_PUSH],
      ];

      for (const sendMethodArray of sendMethods) {
        const params: NotificationParams = {
          ...baseNotificationParams,
          sendMethods: sendMethodArray,
        };

        // モックの設定
        const userSettingsFromDb = [{ isEmailEnabled: true }];
        prismaMock.userSettings.findMany.mockResolvedValue(
          userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
        );

        // 関数を実行
        const result = await sendEmailNotification(params);

        // 結果を検証
        expect(result.success).toBe(true);
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("コンソールログテスト", () => {
    test("should log email notification settings", async () => {
      // モックの設定
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      await sendEmailNotification(baseNotificationParams);

      // コンソールログの呼び出しを検証
      expect(console.log).toHaveBeenCalledWith("email-notification.ts_sendEmailNotification_isEmailNotificationEnabled", userSettingsFromDb);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("メール通知設定の組み合わせテスト", () => {
    test("should handle mixed email notification settings", async () => {
      // 混在するメール通知設定のパラメータ
      const mixedRecipientsParams: NotificationParams = {
        ...baseNotificationParams,
        recipientUserIds: [testUserId1, testUserId2, "user-3", "user-4"],
      };

      // モックの設定 - 一部有効、一部無効
      const userSettingsFromDb = [{ isEmailEnabled: true }, { isEmailEnabled: false }, { isEmailEnabled: true }, { isEmailEnabled: false }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(mixedRecipientsParams);

      // 結果を検証
      expect(result.success).toBe(true);
    });

    test("should handle all email notifications disabled", async () => {
      // 全てのメール通知が無効のパラメータ
      const allDisabledParams: NotificationParams = {
        ...baseNotificationParams,
        recipientUserIds: [testUserId1, testUserId2],
      };

      // モックの設定 - 全て無効
      const userSettingsFromDb = [{ isEmailEnabled: false }, { isEmailEnabled: false }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(allDisabledParams);

      // 結果を検証
      expect(result).toStrictEqual({
        success: true,
        message: "メール通知設定が見つかりません",
      });
    });

    test("should handle partial user settings found", async () => {
      // 一部のユーザー設定のみ見つかる場合
      const partialSettingsParams: NotificationParams = {
        ...baseNotificationParams,
        recipientUserIds: [testUserId1, testUserId2, "user-3"],
      };

      // モックの設定 - 一部のユーザー設定のみ
      const userSettingsFromDb = [{ isEmailEnabled: true }];
      prismaMock.userSettings.findMany.mockResolvedValue(
        userSettingsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.userSettings.findMany>>,
      );

      // 関数を実行
      const result = await sendEmailNotification(partialSettingsParams);

      // 結果を検証
      expect(result.success).toBe(true);
    });
  });
});
