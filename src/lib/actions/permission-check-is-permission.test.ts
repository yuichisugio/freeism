import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  groupFactory,
  groupMembershipFactory,
  taskExecutorFactory,
  taskFactory,
  taskReporterFactory,
  userFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { checkIsPermission } from "./permission";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モックを定義
 */
// permission APIのモックを無効化して実際の実装を使用
vi.unmock("@/lib/actions/permission");

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型を定義
 */
const mockGetAuthenticatedSessionUserId = vi.mocked((await import("@/lib/utils")).getAuthenticatedSessionUserId);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通テストデータの準備
 */
const testUser = userFactory.build({ id: "test-user-1", isAppOwner: false });
const testAppOwner = userFactory.build({ id: "test-app-owner", isAppOwner: true });
const testGroup = groupFactory.build({ id: "test-group-1", createdBy: testUser.id });
const testTask = taskFactory.build({
  id: "test-task-1",
  groupId: testGroup.id,
  creatorId: testUser.id,
});
const testGroupMembership = groupMembershipFactory.build({
  id: "test-membership-1",
  userId: testUser.id,
  groupId: testGroup.id,
  isGroupOwner: true,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  // 各テスト前にモックをリセット
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト
 */
describe("checkIsPermission", () => {
  describe("正常系 - 引数の組み合わせテスト", () => {
    test.each([
      {
        description: "ユーザーID指定、グループID指定、タスクID未指定、isRoleCheck: false - Appオーナー権限あり",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: true },
        mockSetup: () => {
          prismaMock.user.findFirst.mockResolvedValue(testAppOwner);
        },
      },
      {
        description: "ユーザーID指定、グループID指定、タスクID未指定、isRoleCheck: false - Groupオーナー権限あり",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: true },
        mockSetup: () => {
          prismaMock.user.findFirst.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(testGroupMembership);
        },
      },
      {
        description: "ユーザーID指定、グループID指定、タスクID未指定、isRoleCheck: false - 権限なし",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false },
        mockSetup: () => {
          prismaMock.user.findFirst.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(null);
        },
      },
      {
        description: "ユーザーID指定、グループID未指定、タスクID指定、isRoleCheck: false - タスクからグループID取得",
        propsUserId: testUser.id,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: true },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.task.findUnique>
          >);
          prismaMock.user.findFirst.mockResolvedValue(testAppOwner);
        },
      },
      {
        description:
          "ユーザーID未指定、グループID指定、タスクID未指定、isRoleCheck: false - セッションからユーザーID取得",
        propsUserId: undefined,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: true },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.user.findFirst.mockResolvedValue(testAppOwner);
        },
      },
      {
        description: "ユーザーID指定、グループID指定、タスクID指定、isRoleCheck: true - タスク作成者として権限あり",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValue({
            creator: { id: testUser.id },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        },
      },
      {
        description: "ユーザーID指定、グループID指定、タスクID指定、isRoleCheck: true - タスク報告者として権限あり",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true },
        mockSetup: () => {
          const testReporter = taskReporterFactory.build({ id: "test-reporter-1" });
          prismaMock.task.findUnique.mockResolvedValue({
            creator: { id: "other-user" },
            reporters: [testReporter],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        },
      },
      {
        description: "ユーザーID指定、グループID指定、タスクID指定、isRoleCheck: true - タスク実行者として権限あり",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true },
        mockSetup: () => {
          const testExecutor = taskExecutorFactory.build({ id: "test-executor-1" });
          prismaMock.task.findUnique.mockResolvedValue({
            creator: { id: "other-user" },
            reporters: [],
            executors: [testExecutor],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        },
      },
      {
        description:
          "ユーザーID指定、グループID指定、タスクID指定、isRoleCheck: true - タスク権限なし、Appオーナー権限で成功",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValueOnce({
            creator: { id: "other-user" },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
          prismaMock.user.findFirst.mockResolvedValue(testAppOwner);
        },
      },
      {
        description:
          "ユーザーID指定、グループID指定、タスクID指定、isRoleCheck: true - タスク権限なし、Groupオーナー権限で成功",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValueOnce({
            creator: { id: "other-user" },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
          prismaMock.user.findFirst.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(testGroupMembership);
        },
      },
      {
        description: "ユーザーID指定、グループID指定、タスクID指定、isRoleCheck: true - 全ての権限なし",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: false },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValueOnce({
            creator: { id: "other-user" },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
          prismaMock.user.findFirst.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(null);
        },
      },
      {
        description: "ユーザーID指定、グループID未指定、タスクID指定、isRoleCheck: true - タスク作成者として権限あり",
        propsUserId: testUser.id,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValue({
            creator: { id: testUser.id },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        },
      },
    ])("$description", async ({ propsUserId, propsGroupId, propsTaskId, isRoleCheck, expectedResult, mockSetup }) => {
      // Arrange
      mockSetup();

      // Act
      const result = await checkIsPermission(propsUserId, propsGroupId, propsTaskId, isRoleCheck);

      // Assert
      expect(result).toStrictEqual(expectedResult);
    });
  });

  describe("異常系 - エラーケース", () => {
    test.each([
      {
        description: "isRoleCheck: true でタスクIDが指定されていない場合",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: true,
        expectedResult: { success: false, error: "タスクIDが指定されていません" },
        mockSetup: () => {
          // モックセットアップは不要（早期リターンするため）
        },
      },
      {
        description: "isRoleCheck: true でタスクが見つからない場合",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: false, error: "タスクが見つかりません" },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValue(null);
        },
      },
      {
        description: "タスクIDからグループIDを取得する際にタスクが見つからない場合",
        propsUserId: testUser.id,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: false, error: "タスクが見つかりません" },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValue(null);
        },
      },
      {
        description: "getAuthenticatedSessionUserIdが失敗した場合",
        propsUserId: undefined,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false, error: "グループオーナー権限のチェック中にエラーが発生しました" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));
        },
      },
      {
        description: "データベースエラーが発生した場合",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false, error: "グループオーナー権限のチェック中にエラーが発生しました" },
        mockSetup: () => {
          prismaMock.user.findFirst.mockRejectedValue(new Error("Database error"));
        },
      },
    ])("$description", async ({ propsUserId, propsGroupId, propsTaskId, isRoleCheck, expectedResult, mockSetup }) => {
      // Arrange
      mockSetup();

      // Act
      const result = await checkIsPermission(propsUserId, propsGroupId, propsTaskId, isRoleCheck);

      // Assert
      expect(result).toStrictEqual(expectedResult);
    });
  });

  describe("境界値テスト", () => {
    test.each([
      {
        description: "空文字のユーザーIDが指定された場合",
        propsUserId: "",
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false, error: "グループオーナー権限のチェック中にエラーが発生しました" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Empty user ID"));
        },
      },
      {
        description: "空文字のグループIDが指定された場合",
        propsUserId: testUser.id,
        propsGroupId: "",
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false },
        mockSetup: () => {
          prismaMock.user.findFirst.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(null);
        },
      },
      {
        description: "空文字のタスクIDが指定された場合",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: "",
        isRoleCheck: true,
        expectedResult: { success: false, error: "タスクIDが指定されていません" },
        mockSetup: () => {
          // 空文字は早期リターンするため、モックセットアップは不要
        },
      },
      {
        description: "nullのユーザーIDが指定された場合（TypeScript型チェック回避）",
        propsUserId: null as unknown as string,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false, error: "グループオーナー権限のチェック中にエラーが発生しました" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Null user ID"));
        },
      },
    ])("$description", async ({ propsUserId, propsGroupId, propsTaskId, isRoleCheck, expectedResult, mockSetup }) => {
      // Arrange
      mockSetup();

      // Act
      const result = await checkIsPermission(propsUserId, propsGroupId, propsTaskId, isRoleCheck);

      // Assert
      expect(result).toStrictEqual(expectedResult);
    });
  });

  describe("複合条件テスト", () => {
    test.each([
      {
        description: "セッションから取得したユーザーIDでAppオーナー権限チェック成功",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: true },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.task.findUnique>
          >);
          prismaMock.user.findFirst.mockResolvedValue(testAppOwner);
        },
      },
      {
        description: "セッションから取得したユーザーIDでタスク権限チェック成功",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.task.findUnique.mockResolvedValue({
            creator: { id: testUser.id },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        },
      },
      {
        description: "全てのパラメータが未指定でセッション取得に失敗",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false, error: "グループオーナー権限のチェック中にエラーが発生しました" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("No session"));
        },
      },
    ])("$description", async ({ propsUserId, propsGroupId, propsTaskId, isRoleCheck, expectedResult, mockSetup }) => {
      // Arrange
      mockSetup();

      // Act
      const result = await checkIsPermission(propsUserId, propsGroupId, propsTaskId, isRoleCheck);

      // Assert
      expect(result).toStrictEqual(expectedResult);
    });
  });
});
