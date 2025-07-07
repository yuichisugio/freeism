import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory, taskFactory, userSettingsFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

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

  const testUserSettings = userSettingsFactory.build({ userId: testUserId, username: "testuser" });
  const testGroup = groupFactory.build({ id: testGroupId, name: "テストグループ" });
  const testTask = taskFactory.build({ id: testTaskId, task: "テストタスク", groupId: testGroupId });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    describe("権限別の基本動作テスト", () => {
      test("should return all data when user is app owner", async () => {
        const usersFromDb = [
          { id: testUserId, settings: { username: testUserSettings.username } },
          { id: "user-2", settings: { username: "user2" } },
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
        expect(result).toStrictEqual({
          success: true,
          message: "通知作成フォームを準備しました",
          data: {
            users: [
              { id: testUserId, name: testUserSettings.username },
              { id: "user-2", name: "user2" },
            ],
            groups: groupsFromDb,
            tasks: tasksFromDb,
          },
        });

        // Prismaの呼び出しを検証
        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
          select: {
            id: true,
            settings: {
              select: {
                username: true,
              },
            },
          },
          orderBy: {
            settings: {
              username: "asc",
            },
          },
        });
        expect(prismaMock.group.findMany).toHaveBeenCalledWith({
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: "asc",
          },
        });
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          select: {
            id: true,
            task: true,
          },
          orderBy: {
            task: "asc",
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
        expect(result).toStrictEqual({
          success: true,
          message: "通知作成フォームを準備しました",
          data: { users: [], groups: groupsFromDb, tasks: tasksFromDb },
        });

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
            name: "asc",
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
            task: "asc",
          },
        });
      });

      test("should return empty arrays when user is neither app owner nor group owner", async () => {
        // 関数を実行
        const result = await prepareCreateNotificationForm(false, false, testUserId);

        // 結果を検証
        expect(result).toStrictEqual({
          success: true,
          message: "通知作成フォームを準備しました",
          data: {
            users: [],
            groups: [],
            tasks: [],
          },
        });

        // Prismaの呼び出しを検証 - 何も呼ばれない
        expect(prismaMock.user.findMany).not.toHaveBeenCalled();
        expect(prismaMock.group.findMany).not.toHaveBeenCalled();
        expect(prismaMock.task.findMany).not.toHaveBeenCalled();
      });

      test("should prioritize app owner permissions when user is both app owner and group owner", async () => {
        // テストデータの準備
        const usersFromDb = [{ id: testUserId, settings: { username: testUserSettings.username } }];
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
        expect(result).toStrictEqual({
          success: true,
          message: "通知作成フォームを準備しました",
          data: {
            users: [{ id: testUserId, name: testUserSettings.username }],
            groups: groupsFromDb,
            tasks: tasksFromDb,
          },
        });

        // アプリオーナー用のクエリが実行される
        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
          select: {
            id: true,
            settings: {
              select: {
                username: true,
              },
            },
          },
          orderBy: {
            settings: {
              username: "asc",
            },
          },
        });
        expect(prismaMock.group.findMany).toHaveBeenCalledWith({
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: "asc",
          },
        });
        expect(prismaMock.task.findMany).toHaveBeenCalledWith({
          select: {
            id: true,
            task: true,
          },
          orderBy: {
            task: "asc",
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
          userData: { id: "user-1", settings: { username: "username1" } },
          expectedName: "username1",
        },
        {
          description: "should use name when settings is null",
          userData: { id: "user-2", settings: null },
          expectedName: "未設定_user-2",
        },
      ];

      test.each(userNameTestCases)("$description", async ({ userData, expectedName }) => {
        // モックの設定
        prismaMock.user.findMany.mockResolvedValue([userData] as unknown as Awaited<
          ReturnType<typeof prismaMock.user.findMany>
        >);
        prismaMock.group.findMany.mockResolvedValue([]);
        prismaMock.task.findMany.mockResolvedValue([]);

        // 関数を実行
        const result = await prepareCreateNotificationForm(true, false, testUserId);

        // 結果を検証
        expect(result).toStrictEqual({
          success: true,
          message: "通知作成フォームを準備しました",
          data: {
            users: [{ id: userData.id, name: expectedName }],
            groups: [],
            tasks: [],
          },
        });
        expect(prismaMock.user.findMany).toHaveBeenCalledOnce();
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
      expect(result).toStrictEqual({
        success: true,
        message: "通知作成フォームを準備しました",
        data: {
          users: [],
          groups: [],
          tasks: [],
        },
      });
    });
  });
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    const invalidParameterTestCases = [
      {
        description: "should throw error when isAppOwner is undefined",
        isAppOwner: undefined,
        isGroupOwner: false,
        userId: testUserId,
      },
      {
        description: "should throw error when isAppOwner is null",
        isAppOwner: null,
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
        description: "should throw error when isGroupOwner is null",
        isAppOwner: false,
        isGroupOwner: null,
        userId: testUserId,
      },
      {
        description: "should throw error when userId is undefined",
        isAppOwner: false,
        isGroupOwner: true,
        userId: undefined,
      },
      {
        description: "should throw error when userId is null",
        isAppOwner: false,
        isGroupOwner: true,
        userId: null,
      },
    ];

    test.each(invalidParameterTestCases)("$description", async ({ isAppOwner, isGroupOwner, userId }) => {
      // 関数を実行してエラーを検証
      await expect(prepareCreateNotificationForm(isAppOwner!, isGroupOwner!, userId!)).rejects.toThrow(
        "Invalid parameters",
      );
    });

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
        // エラーのモックを設定
        setupError();

        // 関数を実行してエラーを検証
        await expect(prepareCreateNotificationForm(isAppOwner, isGroupOwner, userId)).rejects.toThrow(expectedError);
      },
    );
  });
});
