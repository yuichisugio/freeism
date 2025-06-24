import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { checkIsPermission } from "@/lib/actions/permission";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  auctionFactory,
  bidHistoryFactory,
  groupFactory,
  taskFactory,
  userFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { contributionType, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getTaskById, updateTaskAction } from "./edit-task-modal";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 外部依存のモック
 */
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

vi.mock("@/lib/actions/permission", () => ({
  checkIsOwner: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);
const mockCheckIsOwner = vi.mocked(checkIsPermission);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの準備
 */
const testGroup = groupFactory.build({ id: "test-group-1" });
const testUser1 = userFactory.build({ id: "test-user-1" });
const testUser2 = userFactory.build({ id: "test-user-2" });

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("edit-task-modal.ts", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateTaskAction", () => {
    describe("正常系", () => {
      test("should successfully update task with basic data", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          task: "テストタスク1",
          detail: "テストタスクの詳細",
          status: TaskStatus.PENDING,
          contributionType: contributionType.NON_REWARD,
          groupId: testGroup.id,
          creatorId: testUser1.id,
        });

        const updateData = {
          task: "更新されたタスク",
          detail: "更新された詳細",
          reference: "https://example.com",
          info: "更新された情報",
          imageUrl: "https://example.com/image.jpg",
          contributionType: contributionType.NON_REWARD,
          category: "カテゴリ1",
          reporters: [{ name: "報告者1", userId: testUser1.id }],
          executors: [{ name: "実行者1", userId: testUser2.id }],
        };

        const mockUpdatedTask = {
          id: testTask.id,
          task: updateData.task,
          detail: updateData.detail,
          reference: updateData.reference,
          info: updateData.info,
          imageUrl: updateData.imageUrl,
          contributionType: updateData.contributionType,
          category: updateData.category,
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { id: testUser1.id, name: testUser1.name },
          reporters: [
            {
              id: "reporter-1",
              name: "報告者1",
              userId: testUser1.id,
              user: { id: testUser1.id, name: testUser1.name },
            },
          ],
          executors: [
            {
              id: "executor-1",
              name: "実行者1",
              userId: testUser2.id,
              user: { id: testUser2.id, name: testUser2.name },
            },
          ],
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser1.id);
        prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.task.findUnique>
        >);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.taskReporter.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.taskExecutor.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.task.update.mockResolvedValue(
          mockUpdatedTask as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>,
        );
        prismaMock.auction.findUnique.mockResolvedValue(null);
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(prismaMock);
        });

        // Act
        const result = await updateTaskAction(testTask.id, updateData);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          task: mockUpdatedTask,
        });

        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: testTask.id },
          select: { groupId: true },
        });
        expect(mockCheckIsOwner).toHaveBeenCalledWith(testUser1.id, testGroup.id, undefined, true);
        expect(prismaMock.taskReporter.deleteMany).toHaveBeenCalledWith({
          where: { taskId: testTask.id },
        });
        expect(prismaMock.taskExecutor.deleteMany).toHaveBeenCalledWith({
          where: { taskId: testTask.id },
        });
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/my-tasks");
      });

      test("should create auction when contribution type changes to REWARD", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          groupId: testGroup.id,
          contributionType: contributionType.NON_REWARD,
        });

        const updateData = {
          task: "報酬タスク",
          detail: "詳細",
          contributionType: contributionType.REWARD,
          category: "カテゴリ1",
        };

        const mockUpdatedTask = {
          id: testTask.id,
          task: updateData.task,
          detail: updateData.detail,
          contributionType: updateData.contributionType,
          category: updateData.category,
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { id: testUser1.id, name: testUser1.name },
          reporters: [],
          executors: [],
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser1.id);
        prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.task.findUnique>
        >);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.update.mockResolvedValue(
          mockUpdatedTask as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>,
        );
        prismaMock.auction.findUnique.mockResolvedValue(null);
        prismaMock.auction.create.mockResolvedValue({
          id: "auction-1",
          taskId: testTask.id,
          groupId: testGroup.id,
          startTime: new Date(),
          endTime: new Date(),
          currentHighestBid: 0,
          extensionTotalCount: 0,
          extensionLimitCount: 3,
          extensionTime: 10,
          remainingTimeForExtension: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          isExtension: false,
          currentHighestBidderId: null,
          winnerId: null,
        });
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(prismaMock);
        });

        // Act
        const result = await updateTaskAction(testTask.id, updateData);

        // Assert
        expect(result.success).toBe(true);
        expect(prismaMock.auction.create).toHaveBeenCalledWith({
          data: {
            taskId: testTask.id,
            startTime: expect.any(Date) as unknown as Date,
            endTime: expect.any(Date) as unknown as Date,
            currentHighestBid: 0,
            extensionTotalCount: 0,
            extensionLimitCount: 3,
            extensionTime: 10,
            remainingTimeForExtension: 10,
            groupId: testGroup.id,
          },
        });
      });

      test("should delete auction when contribution type changes to NON_REWARD and no bids exist", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          groupId: testGroup.id,
          contributionType: contributionType.REWARD,
        });

        const updateData = {
          task: "非報酬タスク",
          detail: "詳細",
          contributionType: contributionType.NON_REWARD,
          category: "カテゴリ1",
        };

        const mockUpdatedTask = {
          id: testTask.id,
          task: updateData.task,
          detail: updateData.detail,
          contributionType: updateData.contributionType,
          category: updateData.category,
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { id: testUser1.id, name: testUser1.name },
          reporters: [],
          executors: [],
        };

        const existingAuction = auctionFactory.build({ id: "auction-1", taskId: testTask.id });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser1.id);
        prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.task.findUnique>
        >);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.update.mockResolvedValue(
          mockUpdatedTask as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>,
        );
        prismaMock.auction.findUnique.mockResolvedValue({ id: existingAuction.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.auction.findUnique>
        >);
        prismaMock.bidHistory.findFirst.mockResolvedValue(null);
        prismaMock.auction.delete.mockResolvedValue(
          existingAuction as unknown as Awaited<ReturnType<typeof prismaMock.auction.delete>>,
        );
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(prismaMock);
        });

        // Act
        const result = await updateTaskAction(testTask.id, updateData);

        // Assert
        expect(result.success).toBe(true);
        expect(prismaMock.bidHistory.findFirst).toHaveBeenCalledWith({
          where: { auctionId: existingAuction.id },
        });
        expect(prismaMock.auction.delete).toHaveBeenCalledWith({
          where: { id: existingAuction.id },
        });
      });

      test("should not delete auction when contribution type changes to NON_REWARD but bids exist", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          groupId: testGroup.id,
          contributionType: contributionType.REWARD,
        });

        const updateData = {
          task: "非報酬タスク",
          detail: "詳細",
          contributionType: contributionType.NON_REWARD,
          category: "カテゴリ1",
        };

        const mockUpdatedTask = {
          id: testTask.id,
          task: updateData.task,
          detail: updateData.detail,
          contributionType: updateData.contributionType,
          category: updateData.category,
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { id: testUser1.id, name: testUser1.name },
          reporters: [],
          executors: [],
        };

        const existingAuction = auctionFactory.build({ id: "auction-1", taskId: testTask.id });
        const existingBid = bidHistoryFactory.build({ auctionId: existingAuction.id });

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser1.id);
        prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.task.findUnique>
        >);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.update.mockResolvedValue(
          mockUpdatedTask as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>,
        );
        prismaMock.auction.findUnique.mockResolvedValue({ id: existingAuction.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.auction.findUnique>
        >);
        prismaMock.bidHistory.findFirst.mockResolvedValue(
          existingBid as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findFirst>>,
        );
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(prismaMock);
        });

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        // Act
        const result = await updateTaskAction(testTask.id, updateData);

        // Assert
        expect(result.success).toBe(true);
        expect(prismaMock.bidHistory.findFirst).toHaveBeenCalledWith({
          where: { auctionId: existingAuction.id },
        });
        expect(prismaMock.auction.delete).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          `タスク ${testTask.id} は入札があるため、オークションは削除されませんでした`,
        );

        consoleSpy.mockRestore();
      });

      test("should update task without reporters and executors", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          groupId: testGroup.id,
        });

        const updateData = {
          task: "シンプルタスク",
          detail: "詳細",
          contributionType: contributionType.NON_REWARD,
          category: "カテゴリ1",
        };

        const mockUpdatedTask = {
          id: testTask.id,
          task: updateData.task,
          detail: updateData.detail,
          contributionType: updateData.contributionType,
          category: updateData.category,
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { id: testUser1.id, name: testUser1.name },
          reporters: [],
          executors: [],
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser1.id);
        prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.task.findUnique>
        >);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.task.update.mockResolvedValue(
          mockUpdatedTask as unknown as Awaited<ReturnType<typeof prismaMock.task.update>>,
        );
        prismaMock.auction.findUnique.mockResolvedValue(null);
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(prismaMock);
        });

        // Act
        const result = await updateTaskAction(testTask.id, updateData);

        // Assert
        expect(result.success).toBe(true);
        expect(prismaMock.taskReporter.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.taskExecutor.deleteMany).not.toHaveBeenCalled();
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test("should return error when task not found", async () => {
        // Arrange
        const taskId = "non-existent-task";
        const updateData = {
          task: "タスク",
          detail: "詳細",
          contributionType: contributionType.NON_REWARD,
          category: "カテゴリ1",
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser1.id);
        prismaMock.task.findUnique.mockResolvedValue(
          null as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        // Act
        const result = await updateTaskAction(taskId, updateData);

        // Assert
        expect(result).toStrictEqual({
          error: "更新対象のタスクが見つかりません",
        });
        expect(mockCheckIsOwner).not.toHaveBeenCalled();
      });

      test("should return error when user has no permission", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          groupId: testGroup.id,
        });

        const updateData = {
          task: "タスク",
          detail: "詳細",
          contributionType: contributionType.NON_REWARD,
          category: "カテゴリ1",
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser1.id);
        prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.task.findUnique>
        >);
        mockCheckIsOwner.mockResolvedValue({ success: false, message: "権限がありません" });

        // Act
        const result = await updateTaskAction(testTask.id, updateData);

        // Assert
        expect(result).toStrictEqual({
          error: "このタスクを更新する権限がありません",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      test("should return error when getAuthenticatedSessionUserId fails", async () => {
        // Arrange
        const taskId = "test-task-1";
        const updateData = {
          task: "タスク",
          detail: "詳細",
          contributionType: contributionType.NON_REWARD,
          category: "カテゴリ1",
        };

        mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("認証エラー"));

        // Act
        const result = await updateTaskAction(taskId, updateData);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクの更新中にエラーが発生しました",
        });
      });

      test("should return error when database transaction fails", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          groupId: testGroup.id,
        });

        const updateData = {
          task: "タスク",
          detail: "詳細",
          contributionType: contributionType.NON_REWARD,
          category: "カテゴリ1",
        };

        mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser1.id);
        prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.task.findUnique>
        >);
        mockCheckIsOwner.mockResolvedValue({ success: true });
        prismaMock.$transaction.mockRejectedValue(new Error("データベースエラー"));

        // Act
        const result = await updateTaskAction(testTask.id, updateData);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクの更新中にエラーが発生しました",
        });
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getTaskById", () => {
    describe("正常系", () => {
      test("should successfully return task details", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          task: "テストタスク",
          detail: "詳細",
          reference: "https://example.com",
          info: "情報",
          imageUrl: "https://example.com/image.jpg",
          contributionType: contributionType.NON_REWARD,
          category: "カテゴリ1",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-02"),
        });

        const mockTaskData = {
          id: testTask.id,
          task: testTask.task,
          detail: testTask.detail,
          reference: testTask.reference,
          info: testTask.info,
          imageUrl: testTask.imageUrl,
          contributionType: testTask.contributionType,
          category: testTask.category,
          createdAt: testTask.createdAt,
          updatedAt: testTask.updatedAt,
          creator: {
            id: testUser1.id,
            name: testUser1.name,
          },
          reporters: [
            {
              id: "reporter-1",
              name: "報告者1",
              userId: testUser1.id,
              user: {
                id: testUser1.id,
                name: testUser1.name,
              },
            },
          ],
          executors: [
            {
              id: "executor-1",
              name: "実行者1",
              userId: testUser2.id,
              user: {
                id: testUser2.id,
                name: testUser2.name,
              },
            },
          ],
          group: {
            id: testGroup.id,
            name: testGroup.name,
            maxParticipants: testGroup.maxParticipants,
            goal: testGroup.goal,
            evaluationMethod: testGroup.evaluationMethod,
            depositPeriod: testGroup.depositPeriod,
            members: [{ userId: testUser1.id }, { userId: testUser2.id }],
          },
          auction: {
            id: "auction-1",
            startTime: new Date("2024-01-01"),
            endTime: new Date("2024-01-08"),
            currentHighestBid: 100,
            currentHighestBidderId: testUser1.id,
            winnerId: null,
            extensionLimitCount: 3,
            extensionTotalCount: 0,
          },
        };

        prismaMock.task.findUnique.mockResolvedValue(
          mockTaskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        // Act
        const result = await getTaskById(testTask.id);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          task: mockTaskData,
        });

        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: testTask.id },
          select: {
            id: true,
            task: true,
            detail: true,
            reference: true,
            info: true,
            imageUrl: true,
            contributionType: true,
            category: true,
            createdAt: true,
            updatedAt: true,
            creator: {
              select: {
                id: true,
                name: true,
              },
            },
            reporters: {
              select: {
                id: true,
                name: true,
                userId: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            executors: {
              select: {
                id: true,
                name: true,
                userId: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            group: {
              select: {
                id: true,
                name: true,
                maxParticipants: true,
                goal: true,
                evaluationMethod: true,
                depositPeriod: true,
                members: {
                  select: {
                    userId: true,
                  },
                },
              },
            },
            auction: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
                currentHighestBid: true,
                currentHighestBidderId: true,
                winnerId: true,
                extensionLimitCount: true,
                extensionTotalCount: true,
              },
            },
          },
        });
      });

      test("should return task without auction", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          contributionType: contributionType.NON_REWARD,
        });

        const mockTaskData = {
          id: testTask.id,
          task: testTask.task,
          detail: testTask.detail,
          reference: testTask.reference,
          info: testTask.info,
          imageUrl: testTask.imageUrl,
          contributionType: testTask.contributionType,
          category: testTask.category,
          createdAt: testTask.createdAt,
          updatedAt: testTask.updatedAt,
          creator: {
            id: testUser1.id,
            name: testUser1.name,
          },
          reporters: [],
          executors: [],
          group: {
            id: testGroup.id,
            name: testGroup.name,
            maxParticipants: testGroup.maxParticipants,
            goal: testGroup.goal,
            evaluationMethod: testGroup.evaluationMethod,
            depositPeriod: testGroup.depositPeriod,
            members: [],
          },
          auction: null,
        };

        prismaMock.task.findUnique.mockResolvedValue(
          mockTaskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        // Act
        const result = await getTaskById(testTask.id);

        // Assert
        expect(result.success).toBe(true);
        expect(result.task?.auction).toBeNull();
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test("should return error when task not found", async () => {
        // Arrange
        const taskId = "non-existent-task";
        prismaMock.task.findUnique.mockResolvedValue(
          null as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        // Act
        const result = await getTaskById(taskId);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクが見つかりません",
        });
      });

      test("should return error when database query fails", async () => {
        // Arrange
        const taskId = "test-task-1";
        prismaMock.task.findUnique.mockRejectedValue(new Error("データベースエラー"));

        // Act
        const result = await getTaskById(taskId);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクの取得中にエラーが発生しました",
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("境界値テスト", () => {
      test("should handle empty string taskId", async () => {
        // Arrange
        const taskId = "";
        prismaMock.task.findUnique.mockResolvedValue(
          null as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        // Act
        const result = await getTaskById(taskId);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクが見つかりません",
        });
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: "" },
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });
      });

      test("should handle very long taskId", async () => {
        // Arrange
        const longTaskId = "a".repeat(1000);
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await getTaskById(longTaskId);

        // Assert
        expect(result).toStrictEqual({
          error: "タスクが見つかりません",
        });
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: longTaskId },
          select: expect.any(Object) as unknown as Prisma.TaskSelect,
        });
      });
    });
  });
});
