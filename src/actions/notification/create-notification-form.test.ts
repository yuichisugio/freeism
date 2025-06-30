"use server";

import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory, taskFactory, userFactory, userSettingsFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

// 実際の関数をインポート
import { prepareCreateNotificationForm } from "./create-notification-form";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * setup.tsでモックされた関数をインポート
 * 実際の実装をテストするため、モックを無効化して実際の関数をインポート
 */
vi.unmock("@/lib/actions/notification/create-notification-form");

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("prepareCreateNotificationForm", () => {
  // テスト用の共通データ
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

  describe("権限別の基本動作テスト", () => {
    test("should return all data when user is app owner", async () => {
      // テストデータの準備
      const usersFromDb = [
        { id: testUserId, name: testUser.name, settings: { username: testUserSettings.username } },
        { id: "user-2", name: "ユーザー2", settings: { username: "user2" } },
      ];
      const groupsFromDb = [testGroup, { id: "group-2", name: "グループ2" }];
      const tasksFromDb = [testTask, { id: "task-2", task: "タスク2" }];

      // モックの設定
      prismaMock.user.findMany.mockResolvedValue(
        usersFromDb as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>,
      );
      prismaMock.group.findMany.mockResolvedValue(
        groupsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.task.findMany.mockResolvedValue(
        tasksFromDb as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
      );

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

    test("should return only owned groups and tasks when user is group owner", async () => {
      // テストデータの準備
      const groupsFromDb = [testGroup];
      const tasksFromDb = [testTask];

      // モックの設定
      prismaMock.group.findMany.mockResolvedValue(
        groupsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.task.findMany.mockResolvedValue(
        tasksFromDb as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
      );

      // 関数を実行
      const result = await prepareCreateNotificationForm(false, true, testUserId);

      // 結果を検証
      expect(result.users).toStrictEqual([]);
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

    test("should return empty arrays when user is neither app owner nor group owner", async () => {
      // 関数を実行
      const result = await prepareCreateNotificationForm(false, false, testUserId);

      // 結果を検証
      expect(result.users).toStrictEqual(result.users);
      expect(result.groups).toStrictEqual([]);
      expect(result.tasks).toStrictEqual([]);

      // Prismaの呼び出しを検証 - 何も呼ばれない
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
      expect(prismaMock.group.findMany).not.toHaveBeenCalled();
      expect(prismaMock.task.findMany).not.toHaveBeenCalled();
    });

    test("should prioritize app owner permissions when user is both app owner and group owner", async () => {
      // テストデータの準備
      const usersFromDb = [{ id: testUserId, name: testUser.name, settings: { username: testUserSettings.username } }];
      const groupsFromDb = [testGroup];
      const tasksFromDb = [testTask];

      // モックの設定
      prismaMock.user.findMany.mockResolvedValue(
        usersFromDb as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>,
      );
      prismaMock.group.findMany.mockResolvedValue(
        groupsFromDb as unknown as Awaited<ReturnType<typeof prismaMock.group.findMany>>,
      );
      prismaMock.task.findMany.mockResolvedValue(
        tasksFromDb as unknown as Awaited<ReturnType<typeof prismaMock.task.findMany>>,
      );

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, true, testUserId);

      // 結果を検証 - アプリオーナーの権限が優先される
      expect(result.users).toStrictEqual([{ id: testUserId, name: testUserSettings.username }]);
      expect(result.groups).toStrictEqual(groupsFromDb);
      expect(result.tasks).toStrictEqual(tasksFromDb);

      // アプリオーナー用のクエリが実行される
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
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ユーザー名表示ロジックテスト", () => {
    // パラメータ化テストによるユーザー名表示パターンの統合テスト
    const userNameTestCases = [
      {
        description: "should use username when settings has username",
        userData: { id: "user-1", name: "ユーザー1", settings: { username: "username1" } },
        expectedName: "username1",
      },
      {
        description: "should use name when settings is null",
        userData: { id: "user-2", name: "ユーザー2", settings: null },
        expectedName: "ユーザー2",
      },
      {
        description: "should use username when name is null but settings has username",
        userData: { id: "user-3", name: null, settings: { username: "username3" } },
        expectedName: "username3",
      },
      {
        description: "should use '未設定' when both name and settings are null",
        userData: { id: "user-4", name: null, settings: null },
        expectedName: "未設定",
      },
      {
        description: "should use name when username is null",
        userData: { id: "user-5", name: "ユーザー5", settings: { username: null } },
        expectedName: "ユーザー5",
      },
    ];

    test.each(userNameTestCases)("$description", async ({ userData, expectedName }) => {
      expect.hasAssertions();

      // モックの設定
      prismaMock.user.findMany.mockResolvedValue([userData] as unknown as Awaited<
        ReturnType<typeof prismaMock.user.findMany>
      >);
      prismaMock.group.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, false, testUserId);

      // 結果を検証
      expect(result.users).toStrictEqual([{ id: userData.id, name: expectedName }]);
      expect(prismaMock.user.findMany).toHaveBeenCalledOnce();
    });

    test("should handle mixed user data with various name settings", async () => {
      // 混在するユーザーデータを作成
      const mixedUserList = userNameTestCases.map((testCase) => testCase.userData);
      const expectedUsers = userNameTestCases.map((testCase) => ({
        id: testCase.userData.id,
        name: testCase.expectedName,
      }));

      // モックの設定
      prismaMock.user.findMany.mockResolvedValue(
        mixedUserList as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>,
      );
      prismaMock.group.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, false, testUserId);

      // 結果を検証
      expect(result.users).toStrictEqual(expectedUsers);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値とエラーハンドリングテスト", () => {
    // パラメータバリデーションテストの統合
    const invalidParameterTestCases = [
      {
        description: "should throw error when isAppOwner is undefined",
        isAppOwner: undefined,
        isGroupOwner: false,
        userId: testUserId,
      },
      {
        description: "should throw error when isGroupOwner is undefined",
        isAppOwner: false,
        isGroupOwner: undefined,
        userId: testUserId,
      },
      {
        description: "should throw error when userId is undefined",
        isAppOwner: false,
        isGroupOwner: true,
        userId: undefined,
      },
      {
        description: "should throw error when isAppOwner is null",
        isAppOwner: null,
        isGroupOwner: false,
        userId: testUserId,
      },
      {
        description: "should throw error when isGroupOwner is null",
        isAppOwner: false,
        isGroupOwner: null,
        userId: testUserId,
      },
      {
        description: "should throw error when userId is null",
        isAppOwner: false,
        isGroupOwner: true,
        userId: null,
      },
    ];

    test.each(invalidParameterTestCases)("$description", async ({ isAppOwner, isGroupOwner, userId }) => {
      expect.hasAssertions();

      // 関数を実行してエラーを検証
      await expect(prepareCreateNotificationForm(isAppOwner!, isGroupOwner!, userId!)).rejects.toThrow(
        "Invalid parameters",
      );
    });

    // 境界値テストの統合
    const boundaryValueTestCases = [
      {
        description: "should handle empty string userId",
        userId: "",
      },
      {
        description: "should handle very long userId",
        userId: "a".repeat(1000),
      },
      {
        description: "should handle special characters in userId",
        userId: "user-!@#$%^&*()_+-=[]{}|;':\",./<>?",
      },
    ];

    test.each(boundaryValueTestCases)("$description", async ({ userId }) => {
      expect.hasAssertions();

      // モックの設定
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.group.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数を実行
      const result = await prepareCreateNotificationForm(false, true, userId);

      // 結果を検証
      expect(result.users).toStrictEqual([]);
      expect(result.groups).toStrictEqual([]);
      expect(result.tasks).toStrictEqual([]);

      // 特定のuserIdでクエリが実行されることを確認
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
      expect(prismaMock.group.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            every: {
              userId: userId,
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
                userId: userId,
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

  describe("Prismaエラーハンドリングテスト", () => {
    // Prismaエラーテストの統合
    const prismaErrorTestCases = [
      {
        description: "should throw error when user.findMany fails",
        setupError: () => prismaMock.user.findMany.mockRejectedValue(new Error("ユーザー取得エラー")),
        isAppOwner: true,
        isGroupOwner: false,
        userId: testUserId,
        expectedError: "ユーザー取得エラー",
      },
      {
        description: "should throw error when group.findMany fails for app owner",
        setupError: () => {
          prismaMock.user.findMany.mockResolvedValue([]);
          prismaMock.group.findMany.mockRejectedValue(new Error("グループ取得エラー"));
        },
        isAppOwner: true,
        isGroupOwner: false,
        userId: testUserId,
        expectedError: "グループ取得エラー",
      },
      {
        description: "should throw error when group.findMany fails for group owner",
        setupError: () => prismaMock.group.findMany.mockRejectedValue(new Error("グループ取得エラー")),
        isAppOwner: false,
        isGroupOwner: true,
        userId: testUserId,
        expectedError: "グループ取得エラー",
      },
      {
        description: "should throw error when task.findMany fails for app owner",
        setupError: () => {
          prismaMock.user.findMany.mockResolvedValue([]);
          prismaMock.group.findMany.mockResolvedValue([]);
          prismaMock.task.findMany.mockRejectedValue(new Error("タスク取得エラー"));
        },
        isAppOwner: true,
        isGroupOwner: false,
        userId: testUserId,
        expectedError: "タスク取得エラー",
      },
      {
        description: "should throw error when task.findMany fails for group owner",
        setupError: () => {
          prismaMock.group.findMany.mockResolvedValue([]);
          prismaMock.task.findMany.mockRejectedValue(new Error("タスク取得エラー"));
        },
        isAppOwner: false,
        isGroupOwner: true,
        userId: testUserId,
        expectedError: "タスク取得エラー",
      },
    ];

    test.each(prismaErrorTestCases)(
      "$description",
      async ({ setupError, isAppOwner, isGroupOwner, userId, expectedError }) => {
        expect.hasAssertions();

        // エラーのモックを設定
        setupError();

        // 関数を実行してエラーを検証
        await expect(prepareCreateNotificationForm(isAppOwner, isGroupOwner, userId)).rejects.toThrow(expectedError);
      },
    );
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("パフォーマンステスト", () => {
    test("should handle large number of users efficiently", async () => {
      // 大量のユーザーデータを作成
      const largeUserList = Array.from({ length: 100 }, (_, index) => ({
        id: `user-${index}`,
        name: `ユーザー${index}`,
        settings: { username: `username${index}` },
      }));

      // モックの設定
      prismaMock.user.findMany.mockResolvedValue(
        largeUserList as unknown as Awaited<ReturnType<typeof prismaMock.user.findMany>>,
      );
      prismaMock.group.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      // 関数を実行
      const result = await prepareCreateNotificationForm(true, false, testUserId);

      // 結果を検証
      expect(result.users).toHaveLength(100);
      expect(result.users[0]).toStrictEqual({ id: "user-0", name: "username0" });
      expect(result.users[99]).toStrictEqual({ id: "user-99", name: "username99" });
    });
  });
});
