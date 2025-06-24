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
const testReporter = taskReporterFactory.build({ id: "test-reporter-1", taskId: testTask.id });
const testExecutor = taskExecutorFactory.build({ id: "test-executor-1", taskId: testTask.id });

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
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
        description: "ユーザーID指定、グループID指定、タスクID指定、isRoleCheck: true - タスク作成者として権限あり",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true, message: "タスクの作成者or報告者or実行者の権限があります" },
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
        expectedResult: { success: true, message: "タスクの作成者or報告者or実行者の権限があります" },
        mockSetup: () => {
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
        expectedResult: { success: true, message: "タスクの作成者or報告者or実行者の権限があります" },
        mockSetup: () => {
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
        expectedResult: { success: true, message: "Appオーナー権限があります" },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValueOnce({
            creator: { id: "other-user" },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
          prismaMock.user.findUnique.mockResolvedValue(testAppOwner);
        },
        additionalAssertions: () => {
          expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: {
              id: testUser.id,
              isAppOwner: true,
            },
            select: { id: true },
          });
        },
      },
      {
        description:
          "ユーザーID指定、グループID指定、タスクID指定、isRoleCheck: true - タスク権限なし、Groupオーナー権限で成功",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true, message: "Groupオーナー権限があります" },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValueOnce({
            creator: { id: "other-user" },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(testGroupMembership);
        },
        additionalAssertions: () => {
          expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: {
              id: testUser.id,
              isAppOwner: true,
            },
            select: { id: true },
          });
          expect(prismaMock.groupMembership.findFirst).toHaveBeenCalledWith({
            where: {
              userId: testUser.id,
              groupId: testGroup.id,
              isGroupOwner: true,
            },
            select: { id: true },
          });
        },
      },
      {
        description: "ユーザーID指定、グループID指定、タスクID指定、isRoleCheck: true - タスクが見つからない",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: false, message: "タスクが見つかりません" },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValueOnce(null);
        },
      },
      {
        description: "ユーザーID指定、グループID指定、タスクID指定、isRoleCheck: true - グループオーナー権限なし",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: false, message: "グループオーナー権限がありません" },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValueOnce({
            creator: { id: "other-user" },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(null);
        },
      },
      {
        description:
          "ユーザーIDなし、グループID指定、タスクID指定、isRoleCheck: true - セッションからユーザーID取得で成功",
        propsUserId: undefined,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true, message: "タスクの作成者or報告者or実行者の権限があります" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.task.findUnique.mockResolvedValue({
            creator: { id: testUser.id },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
          expect(prismaMock.task.findUnique).toHaveBeenCalled();
          expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        },
      },
      {
        description: "ユーザーID指定、グループIDなし、タスクID指定、isRoleCheck: true - タスクからグループID取得",
        propsUserId: testUser.id,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true, message: "タスクの作成者or報告者or実行者の権限があります" },
        mockSetup: () => {
          prismaMock.task.findUnique.mockResolvedValue({
            creator: { id: testUser.id },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        },
      },
      {
        description: "ユーザーID指定、グループID指定、タスクID未指定、isRoleCheck: true - タスクIDが指定されていない",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: true,
        expectedResult: { success: false, message: "タスクIDが指定されていません" },
        mockSetup: () => {
          expect(prismaMock.task.findUnique).not.toHaveBeenCalled();
        },
      },
      {
        description: "ユーザーIDあり、グループIDあり、タスクIDあり、isRoleCheck: false - Appオーナー権限あり",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: true, message: "Appオーナー権限があります" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValueOnce(testAppOwner);
        },
        additionalAssertions: () => {
          expect(prismaMock.task.findUnique).not.toHaveBeenCalled();
          expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: {
              id: testUser.id,
              isAppOwner: true,
            },
            select: { id: true },
          });
        },
      },
      {
        description: "ユーザーIDあり、グループIDあり、タスクIDあり、isRoleCheck: false - Groupオーナー権限あり",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: true, message: "Groupオーナー権限があります" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValueOnce(null);
          prismaMock.groupMembership.findFirst.mockResolvedValueOnce(testGroupMembership);
        },
        additionalAssertions: () => {
          expect(prismaMock.task.findUnique).not.toHaveBeenCalled();
          expect(prismaMock.user.findUnique).toHaveBeenCalled();
          expect(prismaMock.groupMembership.findFirst).toHaveBeenCalled();
        },
      },
      {
        description: "ユーザーIDあり、グループIDあり、タスクIDあり、isRoleCheck: false - 権限なし",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: false, message: "グループオーナー権限がありません" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(null);
        },
      },
      {
        description: "ユーザーIDなし、グループIDあり、タスクIDあり、isRoleCheck: false - セッションからユーザーID取得",
        propsUserId: undefined,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: true, message: "Appオーナー権限があります" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.user.findUnique.mockResolvedValue(testAppOwner);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDあり、グループIDなし、タスクIDあり、isRoleCheck: false - タスクからグループID取得、Appオーナー権限あり",
        propsUserId: testUser.id,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: true, message: "Appオーナー権限があります" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValue(testAppOwner);
          prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.task.findUnique>
          >);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).not.toHaveBeenCalled();
          expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: {
              id: testUser.id,
              isAppOwner: true,
            },
            select: { id: true },
          });
          expect(prismaMock.task.findUnique).not.toHaveBeenCalled();
          expect(prismaMock.groupMembership.findFirst).not.toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDあり、グループIDなし、タスクIDあり、isRoleCheck: false - タスクからグループID取得、Groupオーナー権限あり",
        propsUserId: testUser.id,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: true, message: "Groupオーナー権限があります" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.task.findUnique>
          >);
          prismaMock.groupMembership.findFirst.mockResolvedValue(testGroupMembership);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).not.toHaveBeenCalled();
          expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: {
              id: testUser.id,
              isAppOwner: true,
            },
            select: { id: true },
          });
          expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
            where: { id: testTask.id },
            select: { groupId: true },
          });
          expect(prismaMock.groupMembership.findFirst).toHaveBeenCalledWith({
            where: {
              userId: testUser.id,
              groupId: testGroup.id,
              isGroupOwner: true,
            },
            select: { id: true },
          });
        },
      },
      {
        description:
          "ユーザーIDあり、グループIDなし、タスクIDあり、isRoleCheck: false - タスクからグループID取得、タスクが見つからない",
        propsUserId: testUser.id,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: false, message: "タスクが見つかりません" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.task.findUnique.mockResolvedValue(null);
        },
        additionalAssertions: () => {
          expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: {
              id: testUser.id,
              isAppOwner: true,
            },
            select: { id: true },
          });
          expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
            where: { id: testTask.id },
            select: { groupId: true },
          });
        },
      },
      {
        description:
          "ユーザーIDあり、グループIDなし、タスクIDなし、isRoleCheck: false - グループIDとタスクIDが指定されていない",
        propsUserId: testUser.id,
        propsGroupId: undefined,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false, message: "グループIDとタスクIDが指定されていません" },
        mockSetup: () => {
          expect(prismaMock.task.findUnique).not.toHaveBeenCalled();
        },
      },
      {
        description: "ユーザーIDなし、グループIDなし、タスクIDなし、isRoleCheck: true - タスクIDが指定されていません",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: undefined,
        isRoleCheck: true,
        expectedResult: { success: false, message: "タスクIDが指定されていません" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDなし、タスクIDなし、isRoleCheck: false - グループIDとタスクIDが指定されていない",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false, message: "グループIDとタスクIDが指定されていません" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.task.findUnique.mockResolvedValue(null);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      // 不足している組み合わせを追加
      {
        description: "ユーザーIDあり、グループIDあり、タスクIDなし、isRoleCheck: undefined - Appオーナー権限あり",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: undefined,
        expectedResult: { success: true, message: "Appオーナー権限があります" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValue(testAppOwner);
        },
        additionalAssertions: () => {
          expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: {
              id: testUser.id,
              isAppOwner: true,
            },
            select: { id: true },
          });
        },
      },
      {
        description: "ユーザーIDあり、グループIDあり、タスクIDなし、isRoleCheck: undefined - Groupオーナー権限あり",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: undefined,
        expectedResult: { success: true, message: "Groupオーナー権限があります" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(testGroupMembership);
        },
      },
      {
        description: "ユーザーIDあり、グループIDあり、タスクIDなし、isRoleCheck: undefined - 権限なし",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: undefined,
        expectedResult: { success: false, message: "グループオーナー権限がありません" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(null);
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDあり、タスクIDなし、isRoleCheck: false - セッションからユーザーID取得でAppオーナー権限あり",
        propsUserId: undefined,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: true, message: "Appオーナー権限があります" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.user.findUnique.mockResolvedValue(testAppOwner);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDあり、タスクIDなし、isRoleCheck: false - セッションからユーザーID取得でGroupオーナー権限あり",
        propsUserId: undefined,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: true, message: "Groupオーナー権限があります" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(testGroupMembership);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDあり、タスクIDなし、isRoleCheck: false - セッションからユーザーID取得で権限なし",
        propsUserId: undefined,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false, message: "グループオーナー権限がありません" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockResolvedValue(null);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDあり、タスクIDなし、isRoleCheck: undefined - セッションからユーザーID取得でAppオーナー権限あり",
        propsUserId: undefined,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: undefined,
        expectedResult: { success: true, message: "Appオーナー権限があります" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.user.findUnique.mockResolvedValue(testAppOwner);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDなし、タスクIDあり、isRoleCheck: false - セッションからユーザーID取得、タスクからグループID取得でAppオーナー権限あり",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: true, message: "Appオーナー権限があります" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.user.findUnique.mockResolvedValue(testAppOwner);
          prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.task.findUnique>
          >);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDなし、タスクIDあり、isRoleCheck: false - セッションからユーザーID取得、タスクからグループID取得でGroupオーナー権限あり",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: true, message: "Groupオーナー権限があります" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.task.findUnique>
          >);
          prismaMock.groupMembership.findFirst.mockResolvedValue(testGroupMembership);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDなし、タスクIDあり、isRoleCheck: false - セッションからユーザーID取得、タスクからグループID取得で権限なし",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: false, message: "グループオーナー権限がありません" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.task.findUnique>
          >);
          prismaMock.groupMembership.findFirst.mockResolvedValue(null);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDなし、タスクIDあり、isRoleCheck: false - セッションからユーザーID取得、タスクが見つからない",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: false, message: "タスクが見つかりません" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.task.findUnique.mockResolvedValue(null);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDなし、タスクIDあり、isRoleCheck: undefined - セッションからユーザーID取得、タスクからグループID取得でAppオーナー権限あり",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: undefined,
        expectedResult: { success: true, message: "Appオーナー権限があります" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.user.findUnique.mockResolvedValue(testAppOwner);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDなし、タスクIDあり、isRoleCheck: true - セッションからユーザーID取得、タスク作成者として権限あり",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: true, message: "タスクの作成者or報告者or実行者の権限があります" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.task.findUnique.mockResolvedValue({
            creator: { id: testUser.id },
            reporters: [],
            executors: [],
          } as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDなし、タスクIDあり、isRoleCheck: true - セッションからユーザーID取得、タスクが見つからない",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: false, message: "タスクが見つかりません" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.task.findUnique.mockResolvedValue(null);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
      {
        description:
          "ユーザーIDあり、グループIDなし、タスクIDなし、isRoleCheck: undefined - グループIDとタスクIDが指定されていない",
        propsUserId: testUser.id,
        propsGroupId: undefined,
        propsTaskId: undefined,
        isRoleCheck: undefined,
        expectedResult: { success: false, message: "グループIDとタスクIDが指定されていません" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValue(null);
        },
        additionalAssertions: () => {
          expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: {
              id: testUser.id,
              isAppOwner: true,
            },
            select: { id: true },
          });
        },
      },
      {
        description:
          "ユーザーIDなし、グループIDなし、タスクIDなし、isRoleCheck: undefined - セッションからユーザーID取得、グループIDとタスクIDが指定されていない",
        propsUserId: undefined,
        propsGroupId: undefined,
        propsTaskId: undefined,
        isRoleCheck: undefined,
        expectedResult: { success: false, message: "グループIDとタスクIDが指定されていません" },
        mockSetup: () => {
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.user.findUnique.mockResolvedValue(null);
        },
        additionalAssertions: () => {
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        },
      },
    ])(
      "$description",
      async ({
        propsUserId,
        propsGroupId,
        propsTaskId,
        isRoleCheck,
        expectedResult,
        mockSetup,
        additionalAssertions,
      }) => {
        // Arrange
        mockSetup();

        // Act
        const result = await checkIsPermission(propsUserId, propsGroupId, propsTaskId, isRoleCheck);

        // Assert
        expect(result).toStrictEqual(expectedResult);
        additionalAssertions?.();
      },
    );
  });

  describe("異常系 - エラーケース", () => {
    test.each([
      {
        description: "getAuthenticatedSessionUserIdが失敗した場合",
        propsUserId: undefined,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false, message: "権限のチェック中にエラーが発生しました" },
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
        expectedResult: { success: false, message: "権限のチェック中にエラーが発生しました" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockRejectedValue(new Error("Database error"));
        },
      },
      {
        description: "isRoleCheckがtrueでタスク検索時にデータベースエラーが発生した場合",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: testTask.id,
        isRoleCheck: true,
        expectedResult: { success: false, message: "権限のチェック中にエラーが発生しました" },
        mockSetup: () => {
          prismaMock.task.findUnique.mockRejectedValue(new Error("Database error"));
        },
      },
      {
        description: "グループメンバーシップ検索時にデータベースエラーが発生した場合",
        propsUserId: testUser.id,
        propsGroupId: testGroup.id,
        propsTaskId: undefined,
        isRoleCheck: false,
        expectedResult: { success: false, message: "権限のチェック中にエラーが発生しました" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.groupMembership.findFirst.mockRejectedValue(new Error("Database error"));
        },
      },
      {
        description: "タスクからグループID取得時にデータベースエラーが発生した場合",
        propsUserId: testUser.id,
        propsGroupId: undefined,
        propsTaskId: testTask.id,
        isRoleCheck: false,
        expectedResult: { success: false, message: "権限のチェック中にエラーが発生しました" },
        mockSetup: () => {
          prismaMock.user.findUnique.mockResolvedValue(null);
          prismaMock.task.findUnique.mockRejectedValue(new Error("Database error"));
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
