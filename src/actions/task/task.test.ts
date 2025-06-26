import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory, taskFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { ContributionType, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { deleteTask, updateTaskStatus } from "./task";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("@/actions/permission/permission", () => ({
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
    contributionType: ContributionType.NON_REWARD,
  });

  const createTaskData = (overrides = {}) => ({
    fixedContributionPoint: null,
    groupId: testGroup.id,
    executors: [],
    ...overrides,
  });

  const deleteTaskBoundaryTestCases = [
    { value: null as unknown as string, description: "null", param: "taskId" },
    { value: undefined as unknown as string, description: "undefined", param: "taskId" },
    { value: "", description: "empty string", param: "taskId" },
    { value: "   ", description: "whitespace only", param: "taskId" },
    { value: 123 as unknown as string, description: "number", param: "taskId" },
    { value: null as unknown as string, description: "null", param: "userId" },
    { value: undefined as unknown as string, description: "undefined", param: "userId" },
    { value: "", description: "empty string", param: "userId" },
    { value: "   ", description: "whitespace only", param: "userId" },
    { value: 123 as unknown as string, description: "number", param: "userId" },
  ];

  const statusBoundaryTestCases = [
    { value: null as unknown as TaskStatus, description: "null", errorMessage: "無効なステータスです" },
    { value: undefined as unknown as TaskStatus, description: "undefined", errorMessage: "無効なステータスです" },
    {
      value: "INVALID_STATUS" as unknown as TaskStatus,
      description: "invalid string",
      errorMessage: "無効なステータスです",
    },
    { value: "" as unknown as TaskStatus, description: "empty string", errorMessage: "無効なステータスです" },
    { value: 123 as unknown as TaskStatus, description: "number", errorMessage: "無効なステータスです" },
    {
      value: TaskStatus.FIXED_EVALUATED,
      description: "fixed evaluated",
      errorMessage: "このステータスのタスクは変更できません",
    },
    {
      value: TaskStatus.POINTS_AWARDED,
      description: "points awarded",
      errorMessage: "このステータスのタスクは変更できません",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("deleteTask", () => {
    describe("正常系", () => {
      test("should delete task successfully", async () => {
        // Arrange
        const taskData = { id: testTask.id, groupId: testGroup.id };

        mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        prismaMock.task.delete.mockResolvedValue(testTask);

        // Act
        const result = await deleteTask(testTask.id, testUser.id);

        // Assert
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
        // Arrange
        mockCheckIsPermission.mockResolvedValue({ success: false, message: "Permission check failed" });

        // Act
        const result = await deleteTask(testTask.id, testUser.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "このタスクを削除する権限がありません",
        });
        expect(result.success).toBe(false);
        expect(prismaMock.task.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.task.delete).not.toHaveBeenCalled();
      });

      test("should return error when task not found", async () => {
        // Arrange
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await deleteTask(testTask.id, testUser.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "タスクが見つかりません",
        });
        expect(prismaMock.task.delete).not.toHaveBeenCalled();
      });

      test("should handle database error gracefully", async () => {
        // Arrange
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.findUnique.mockRejectedValue(new Error("Database error"));

        // Act
        const result = await deleteTask(testTask.id, testUser.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "タスクの削除中にエラーが発生しました: Database error",
        });
        expect(result.success).toBe(false);
      });

      test.each(deleteTaskBoundaryTestCases)("should handle $description $param", async ({ value, param }) => {
        // Act
        const taskId = param === "taskId" ? value : testTask.id;
        const userId = param === "userId" ? value : testUser.id;

        const result = await deleteTask(taskId, userId);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "タスクの削除中にエラーが発生しました: タスクID or ユーザーIDが指定されていません",
        });
        expect(result.success).toBe(false);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateTaskStatus", () => {
    describe("正常系", () => {
      test("should update task status successfully when status is AUCTION_ACTIVE", async () => {
        // Arrange
        const taskData = createTaskData();

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.update.mockResolvedValue(testTask);

        // Act
        const result = await updateTaskStatus(testTask.id, TaskStatus.AUCTION_ACTIVE);

        // Assert
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
    });

    describe("異常系", () => {
      const commonErrorTestCases = [
        {
          name: "should return error when task not found",
          setup: () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
            prismaMock.task.findUnique.mockResolvedValue(null);
          },
          errorMessage: "タスクが見つかりません",
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
          errorMessage: "このタスクのステータスを変更する権限がありません",
        },
        {
          name: "should handle database error gracefully",
          setup: () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
            prismaMock.task.findUnique.mockRejectedValue(new Error("Database error"));
          },
          errorMessage: "Database error",
        },
      ];

      test.each(commonErrorTestCases)("$name", async ({ setup, errorMessage }) => {
        // Arrange
        setup();

        // Act
        const result = await updateTaskStatus(testTask.id, TaskStatus.AUCTION_ACTIVE);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: errorMessage,
        });
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test.each(statusBoundaryTestCases)(
        "should return error when status is $description",
        async ({ value, errorMessage }) => {
          // Act
          const result = await updateTaskStatus(testTask.id, value);

          // Assert
          expect(result).toStrictEqual({
            success: false,
            message: errorMessage,
          });
          expect(result.success).toBe(false);
        },
      );

      test.each([
        { value: null as unknown as string, description: "null" },
        { value: undefined as unknown as string, description: "undefined" },
        { value: "", description: "empty string" },
        { value: "   ", description: "whitespace only" },
        { value: 123 as unknown as string, description: "number" },
      ])("should handle $description taskId", async ({ value }) => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await updateTaskStatus(value, TaskStatus.AUCTION_ACTIVE);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "タスクが見つかりません",
        });
        expect(result.success).toBe(false);
      });
    });
  });
});
