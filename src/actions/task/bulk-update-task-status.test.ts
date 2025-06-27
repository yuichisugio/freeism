import { checkIsPermission } from "@/actions/permission/permission";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupPointFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { bulkUpdateTaskStatus } from "./bulk-update-task-status";

// モック設定
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("../permission", () => ({
  checkIsOwner: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// モック関数の型定義
const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);
const mockCheckIsOwner = vi.mocked(checkIsPermission);

describe("upload-modal", () => {
  const testUserId = "test-user-id";
  const testGroupId = "test-group-id";

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
    mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
    mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });
  });

  describe("bulkUpdateTaskStatuses", () => {
    const validStatusData = [
      { taskId: "task-1", status: TaskStatus.PENDING },
      { taskId: "task-2", status: TaskStatus.TASK_COMPLETED },
    ];

    test("should update task statuses successfully", async () => {
      // Arrange
      const tasks = validStatusData.map((data) => ({
        id: data.taskId,
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        group: { id: testGroupId },
      }));

      // 各タスクに対してfindUniqueとupdateをモック
      prismaMock.task.findUnique
        .mockResolvedValueOnce(tasks[0] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[1] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);

      prismaMock.task.update
        .mockResolvedValueOnce({
          id: tasks[0].id,
          task: "テストタスク1",
          reference: null,
          status: TaskStatus.PENDING,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: tasks[1].id,
          task: "テストタスク2",
          reference: null,
          status: TaskStatus.TASK_COMPLETED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>);

      // Act
      const result = await bulkUpdateTaskStatus(validStatusData, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockCheckIsOwner).toHaveBeenCalledTimes(2);
    });

    test("should handle missing task ID", async () => {
      // Arrange
      const invalidData = [{ taskId: "", status: TaskStatus.PENDING }];

      // Act
      const result = await bulkUpdateTaskStatus(invalidData, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("タスクIDが指定されていません");
    });

    test("should handle missing status", async () => {
      // Arrange
      const invalidData = [{ taskId: "task-1", status: "" }];

      // Act
      const result = await bulkUpdateTaskStatus(invalidData, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("ステータスが指定されていません");
    });

    test("should handle invalid status", async () => {
      // Arrange
      const invalidData = [{ taskId: "task-1", status: "INVALID_STATUS" }];

      // Act
      const result = await bulkUpdateTaskStatus(invalidData, testUserId);

      // Assert
      expect(result.success).toBe(true);
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
      expect(result.success).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("タスクが見つかりません");
    });

    test("should handle permission denied", async () => {
      // Arrange
      const task = {
        id: "task-1",
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        group: { id: testGroupId },
      };

      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );
      mockCheckIsOwner.mockResolvedValue({ success: false, message: "Permission check failed" });

      // Act
      const result = await bulkUpdateTaskStatus([{ taskId: "task-1", status: TaskStatus.PENDING }], testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("このタスクのステータスを変更する権限がありません");
    });

    test("should handle immutable status", async () => {
      // Arrange
      const task = {
        id: "task-1",
        status: TaskStatus.FIXED_EVALUATED, // 変更不可ステータス
        fixedContributionPoint: null,
        group: { id: testGroupId },
      };

      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );

      // Act
      const result = await bulkUpdateTaskStatus([{ taskId: "task-1", status: TaskStatus.PENDING }], testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("このステータス(FIXED_EVALUATED)のタスクは変更できません");
    });

    test("should update group points when status changes to POINTS_AWARDED", async () => {
      // Arrange
      const task = {
        id: "task-1",
        status: TaskStatus.TASK_COMPLETED,
        fixedContributionPoint: 100,
        group: { id: testGroupId },
      };

      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );
      prismaMock.task.update.mockResolvedValue({
        id: "task-1",
        task: "テストタスク",
        reference: null,
        status: TaskStatus.POINTS_AWARDED,
        contributionType: "NON_REWARD",
        info: null,
        fixedContributionPoint: 100,
        fixedEvaluatorId: null,
        fixedEvaluationLogic: null,
        fixedEvaluationDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        groupId: testGroupId,
        creatorId: testUserId,
        userFixedSubmitterId: null,
        reporters: [{ userId: "user-1" }],
        executors: [{ userId: "user-2" }],
      } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>);

      const mockGroupPointUpdate = vi.fn().mockResolvedValue({ id: "group-point-1" });
      const mockGroupPointCreate = vi.fn().mockResolvedValue({ id: "group-point-2" });

      prismaMock.groupPoint.findUnique
        .mockResolvedValueOnce(
          groupPointFactory.build({
            id: "existing-point",
            userId: "user-1",
            groupId: testGroupId,
            balance: 50,
            fixedTotalPoints: 50,
          }),
        ) // user-1の既存ポイント
        .mockResolvedValueOnce(null); // user-2の新規ポイント

      prismaMock.groupPoint.update.mockImplementation(mockGroupPointUpdate);
      prismaMock.groupPoint.create.mockImplementation(mockGroupPointCreate);

      // Act
      const result = await bulkUpdateTaskStatus([{ taskId: "task-1", status: TaskStatus.POINTS_AWARDED }], testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(1);
      expect(mockGroupPointUpdate).toHaveBeenCalledWith({
        where: {
          userId_groupId: {
            userId: "user-1",
            groupId: testGroupId,
          },
        },
        data: {
          balance: { increment: 100 },
          fixedTotalPoints: { increment: 100 },
        },
      });
      expect(mockGroupPointCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-2",
          groupId: testGroupId,
          balance: 100,
          fixedTotalPoints: 100,
        },
      });
    });

    test("should not update group points when fixedContributionPoint is null", async () => {
      // Arrange
      const task = {
        id: "task-1",
        status: TaskStatus.TASK_COMPLETED,
        fixedContributionPoint: null, // ポイントが設定されていない
        group: { id: testGroupId },
      };

      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );
      prismaMock.task.update.mockResolvedValue({
        id: "task-1",
        task: "テストタスク",
        reference: null,
        status: TaskStatus.POINTS_AWARDED,
        contributionType: "NON_REWARD",
        info: null,
        fixedContributionPoint: null,
        fixedEvaluatorId: null,
        fixedEvaluationLogic: null,
        fixedEvaluationDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        groupId: testGroupId,
        creatorId: testUserId,
        userFixedSubmitterId: null,
        reporters: [{ userId: "user-1" }],
        executors: [{ userId: "user-2" }],
      } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>);

      // Act
      const result = await bulkUpdateTaskStatus([{ taskId: "task-1", status: TaskStatus.POINTS_AWARDED }], testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(1);
      expect(prismaMock.groupPoint.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.groupPoint.update).not.toHaveBeenCalled();
      expect(prismaMock.groupPoint.create).not.toHaveBeenCalled();
    });

    test("should handle empty data array", async () => {
      // Act
      const result = await bulkUpdateTaskStatus([], testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    test("should handle database error during individual task update", async () => {
      // Arrange
      const task = {
        id: "task-1",
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        group: { id: testGroupId },
      };

      prismaMock.task.findUnique.mockResolvedValue(
        task as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
      );
      prismaMock.task.update.mockRejectedValue(new Error("Database update error"));

      // Act
      const result = await bulkUpdateTaskStatus([{ taskId: "task-1", status: TaskStatus.TASK_COMPLETED }], testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.failedData![0].error).toBe("Database update error");
    });

    test("should handle authentication error", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("Authentication failed"));

      // Act
      const result = await bulkUpdateTaskStatus(validStatusData, testUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication failed");
    });

    test("should handle all valid task statuses", async () => {
      // Arrange
      const allValidStatuses = [
        { taskId: "task-1", status: TaskStatus.PENDING },
        { taskId: "task-2", status: TaskStatus.POINTS_DEPOSITED },
        { taskId: "task-3", status: TaskStatus.TASK_COMPLETED },
        { taskId: "task-4", status: TaskStatus.FIXED_EVALUATED },
        { taskId: "task-5", status: TaskStatus.POINTS_AWARDED },
        { taskId: "task-6", status: TaskStatus.ARCHIVED },
      ];

      const tasks = allValidStatuses.map((data) => ({
        id: data.taskId,
        status: TaskStatus.PENDING,
        fixedContributionPoint: null,
        group: { id: testGroupId },
      }));

      // 各タスクに対してfindUniqueとupdateをモック
      prismaMock.task.findUnique
        .mockResolvedValueOnce(tasks[0] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[1] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[2] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[3] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[4] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>)
        .mockResolvedValueOnce(tasks[5] as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);

      prismaMock.task.update
        .mockResolvedValueOnce({
          id: "task-1",
          task: "テストタスク1",
          reference: null,
          status: TaskStatus.PENDING,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: "task-2",
          task: "テストタスク2",
          reference: null,
          status: TaskStatus.POINTS_DEPOSITED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: "task-3",
          task: "テストタスク3",
          reference: null,
          status: TaskStatus.TASK_COMPLETED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: "task-4",
          task: "テストタスク4",
          reference: null,
          status: TaskStatus.FIXED_EVALUATED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: "task-5",
          task: "テストタスク5",
          reference: null,
          status: TaskStatus.POINTS_AWARDED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>)
        .mockResolvedValueOnce({
          id: "task-6",
          task: "テストタスク6",
          reference: null,
          status: TaskStatus.ARCHIVED,
          contributionType: "NON_REWARD",
          info: null,
          fixedContributionPoint: null,
          fixedEvaluatorId: null,
          fixedEvaluationLogic: null,
          fixedEvaluationDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          groupId: testGroupId,
          creatorId: testUserId,
          userFixedSubmitterId: null,
          reporters: [],
          executors: [],
        } as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>);

      // Act
      const result = await bulkUpdateTaskStatus(allValidStatuses, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(6);
      expect(result.failedCount).toBe(0);
    });
  });
});
