import { revalidatePath, revalidateTag } from "next/cache";
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数のインポート
import { cachedGetNotificationsAndUnreadCount, cachedGetUnreadNotificationsCount } from "@/lib/actions/cache/cache-notification-utilities";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { NotificationTargetType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildCommonNotificationWhereClause,
  buildNotificationTargetCondition,
  getNotificationsAndUnreadCount,
  getNotificationTargetUserIds,
  getUnreadNotificationsCount,
  getUserAccessibleGroupIds,
  updateNotificationStatus,
} from "./notification-utilities";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 依存関数のモック
vi.mock("@/lib/actions/cache/cache-notification-utilities", () => ({
  cachedGetUnreadNotificationsCount: vi.fn(),
  cachedGetNotificationsAndUnreadCount: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数の型定義
const mockCachedGetUnreadNotificationsCount = vi.mocked(cachedGetUnreadNotificationsCount);
const mockCachedGetNotificationsAndUnreadCount = vi.mocked(cachedGetNotificationsAndUnreadCount);
const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);
const mockRevalidateTag = vi.mocked(revalidateTag);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("notification-utilities", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockGetAuthenticatedSessionUserId.mockResolvedValue("user-1");
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUnreadNotificationsCount", () => {
    describe("正常系テスト", () => {
      test("should return true when user has unread notifications", async () => {
        // Arrange
        const userId = "user-1";
        mockCachedGetUnreadNotificationsCount.mockResolvedValue(true);

        // Act
        const result = await getUnreadNotificationsCount(userId);

        // Assert
        expect(result).toBe(true);
        expect(mockCachedGetUnreadNotificationsCount).toHaveBeenCalledWith(userId);
      });

      test("should return false when user has no unread notifications", async () => {
        // Arrange
        const userId = "user-1";
        mockCachedGetUnreadNotificationsCount.mockResolvedValue(false);

        // Act
        const result = await getUnreadNotificationsCount(userId);

        // Assert
        expect(result).toBe(false);
        expect(mockCachedGetUnreadNotificationsCount).toHaveBeenCalledWith(userId);
      });
    });

    describe("異常系テスト", () => {
      test("should handle error from cached function", async () => {
        // Arrange
        const userId = "user-1";
        mockCachedGetUnreadNotificationsCount.mockRejectedValue(new Error("キャッシュエラー"));

        // Act & Assert
        await expect(getUnreadNotificationsCount(userId)).rejects.toThrow("キャッシュエラー");
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getNotificationsAndUnreadCount", () => {
    describe("正常系テスト", () => {
      test("should return notifications and counts successfully", async () => {
        // Arrange
        const userId = "user-1";
        const page = 1;
        const limit = 20;
        const mockNotifications = [
          {
            id: "notification-1",
            title: "テスト通知",
            message: "テストメッセージ",
            NotificationTargetType: NotificationTargetType.USER,
            isRead: false,
            sentAt: new Date(),
            readAt: null,
            expiresAt: null,
            actionUrl: null,
            senderUserId: null,
            groupId: null,
            taskId: null,
            userName: null,
            groupName: null,
            taskName: null,
            auctionEventType: null,
            auctionId: null,
          },
        ];
        const mockResult = {
          notifications: mockNotifications,
          totalCount: 1,
          unreadCount: 1,
          readCount: 0,
        };
        mockCachedGetNotificationsAndUnreadCount.mockResolvedValue(mockResult);

        // Act
        const result = await getNotificationsAndUnreadCount(userId, page, limit);

        // Assert
        expect(result).toStrictEqual(mockResult);
        expect(mockCachedGetNotificationsAndUnreadCount).toHaveBeenCalledWith(userId, page, limit);
      });

      test("should use default values for page and limit", async () => {
        // Arrange
        const userId = "user-1";
        const mockResult = {
          notifications: [],
          totalCount: 0,
          unreadCount: 0,
          readCount: 0,
        };
        mockCachedGetNotificationsAndUnreadCount.mockResolvedValue(mockResult);

        // Act
        const result = await getNotificationsAndUnreadCount(userId);

        // Assert
        expect(result).toStrictEqual(mockResult);
        expect(mockCachedGetNotificationsAndUnreadCount).toHaveBeenCalledWith(userId, 1, 20);
      });
    });

    describe("異常系テスト", () => {
      test("should return empty result when error occurs", async () => {
        // Arrange
        const userId = "user-1";
        mockCachedGetNotificationsAndUnreadCount.mockRejectedValue(new Error("データベースエラー"));

        // Act
        const result = await getNotificationsAndUnreadCount(userId);

        // Assert
        expect(result).toStrictEqual({
          notifications: [],
          totalCount: 0,
          unreadCount: 0,
          readCount: 0,
        });
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateNotificationStatus", () => {
    describe("正常系テスト", () => {
      test("should update notification status successfully", async () => {
        // Arrange
        const updates = [
          { notificationId: "notification-1", isRead: true },
          { notificationId: "notification-2", isRead: false },
        ];
        const userId = "user-1";
        mockGetAuthenticatedSessionUserId.mockResolvedValue(userId);

        // Prismaのトランザクションモック
        const mockTransaction = vi.fn().mockImplementation(async (callback: (tx: { $executeRaw: () => Promise<void> }) => Promise<unknown>) => {
          return await callback({
            $executeRaw: vi.fn().mockResolvedValue(undefined),
          });
        });
        prismaMock.$transaction.mockImplementation(mockTransaction);

        // Act
        const result = await updateNotificationStatus(updates);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        expect(prismaMock.$transaction).toHaveBeenCalled();
        expect(mockRevalidateTag).toHaveBeenCalledWith(`Notification:${userId}`);
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/notifications");
      });

      test("should handle empty updates array", async () => {
        // Arrange
        const updates: Array<{ notificationId: string; isRead: boolean }> = [];
        const userId = "user-1";
        mockGetAuthenticatedSessionUserId.mockResolvedValue(userId);

        const mockTransaction = vi.fn().mockImplementation(async (callback: (tx: { $executeRaw: () => Promise<void> }) => Promise<unknown>) => {
          return await callback({
            $executeRaw: vi.fn().mockResolvedValue(undefined),
          });
        });
        prismaMock.$transaction.mockImplementation(mockTransaction);

        // Act
        const result = await updateNotificationStatus(updates);

        // Assert
        expect(result).toStrictEqual({ success: true });
      });
    });

    describe("異常系テスト", () => {
      test("should return error when authentication fails", async () => {
        // Arrange
        const updates = [{ notificationId: "notification-1", isRead: true }];
        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("認証エラー"));

        // Act
        const result = await updateNotificationStatus(updates);

        // Assert
        expect(result).toStrictEqual({ success: false });
      });

      test("should return error when transaction fails", async () => {
        // Arrange
        const updates = [{ notificationId: "notification-1", isRead: true }];
        const userId = "user-1";
        mockGetAuthenticatedSessionUserId.mockResolvedValue(userId);
        prismaMock.$transaction.mockRejectedValue(new Error("トランザクションエラー"));

        // Act
        const result = await updateNotificationStatus(updates);

        // Assert
        expect(result).toStrictEqual({ success: false });
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserAccessibleGroupIds", () => {
    describe("正常系テスト", () => {
      test("should return group IDs for user with groups", async () => {
        // Arrange
        const userId = "user-1";
        const mockGroupMemberships = [{ groupId: "group-1" }, { groupId: "group-2" }];
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getUserAccessibleGroupIds(userId);

        // Assert
        expect(result).toStrictEqual(["group-1", "group-2"]);
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { userId },
          select: { groupId: true },
        });
      });

      test("should return dummy ID when user has no groups", async () => {
        // Arrange
        const userId = "user-1";
        prismaMock.groupMembership.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>);

        // Act
        const result = await getUserAccessibleGroupIds(userId);

        // Assert
        expect(result).toStrictEqual(["00000000-0000-0000-0000-000000000000"]);
      });

      test("should filter out null group IDs", async () => {
        // Arrange
        const userId = "user-1";
        const mockGroupMemberships = [{ groupId: "group-1" }, { groupId: null }, { groupId: "group-2" }];
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getUserAccessibleGroupIds(userId);

        // Assert
        expect(result).toStrictEqual(["group-1", "group-2"]);
      });
    });

    describe("異常系テスト", () => {
      test("should handle database error", async () => {
        // Arrange
        const userId = "user-1";
        prismaMock.groupMembership.findMany.mockRejectedValue(new Error("データベースエラー"));

        // Act & Assert
        await expect(getUserAccessibleGroupIds(userId)).rejects.toThrow("データベースエラー");
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getNotificationTargetUserIds", () => {
    describe("正常系テスト", () => {
      test("should return all user IDs for SYSTEM target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.SYSTEM;
        const params = {};
        const mockUsers = [{ id: "user-1" }, { id: "user-2" }, { id: "user-3" }];
        prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual(["user-1", "user-2", "user-3"]);
        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
          select: { id: true },
        });
      });

      test("should return specified user IDs for USER target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.USER;
        const params = { userIds: ["user-1", "user-2"] };

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual(["user-1", "user-2"]);
      });

      test("should return group member IDs for GROUP target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.GROUP;
        const params = { groupId: "group-1" };
        const mockGroupMembers = [{ userId: "user-1" }, { userId: "user-2" }];
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMembers as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual(["user-1", "user-2"]);
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { groupId: "group-1" },
          select: { userId: true },
        });
      });

      test("should return task-related user IDs for TASK target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.TASK;
        const params = { taskId: "task-1" };
        const mockTask = {
          creatorId: "user-1",
          groupId: "group-1",
          reporters: [
            { userId: "user-2" },
            { userId: null }, // 未登録ユーザーは除外される
          ],
          executors: [
            { userId: "user-3" },
            { userId: null }, // 未登録ユーザーは除外される
          ],
        };
        const mockGroupMembers = [{ userId: "user-4" }, { userId: "user-5" }];
        prismaMock.task.findUnique.mockResolvedValue(mockTask as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMembers as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        // 重複を除去して返される
        expect(result).toStrictEqual(["user-1", "user-2", "user-3", "user-4", "user-5"]);
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: "task-1" },
          select: {
            creatorId: true,
            groupId: true,
            reporters: {
              select: {
                userId: true,
              },
            },
            executors: {
              select: {
                userId: true,
              },
            },
          },
        });
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { groupId: "group-1" },
          select: { userId: true },
        });
      });

      test("should handle task not found for TASK target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.TASK;
        const params = { taskId: "task-1" };
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual([]);
      });

      test("should remove duplicate user IDs", async () => {
        // Arrange
        const targetType = NotificationTargetType.TASK;
        const params = { taskId: "task-1" };
        const mockTask = {
          creatorId: "user-1",
          groupId: "group-1",
          reporters: [
            { userId: "user-1" }, // 重複
          ],
          executors: [{ userId: "user-2" }],
        };
        const mockGroupMembers = [
          { userId: "user-1" }, // 重複
          { userId: "user-2" }, // 重複
        ];
        prismaMock.task.findUnique.mockResolvedValue(mockTask as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMembers as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual(["user-1", "user-2"]);
      });
    });

    describe("異常系テスト", () => {
      test("should throw error when userIds not provided for USER target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.USER;
        const params = {};

        // Act & Assert
        await expect(getNotificationTargetUserIds(targetType, params)).rejects.toThrow("ユーザーIDが指定されていません");
      });

      test("should throw error when groupId not provided for GROUP target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.GROUP;
        const params = {};

        // Act & Assert
        await expect(getNotificationTargetUserIds(targetType, params)).rejects.toThrow("グループIDが指定されていません");
      });

      test("should throw error when taskId not provided for TASK target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.TASK;
        const params = {};

        // Act & Assert
        await expect(getNotificationTargetUserIds(targetType, params)).rejects.toThrow("タスクIDが指定されていません");
      });

      test("should handle database error for SYSTEM target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.SYSTEM;
        const params = {};
        prismaMock.user.findMany.mockRejectedValue(new Error("データベースエラー"));

        // Act & Assert
        await expect(getNotificationTargetUserIds(targetType, params)).rejects.toThrow("データベースエラー");
      });
    });

    describe("境界値テスト", () => {
      test("should handle empty user list for SYSTEM target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.SYSTEM;
        const params = {};
        prismaMock.user.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual([]);
      });

      test("should handle empty userIds array for USER target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.USER;
        const params = { userIds: [] };

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual([]);
      });

      test("should handle empty group members for GROUP target type", async () => {
        // Arrange
        const targetType = NotificationTargetType.GROUP;
        const params = { groupId: "group-1" };
        prismaMock.groupMembership.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>);

        // Act
        const result = await getNotificationTargetUserIds(targetType, params);

        // Assert
        expect(result).toStrictEqual([]);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("buildNotificationTargetCondition", () => {
    describe("正常系テスト", () => {
      test("should build condition with task IDs", async () => {
        // Arrange
        const userId = "user-1";
        const groupIds = ["group-1", "group-2"];
        const taskIds = ["task-1", "task-2"];

        // Act
        const result = await buildNotificationTargetCondition(userId, groupIds, taskIds);

        // Assert
        expect(result).toBeDefined();
        // Prisma.sqlオブジェクトの内容は直接比較できないため、存在確認のみ
      });

      test("should build condition without task IDs", async () => {
        // Arrange
        const userId = "user-1";
        const groupIds = ["group-1", "group-2"];

        // Act
        const result = await buildNotificationTargetCondition(userId, groupIds);

        // Assert
        expect(result).toBeDefined();
      });

      test("should build condition with empty task IDs", async () => {
        // Arrange
        const userId = "user-1";
        const groupIds = ["group-1", "group-2"];
        const taskIds: string[] = [];

        // Act
        const result = await buildNotificationTargetCondition(userId, groupIds, taskIds);

        // Assert
        expect(result).toBeDefined();
      });
    });

    describe("境界値テスト", () => {
      test("should handle empty group IDs", async () => {
        // Arrange
        const userId = "user-1";
        const groupIds: string[] = [];

        // Act
        const result = await buildNotificationTargetCondition(userId, groupIds);

        // Assert
        expect(result).toBeDefined();
      });

      test("should handle single group ID", async () => {
        // Arrange
        const userId = "user-1";
        const groupIds = ["group-1"];

        // Act
        const result = await buildNotificationTargetCondition(userId, groupIds);

        // Assert
        expect(result).toBeDefined();
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("buildCommonNotificationWhereClause", () => {
    describe("正常系テスト", () => {
      test("should build where clause with task condition", async () => {
        // Arrange
        const userId = "user-1";
        const includeTaskCondition = true;

        // getUserAccessibleGroupIdsのモック
        const mockGroupMemberships = [{ groupId: "group-1" }];
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // getTaskIdsByGroupIdsのモック（内部関数なので間接的にテスト）
        const mockTasks = [{ id: "task-1" }];
        prismaMock.task.findMany.mockResolvedValue(mockTasks as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);

        // Act
        const result = await buildCommonNotificationWhereClause(userId, includeTaskCondition);

        // Assert
        expect(result).toBeDefined();
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { userId },
          select: { groupId: true },
        });
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: { groupId: { in: ["group-1"] } },
          select: { id: true },
        });
      });

      test("should build where clause without task condition", async () => {
        // Arrange
        const userId = "user-1";
        const includeTaskCondition = false;

        const mockGroupMemberships = [{ groupId: "group-1" }];
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        // Act
        const result = await buildCommonNotificationWhereClause(userId, includeTaskCondition);

        // Assert
        expect(result).toBeDefined();
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalled();
        // タスク条件を含めない場合はタスク検索は実行されない
        expect(prismaMock.task.findMany).not.toHaveBeenCalled();
      });

      test("should use default value for includeTaskCondition", async () => {
        // Arrange
        const userId = "user-1";

        const mockGroupMemberships = [{ groupId: "group-1" }];
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );

        const mockTasks = [{ id: "task-1" }];
        prismaMock.task.findMany.mockResolvedValue(mockTasks as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);

        // Act
        const result = await buildCommonNotificationWhereClause(userId);

        // Assert
        expect(result).toBeDefined();
        // デフォルトでtrue（タスク条件を含む）
        expect(prismaMock.task.findMany).toHaveBeenCalled();
      });
    });

    describe("異常系テスト", () => {
      test("should handle error from getUserAccessibleGroupIds", async () => {
        // Arrange
        const userId = "user-1";
        prismaMock.groupMembership.findMany.mockRejectedValue(new Error("データベースエラー"));

        // Act & Assert
        await expect(buildCommonNotificationWhereClause(userId)).rejects.toThrow("データベースエラー");
      });

      test("should handle error from getTaskIdsByGroupIds", async () => {
        // Arrange
        const userId = "user-1";
        const includeTaskCondition = true;

        const mockGroupMemberships = [{ groupId: "group-1" }];
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );
        prismaMock.task.findMany.mockRejectedValue(new Error("タスク取得エラー"));

        // Act & Assert
        await expect(buildCommonNotificationWhereClause(userId, includeTaskCondition)).rejects.toThrow("タスク取得エラー");
      });
    });

    describe("境界値テスト", () => {
      test("should handle user with no groups", async () => {
        // Arrange
        const userId = "user-1";
        prismaMock.groupMembership.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>);
        prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);

        // Act
        const result = await buildCommonNotificationWhereClause(userId);

        // Assert
        expect(result).toBeDefined();
        // ダミーIDでタスク検索が実行される
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          where: { groupId: { in: ["00000000-0000-0000-0000-000000000000"] } },
          select: { id: true },
        });
      });

      test("should handle groups with no tasks", async () => {
        // Arrange
        const userId = "user-1";
        const mockGroupMemberships = [{ groupId: "group-1" }];
        prismaMock.groupMembership.findMany.mockResolvedValue(
          mockGroupMemberships as unknown as Awaited<ReturnType<typeof prismaMock.groupMembership.findMany>>,
        );
        prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);

        // Act
        const result = await buildCommonNotificationWhereClause(userId);

        // Assert
        expect(result).toBeDefined();
      });
    });
  });
});
