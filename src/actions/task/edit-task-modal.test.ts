import { revalidatePath } from "next/cache";
import { checkIsPermission } from "@/actions/permission/permission";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  auctionFactory,
  bidHistoryFactory,
  groupFactory,
  taskFactory,
  userFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { ContributionType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getTaskById, updateTaskAction } from "./edit-task-modal";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 外部依存のモック
 */
vi.mock("@/actions/permission/permission", () => ({
  checkIsPermission: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockCheckIsPermission = vi.mocked(checkIsPermission);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの準備
 */
const testGroup = groupFactory.build({ id: "test-group-1" });
const testUser1 = userFactory.build({ id: "test-user-1" });
const testUser2 = userFactory.build({ id: "test-user-2" });

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク更新用の基本データを作成するヘルパー関数
 */
const createUpdateData = (overrides = {}) => ({
  task: "テストタスク",
  detail: "詳細",
  contributionType: ContributionType.NON_REWARD,
  category: "カテゴリ1",
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getTaskById用のモックタスクデータを作成するヘルパー関数
 */
const createMockTaskData = (overrides = {}) => ({
  id: "test-task-1",
  task: "テストタスク",
  detail: "詳細",
  reference: "https://example.com",
  info: "情報",
  imageUrl: "https://example.com/image.jpg",
  contributionType: ContributionType.NON_REWARD,
  category: "カテゴリ1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
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
  ...overrides,
});

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
          groupId: testGroup.id,
        });

        const updateData = createUpdateData({
          task: "更新されたタスク",
          detail: "更新された詳細",
          reference: "https://example.com",
          info: "更新された情報",
          imageUrl: "https://example.com/image.jpg",
          reporters: [{ name: "報告者1", userId: testUser1.id }],
          executors: [{ name: "実行者1", userId: testUser2.id }],
        });

        prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.task.findUnique>
        >);
        mockCheckIsPermission.mockResolvedValue({
          success: true,
          message: "Permission check successfully",
        });
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(prismaMock);
        });
        prismaMock.taskReporter.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.taskExecutor.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.task.update.mockResolvedValue({} as Awaited<ReturnType<typeof prismaMock.task.update>>);
        prismaMock.auction.findUnique.mockResolvedValue(null);
        prismaMock.bidHistory.findFirst.mockResolvedValue(null);
        prismaMock.auction.delete.mockResolvedValue({} as Awaited<ReturnType<typeof prismaMock.auction.delete>>);

        // Act
        const result = await updateTaskAction(testTask.id, updateData);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "タスクが更新されました",
        });
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: testTask.id },
          select: { groupId: true },
        });
        expect(mockCheckIsPermission).toHaveBeenCalledWith(undefined, testGroup.id, testTask.id, true);
        expect(prismaMock.taskReporter.deleteMany).toHaveBeenCalledWith({
          where: { taskId: testTask.id },
        });
        expect(prismaMock.taskExecutor.deleteMany).toHaveBeenCalledWith({
          where: { taskId: testTask.id },
        });
        expect(prismaMock.task.update).toHaveBeenCalled();
        expect(prismaMock.auction.findUnique).toHaveBeenCalled();
        expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroup.id}`);
        expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/my-tasks");
      });

      test("should update task without reporters and executors when not provided", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          groupId: testGroup.id,
        });

        const updateData = createUpdateData({
          task: "シンプルタスク",
          detail: "詳細",
        });

        prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.task.findUnique>
        >);
        mockCheckIsPermission.mockResolvedValue({
          success: true,
          message: "Permission check successfully",
        });
        prismaMock.$transaction.mockImplementation(async (callback) => {
          return await callback(prismaMock);
        });
        prismaMock.task.update.mockResolvedValue({} as Awaited<ReturnType<typeof prismaMock.task.update>>);
        prismaMock.auction.findUnique.mockResolvedValue(null);

        // Act
        const result = await updateTaskAction(testTask.id, updateData);

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "タスクが更新されました",
        });
        expect(prismaMock.taskReporter.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.taskExecutor.deleteMany).not.toHaveBeenCalled();
      });

      describe("オークション関連の処理", () => {
        test("should create auction when contribution type changes to REWARD", async () => {
          // Arrange
          const testTask = taskFactory.build({
            id: "test-task-1",
            groupId: testGroup.id,
          });

          const updateData = createUpdateData({
            contributionType: ContributionType.REWARD,
          });

          prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.task.findUnique>
          >);
          mockCheckIsPermission.mockResolvedValue({
            success: true,
            message: "Permission check successfully",
          });
          prismaMock.$transaction.mockImplementation(async (callback) => {
            return await callback(prismaMock);
          });
          prismaMock.task.update.mockResolvedValue({} as Awaited<ReturnType<typeof prismaMock.task.update>>);
          prismaMock.auction.findUnique.mockResolvedValue(null);
          prismaMock.auction.create.mockResolvedValue({
            id: "auction-1",
            taskId: testTask.id,
            groupId: testGroup.id,
          } as Awaited<ReturnType<typeof prismaMock.auction.create>>);

          // Act
          const result = await updateTaskAction(testTask.id, updateData);

          // Assert
          expect(result).toStrictEqual({
            success: true,
            message: "タスクが更新されました",
          });
          expect(prismaMock.auction.create).toHaveBeenCalledWith({
            data: {
              taskId: testTask.id,
              startTime: expect.any(Date) as Date,
              endTime: expect.any(Date) as Date,
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
          });

          const updateData = createUpdateData({
            contributionType: ContributionType.NON_REWARD,
          });

          const existingAuction = auctionFactory.build({ id: "auction-1", taskId: testTask.id });

          prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.task.findUnique>
          >);
          mockCheckIsPermission.mockResolvedValue({
            success: true,
            message: "Permission check successfully",
          });
          prismaMock.$transaction.mockImplementation(async (callback) => {
            return await callback(prismaMock);
          });
          prismaMock.task.update.mockResolvedValue({} as Awaited<ReturnType<typeof prismaMock.task.update>>);
          prismaMock.auction.findUnique.mockResolvedValue({
            id: existingAuction.id,
            task: {
              contributionType: ContributionType.REWARD,
            },
          } as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);
          prismaMock.bidHistory.findFirst.mockResolvedValue(null);
          prismaMock.auction.delete.mockResolvedValue(existingAuction);

          // Act
          const result = await updateTaskAction(testTask.id, updateData);

          // Assert
          expect(result).toStrictEqual({
            success: true,
            message: "タスクが更新されました",
          });
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
          });

          const updateData = createUpdateData({
            contributionType: ContributionType.NON_REWARD,
          });

          const existingAuction = auctionFactory.build({ id: "auction-1", taskId: testTask.id });
          const existingBid = bidHistoryFactory.build({ auctionId: existingAuction.id });

          prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
            ReturnType<typeof prismaMock.task.findUnique>
          >);
          mockCheckIsPermission.mockResolvedValue({
            success: true,
            message: "Permission check successfully",
          });
          prismaMock.$transaction.mockImplementation(async (callback) => {
            return await callback(prismaMock);
          });
          prismaMock.task.update.mockResolvedValue({} as Awaited<ReturnType<typeof prismaMock.task.update>>);
          prismaMock.auction.findUnique.mockResolvedValue({
            id: existingAuction.id,
            task: {
              contributionType: ContributionType.REWARD,
            },
          } as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);
          prismaMock.bidHistory.findFirst.mockResolvedValue(
            existingBid as Awaited<ReturnType<typeof prismaMock.bidHistory.findFirst>>,
          );

          const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
            // 何もしない
          });

          // Act
          const result = await updateTaskAction(testTask.id, updateData);

          // Assert
          expect(result).toStrictEqual({
            success: true,
            message: "タスクが更新されました",
          });
          expect(prismaMock.bidHistory.findFirst).toHaveBeenCalledWith({
            where: { auctionId: existingAuction.id },
          });
          expect(prismaMock.auction.delete).not.toHaveBeenCalled();
          expect(consoleSpy).toHaveBeenCalledWith(
            `タスク ${testTask.id} は入札があるため、オークションは削除されませんでした`,
          );

          consoleSpy.mockRestore();
        });
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test.each(["", null, undefined])("should return error when taskId is not provided", async (taskId) => {
        // Arrange
        const updateData = createUpdateData();

        // Act
        const result = await updateTaskAction(taskId!, updateData);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "タスクIDが指定されていません",
        });
      });

      test("should return error when task not found", async () => {
        // Arrange
        const taskId = "non-existent-task";
        const updateData = createUpdateData();

        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await updateTaskAction(taskId, updateData);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "更新対象のタスクが見つかりません",
        });
        expect(mockCheckIsPermission).not.toHaveBeenCalled();
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      test("should return error when user has no permission", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          groupId: testGroup.id,
        });

        const updateData = createUpdateData();

        prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as unknown as Awaited<
          ReturnType<typeof prismaMock.task.findUnique>
        >);
        mockCheckIsPermission.mockResolvedValue({
          success: false,
          message: "Permission check failed",
        });

        // Act
        const result = await updateTaskAction(testTask.id, updateData);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "Permission check failed",
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      test("should return error when database transaction fails", async () => {
        // Arrange
        const testTask = taskFactory.build({
          id: "test-task-1",
          groupId: testGroup.id,
        });

        const updateData = createUpdateData();

        prismaMock.task.findUnique.mockResolvedValue({ groupId: testGroup.id } as Awaited<
          ReturnType<typeof prismaMock.task.findUnique>
        >);
        mockCheckIsPermission.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.$transaction.mockRejectedValue(new Error("データベースエラー"));

        // Act
        const result = await updateTaskAction(testTask.id, updateData);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "データベースエラー",
        });
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getTaskById", () => {
    describe("正常系", () => {
      test("should successfully return task details with all related data", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
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
        });

        prismaMock.task.findUnique.mockResolvedValue(
          mockTaskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        // Act
        const result = await getTaskById("test-task-1");

        // Assert
        expect(result).toStrictEqual({
          success: true,
          message: "タスクが取得されました",
          task: mockTaskData,
        });

        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: "test-task-1" },
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

      test("should return task without auction when none exists", async () => {
        // Arrange
        const mockTaskData = createMockTaskData({
          contributionType: ContributionType.NON_REWARD,
          auction: null,
        });

        prismaMock.task.findUnique.mockResolvedValue(
          mockTaskData as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>,
        );

        // Act
        const result = await getTaskById("test-task-1");

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe("タスクが取得されました");
        expect(result.task?.auction).toBeNull();
      });
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test("should return error when task not found", async () => {
        // Arrange
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act
        const result = await getTaskById("non-existent-task");

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "タスクが見つかりません",
          task: null,
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
          success: false,
          message: "データベースエラー",
          task: null,
        });
      });

      test.each(["", null, undefined])("should return error when taskId is not provided", async (taskId) => {
        // Act
        const result = await getTaskById(taskId!);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          message: "タスクIDが指定されていません",
          task: null,
        });
      });
    });
  });
});
