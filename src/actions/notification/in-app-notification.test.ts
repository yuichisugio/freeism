import type { Session } from "next-auth";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { notificationFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { NotificationSendMethod, NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { NotificationParams } from "./email-notification";
import { sendInAppNotification } from "./in-app-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getAuthSessionのモック
 */
vi.mock("@/lib/utils", () => ({
  getAuthSession: vi.fn(),
}));
const mockGetAuthSession = vi.mocked(await import("@/lib/utils")).getAuthSession;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 基本的なNotificationParamsを作成するヘルパー関数
 */
const createNotificationParams = (overrides: Partial<NotificationParams> = {}): NotificationParams => ({
  recipientUserIds: ["user-1"],
  title: "テスト通知",
  message: "テストメッセージ",
  sendMethods: [NotificationSendMethod.IN_APP],
  senderUserId: null,
  actionUrl: null,
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
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("sendInAppNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    describe("新規通知作成", () => {
      const testCases = [
        {
          name: "should create new notification with NOW timing successfully",
          params: {
            recipientUserIds: ["user-1", "user-2"],
            title: "NOW通知",
            message: "NOW通知メッセージ",
            actionUrl: "https://example.com",
            expiresAt: new Date("2024-12-31"),
          },
          expectedData: {
            sendTimingType: NotificationSendTiming.NOW,
            sendScheduledDate: null,
            sentAt: expect.any(Date) as unknown as Date,
            expiresAt: new Date("2024-12-31"),
            actionUrl: "https://example.com",
            senderUserId: "user-123",
          },
        },
        {
          name: "should create new notification with SCHEDULED timing successfully",
          params: {
            sendTiming: NotificationSendTiming.SCHEDULED,
            sendScheduledDate: new Date("2024-12-25"),
            title: "SCHEDULED通知",
            message: "SCHEDULED通知メッセージ",
          },
          expectedData: {
            sendTimingType: NotificationSendTiming.SCHEDULED,
            sendScheduledDate: new Date("2024-12-25"),
            sentAt: null as unknown as Date,
            expiresAt: undefined,
            actionUrl: undefined,
            senderUserId: "user-123",
          },
        },
        {
          name: "should create GROUP notification successfully",
          params: {
            recipientUserIds: ["user-1", "user-2", "user-3"],
            title: "グループ通知",
            message: "グループメッセージ",
            targetType: NotificationTargetType.GROUP,
            groupId: "group-123",
          },
          expectedData: {
            targetType: NotificationTargetType.GROUP,
            groupId: "group-123",
            taskId: null,
            senderUserId: "user-123",
          },
        },
        {
          name: "should create TASK notification successfully",
          params: {
            title: "タスク通知",
            message: "タスクメッセージ",
            targetType: NotificationTargetType.TASK,
            taskId: "task-123",
          },
          expectedData: {
            targetType: NotificationTargetType.TASK,
            groupId: null,
            taskId: "task-123",
            senderUserId: "user-123",
          },
        },
        {
          name: "should create auction notification with null senderUserId",
          params: {
            title: "オークション通知",
            message: "オークションメッセージ",
            auctionId: "auction-123",
          },
          expectedData: {
            senderUserId: null,
          },
          skipAuthCheck: true,
        },
      ];

      test.each(testCases)("$name", async ({ params, expectedData, skipAuthCheck = false }) => {
        // テストデータの準備
        const notificationParams = createNotificationParams(params);

        // モックの設定
        if (!skipAuthCheck) {
          const mockSession = {
            user: { id: "user-123", email: "test@example.com", name: "Test User" },
            expires: "2024-12-31",
          };

          mockGetAuthSession.mockResolvedValue(mockSession);
          prismaMock.notification.create.mockResolvedValue(notificationFactory.build());
        } else {
          prismaMock.notification.create.mockResolvedValue(notificationFactory.build());
        }

        // 関数実行
        const result = await sendInAppNotification(notificationParams);

        // 検証
        expect(result).toStrictEqual({ success: true });

        if (skipAuthCheck) {
          expect(mockGetAuthSession).not.toHaveBeenCalled();
        }

        const isReadJsonb: Record<string, { isRead: boolean; readAt: null }> = {};
        notificationParams.recipientUserIds.forEach((userId) => {
          isReadJsonb[userId] = { isRead: false, readAt: null };
        });

        expect(prismaMock.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            title: notificationParams.title,
            message: notificationParams.message,
            targetType: notificationParams.targetType,
            isRead: isReadJsonb,
            sendMethods: [NotificationSendMethod.IN_APP],
            ...expectedData,
          }) as unknown as object,
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("既存通知更新", () => {
      test("should update existing notification when notificationId is provided", async () => {
        // テストデータの準備
        const notificationParams = createNotificationParams({
          notificationId: "notification-123",
          title: "更新通知",
          message: "更新メッセージ",
        });

        // モックの設定
        prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });

        // 関数実行
        const result = await sendInAppNotification(notificationParams);

        // 検証
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
          where: { id: "notification-123" },
          data: {
            sentAt: expect.any(Date) as unknown as Date,
          },
        });
        expect(prismaMock.notification.create).not.toHaveBeenCalled();
        expect(mockGetAuthSession).not.toHaveBeenCalled();
      });
    });
  });
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト - recipientUserIds", () => {
    const testCases = [
      {
        name: "should handle empty recipientUserIds array",
        recipientUserIds: [],
        expectedIsRead: {},
      },
      {
        name: "should handle single recipientUserId",
        recipientUserIds: ["user-1"],
        expectedIsRead: { "user-1": { isRead: false, readAt: null } },
      },
      {
        name: "should handle multiple recipientUserIds",
        recipientUserIds: ["user-1", "user-2", "user-3", "user-4", "user-5"],
        expectedIsRead: {
          "user-1": { isRead: false, readAt: null },
          "user-2": { isRead: false, readAt: null },
          "user-3": { isRead: false, readAt: null },
          "user-4": { isRead: false, readAt: null },
          "user-5": { isRead: false, readAt: null },
        },
      },
    ];

    test.each(testCases)("$name", async ({ recipientUserIds, expectedIsRead }) => {
      // テストデータの準備
      const notificationParams = createNotificationParams({ recipientUserIds });

      // モックの設定
      const mockSession = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isRead: expectedIsRead,
        }) as unknown as object,
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("セッション関連のテスト", () => {
    const sessionTestCases = [
      {
        name: "should handle null session",
        session: null,
        expectedSenderUserId: null,
      },
      {
        name: "should handle session without user",
        session: { expires: "2024-12-31" } as Session,
        expectedSenderUserId: null,
      },
      {
        name: "should handle session with user without id",
        session: {
          user: { email: "test@example.com", name: "Test User" },
          expires: "2024-12-31",
        } as Session,
        expectedSenderUserId: null,
      },
    ];

    test.each(sessionTestCases)("$name", async ({ session, expectedSenderUserId }) => {
      // テストデータの準備
      const notificationParams = createNotificationParams();

      // モックの設定
      mockGetAuthSession.mockResolvedValue(session);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          senderUserId: expectedSenderUserId,
        }) as unknown as object,
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    const errorTestCases = [
      {
        name: "should handle Prisma create error",
        setupMock: () => {
          const mockSession = {
            user: { id: "user-123", email: "test@example.com", name: "Test User" },
            expires: "2024-12-31",
          };
          mockGetAuthSession.mockResolvedValue(mockSession);
          const prismaError = new Error("Database connection failed");
          prismaMock.notification.create.mockRejectedValue(prismaError);
          return prismaError;
        },
        params: {},
        expectedError: "通知の作成中にエラーが発生しました: Database connection failed",
      },
      {
        name: "should handle Prisma updateMany error",
        setupMock: () => {
          const prismaError = new Error("Update failed");
          prismaMock.notification.updateMany.mockRejectedValue(prismaError);
          return prismaError;
        },
        params: { notificationId: "notification-123" },
        expectedError: "通知の作成中にエラーが発生しました: Update failed",
      },
      {
        name: "should handle getAuthSession error",
        setupMock: () => {
          const authError = new Error("Authentication failed");
          mockGetAuthSession.mockRejectedValue(authError);
          return authError;
        },
        params: {},
        expectedError: "通知の作成中にエラーが発生しました: Authentication failed",
      },
    ];

    test.each(errorTestCases)("$name", async ({ setupMock, params, expectedError }) => {
      // テストデータの準備
      const notificationParams = createNotificationParams(params);

      // モックの設定
      const originalError = setupMock();

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // エラーログのモック実装
      });

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({
        success: false,
        data: null,
        message: expectedError,
      });
      expect(consoleSpy).toHaveBeenCalledWith("sendInAppNotification_エラー:", originalError);

      // クリーンアップ
      consoleSpy.mockRestore();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("引数の異常値テスト", () => {
    const invalidDataTestCases = [
      {
        name: "should handle undefined recipientUserIds",
        params: { recipientUserIds: undefined as unknown as string[] },
        setupPrismaError: false,
        expectedError: "通知の作成中にエラーが発生しました: recipientUserIds is required",
      },
      {
        name: "should handle null title",
        params: { title: null as unknown as string },
        setupPrismaError: false,
        expectedError: "通知の作成中にエラーが発生しました: title is required",
      },
      {
        name: "should handle null message",
        params: { message: null as unknown as string },
        setupPrismaError: false,
        expectedError: "通知の作成中にエラーが発生しました: message is required",
      },
      {
        name: "should handle null targetType",
        params: { targetType: null as unknown as NotificationTargetType },
        setupPrismaError: false,
        expectedError: "通知の作成中にエラーが発生しました: targetType is required",
      },
      {
        name: "should handle undefined sendTiming",
        params: { sendTiming: undefined as unknown as NotificationSendTiming },
        setupPrismaError: false,
        expectedError: "通知の作成中にエラーが発生しました: sendTiming is required",
      },
      {
        name: "should handle undefined sendMethods",
        params: { sendMethods: undefined as unknown as NotificationSendMethod[] },
        setupPrismaError: false,
        expectedError: "通知の作成中にエラーが発生しました: sendMethods is required",
      },
    ];

    test.each(invalidDataTestCases)("$name", async ({ params, expectedError }) => {
      // テストデータの準備
      const mockSession = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const notificationParams = createNotificationParams(params);

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);

      // コンソールエラーをモック
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // エラーログのモック実装
      });

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({
        success: false,
        data: null,
        message: expectedError,
      });
      expect(consoleSpy).toHaveBeenCalled();

      // クリーンアップ
      consoleSpy.mockRestore();
    });
  });
});
