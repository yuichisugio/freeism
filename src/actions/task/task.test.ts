import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory, taskFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { contributionType, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { deleteTask, updateTaskStatus } from "./task";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("@/lib/actions/permission", () => ({
  checkIsPermission: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

/**
 * モック関数の型定義
 */
const mockGetAuthenticatedSessionUserId = vi.mocked(await import("@/lib/utils")).getAuthenticatedSessionUserId;
const mockCheckIsPermission = vi.mocked(await import("@/actions/permission/permission")).checkIsPermission;
const mockRevalidatePath = vi.mocked(await import("next/cache")).revalidatePath;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通テストデータとヘルパー関数
 */
describe("task.ts", () => {
  // テスト用データ
  const testUser = userFactory.build({ id: "test-user-id" });
  const testGroup = groupFactory.build({ id: "test-group-id" });
  const testTask = taskFactory.build({
    id: "test-task-id",
    groupId: testGroup.id,
    creatorId: testUser.id,
    status: TaskStatus.PENDING,
    contributionType: contributionType.NON_REWARD,
  });

  const createTaskData = (overrides = {}) => ({
    fixedContributionPoint: null,
    groupId: testGroup.id,
    executors: [],
    ...overrides,
  });

  // 境界値テスト用のテストケース
  const boundaryTestCases = [
    { value: null as unknown as string, description: "null" },
    { value: "", description: "empty string" },
    { value: undefined as unknown as string, description: "undefined" },
  ];

  const boundaryStatusTestCases = [
    { value: null as unknown as TaskStatus, description: "null" },
    { value: undefined as unknown as TaskStatus, description: "undefined" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const expectDatabaseError = (result: { success: boolean; message: string }, errorMessage: string) => {
    expect(result).toStrictEqual({
      success: false,
      message: errorMessage,
    });
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("deleteTask", () => {
    describe("正常系", () => {
      test("should delete task successfully", async () => {
        const taskData = { id: testTask.id, groupId: testGroup.id };

        mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        prismaMock.task.delete.mockResolvedValue(testTask);

        const result = await deleteTask(testTask.id, testUser.id);

        expect(result).toStrictEqual({ success: true, message: "タスクを削除しました" });
        expect(mockCheckIsPermission).toHaveBeenCalledWith(testUser.id, undefined, testTask.id, true);
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: testTask.id },
          select: { id: true, groupId: true },
        });
        expect(prismaMock.task.delete).toHaveBeenCalledWith({ where: { id: testTask.id } });
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/groups/${testGroup.id}`);
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
      });
    });

    describe("異常系", () => {
      test("should return error when user has no permission", async () => {
        mockCheckIsPermission.mockResolvedValue({ success: false, message: "Permission check failed" });
        const result = await deleteTask(testTask.id, testUser.id);

        expect(result).toStrictEqual({
          success: false,
          message: "このタスクを削除する権限がありません",
        });
        expect(result.success).toBe(false);
        expect(prismaMock.task.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.task.delete).not.toHaveBeenCalled();
      });

      test("should return error when task not found", async () => {
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.findUnique.mockResolvedValue(null);

        const result = await deleteTask(testTask.id, testUser.id);

        expect(result).toStrictEqual({
          success: false,
          message: "タスクが見つかりません",
        });
        expect(prismaMock.task.delete).not.toHaveBeenCalled();
      });

      test("should handle database error gracefully", async () => {
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.findUnique.mockRejectedValue(new Error("Database error"));

        const result = await deleteTask(testTask.id, testUser.id);

        expectDatabaseError(result, "タスクの削除中にエラーが発生しました: Database error");
        expect(result.success).toBe(false);
      });
    });

    describe("境界値テスト", () => {
      test.each([
        ...boundaryTestCases.map((tc) => ({ ...tc, param: "taskId", validParam: testUser.id })),
        ...boundaryTestCases.map((tc) => ({ ...tc, param: "userId", validParam: testTask.id })),
      ])("should handle $description $param", async ({ value, param, validParam }) => {
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully" });

        const taskId = param === "taskId" ? value : validParam;
        const userId = param === "userId" ? value : validParam;

        const result = await deleteTask(taskId, userId);

        expectDatabaseError(result, "タスクの削除中にエラーが発生しました: タスクID or ユーザーIDが指定されていません");
        expect(result.success).toBe(false);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateTaskStatus", () => {
    describe("正常系", () => {
      test("should update task status successfully", async () => {
        const taskData = createTaskData();

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.update.mockResolvedValue(testTask);

        const result = await updateTaskStatus(testTask.id, TaskStatus.AUCTION_ACTIVE);

        expect(result).toStrictEqual({ success: true, message: "タスクのステータスを更新しました" });
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: testTask.id },
          select: {
            fixedContributionPoint: true,
            groupId: true,
            executors: { select: { user: { select: { id: true } } } },
          },
        });
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { status: TaskStatus.AUCTION_ACTIVE },
        });
      });

      test("should not allow setting POINTS_AWARDED status due to immutability", async () => {
        const fixedContributionPoint = 100;
        const executorUser = userFactory.build({ id: "executor-user-id" });
        const taskData = createTaskData({
          fixedContributionPoint,
          executors: [{ user: { id: executorUser.id } }],
        });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        const result = await updateTaskStatus(testTask.id, TaskStatus.POINTS_AWARDED);

        expectDatabaseError(result, "タスクのステータスの更新中にエラーが発生しました");
        expect(prismaMock.task.update).not.toHaveBeenCalled();
        expect(prismaMock.groupPoint.upsert).not.toHaveBeenCalled();
      });
    });

    describe("異常系", () => {
      const commonErrorTestCases = [
        {
          name: "should return error when task not found",
          setup: () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
            prismaMock.task.findUnique.mockResolvedValue(null);
          },
        },
        {
          name: "should return error when user has no permission",
          setup: () => {
            const taskData = createTaskData();
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
            prismaMock.task.findUnique.mockResolvedValue(
              taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
            );
            mockCheckIsPermission.mockResolvedValue({ success: false, message: "Permission check failed" });
          },
        },
        {
          name: "should handle database error gracefully",
          setup: () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
            prismaMock.task.findUnique.mockRejectedValue(new Error("Database error"));
          },
        },
      ];

      test.each(commonErrorTestCases)("$name", async ({ setup }) => {
        setup();
        const result = await updateTaskStatus(testTask.id, TaskStatus.AUCTION_ACTIVE);

        expectDatabaseError(result, "タスクのステータスの更新中にエラーが発生しました");
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test.each([TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED])(
        "should return error when trying to set immutable status %s",
        async (immutableStatus) => {
          const taskData = createTaskData();
          mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
          prismaMock.task.findUnique.mockResolvedValue(
            taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
          );

          const result = await updateTaskStatus(testTask.id, immutableStatus);

          expectDatabaseError(result, "タスクのステータスの更新中にエラーが発生しました");
          expect(prismaMock.task.update).not.toHaveBeenCalled();
        },
      );
    });

    describe("境界値テスト", () => {
      test.each(boundaryTestCases)("should handle $description taskId", async ({ value }) => {
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(null);

        const result = await updateTaskStatus(value, TaskStatus.AUCTION_ACTIVE);

        expectDatabaseError(result, "タスクのステータスの更新中にエラーが発生しました");
        expect(result.success).toBe(false);
      });

      test.each(boundaryStatusTestCases)("should handle $description newStatus", async ({ value }) => {
        const taskData = createTaskData();
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.update.mockResolvedValue(testTask);

        const result = await updateTaskStatus(testTask.id, value);

        expect(result).toStrictEqual({ success: true, message: "タスクのステータスを更新しました" });
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { status: value },
        });
      });
    });
  });
});
