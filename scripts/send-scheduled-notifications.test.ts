import { sendGeneralNotification } from "@/actions/notification/general-notification";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { notificationFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { NotificationSendMethod, NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { main, sendScheduledNotifications } from "./send-scheduled-notifications";

// テスト対象のモジュールをモック
vi.mock("@/lib/actions/notification/general-notification", () => ({
  sendGeneralNotification: vi.fn(),
}));

describe("send-scheduled-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendScheduledNotifications", () => {
    test("should process scheduled notifications successfully", async () => {
      // テストデータの準備
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60 * 60 * 1000); // 1時間前

      const notification = notificationFactory.build({
        id: "notification-1",
        title: "テスト通知",
        message: "テストメッセージ",
        sendScheduledDate: pastDate,
        sendTimingType: NotificationSendTiming.SCHEDULED,
        sentAt: null,
        sendMethods: [NotificationSendMethod.EMAIL, NotificationSendMethod.IN_APP],
        targetType: NotificationTargetType.USER,
        isRead: {
          "user-1": { isRead: false, readAt: null },
          "user-2": { isRead: false, readAt: null },
        },
        groupId: "group-1",
        taskId: "task-1",
        auctionId: "auction-1",
        actionUrl: "/test-url",
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24時間後
      });

      // Prismaモックの設定
      prismaMock.notification.findMany.mockResolvedValue([notification]);
      prismaMock.notification.update.mockResolvedValue(notification);
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // sendGeneralNotificationのモック
      vi.mocked(sendGeneralNotification).mockResolvedValue({
        success: true,
        message: "通知の登録を完了しました",
        data: null,
      });

      // テスト実行
      const result = await sendScheduledNotifications();

      // 検証
      expect(result).toBe(1);
      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: {
          sendScheduledDate: {
            lte: expect.any(Date),
          },
          sendTimingType: NotificationSendTiming.SCHEDULED,
          sentAt: null,
        },
      });

      expect(sendGeneralNotification).toHaveBeenCalledWith({
        title: notification.title,
        message: notification.message,
        sendMethods: notification.sendMethods,
        targetType: notification.targetType,
        recipientUserIds: ["user-1", "user-2"],
        groupId: notification.groupId,
        taskId: notification.taskId,
        auctionId: notification.auctionId,
        actionUrl: notification.actionUrl,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: notification.expiresAt,
        notificationId: notification.id,
      });

      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: notification.id },
        data: { sentAt: expect.any(Date) },
      });

      expect(prismaMock.$disconnect).toHaveBeenCalled();
    });

    test("should skip notifications with no target users", async () => {
      // テストデータの準備 - isReadが空のオブジェクト
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60 * 60 * 1000);

      const notification = notificationFactory.build({
        id: "notification-1",
        sendScheduledDate: pastDate,
        sendTimingType: NotificationSendTiming.SCHEDULED,
        sentAt: null,
        isRead: {}, // 対象ユーザーなし
      });

      // Prismaモックの設定
      prismaMock.notification.findMany.mockResolvedValue([notification]);
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // sendGeneralNotificationのモック
      vi.mocked(sendGeneralNotification).mockResolvedValue({
        success: true,
        message: "通知の登録を完了しました",
        data: null,
      });

      // テスト実行
      const result = await sendScheduledNotifications();

      // 検証 - 対象ユーザーがいないのでスキップされる
      expect(result).toBe(0);
      expect(sendGeneralNotification).not.toHaveBeenCalled();
      expect(prismaMock.notification.update).not.toHaveBeenCalled();
      expect(prismaMock.$disconnect).toHaveBeenCalled();
    });

    test("should handle notification send failure", async () => {
      // テストデータの準備
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60 * 60 * 1000);

      const notification = notificationFactory.build({
        id: "notification-1",
        sendScheduledDate: pastDate,
        sendTimingType: NotificationSendTiming.SCHEDULED,
        sentAt: null,
        isRead: {
          "user-1": { isRead: false, readAt: null },
        },
      });

      // Prismaモックの設定
      prismaMock.notification.findMany.mockResolvedValue([notification]);
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // sendGeneralNotificationが失敗する場合
      vi.mocked(sendGeneralNotification).mockResolvedValue({
        success: false,
        message: "送信エラー",
        data: null,
      });

      // テスト実行
      const result = await sendScheduledNotifications();

      // 検証 - 送信失敗時はsentAtが更新されない
      expect(result).toBe(0);
      expect(sendGeneralNotification).toHaveBeenCalled();
      expect(prismaMock.notification.update).not.toHaveBeenCalled();
      expect(prismaMock.$disconnect).toHaveBeenCalled();
    });

    test("should handle individual notification processing errors", async () => {
      // テストデータの準備
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60 * 60 * 1000);

      const notification1 = notificationFactory.build({
        id: "notification-1",
        sendScheduledDate: pastDate,
        sendTimingType: NotificationSendTiming.SCHEDULED,
        sentAt: null,
        isRead: {
          "user-1": { isRead: false, readAt: null },
        },
      });

      const notification2 = notificationFactory.build({
        id: "notification-2",
        sendScheduledDate: pastDate,
        sendTimingType: NotificationSendTiming.SCHEDULED,
        sentAt: null,
        isRead: {
          "user-2": { isRead: false, readAt: null },
        },
      });

      // Prismaモックの設定
      prismaMock.notification.findMany.mockResolvedValue([notification1, notification2]);
      prismaMock.notification.update.mockResolvedValue(notification2);
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // sendGeneralNotificationのモック
      vi.mocked(sendGeneralNotification).mockRejectedValueOnce(new Error("送信エラー")).mockResolvedValueOnce({
        success: true,
        message: "通知の登録を完了しました",
        data: null,
      });

      // テスト実行
      const result = await sendScheduledNotifications();

      // 検証 - 1つ目はエラーで処理されず、2つ目は成功
      expect(result).toBe(1);
      expect(sendGeneralNotification).toHaveBeenCalledTimes(2);
      expect(prismaMock.notification.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.$disconnect).toHaveBeenCalled();
    });

    test("should process multiple notifications correctly", async () => {
      // テストデータの準備
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60 * 60 * 1000);

      const notification1 = notificationFactory.build({
        id: "notification-1",
        sendScheduledDate: pastDate,
        sendTimingType: NotificationSendTiming.SCHEDULED,
        sentAt: null,
        isRead: {
          "user-1": { isRead: false, readAt: null },
        },
      });

      const notification2 = notificationFactory.build({
        id: "notification-2",
        sendScheduledDate: pastDate,
        sendTimingType: NotificationSendTiming.SCHEDULED,
        sentAt: null,
        isRead: {
          "user-2": { isRead: false, readAt: null },
        },
      });

      // Prismaモックの設定
      prismaMock.notification.findMany.mockResolvedValue([notification1, notification2]);
      prismaMock.notification.update.mockResolvedValue(notification1);
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // sendGeneralNotificationのモック
      vi.mocked(sendGeneralNotification).mockResolvedValue({
        success: true,
        message: "通知の登録を完了しました",
        data: null,
      });

      // テスト実行
      const result = await sendScheduledNotifications();

      // 検証 - 2件とも処理される
      expect(result).toBe(2);
      expect(sendGeneralNotification).toHaveBeenCalledTimes(2);
      expect(prismaMock.notification.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.$disconnect).toHaveBeenCalled();
    });

    test("should return 0 when no notifications to process", async () => {
      // Prismaモックの設定 - 対象の通知なし
      prismaMock.notification.findMany.mockResolvedValue([]);
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // テスト実行
      const result = await sendScheduledNotifications();

      // 検証
      expect(result).toBe(0);
      expect(prismaMock.notification.findMany).toHaveBeenCalled();
      expect(prismaMock.$disconnect).toHaveBeenCalled();
    });

    test("should handle database query errors", async () => {
      // Prismaモックの設定 - findManyでエラーが発生
      prismaMock.notification.findMany.mockRejectedValue(new Error("Database error"));
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // テスト実行と検証
      await expect(sendScheduledNotifications()).rejects.toThrow("Database error");
      expect(prismaMock.$disconnect).toHaveBeenCalled();
    });

    test("should handle notification update errors", async () => {
      // テストデータの準備
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60 * 60 * 1000);

      const notification = notificationFactory.build({
        id: "notification-1",
        sendScheduledDate: pastDate,
        sendTimingType: NotificationSendTiming.SCHEDULED,
        sentAt: null,
        isRead: {
          "user-1": { isRead: false, readAt: null },
        },
      });

      // Prismaモックの設定
      prismaMock.notification.findMany.mockResolvedValue([notification]);
      prismaMock.notification.update.mockRejectedValue(new Error("Update failed"));
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // sendGeneralNotificationのモック
      vi.mocked(sendGeneralNotification).mockResolvedValue({
        success: true,
        message: "通知の登録を完了しました",
        data: null,
      });

      // テスト実行
      const result = await sendScheduledNotifications();

      // 検証 - 更新エラーが発生してもprocessedCountは増えない
      expect(result).toBe(0);
      expect(sendGeneralNotification).toHaveBeenCalled();
      expect(prismaMock.notification.update).toHaveBeenCalled();
      expect(prismaMock.$disconnect).toHaveBeenCalled();
    });

    test("should handle boundary case with exact current time", async () => {
      // テストデータの準備 - 現在時刻ちょうど
      const now = new Date();

      const notification = notificationFactory.build({
        id: "notification-1",
        sendScheduledDate: now,
        sendTimingType: NotificationSendTiming.SCHEDULED,
        sentAt: null,
        isRead: {
          "user-1": { isRead: false, readAt: null },
        },
      });

      // Prismaモックの設定
      prismaMock.notification.findMany.mockResolvedValue([notification]);
      prismaMock.notification.update.mockResolvedValue(notification);
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // sendGeneralNotificationのモック
      vi.mocked(sendGeneralNotification).mockResolvedValue({
        success: true,
        message: "通知の登録を完了しました",
        data: null,
      });

      // テスト実行
      const result = await sendScheduledNotifications();

      // 検証 - 現在時刻ちょうどでも処理される
      expect(result).toBe(1);
      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: {
          sendScheduledDate: {
            lte: expect.any(Date),
          },
          sendTimingType: NotificationSendTiming.SCHEDULED,
          sentAt: null,
        },
      });
      expect(prismaMock.$disconnect).toHaveBeenCalled();
    });

    test("should handle notifications with null optional fields", async () => {
      // テストデータの準備 - オプションフィールドがnull
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60 * 60 * 1000);

      const notification = notificationFactory.build({
        id: "notification-1",
        sendScheduledDate: pastDate,
        sendTimingType: NotificationSendTiming.SCHEDULED,
        sentAt: null,
        isRead: {
          "user-1": { isRead: false, readAt: null },
        },
        groupId: null,
        taskId: null,
        auctionId: null,
        actionUrl: null,
        expiresAt: null,
      });

      // Prismaモックの設定
      prismaMock.notification.findMany.mockResolvedValue([notification]);
      prismaMock.notification.update.mockResolvedValue(notification);
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // sendGeneralNotificationのモック
      vi.mocked(sendGeneralNotification).mockResolvedValue({
        success: true,
        message: "通知の登録を完了しました",
        data: null,
      });

      // テスト実行
      const result = await sendScheduledNotifications();

      // 検証 - nullフィールドでも正常に処理される
      expect(result).toBe(1);
      expect(sendGeneralNotification).toHaveBeenCalledWith({
        title: notification.title,
        message: notification.message,
        sendMethods: notification.sendMethods,
        targetType: notification.targetType,
        recipientUserIds: ["user-1"],
        groupId: null,
        taskId: null,
        auctionId: null,
        actionUrl: null,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
        notificationId: notification.id,
      });
      expect(prismaMock.$disconnect).toHaveBeenCalled();
    });

    test("should handle error and still disconnect prisma", async () => {
      // Prismaモックの設定 - findManyでエラーが発生
      prismaMock.notification.findMany.mockRejectedValue(new Error("Database error"));
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // テスト実行と検証
      await expect(sendScheduledNotifications()).rejects.toThrow("Database error");
      expect(prismaMock.$disconnect).toHaveBeenCalled();
    });
  });

  describe("main function", () => {
    test("should handle errors and exit with code 1", async () => {
      // process.exitのモック
      const mockExit = vi.spyOn(process, "exit").mockImplementation((code) => {
        throw new Error(`process.exit called with code ${code}`);
      });

      // console.errorのモック
      const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      // Prismaモックの設定 - エラーが発生
      const testError = new Error("テストエラー");
      prismaMock.notification.findMany.mockRejectedValue(testError);
      prismaMock.$disconnect.mockResolvedValue(undefined);

      // テスト実行と検証
      try {
        await main();
      } catch (error) {
        // process.exitが呼ばれることを確認
        expect(error).toEqual(new Error("process.exit called with code 1"));
      }

      expect(mockConsoleError).toHaveBeenCalledWith("エラーが発生しました:", testError);
      expect(mockExit).toHaveBeenCalledWith(1);

      // モックをリストア
      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });
  });
});
