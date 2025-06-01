"use server";

import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory, taskFactory, userFactory, userSettingsFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { prepareCreateNotificationForm } from "./create-notification-form";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("prepareCreateNotificationForm", () => {
  // テスト用のデータを準備
  const testUserId = "test-user-id";
  const testGroupId = "test-group-id";
  const testTaskId = "test-task-id";

  const testUser = userFactory.build({ id: testUserId, name: "テストユーザー" });
  const testUserSettings = userSettingsFactory.build({ userId: testUserId, username: "testuser" });
  const testGroup = groupFactory.build({ id: testGroupId, name: "テストグループ" });
  const testTask = taskFactory.build({ id: testTaskId, task: "テストタスク", groupId: testGroupId });

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("アプリオーナーの場合", () => {
    test("should return all users, groups, and tasks when user is app owner", async () => {
      // モックの設定
      const usersFromDb = [
        {
          id: testUserId,
          name: testUser.name,
          settings: { username: testUserSettings.username },
        },
        {
          id: "user-2",
          name: "ユーザー2",
          settings: { username: "user2" },
        },
      ];
      const groupsFromDb = [testGroup, { id: "group-2", name: "グループ2" }];
      const tasksFromDb = [testTask, { id: "task-2", task: "タスク2" }];

      prismaMock.user.findMany.mockResolvedValue(usersFromDb as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);
      prismaMock.group.findMany.mockResolvedValue(groupsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>);
      prismaMock.task.findMany.mockResolvedValue(tasksFromDb as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, false, testUserId);

      // 結果を検証
      expect(result.users).toStrictEqual([
        { id: testUserId, name: testUserSettings.username },
        { id: "user-2", name: "user2" },
      ]);
      expect(result.groups).toStrictEqual(groupsFromDb);
      expect(result.tasks).toStrictEqual(tasksFromDb);

      // Prismaの呼び出しを検証
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          settings: {
            select: {
              username: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
      expect(prismaMock.group.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          task: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    });

    test("should handle users with null settings", async () => {
      // モックの設定 - settingsがnullのユーザー
      const usersFromDb = [
        {
          id: testUserId,
          name: testUser.name,
          settings: null,
        },
      ];

      prismaMock.user.findMany.mockResolvedValue(usersFromDb as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);
      prismaMock.group.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>);
      prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, false, testUserId);

      // 結果を検証 - nameが使用される
      expect(result.users).toStrictEqual([{ id: testUserId, name: testUser.name }]);
    });

    test("should handle users with null name and null settings", async () => {
      // モックの設定 - nameもsettingsもnullのユーザー
      const usersFromDb = [
        {
          id: testUserId,
          name: null,
          settings: null,
        },
      ];

      prismaMock.user.findMany.mockResolvedValue(usersFromDb as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);
      prismaMock.group.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>);
      prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, false, testUserId);

      // 結果を検証 - "未設定"が使用される
      expect(result.users).toStrictEqual([{ id: testUserId, name: "未設定" }]);
    });

    test("should handle users with settings but null username", async () => {
      // モックの設定 - settingsはあるがusernameがnullのユーザー
      const usersFromDb = [
        {
          id: testUserId,
          name: testUser.name,
          settings: { username: null },
        },
      ];

      prismaMock.user.findMany.mockResolvedValue(usersFromDb as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);
      prismaMock.group.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>);
      prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, false, testUserId);

      // 結果を検証 - nameが使用される
      expect(result.users).toStrictEqual([{ id: testUserId, name: testUser.name }]);
    });

    test("should handle empty data arrays", async () => {
      // モックの設定 - 空の配列
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.group.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, false, testUserId);

      // 結果を検証
      expect(result.users).toStrictEqual([]);
      expect(result.groups).toStrictEqual([]);
      expect(result.tasks).toStrictEqual([]);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("グループオーナーの場合", () => {
    test("should return only owned groups and tasks when user is group owner", async () => {
      // モックの設定
      const groupsFromDb = [testGroup];
      const tasksFromDb = [testTask];

      prismaMock.group.findMany.mockResolvedValue(groupsFromDb);
      prismaMock.task.findMany.mockResolvedValue(tasksFromDb);

      // 関数を実行
      const result = await prepareCreateNotificationForm(false, true, testUserId);

      // 結果を検証
      expect(result.users).toStrictEqual([]); // アプリオーナーではないのでユーザー一覧は空
      expect(result.groups).toStrictEqual(groupsFromDb);
      expect(result.tasks).toStrictEqual(tasksFromDb);

      // Prismaの呼び出しを検証
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
      expect(prismaMock.group.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            every: {
              userId: testUserId,
              isGroupOwner: true,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          group: {
            members: {
              every: {
                userId: testUserId,
                isGroupOwner: true,
              },
            },
          },
        },
        select: {
          id: true,
          task: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    });

    test("should handle empty groups and tasks for group owner", async () => {
      // モックの設定 - 空の配列
      prismaMock.group.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数を実行
      const result = await prepareCreateNotificationForm(false, true, testUserId);

      // 結果を検証
      expect(result.users).toStrictEqual([]);
      expect(result.groups).toStrictEqual([]);
      expect(result.tasks).toStrictEqual([]);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("一般ユーザーの場合", () => {
    test("should return empty arrays when user is neither app owner nor group owner", async () => {
      // 関数を実行
      const result = await prepareCreateNotificationForm(false, false, testUserId);

      // 結果を検証
      expect(result.users).toStrictEqual([]);
      expect(result.groups).toStrictEqual([]);
      expect(result.tasks).toStrictEqual([]);

      // Prismaの呼び出しを検証 - 何も呼ばれない
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
      expect(prismaMock.group.findMany).not.toHaveBeenCalled();
      expect(prismaMock.task.findMany).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("アプリオーナーかつグループオーナーの場合", () => {
    test("should return all data when user is both app owner and group owner", async () => {
      // モックの設定
      const usersFromDb = [{ id: testUserId, name: testUser.name, settings: { username: testUserSettings.username } }];
      const groupsFromDb = [testGroup];
      const tasksFromDb = [testTask];

      prismaMock.user.findMany.mockResolvedValue(usersFromDb as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);
      prismaMock.group.findMany.mockResolvedValue(groupsFromDb);
      prismaMock.task.findMany.mockResolvedValue(tasksFromDb);

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, true, testUserId);

      // 結果を検証 - アプリオーナーの権限が優先される
      expect(result.users).toStrictEqual([{ id: testUserId, name: testUserSettings.username }]);
      expect(result.groups).toStrictEqual(groupsFromDb);
      expect(result.tasks).toStrictEqual(tasksFromDb);

      // アプリオーナー用のクエリが実行される
      expect(prismaMock.user.findMany).toHaveBeenCalledOnce();
      expect(prismaMock.group.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          task: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリング", () => {
    test("should throw error when user.findMany fails", async () => {
      // モックの設定
      const errorMessage = "ユーザー取得エラー";
      prismaMock.user.findMany.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(prepareCreateNotificationForm(true, false, testUserId)).rejects.toThrow(errorMessage);
      expect(prismaMock.user.findMany).toHaveBeenCalledOnce();
    });

    test("should throw error when group.findMany fails for app owner", async () => {
      // モックの設定
      prismaMock.user.findMany.mockResolvedValue([]);
      const errorMessage = "グループ取得エラー";
      prismaMock.group.findMany.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(prepareCreateNotificationForm(true, false, testUserId)).rejects.toThrow(errorMessage);
      expect(prismaMock.user.findMany).toHaveBeenCalledOnce();
      expect(prismaMock.group.findMany).toHaveBeenCalledOnce();
    });

    test("should throw error when group.findMany fails for group owner", async () => {
      // モックの設定
      const errorMessage = "グループ取得エラー";
      prismaMock.group.findMany.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(prepareCreateNotificationForm(false, true, testUserId)).rejects.toThrow(errorMessage);
      expect(prismaMock.group.findMany).toHaveBeenCalledOnce();
    });

    test("should throw error when task.findMany fails for app owner", async () => {
      // モックの設定
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.group.findMany.mockResolvedValue([]);
      const errorMessage = "タスク取得エラー";
      prismaMock.task.findMany.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(prepareCreateNotificationForm(true, false, testUserId)).rejects.toThrow(errorMessage);
      expect(prismaMock.user.findMany).toHaveBeenCalledOnce();
      expect(prismaMock.group.findMany).toHaveBeenCalledOnce();
      expect(prismaMock.task.findMany).toHaveBeenCalledOnce();
    });

    test("should throw error when task.findMany fails for group owner", async () => {
      // モックの設定
      prismaMock.group.findMany.mockResolvedValue([]);
      const errorMessage = "タスク取得エラー";
      prismaMock.task.findMany.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(prepareCreateNotificationForm(false, true, testUserId)).rejects.toThrow(errorMessage);
      expect(prismaMock.group.findMany).toHaveBeenCalledOnce();
      expect(prismaMock.task.findMany).toHaveBeenCalledOnce();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty string userId", async () => {
      // モックの設定を追加
      prismaMock.group.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数を実行
      const result = await prepareCreateNotificationForm(false, true, "");

      // 結果を検証
      expect(result.users).toStrictEqual([]);
      expect(result.groups).toStrictEqual([]);
      expect(result.tasks).toStrictEqual([]);

      // 空文字列のuserIdでクエリが実行される
      expect(prismaMock.group.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            every: {
              userId: "",
              isGroupOwner: true,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    });

    test("should handle null userId", async () => {
      // モックの設定を追加
      prismaMock.group.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数を実行
      const result = await prepareCreateNotificationForm(false, true, null as unknown as string);

      // 結果を検証
      expect(result.users).toStrictEqual([]);
      expect(result.groups).toStrictEqual([]);
      expect(result.tasks).toStrictEqual([]);

      // nullのuserIdでクエリが実行される
      expect(prismaMock.group.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            every: {
              userId: null,
              isGroupOwner: true,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    });

    test("should handle undefined userId", async () => {
      // モックの設定を追加
      prismaMock.group.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数を実行
      const result = await prepareCreateNotificationForm(false, true, undefined as unknown as string);

      // 結果を検証
      expect(result.users).toStrictEqual([]);
      expect(result.groups).toStrictEqual([]);
      expect(result.tasks).toStrictEqual([]);

      // undefinedのuserIdでクエリが実行される
      expect(prismaMock.group.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            every: {
              userId: undefined,
              isGroupOwner: true,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    });

    test("should handle very long userId", async () => {
      // 非常に長いuserIdを作成
      const longUserId = "a".repeat(1000);

      // モックの設定を追加
      prismaMock.group.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数を実行
      const result = await prepareCreateNotificationForm(false, true, longUserId);

      // 結果を検証
      expect(result.users).toStrictEqual([]);
      expect(result.groups).toStrictEqual([]);
      expect(result.tasks).toStrictEqual([]);

      // 長いuserIdでクエリが実行される
      expect(prismaMock.group.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            every: {
              userId: longUserId,
              isGroupOwner: true,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    });

    test("should handle special characters in userId", async () => {
      // 特殊文字を含むuserIdを作成
      const specialUserId = "user-!@#$%^&*()_+-=[]{}|;':\",./<>?";

      // モックの設定を追加
      prismaMock.group.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数を実行
      const result = await prepareCreateNotificationForm(false, true, specialUserId);

      // 結果を検証
      expect(result.users).toStrictEqual([]);
      expect(result.groups).toStrictEqual([]);
      expect(result.tasks).toStrictEqual([]);

      // 特殊文字を含むuserIdでクエリが実行される
      expect(prismaMock.group.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            every: {
              userId: specialUserId,
              isGroupOwner: true,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("複数データのテスト", () => {
    test("should handle large number of users", async () => {
      // 大量のユーザーデータを作成
      const largeUserList = Array.from({ length: 100 }, (_, index) => ({
        id: `user-${index}`,
        name: `ユーザー${index}`,
        settings: { username: `username${index}` },
      }));

      prismaMock.user.findMany.mockResolvedValue(largeUserList as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);
      prismaMock.group.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>);
      prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, false, testUserId);

      // 結果を検証
      expect(result.users).toHaveLength(100);
      expect(result.users[0]).toStrictEqual({ id: "user-0", name: "username0" });
      expect(result.users[99]).toStrictEqual({ id: "user-99", name: "username99" });
    });

    test("should handle mixed user data with some null settings", async () => {
      // 混在するユーザーデータを作成
      const mixedUserList = [
        { id: "user-1", name: "ユーザー1", settings: { username: "username1" } },
        { id: "user-2", name: "ユーザー2", settings: null },
        { id: "user-3", name: null, settings: { username: "username3" } },
        { id: "user-4", name: null, settings: null },
        { id: "user-5", name: "ユーザー5", settings: { username: null } },
      ];

      prismaMock.user.findMany.mockResolvedValue(mixedUserList as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>);
      prismaMock.group.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>);
      prismaMock.task.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>);

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, false, testUserId);

      // 結果を検証
      expect(result.users).toStrictEqual([
        { id: "user-1", name: "username1" },
        { id: "user-2", name: "ユーザー2" },
        { id: "user-3", name: "username3" },
        { id: "user-4", name: "未設定" },
        { id: "user-5", name: "ユーザー5" },
      ]);
    });
  });
});
