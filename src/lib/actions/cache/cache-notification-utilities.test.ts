import { unstable_cacheTag as cacheTag } from "next/cache";
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数のインポート
import { buildCommonNotificationWhereClause } from "@/lib/actions/notification/notification-utilities";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { AuctionEventType, NotificationTargetType, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { RawNotificationFromDB } from "./cache-notification-utilities";
import {
  cachedGetNotificationsAndUnreadCount,
  cachedGetUnreadNotificationsCount,
} from "./cache-notification-utilities";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 依存関数のモック
vi.mock("@/lib/actions/notification/notification-utilities", () => ({
  buildCommonNotificationWhereClause: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cacheTag: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数の型定義
const mockBuildCommonNotificationWhereClause = vi.mocked(buildCommonNotificationWhereClause);
const mockCacheTag = vi.mocked(cacheTag);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テストデータのファクトリー関数
function createMockRawNotificationFromDB(overrides: Partial<RawNotificationFromDB> = {}) {
  return {
    id: overrides.hasOwnProperty("id") ? overrides.id : "notification-1",
    title: overrides.hasOwnProperty("title") ? overrides.title : "テスト通知",
    message: overrides.hasOwnProperty("message") ? overrides.message : "テストメッセージ",
    NotificationTargetType: overrides.hasOwnProperty("NotificationTargetType")
      ? overrides.NotificationTargetType
      : NotificationTargetType.USER,
    isRead: overrides.hasOwnProperty("isRead") ? overrides.isRead : false,
    sentAt: overrides.hasOwnProperty("sentAt") ? overrides.sentAt : new Date("2024-01-01T00:00:00Z"),
    readAt: overrides.hasOwnProperty("readAt") ? overrides.readAt : null,
    expiresAt: overrides.hasOwnProperty("expiresAt") ? overrides.expiresAt : null,
    actionUrl: overrides.hasOwnProperty("actionUrl") ? overrides.actionUrl : "https://example.com",
    senderUserId: overrides.hasOwnProperty("senderUserId") ? overrides.senderUserId : "sender-1",
    groupId: overrides.hasOwnProperty("groupId") ? overrides.groupId : null,
    taskId: overrides.hasOwnProperty("taskId") ? overrides.taskId : null,
    auctionEventType: overrides.hasOwnProperty("auctionEventType") ? overrides.auctionEventType : null,
    auctionId: overrides.hasOwnProperty("auctionId") ? overrides.auctionId : null,
    userName: overrides.hasOwnProperty("userName") ? overrides.userName : "送信者名",
    groupName: overrides.hasOwnProperty("groupName") ? overrides.groupName : null,
    taskName: overrides.hasOwnProperty("taskName") ? overrides.taskName : null,
  };
}

function createMockWhereClause(): Prisma.Sql {
  return Prisma.sql`(n."target_type" = 'USER' AND n."sender_user_id" = 'user-1') AND ((n."send_timing_type" = 'NOW') OR (n."send_timing_type" = 'SCHEDULED' AND n."send_scheduled_date" < NOW()))`;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cachedGetUnreadNotificationsCount", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockBuildCommonNotificationWhereClause.mockResolvedValue(createMockWhereClause());
    mockCacheTag.mockReturnValue(undefined);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should return true when unread notifications exist", async () => {
      // Arrange
      const userId = "user-1";
      const mockResult = [{ id: "notification-1" }];
      prismaMock.$queryRaw.mockResolvedValue(mockResult);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(true);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
      expect(mockCacheTag).toHaveBeenCalledWith(`Notification:${userId}`);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });

    test("should return false when no unread notifications exist", async () => {
      // Arrange
      const userId = "user-1";
      const mockResult: RawNotificationFromDB[] = [];
      prismaMock.$queryRaw.mockResolvedValue(mockResult);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });

    test("should handle different user IDs correctly", async () => {
      // Arrange
      const userId = "user-2";
      const mockResult = [{ id: "notification-2" }];
      prismaMock.$queryRaw.mockResolvedValue(mockResult);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(true);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
      expect(mockCacheTag).toHaveBeenCalledWith(`Notification:${userId}`);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should return false when database query throws error", async () => {
      // Arrange
      const userId = "user-1";
      prismaMock.$queryRaw.mockRejectedValue(new Error("データベースエラー"));

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
    });

    test("should return false when buildCommonNotificationWhereClause throws error", async () => {
      // Arrange
      const userId = "user-1";
      mockBuildCommonNotificationWhereClause.mockRejectedValue(new Error("WHERE句構築エラー"));

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
    });

    test("should handle null result from database", async () => {
      // Arrange
      const userId = "user-1";
      prismaMock.$queryRaw.mockResolvedValue(null as unknown as RawNotificationFromDB[]);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
    });

    test("should handle undefined result from database", async () => {
      // Arrange
      const userId = "user-1";
      prismaMock.$queryRaw.mockResolvedValue(undefined as unknown as RawNotificationFromDB[]);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty user ID", async () => {
      // Arrange
      const userId = "";
      const mockResult: RawNotificationFromDB[] = [];
      prismaMock.$queryRaw.mockResolvedValue(mockResult);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
    });

    test("should handle very long user ID", async () => {
      // Arrange
      const userId = "a".repeat(1000);
      const mockResult = [{ id: "notification-1" }];
      prismaMock.$queryRaw.mockResolvedValue(mockResult);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(true);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
    });

    test("should handle special characters in user ID", async () => {
      // Arrange
      const userId = "user-!@#$%^&*()";
      const mockResult: RawNotificationFromDB[] = [];
      prismaMock.$queryRaw.mockResolvedValue(mockResult);

      // Act
      const result = await cachedGetUnreadNotificationsCount(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
    });
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cachedGetNotificationsAndUnreadCount", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockBuildCommonNotificationWhereClause.mockResolvedValue(createMockWhereClause());
    mockCacheTag.mockReturnValue(undefined);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should return notifications and counts successfully", async () => {
      // Arrange
      const userId = "user-1";
      const page = 1;
      const limit = 20;

      const mockNotifications = [
        createMockRawNotificationFromDB({ id: "notification-1", isRead: false }),
        createMockRawNotificationFromDB({ id: "notification-2", isRead: true }),
      ];

      const mockUnreadCount = [{ count: BigInt(5) }];
      const mockTotalCount = [{ count: BigInt(10) }];

      // 通知取得クエリのモック（2回呼ばれる：未読と既読）
      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert
      expect(result).toStrictEqual({
        notifications: [
          {
            id: "notification-1",
            title: "テスト通知",
            message: "テストメッセージ",
            NotificationTargetType: NotificationTargetType.USER,
            isRead: false,
            sentAt: new Date("2024-01-01T00:00:00Z"),
            readAt: null,
            expiresAt: null,
            actionUrl: "https://example.com",
            senderUserId: "sender-1",
            groupId: null,
            taskId: null,
            auctionEventType: null,
            auctionId: null,
            userName: "送信者名",
            groupName: null,
            taskName: null,
          },
          {
            id: "notification-2",
            title: "テスト通知",
            message: "テストメッセージ",
            NotificationTargetType: NotificationTargetType.USER,
            isRead: true,
            sentAt: new Date("2024-01-01T00:00:00Z"),
            readAt: null,
            expiresAt: null,
            actionUrl: "https://example.com",
            senderUserId: "sender-1",
            groupId: null,
            taskId: null,
            auctionEventType: null,
            auctionId: null,
            userName: "送信者名",
            groupName: null,
            taskName: null,
          },
        ],
        totalCount: 10,
        unreadCount: 5,
        readCount: 5,
      });

      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
      expect(mockCacheTag).toHaveBeenCalledWith(`Notification:${userId}`);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(4);
    });

    test("should handle empty notifications list", async () => {
      // Arrange
      const userId = "user-1";
      const mockUnreadCount = [{ count: BigInt(0) }];
      const mockTotalCount = [{ count: BigInt(0) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result).toStrictEqual({
        notifications: [],
        totalCount: 0,
        unreadCount: 0,
        readCount: 0,
      });
    });

    test("should handle pagination correctly", async () => {
      // Arrange
      const userId = "user-1";
      const page = 2;
      const limit = 5;

      const mockNotifications = [createMockRawNotificationFromDB({ id: "notification-6" })];

      const mockUnreadCount = [{ count: BigInt(3) }];
      const mockTotalCount = [{ count: BigInt(10) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.totalCount).toBe(10);
      expect(result.unreadCount).toBe(3);
      expect(result.readCount).toBe(7);
    });

    test("should handle notifications with all fields populated", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [
        createMockRawNotificationFromDB({
          id: "notification-1",
          title: "完全な通知",
          message: "すべてのフィールドが設定された通知",
          NotificationTargetType: NotificationTargetType.GROUP,
          isRead: true,
          sentAt: new Date("2024-01-01T10:00:00Z"),
          readAt: new Date("2024-01-01T11:00:00Z"),
          expiresAt: new Date("2024-12-31T23:59:59Z"),
          actionUrl: "https://example.com/action",
          senderUserId: "sender-1",
          groupId: "group-1",
          taskId: "task-1",
          auctionEventType: "AUCTION_WIN",
          auctionId: "auction-1",
          userName: "送信者名",
          groupName: "テストグループ",
          taskName: "テストタスク",
        }),
      ];

      const mockUnreadCount = [{ count: BigInt(0) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.notifications[0]).toStrictEqual({
        id: "notification-1",
        title: "完全な通知",
        message: "すべてのフィールドが設定された通知",
        NotificationTargetType: NotificationTargetType.GROUP,
        isRead: true,
        sentAt: new Date("2024-01-01T10:00:00Z"),
        readAt: new Date("2024-01-01T11:00:00Z"),
        expiresAt: new Date("2024-12-31T23:59:59Z"),
        actionUrl: "https://example.com/action",
        senderUserId: "sender-1",
        groupId: "group-1",
        taskId: "task-1",
        auctionEventType: AuctionEventType.AUCTION_WIN,
        auctionId: "auction-1",
        userName: "送信者名",
        groupName: "テストグループ",
        taskName: "テストタスク",
      });
    });

    test("should handle notifications with null/empty fields", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [
        createMockRawNotificationFromDB({
          id: "notification-1",
          title: null,
          message: null,
          actionUrl: null,
          senderUserId: null,
          groupId: null,
          taskId: null,
          auctionEventType: null,
          auctionId: null,
          userName: null,
          groupName: null,
          taskName: null,
          sentAt: null,
          readAt: null,
          expiresAt: null,
        }),
      ];

      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.notifications[0]).toStrictEqual({
        id: "notification-1",
        title: "",
        message: "",
        NotificationTargetType: NotificationTargetType.USER,
        isRead: false,
        sentAt: null,
        readAt: null,
        expiresAt: null,
        actionUrl: null,
        senderUserId: null,
        groupId: null,
        taskId: null,
        auctionEventType: null,
        auctionId: null,
        userName: null,
        groupName: null,
        taskName: null,
      });
    });

    test("should handle duplicate notifications correctly", async () => {
      // Arrange
      const userId = "user-1";
      const duplicateNotification = createMockRawNotificationFromDB({ id: "notification-1" });
      const mockNotifications = [duplicateNotification, duplicateNotification];

      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知（重複あり）
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.notifications).toHaveLength(1); // 重複が除去されている
      expect(result.notifications[0].id).toBe("notification-1");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should return empty result when database query throws error", async () => {
      // Arrange
      const userId = "user-1";
      prismaMock.$queryRaw.mockRejectedValue(new Error("データベースエラー"));

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result).toStrictEqual({
        notifications: [],
        totalCount: 0,
        unreadCount: 0,
        readCount: 0,
      });
    });

    test("should return empty result when buildCommonNotificationWhereClause throws error", async () => {
      // Arrange
      const userId = "user-1";
      mockBuildCommonNotificationWhereClause.mockRejectedValue(new Error("WHERE句構築エラー"));

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result).toStrictEqual({
        notifications: [],
        totalCount: 0,
        unreadCount: 0,
        readCount: 0,
      });
    });

    test("should handle null count results", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [createMockRawNotificationFromDB()];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce([]) // 未読カウント（空配列）
        .mockResolvedValueOnce([{ count: null }]); // 総カウント（null）

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.unreadCount).toBe(0);
      expect(result.totalCount).toBe(0);
      expect(result.readCount).toBe(0);
    });

    test("should handle non-array result from database", async () => {
      // Arrange
      const userId = "user-1";

      prismaMock.$queryRaw
        .mockResolvedValueOnce(null as unknown as RawNotificationFromDB[]) // 未読通知（null）
        .mockResolvedValueOnce(undefined as unknown as RawNotificationFromDB[]) // 既読通知（undefined）
        .mockResolvedValueOnce([{ count: BigInt(0) }]) // 未読カウント
        .mockResolvedValueOnce([{ count: BigInt(0) }]); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.notifications).toStrictEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.unreadCount).toBe(0);
      expect(result.readCount).toBe(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle page 0", async () => {
      // Arrange
      const userId = "user-1";
      const page = 0;
      const limit = 20;

      const mockNotifications = [createMockRawNotificationFromDB()];
      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });

    test("should handle negative page number", async () => {
      // Arrange
      const userId = "user-1";
      const page = -1;
      const limit = 20;

      const mockNotifications = [createMockRawNotificationFromDB()];
      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert
      expect(result.notifications).toHaveLength(1);
    });

    test("should handle limit 0", async () => {
      // Arrange
      const userId = "user-1";
      const page = 1;
      const limit = 0;

      const mockUnreadCount = [{ count: BigInt(0) }];
      const mockTotalCount = [{ count: BigInt(0) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert
      expect(result.notifications).toStrictEqual([]);
    });

    test("should handle very large limit", async () => {
      // Arrange
      const userId = "user-1";
      const page = 1;
      const limit = 10000;

      const mockNotifications = Array.from({ length: 100 }, (_, i) =>
        createMockRawNotificationFromDB({ id: `notification-${i}` }),
      );
      const mockUnreadCount = [{ count: BigInt(100) }];
      const mockTotalCount = [{ count: BigInt(100) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert
      expect(result.notifications).toHaveLength(100);
      expect(result.totalCount).toBe(100);
    });

    test("should handle empty user ID", async () => {
      // Arrange
      const userId = "";
      const mockUnreadCount = [{ count: BigInt(0) }];
      const mockTotalCount = [{ count: BigInt(0) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce([]) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result).toStrictEqual({
        notifications: [],
        totalCount: 0,
        unreadCount: 0,
        readCount: 0,
      });
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
    });

    test("should handle very long user ID", async () => {
      // Arrange
      const userId = "a".repeat(1000);
      const mockNotifications = [createMockRawNotificationFromDB()];
      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(mockBuildCommonNotificationWhereClause).toHaveBeenCalledWith(userId, true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("引数パターンテスト", () => {
    test("should handle all NotificationTargetType values", async () => {
      // Arrange
      const userId = "user-1";
      const targetTypes = [
        NotificationTargetType.USER,
        NotificationTargetType.GROUP,
        NotificationTargetType.TASK,
        NotificationTargetType.SYSTEM,
      ];

      for (const targetType of targetTypes) {
        const mockNotifications = [createMockRawNotificationFromDB({ NotificationTargetType: targetType })];
        const mockUnreadCount = [{ count: BigInt(1) }];
        const mockTotalCount = [{ count: BigInt(1) }];

        prismaMock.$queryRaw
          .mockResolvedValueOnce(mockNotifications) // 未読通知
          .mockResolvedValueOnce([]) // 既読通知
          .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
          .mockResolvedValueOnce(mockTotalCount); // 総カウント

        // Act
        const result = await cachedGetNotificationsAndUnreadCount(userId);

        // Assert
        expect(result.notifications[0].NotificationTargetType).toBe(targetType);

        // モックをリセット
        vi.clearAllMocks();
        mockBuildCommonNotificationWhereClause.mockResolvedValue(createMockWhereClause());
      }
    });

    test("should handle all AuctionEventType values", async () => {
      // Arrange
      const userId = "user-1";
      const auctionEventTypes = Object.values(AuctionEventType);

      for (const eventType of auctionEventTypes) {
        const mockNotifications = [createMockRawNotificationFromDB({ auctionEventType: eventType })];
        const mockUnreadCount = [{ count: BigInt(1) }];
        const mockTotalCount = [{ count: BigInt(1) }];

        prismaMock.$queryRaw
          .mockResolvedValueOnce(mockNotifications) // 未読通知
          .mockResolvedValueOnce([]) // 既読通知
          .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
          .mockResolvedValueOnce(mockTotalCount); // 総カウント

        // Act
        const result = await cachedGetNotificationsAndUnreadCount(userId);

        // Assert
        expect(result.notifications[0].auctionEventType).toBe(eventType);

        // モックをリセット
        vi.clearAllMocks();
        mockBuildCommonNotificationWhereClause.mockResolvedValue(createMockWhereClause());
      }
    });

    test("should handle default parameters", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [createMockRawNotificationFromDB()];
      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act - pageとlimitを指定しない
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.unreadCount).toBe(1);
      expect(result.readCount).toBe(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("複合条件テスト", () => {
    test("should handle mixed read and unread notifications", async () => {
      // Arrange
      const userId = "user-1";
      const unreadNotifications = [
        createMockRawNotificationFromDB({ id: "notification-1", isRead: false }),
        createMockRawNotificationFromDB({ id: "notification-2", isRead: false }),
      ];
      const readNotifications = [createMockRawNotificationFromDB({ id: "notification-3", isRead: true })];

      const mockUnreadCount = [{ count: BigInt(2) }];
      const mockTotalCount = [{ count: BigInt(3) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(unreadNotifications) // 未読通知
        .mockResolvedValueOnce(readNotifications) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.notifications).toHaveLength(3);
      expect(result.unreadCount).toBe(2);
      expect(result.readCount).toBe(1);
      expect(result.totalCount).toBe(3);
    });

    test("should handle large dataset with pagination", async () => {
      // Arrange
      const userId = "user-1";
      const page = 5;
      const limit = 50;

      const mockNotifications = Array.from({ length: 50 }, (_, i) =>
        createMockRawNotificationFromDB({ id: `notification-${200 + i}` }),
      );
      const mockUnreadCount = [{ count: BigInt(150) }];
      const mockTotalCount = [{ count: BigInt(500) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId, page, limit);

      // Assert
      expect(result.notifications).toHaveLength(50);
      expect(result.totalCount).toBe(500);
      expect(result.unreadCount).toBe(150);
      expect(result.readCount).toBe(350);
    });

    test("should handle concurrent calls with same user", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [createMockRawNotificationFromDB()];
      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValue(mockNotifications) // 未読通知
        .mockResolvedValue([]) // 既読通知
        .mockResolvedValue(mockUnreadCount) // 未読カウント
        .mockResolvedValue(mockTotalCount); // 総カウント

      // Act - 同時実行
      const [result1, result2] = await Promise.all([
        cachedGetNotificationsAndUnreadCount(userId),
        cachedGetNotificationsAndUnreadCount(userId),
      ]);

      // Assert
      expect(result1).toStrictEqual(result2);
      expect(result1.notifications).toHaveLength(1);
    });
  });

  describe("エッジケースとエラーハンドリング", () => {
    test("should handle very large count values", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [createMockRawNotificationFromDB()];
      const mockUnreadCount = [{ count: BigInt(Number.MAX_SAFE_INTEGER) }];
      const mockTotalCount = [{ count: BigInt(Number.MAX_SAFE_INTEGER) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.unreadCount).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.totalCount).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.readCount).toBe(0);
    });

    test("should handle malformed date strings", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [
        createMockRawNotificationFromDB({
          sentAt: "invalid-date" as unknown as Date,
          readAt: "2024-13-45T25:70:70Z" as unknown as Date, // 無効な日付
          expiresAt: "not-a-date" as unknown as Date,
        }),
      ];
      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.notifications).toHaveLength(1);
      // 無効な日付は Invalid Date オブジェクトになる
      expect(result.notifications[0].sentAt).toBeInstanceOf(Date);
      expect(result.notifications[0].readAt).toBeInstanceOf(Date);
      expect(result.notifications[0].expiresAt).toBeInstanceOf(Date);
    });

    test("should handle special characters in notification content", async () => {
      // Arrange
      const userId = "user-1";
      const mockNotifications = [
        createMockRawNotificationFromDB({
          title: "特殊文字テスト!@#$%^&*()_+-=[]{}|;':\",./<>?",
          message: "改行\nタブ\t特殊文字🎉📧💌\0null文字",
          actionUrl: "https://example.com/path?param=value&other=test#fragment",
        }),
      ];
      const mockUnreadCount = [{ count: BigInt(1) }];
      const mockTotalCount = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockNotifications) // 未読通知
        .mockResolvedValueOnce([]) // 既読通知
        .mockResolvedValueOnce(mockUnreadCount) // 未読カウント
        .mockResolvedValueOnce(mockTotalCount); // 総カウント

      // Act
      const result = await cachedGetNotificationsAndUnreadCount(userId);

      // Assert
      expect(result.notifications[0].title).toBe("特殊文字テスト!@#$%^&*()_+-=[]{}|;':\",./<>?");
      expect(result.notifications[0].message).toBe("改行\nタブ\t特殊文字🎉📧💌\0null文字");
      expect(result.notifications[0].actionUrl).toBe("https://example.com/path?param=value&other=test#fragment");
    });
  });
});
