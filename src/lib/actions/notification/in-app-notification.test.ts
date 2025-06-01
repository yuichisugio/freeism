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

describe("sendInAppNotification", () => {
  // 各テスト前にモックをリセット
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系 - 新規通知作成", () => {
    test("should create new notification with NOW timing successfully", async () => {
      // テストデータの準備
      const mockSession: Session = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1", "user-2"],
        title: "テスト通知",
        message: "テストメッセージ",
        sendMethods: [NotificationSendMethod.IN_APP],
        senderUserId: null,
        actionUrl: "https://example.com",
        targetType: NotificationTargetType.USER,
        groupId: null,
        taskId: null,
        auctionId: null,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: new Date("2024-12-31"),
        notificationId: null,
        sentAt: null,
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          title: "テスト通知",
          message: "テストメッセージ",
          targetType: NotificationTargetType.USER,
          sendTimingType: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          sentAt: expect.any(Date) as unknown as Date,
          expiresAt: new Date("2024-12-31"),
          actionUrl: "https://example.com",
          senderUserId: "user-123",
          groupId: null,
          taskId: null,
          isRead: {
            "user-1": { isRead: false, readAt: null },
            "user-2": { isRead: false, readAt: null },
          },
          sendMethods: [NotificationSendMethod.IN_APP],
        },
      });
    });

    test("should create new notification with SCHEDULED timing successfully", async () => {
      // テストデータの準備
      const mockSession: Session = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const scheduledDate = new Date("2024-12-25");
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1"],
        title: "予約通知",
        message: "予約メッセージ",
        sendMethods: [NotificationSendMethod.IN_APP],
        senderUserId: null,
        actionUrl: null,
        targetType: NotificationTargetType.USER,
        groupId: null,
        taskId: null,
        auctionId: null,
        sendTiming: NotificationSendTiming.SCHEDULED,
        sendScheduledDate: scheduledDate,
        expiresAt: null,
        notificationId: null,
        sentAt: null,
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          title: "予約通知",
          message: "予約メッセージ",
          targetType: NotificationTargetType.USER,
          sendTimingType: NotificationSendTiming.SCHEDULED,
          sendScheduledDate: scheduledDate,
          sentAt: null as unknown as Date,
          expiresAt: undefined,
          actionUrl: undefined,
          senderUserId: "user-123",
          groupId: null,
          taskId: null,
          isRead: {
            "user-1": { isRead: false, readAt: null },
          },
          sendMethods: [NotificationSendMethod.IN_APP],
        },
      });
    });

    test("should create GROUP notification successfully", async () => {
      // テストデータの準備
      const mockSession: Session = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1", "user-2", "user-3"],
        title: "グループ通知",
        message: "グループメッセージ",
        sendMethods: [NotificationSendMethod.IN_APP],
        senderUserId: null,
        actionUrl: null,
        targetType: NotificationTargetType.GROUP,
        groupId: "group-123",
        taskId: null,
        auctionId: null,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
        notificationId: null,
        sentAt: null,
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          title: "グループ通知",
          message: "グループメッセージ",
          targetType: NotificationTargetType.GROUP,
          sendTimingType: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          sentAt: expect.any(Date) as unknown as Date,
          expiresAt: undefined,
          actionUrl: undefined,
          senderUserId: "user-123",
          groupId: "group-123",
          taskId: null,
          isRead: {
            "user-1": { isRead: false, readAt: null },
            "user-2": { isRead: false, readAt: null },
            "user-3": { isRead: false, readAt: null },
          },
          sendMethods: [NotificationSendMethod.IN_APP],
        },
      });
    });

    test("should create TASK notification successfully", async () => {
      // テストデータの準備
      const mockSession: Session = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1"],
        title: "タスク通知",
        message: "タスクメッセージ",
        sendMethods: [NotificationSendMethod.IN_APP],
        senderUserId: null,
        actionUrl: null,
        targetType: NotificationTargetType.TASK,
        groupId: null,
        taskId: "task-123",
        auctionId: null,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
        notificationId: null,
        sentAt: null,
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          title: "タスク通知",
          message: "タスクメッセージ",
          targetType: NotificationTargetType.TASK,
          sendTimingType: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          sentAt: expect.any(Date) as unknown as Date,
          expiresAt: undefined,
          actionUrl: undefined,
          senderUserId: "user-123",
          groupId: null,
          taskId: "task-123",
          isRead: {
            "user-1": { isRead: false, readAt: null },
          },
          sendMethods: [NotificationSendMethod.IN_APP],
        },
      });
    });

    test("should create auction notification with null senderUserId", async () => {
      // テストデータの準備
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1"],
        title: "オークション通知",
        message: "オークションメッセージ",
        sendMethods: [NotificationSendMethod.IN_APP],
        senderUserId: null,
        actionUrl: null,
        targetType: NotificationTargetType.USER,
        groupId: null,
        taskId: null,
        auctionId: "auction-123", // オークションIDが設定されている
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
        notificationId: null,
        sentAt: null,
      };

      // モックの設定
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(mockGetAuthSession).not.toHaveBeenCalled(); // オークション通知の場合はgetAuthSessionが呼ばれない
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          title: "オークション通知",
          message: "オークションメッセージ",
          targetType: NotificationTargetType.USER,
          sendTimingType: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          sentAt: expect.any(Date) as unknown as Date,
          expiresAt: undefined,
          actionUrl: undefined,
          senderUserId: null, // オークション通知の場合はnull
          groupId: null,
          taskId: null,
          isRead: {
            "user-1": { isRead: false, readAt: null },
          },
          sendMethods: [NotificationSendMethod.IN_APP],
        },
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系 - 既存通知更新", () => {
    test("should update existing notification when notificationId is provided", async () => {
      // テストデータの準備
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1"],
        title: "更新通知",
        message: "更新メッセージ",
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
        notificationId: "notification-123", // 既存の通知ID
        sentAt: null,
      };

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
      expect(prismaMock.notification.create).not.toHaveBeenCalled(); // 新規作成は呼ばれない
      expect(mockGetAuthSession).not.toHaveBeenCalled(); // セッション取得も呼ばれない
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty recipientUserIds array", async () => {
      // テストデータの準備
      const mockSession: Session = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const notificationParams: NotificationParams = {
        recipientUserIds: [], // 空の配列
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
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isRead: {}, // 空のオブジェクト
        }) as unknown as object,
      });
    });

    test("should handle single recipientUserId", async () => {
      // テストデータの準備
      const mockSession: Session = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1"], // 単一のユーザー
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
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isRead: {
            "user-1": { isRead: false, readAt: null },
          },
        }) as unknown as object,
      });
    });

    test("should handle multiple recipientUserIds", async () => {
      // テストデータの準備
      const mockSession: Session = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1", "user-2", "user-3", "user-4", "user-5"], // 複数のユーザー
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
      };

      // モックの設定
      mockGetAuthSession.mockResolvedValue(mockSession);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isRead: {
            "user-1": { isRead: false, readAt: null },
            "user-2": { isRead: false, readAt: null },
            "user-3": { isRead: false, readAt: null },
            "user-4": { isRead: false, readAt: null },
            "user-5": { isRead: false, readAt: null },
          },
        }) as unknown as object,
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("セッション関連のテスト", () => {
    test("should handle null session", async () => {
      // テストデータの準備
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1"],
        title: "テスト通知",
        message: "テストメッセージ",
        sendMethods: [NotificationSendMethod.IN_APP],
        senderUserId: null,
        actionUrl: null,
        targetType: NotificationTargetType.USER,
        groupId: null,
        taskId: null,
        auctionId: null, // オークション通知ではない
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
        notificationId: null,
        sentAt: null,
      };

      // モックの設定（セッションがnull）
      mockGetAuthSession.mockResolvedValue(null);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          senderUserId: null, // セッションがnullの場合はnull
        }) as unknown as object,
      });
    });

    test("should handle session without user", async () => {
      // テストデータの準備
      const notificationParams: NotificationParams = {
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
      };

      // モックの設定（userがundefined）
      const mockSessionWithoutUser: Session = {
        expires: "2024-12-31",
      } as Session;
      mockGetAuthSession.mockResolvedValue(mockSessionWithoutUser);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          senderUserId: null, // userがundefinedの場合はnull
        }) as unknown as object,
      });
    });

    test("should handle session with user without id", async () => {
      // テストデータの準備
      const notificationParams: NotificationParams = {
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
      };

      // モックの設定（user.idがundefined）
      const mockSessionWithoutUserId: Session = {
        user: { email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      } as Session;
      mockGetAuthSession.mockResolvedValue(mockSessionWithoutUserId);
      prismaMock.notification.create.mockResolvedValue(notificationFactory.build());

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({ success: true });
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          senderUserId: null, // user.idがundefinedの場合はnull
        }) as unknown as object,
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle Prisma create error", async () => {
      // テストデータの準備
      const mockSession: Session = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const notificationParams: NotificationParams = {
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
      };

      // モックの設定（Prismaエラー）
      mockGetAuthSession.mockResolvedValue(mockSession);
      const prismaError = new Error("Database connection failed");
      prismaMock.notification.create.mockRejectedValue(prismaError);

      // コンソールエラーをモック

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // エラーログのモック実装
      });

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({
        success: false,
        error: "通知の作成中にエラーが発生しました",
      });
      expect(consoleSpy).toHaveBeenCalledWith("sendInAppNotification_エラー:", prismaError);
      expect(consoleSpy).toHaveBeenCalledWith("sendInAppNotification_エラーstack:", expect.any(String));

      // クリーンアップ
      consoleSpy.mockRestore();
    });

    test("should handle Prisma updateMany error", async () => {
      // テストデータの準備
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1"],
        title: "更新通知",
        message: "更新メッセージ",
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
        notificationId: "notification-123",
        sentAt: null,
      };

      // モックの設定（Prismaエラー）
      const prismaError = new Error("Update failed");
      prismaMock.notification.updateMany.mockRejectedValue(prismaError);

      // コンソールエラーをモック
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // エラーログのモック実装
      });

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({
        success: false,
        error: "通知の作成中にエラーが発生しました",
      });
      expect(consoleSpy).toHaveBeenCalledWith("sendInAppNotification_エラー:", prismaError);

      // クリーンアップ
      consoleSpy.mockRestore();
    });

    test("should handle getAuthSession error", async () => {
      // テストデータの準備
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1"],
        title: "テスト通知",
        message: "テストメッセージ",
        sendMethods: [NotificationSendMethod.IN_APP],
        senderUserId: null,
        actionUrl: null,
        targetType: NotificationTargetType.USER,
        groupId: null,
        taskId: null,
        auctionId: null, // オークション通知ではない
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
        notificationId: null,
        sentAt: null,
      };

      // モックの設定（getAuthSessionエラー）
      const authError = new Error("Authentication failed");
      mockGetAuthSession.mockRejectedValue(authError);

      // コンソールエラーをモック

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // エラーログのモック実装
      });

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({
        success: false,
        error: "通知の作成中にエラーが発生しました",
      });
      expect(consoleSpy).toHaveBeenCalledWith("sendInAppNotification_エラー:", authError);

      // クリーンアップ
      consoleSpy.mockRestore();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("引数の異常値テスト", () => {
    test("should handle undefined recipientUserIds", async () => {
      // テストデータの準備
      const mockSession: Session = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const notificationParams: NotificationParams = {
        recipientUserIds: undefined as unknown as string[], // 異常値
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
      };

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
        error: "通知の作成中にエラーが発生しました",
      });
      expect(consoleSpy).toHaveBeenCalled();

      // クリーンアップ
      consoleSpy.mockRestore();
    });

    test("should handle null title", async () => {
      // テストデータの準備
      const mockSession: Session = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const notificationParams: NotificationParams = {
        recipientUserIds: ["user-1"],
        title: null as unknown as string, // 異常値
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
      };

      // モックの設定（Prismaエラーを発生させる）
      mockGetAuthSession.mockResolvedValue(mockSession);
      const prismaError = new Error("Prisma validation error: title cannot be null");
      prismaMock.notification.create.mockRejectedValue(prismaError);

      // コンソールエラーをモック

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // エラーログのモック実装
      });

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({
        success: false,
        error: "通知の作成中にエラーが発生しました",
      });
      expect(consoleSpy).toHaveBeenCalledWith("sendInAppNotification_エラー:", prismaError);

      // クリーンアップ
      consoleSpy.mockRestore();
    });

    test("should handle undefined sendTiming", async () => {
      // テストデータの準備
      const mockSession: Session = {
        user: { id: "user-123", email: "test@example.com", name: "Test User" },
        expires: "2024-12-31",
      };
      const notificationParams: NotificationParams = {
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
        sendTiming: undefined as unknown as NotificationSendTiming, // 異常値
        sendScheduledDate: null,
        expiresAt: null,
        notificationId: null,
        sentAt: null,
      };

      // モックの設定（Prismaエラーを発生させる）
      mockGetAuthSession.mockResolvedValue(mockSession);
      const prismaError = new Error("Prisma validation error: sendTiming cannot be undefined");
      prismaMock.notification.create.mockRejectedValue(prismaError);

      // コンソールエラーをモック

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // エラーログのモック実装
      });

      // 関数実行
      const result = await sendInAppNotification(notificationParams);

      // 検証
      expect(result).toStrictEqual({
        success: false,
        error: "通知の作成中にエラーが発生しました",
      });
      expect(consoleSpy).toHaveBeenCalledWith("sendInAppNotification_エラー:", prismaError);

      // クリーンアップ
      consoleSpy.mockRestore();
    });
  });
});
