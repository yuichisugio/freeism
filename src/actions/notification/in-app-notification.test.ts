import type { Session } from "next-auth";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { notificationFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { NotificationSendMethod, NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { NotificationParams } from "./email-notification";
import { sendInAppNotification } from "./in-app-notification";

// getAuthSessionのモック
vi.mock("@/lib/utils", () => ({
  getAuthSession: vi.fn(),
}));

// モック関数の型定義
const mockGetAuthSession = vi.mocked(await import("@/lib/utils")).getAuthSession;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
// テストヘルパー関数
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 標準的なモックセッションを作成するヘルパー関数
 */
const createMockSession = (userId = "user-123"): Session => ({
  user: { id: userId, email: "test@example.com", name: "Test User" },
  expires: "2024-12-31",
});

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

/**
 * 基本的なモック設定を行うヘルパー関数
 */
const setupBasicMocks = (session: Session | null = createMockSession()) => {
  mockGetAuthSession.mockResolvedValue(session);
  prismaMock.notification.create.mockResolvedValue(notificationFactory.build());
};

/**
 * コンソールエラーのスパイを設定するヘルパー関数
 */
const setupConsoleSpy = () => {
  return vi.spyOn(console, "error").mockImplementation(() => {
    // エラーログのモック実装
  });
};

/**
 * 成功レスポンスの検証を行うヘルパー関数
 */
const expectSuccessResponse = (result: { success: boolean; error?: string }) => {
  expect(result).toStrictEqual({ success: true });
};

/**
 * エラーレスポンスの検証を行うヘルパー関数
 */
const expectErrorResponse = (result: { success: boolean; error?: string }) => {
  expect(result).toStrictEqual({
    success: false,
    error: "通知の作成中にエラーが発生しました",
  });
};

/**
 * isReadオブジェクトを生成するヘルパー関数
 */
const createIsReadObject = (userIds: string[]): Record<string, { isRead: boolean; readAt: null }> => {
  const isReadJsonb: Record<string, { isRead: boolean; readAt: null }> = {};
  userIds.forEach((userId) => {
    isReadJsonb[userId] = { isRead: false, readAt: null };
  });
  return isReadJsonb;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("sendInAppNotification", () => {
  // 各テスト前にモックをリセット
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系 - 新規通知作成", () => {
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

    testCases.forEach(({ name, params, expectedData, skipAuthCheck = false }) => {
      test(`${name}`, async () => {
        // テストデータの準備
        const notificationParams = createNotificationParams(params);

        // モックの設定
        if (!skipAuthCheck) {
          setupBasicMocks();
        } else {
          prismaMock.notification.create.mockResolvedValue(notificationFactory.build());
        }

        // 関数実行
        const result = await sendInAppNotification(notificationParams);

        // 検証
        expectSuccessResponse(result);

        if (skipAuthCheck) {
          expect(mockGetAuthSession).not.toHaveBeenCalled();
        }

        expect(prismaMock.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            title: notificationParams.title,
            message: notificationParams.message,
            targetType: notificationParams.targetType,
            isRead: createIsReadObject(notificationParams.recipientUserIds),
            sendMethods: [NotificationSendMethod.IN_APP],
            ...expectedData,
          }) as unknown as object,
        });
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系 - 既存通知更新", () => {
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
      expectSuccessResponse(result);
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

    testCases.forEach(({ name, recipientUserIds, expectedIsRead }) => {
      test(`${name}`, async () => {
        // テストデータの準備
        const notificationParams = createNotificationParams({ recipientUserIds });

        // モックの設定
        setupBasicMocks();

        // 関数実行
        const result = await sendInAppNotification(notificationParams);

        // 検証
        expectSuccessResponse(result);
        expect(prismaMock.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            isRead: expectedIsRead,
          }) as unknown as object,
        });
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

    sessionTestCases.forEach(({ name, session, expectedSenderUserId }) => {
      test(`${name}`, async () => {
        // テストデータの準備
        const notificationParams = createNotificationParams();

        // モックの設定
        setupBasicMocks(session);

        // 関数実行
        const result = await sendInAppNotification(notificationParams);

        // 検証
        expectSuccessResponse(result);
        expect(prismaMock.notification.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            senderUserId: expectedSenderUserId,
          }) as unknown as object,
        });
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    const errorTestCases = [
      {
        name: "should handle Prisma create error",
        setupMock: () => {
          const mockSession = createMockSession();
          mockGetAuthSession.mockResolvedValue(mockSession);
          const prismaError = new Error("Database connection failed");
          prismaMock.notification.create.mockRejectedValue(prismaError);
          return prismaError;
        },
        params: {},
      },
      {
        name: "should handle Prisma updateMany error",
        setupMock: () => {
          const prismaError = new Error("Update failed");
          prismaMock.notification.updateMany.mockRejectedValue(prismaError);
          return prismaError;
        },
        params: { notificationId: "notification-123" },
      },
      {
        name: "should handle getAuthSession error",
        setupMock: () => {
          const authError = new Error("Authentication failed");
          mockGetAuthSession.mockRejectedValue(authError);
          return authError;
        },
        params: {},
      },
    ];

    errorTestCases.forEach(({ name, setupMock, params }) => {
      test(`${name}`, async () => {
        // テストデータの準備
        const notificationParams = createNotificationParams(params);

        // モックの設定
        const expectedError = setupMock();

        // コンソールエラーをモック
        const consoleSpy = setupConsoleSpy();

        // 関数実行
        const result = await sendInAppNotification(notificationParams);

        // 検証
        expectErrorResponse(result);
        expect(consoleSpy).toHaveBeenCalledWith("sendInAppNotification_エラー:", expectedError);

        // クリーンアップ
        consoleSpy.mockRestore();
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("引数の異常値テスト", () => {
    const invalidDataTestCases = [
      {
        name: "should handle undefined recipientUserIds",
        params: { recipientUserIds: undefined as unknown as string[] },
        setupPrismaError: false,
      },
      {
        name: "should handle null title",
        params: { title: null as unknown as string },
        setupPrismaError: true,
        prismaErrorMessage: "Prisma validation error: title cannot be null",
      },
      {
        name: "should handle undefined sendTiming",
        params: { sendTiming: undefined as unknown as NotificationSendTiming },
        setupPrismaError: true,
        prismaErrorMessage: "Prisma validation error: sendTiming cannot be undefined",
      },
    ];

    invalidDataTestCases.forEach(({ name, params, setupPrismaError, prismaErrorMessage }) => {
      test(`${name}`, async () => {
        // テストデータの準備
        const mockSession = createMockSession();
        const notificationParams = createNotificationParams(params);

        // モックの設定
        mockGetAuthSession.mockResolvedValue(mockSession);

        if (setupPrismaError && prismaErrorMessage) {
          const prismaError = new Error(prismaErrorMessage);
          prismaMock.notification.create.mockRejectedValue(prismaError);
        }

        // コンソールエラーをモック
        const consoleSpy = setupConsoleSpy();

        // 関数実行
        const result = await sendInAppNotification(notificationParams);

        // 検証
        expectErrorResponse(result);
        expect(consoleSpy).toHaveBeenCalled();

        // クリーンアップ
        consoleSpy.mockRestore();
      });
    });
  });
});
