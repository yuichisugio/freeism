import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionFactory, groupFactory, taskFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { contributionType, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { deleteTask, updateTaskStatus } from "./task";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

// checkIsOwnerのモック
vi.mock("@/lib/actions/permission", () => ({
  checkIsOwner: vi.fn(),
}));

// revalidatePathのモック
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockGetAuthenticatedSessionUserId = vi.mocked(await import("@/lib/utils")).getAuthenticatedSessionUserId;
const mockCheckIsOwner = vi.mocked(await import("@/lib/actions/permission")).checkIsPermission;
const mockRevalidatePath = vi.mocked(await import("next/cache")).revalidatePath;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
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

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("deleteTask", () => {
    describe("正常系", () => {
      test("should delete non-reward task successfully when status is PENDING", async () => {
        // Arrange
        const taskData = {
          contributionType: contributionType.NON_REWARD,
          status: TaskStatus.PENDING,
          groupId: testGroup.id,
          creator: { id: testUser.id },
          reporters: [],
          executors: [],
          group: { members: [] },
          auction: null,
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        prismaMock.task.delete.mockResolvedValue(testTask);

        // Act
        const result = await deleteTask(testTask.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalled();
        expect(mockCheckIsOwner).toHaveBeenCalledWith(testUser.id, undefined, testTask.id, true);
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: testTask.id },
          select: {
            contributionType: true,
            status: true,
            groupId: true,
            creator: { select: { id: true } },
            reporters: { select: { userId: true } },
            executors: { select: { userId: true } },
            group: {
              select: {
                members: {
                  where: {
                    userId: testUser.id,
                    isGroupOwner: true,
                  },
                },
              },
            },
            auction: true,
          },
        });
        expect(prismaMock.task.delete).toHaveBeenCalledWith({
          where: { id: testTask.id },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/groups/${testGroup.id}`);
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
      });

      test("should delete reward task successfully when status is PENDING and auction exists", async () => {
        // Arrange
        const auction = auctionFactory.build({ id: "test-auction-id" });
        const taskData = {
          contributionType: contributionType.REWARD,
          status: TaskStatus.PENDING,
          groupId: testGroup.id,
          creator: { id: testUser.id },
          reporters: [],
          executors: [],
          group: { members: [] },
          auction: auction,
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        prismaMock.task.delete.mockResolvedValue(testTask);

        // Act
        const result = await deleteTask(testTask.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.task.delete).toHaveBeenCalledWith({
          where: { id: testTask.id },
        });
      });
    });

    describe("異常系", () => {
      test("should return error when user has no permission", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckIsOwner.mockResolvedValue({
          success: false,
          error: "権限がありません",
        });

        // Act
        const result = await deleteTask(testTask.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "このタスクを削除する権限がありません",
        });
        expect(prismaMock.task.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.task.delete).not.toHaveBeenCalled();
      });

      test("should return error when task not found", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await deleteTask(testTask.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "タスクが見つかりません",
        });
        expect(prismaMock.task.delete).not.toHaveBeenCalled();
      });

      test("should return error when reward task auction is already started", async () => {
        // Arrange
        const taskData = {
          contributionType: contributionType.REWARD,
          status: TaskStatus.AUCTION_ACTIVE,
          groupId: testGroup.id,
          creator: { id: testUser.id },
          reporters: [],
          executors: [],
          group: { members: [] },
          auction: auctionFactory.build(),
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        // Act
        const result = await deleteTask(testTask.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "オークションが開始されているタスクは削除できません",
        });
        expect(prismaMock.task.delete).not.toHaveBeenCalled();
      });

      test("should return error when reward task has no auction", async () => {
        // Arrange
        const taskData = {
          contributionType: contributionType.REWARD,
          status: TaskStatus.PENDING,
          groupId: testGroup.id,
          creator: { id: testUser.id },
          reporters: [],
          executors: [],
          group: { members: [] },
          auction: null,
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        // Act
        const result = await deleteTask(testTask.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "オークションが開始されているタスクは削除できません",
        });
        expect(prismaMock.task.delete).not.toHaveBeenCalled();
      });

      test("should return error when non-reward task status is not PENDING", async () => {
        // Arrange
        const taskData = {
          contributionType: contributionType.NON_REWARD,
          status: TaskStatus.AUCTION_ACTIVE,
          groupId: testGroup.id,
          creator: { id: testUser.id },
          reporters: [],
          executors: [],
          group: { members: [] },
          auction: null,
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        // Act
        const result = await deleteTask(testTask.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "進行中または完了したタスクは削除できません",
        });
        expect(prismaMock.task.delete).not.toHaveBeenCalled();
      });

      test("should handle database error gracefully", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.findUnique.mockRejectedValue(new Error("Database error"));

        // Act
        const result = await deleteTask(testTask.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "タスクの削除中にエラーが発生しました",
        });
      });
    });

    describe("境界値テスト", () => {
      test("should handle null taskId", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await deleteTask(null as unknown as string);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "タスクが見つかりません",
        });
      });

      test("should handle empty string taskId", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await deleteTask("");

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "タスクが見つかりません",
        });
      });

      test("should handle undefined taskId", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await deleteTask(undefined as unknown as string);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "タスクが見つかりません",
        });
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateTaskStatus", () => {
    describe("正常系", () => {
      test("should update task status successfully", async () => {
        // Arrange
        const taskData = {
          group: testGroup,
          fixedContributionPoint: null,
          groupId: testGroup.id,
          creator: { id: testUser.id },
          reporters: [],
          executors: [],
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.update.mockResolvedValue(testTask);

        // Act
        const result = await updateTaskStatus(testTask.id, TaskStatus.AUCTION_ACTIVE);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: testTask.id },
          select: {
            group: true,
            fixedContributionPoint: true,
            groupId: true,
            creator: { select: { id: true } },
            reporters: { select: { user: { select: { id: true } } } },
            executors: { select: { user: { select: { id: true } } } },
          },
        });
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { status: TaskStatus.AUCTION_ACTIVE },
        });
      });

      test("should update task status to COMPLETED successfully", async () => {
        // Arrange
        const taskData = {
          group: testGroup,
          fixedContributionPoint: null,
          groupId: testGroup.id,
          creator: { id: testUser.id },
          reporters: [],
          executors: [],
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.update.mockResolvedValue(testTask);

        // Act
        const result = await updateTaskStatus(testTask.id, TaskStatus.TASK_COMPLETED);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { status: TaskStatus.TASK_COMPLETED },
        });
      });
    });

    describe("異常系", () => {
      test("should return error when task not found", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await updateTaskStatus(testTask.id, TaskStatus.AUCTION_ACTIVE);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクのステータスの更新中にエラーが発生しました",
        });
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test("should return error when trying to set immutable status", async () => {
        // Arrange
        const taskData = {
          group: testGroup,
          fixedContributionPoint: null,
          groupId: testGroup.id,
          creator: { id: testUser.id },
          reporters: [],
          executors: [],
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        // Act - FIXED_EVALUATED
        const result1 = await updateTaskStatus(testTask.id, TaskStatus.FIXED_EVALUATED);
        // Act - POINTS_AWARDED
        const result2 = await updateTaskStatus(testTask.id, TaskStatus.POINTS_AWARDED);
        // Act - ARCHIVED
        const result3 = await updateTaskStatus(testTask.id, TaskStatus.ARCHIVED);

        // Assert
        expect(result1).toStrictEqual({
          error: "このステータスのタスクは変更できません",
        });
        expect(result2).toStrictEqual({
          error: "このステータスのタスクは変更できません",
        });
        expect(result3).toStrictEqual({
          error: "このステータスのタスクは変更できません",
        });
        expect(prismaMock.task.findUnique).toHaveBeenCalledTimes(3);
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test("should return error when user has no permission", async () => {
        // Arrange
        const taskData = {
          group: testGroup,
          fixedContributionPoint: null,
          groupId: testGroup.id,
          creator: { id: testUser.id },
          reporters: [],
          executors: [],
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        mockCheckIsOwner.mockResolvedValue({
          success: false,
          error: "権限がありません",
        });

        // Act
        const result = await updateTaskStatus(testTask.id, TaskStatus.AUCTION_ACTIVE);

        // Assert
        expect(result).toStrictEqual({
          error: "このタスクのステータスを変更する権限がありません",
        });
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test("should handle database error gracefully", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockRejectedValue(new Error("Database error"));

        // Act
        const result = await updateTaskStatus(testTask.id, TaskStatus.AUCTION_ACTIVE);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクのステータスの更新中にエラーが発生しました",
        });
      });
    });

    describe("境界値テスト", () => {
      test("should handle null taskId", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await updateTaskStatus(null as unknown as string, TaskStatus.AUCTION_ACTIVE);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクのステータスの更新中にエラーが発生しました",
        });
      });

      test("should handle empty string taskId", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await updateTaskStatus("", TaskStatus.AUCTION_ACTIVE);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクのステータスの更新中にエラーが発生しました",
        });
      });

      test("should handle undefined taskId", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await updateTaskStatus(undefined as unknown as string, TaskStatus.AUCTION_ACTIVE);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクのステータスの更新中にエラーが発生しました",
        });
      });

      test("should handle null newStatus", async () => {
        // Arrange
        const taskData = {
          group: testGroup,
          fixedContributionPoint: null,
          groupId: testGroup.id,
          creator: { id: testUser.id },
          reporters: [],
          executors: [],
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.update.mockResolvedValue(testTask);

        // Act
        const result = await updateTaskStatus(testTask.id, null as unknown as TaskStatus);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { status: null },
        });
      });

      test("should handle undefined newStatus", async () => {
        // Arrange
        const taskData = {
          group: testGroup,
          fixedContributionPoint: null,
          groupId: testGroup.id,
          creator: { id: testUser.id },
          reporters: [],
          executors: [],
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
        prismaMock.task.findUnique.mockResolvedValue(
          taskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.update.mockResolvedValue(testTask);

        // Act
        const result = await updateTaskStatus(testTask.id, undefined as unknown as TaskStatus);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { status: undefined },
        });
      });
    });
  });
});
