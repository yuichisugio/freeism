import { checkIsPermission } from "@/actions/permission/permission";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { bulkUpdateTaskStatus } from "./bulk-update-task-status";

// モック設定
vi.mock("@/actions/permission/permission", () => ({
  checkIsPermission: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// モック関数の型定義
const mockCheckIsPermission = vi.mocked(checkIsPermission);

// テスト用のヘルパー関数
const createMockTask = (
  taskId: string,
  status: TaskStatus = TaskStatus.PENDING,
  fixedContributionPoint: number | null = null,
  groupId = "test-group-id",
) => ({
  id: taskId,
  status,
  fixedContributionPoint,
  group: {
    id: groupId,
  },
});

const setupSuccessfulTaskMocks = (taskIds: string[]) => {
  // findUniqueのモック設定
  taskIds.forEach((taskId) => {
    prismaMock.task.findUnique.mockResolvedValueOnce(
      createMockTask(taskId, TaskStatus.PENDING, null) as unknown as Awaited<
        ReturnType<typeof prismaMock.task.findUnique>
      >,
    );
  });

  // updateのモック設定
  taskIds.forEach((taskId) => {
    prismaMock.task.update.mockResolvedValueOnce({ id: taskId } as unknown as Awaited<
      ReturnType<typeof prismaMock.task.update>
    >);
  });
};

describe("bulkUpdateTaskStatus", () => {
  const testUserId = "test-user-id";

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
    mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully", data: true });
  });

  describe("正常系", () => {
    test("should successfully update multiple task statuses", async () => {
      // Arrange
      const validStatusData = [
        { taskId: "task-1", status: TaskStatus.PENDING },
        { taskId: "task-2", status: TaskStatus.TASK_COMPLETED },
      ];

      setupSuccessfulTaskMocks(["task-1", "task-2"]);

      // Act
      const result = await bulkUpdateTaskStatus(validStatusData, testUserId);

      // Assert
      expect(prismaMock.task.findUnique).toHaveBeenCalledTimes(validStatusData.length);
      expect(prismaMock.task.update).toHaveBeenCalledTimes(validStatusData.length);
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockCheckIsPermission).toHaveBeenCalledTimes(validStatusData.length);
    });

    test.each(
      Object.values(TaskStatus).map((status, index) => ({
        taskId: `task-${index + 1}`,
        status,
      })),
    )("should successfully update task status to $status", async ({ taskId, status }) => {
      // Arrange
      setupSuccessfulTaskMocks([taskId]);

      // Act
      const result = await bulkUpdateTaskStatus([{ taskId, status }], testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(1);
      expect(result.failedCount).toBe(0);
    });
  });

  describe("異常系", () => {
    test("should handle empty data array", async () => {
      // Act
      const result = await bulkUpdateTaskStatus([], testUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("データが指定されていません");
    });

    test("should handle missing task ID", async () => {
      // Arrange
      const data = [{ taskId: "", status: TaskStatus.PENDING }];

      // Act
      const result = await bulkUpdateTaskStatus(data, testUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.updatedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("タスクIDが指定されていません");
    });

    test("should handle missing status", async () => {
      // Arrange
      const data = [{ taskId: "task-1", status: "" as TaskStatus }];

      // Act
      const result = await bulkUpdateTaskStatus(data, testUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.updatedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("ステータスが指定されていません");
    });

    test("should handle invalid status", async () => {
      // Arrange
      const data = [{ taskId: "task-1", status: "INVALID_STATUS" as TaskStatus }];

      // Act
      const result = await bulkUpdateTaskStatus(data, testUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.updatedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("無効なステータスです: INVALID_STATUS");
    });

    test("should handle task not found", async () => {
      // Arrange
      const validData = [{ taskId: "non-existent-task", status: TaskStatus.PENDING }];
      prismaMock.task.findUnique.mockResolvedValue(null);

      // Act
      const result = await bulkUpdateTaskStatus(validData, testUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("タスクが見つかりません");
    });

    test("should handle permission denied", async () => {
      // Arrange
      const task = createMockTask("task-1", TaskStatus.PENDING, null);
      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );
      mockCheckIsPermission.mockResolvedValue({ success: false, message: "Permission check failed", data: false });

      // Act
      const result = await bulkUpdateTaskStatus([{ taskId: "task-1", status: TaskStatus.PENDING }], testUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("このタスクのステータスを変更する権限がありません");
    });

    test("should handle FIXED_EVALUATED status (immutable)", async () => {
      // Arrange
      const task = createMockTask("task-1", TaskStatus.FIXED_EVALUATED, null);
      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );

      // Act
      const result = await bulkUpdateTaskStatus([{ taskId: "task-1", status: TaskStatus.PENDING }], testUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("このステータス(FIXED_EVALUATED)のタスクは変更できません");
    });

    test("should handle POINTS_AWARDED status (immutable)", async () => {
      // Arrange
      const task = createMockTask("task-1", TaskStatus.POINTS_AWARDED, null);
      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );

      // Act
      const result = await bulkUpdateTaskStatus([{ taskId: "task-1", status: TaskStatus.PENDING }], testUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("このステータス(POINTS_AWARDED)のタスクは変更できません");
    });

    test("should handle database error during individual task update", async () => {
      // Arrange
      const task = createMockTask("task-1", TaskStatus.PENDING, null);
      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );
      prismaMock.task.update.mockRejectedValue(new Error("Database update error"));

      // Act
      const result = await bulkUpdateTaskStatus([{ taskId: "task-1", status: TaskStatus.TASK_COMPLETED }], testUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.updatedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("Database update error");
    });

    test("should handle missing userId with redirect", async () => {
      // Arrange
      const validStatusData = [{ taskId: "task-1", status: TaskStatus.PENDING }];

      // Act
      const result = await bulkUpdateTaskStatus(validStatusData, "");

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("NEXT_REDIRECT");
    });
  });
});
