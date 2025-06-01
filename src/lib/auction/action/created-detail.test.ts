import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionFactory, taskFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { completeTaskDelivery, getAuctionHistoryCreatedDetail, updateDeliveryMethod } from "./created-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

// getCachedAuctionHistoryCreatedDetailのモック
vi.mock("./cache/cache-auction-history", () => ({
  getCachedAuctionHistoryCreatedDetail: vi.fn(),
}));

// revalidateTagのモック
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockGetAuthenticatedSessionUserId = vi.mocked((await import("@/lib/utils")).getAuthenticatedSessionUserId);
const mockGetCachedAuctionHistoryCreatedDetail = vi.mocked((await import("./cache/cache-auction-history")).getCachedAuctionHistoryCreatedDetail);
const mockRevalidateTag = vi.mocked((await import("next/cache")).revalidateTag);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
const testUser = userFactory.build({ id: "test-user-id" });
const testTask = taskFactory.build({
  id: "test-task-id",
  creatorId: testUser.id,
  deliveryMethod: "オンライン",
});
const testAuction = auctionFactory.build({
  id: "test-auction-id",
  taskId: testTask.id,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("created-detail.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedSessionUserId.mockResolvedValue(testUser.id);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getAuctionHistoryCreatedDetail", () => {
    describe("正常系", () => {
      test("should return auction detail when auction exists", async () => {
        // Arrange
        const expectedAuction = {
          id: testAuction.id,
          currentHighestBid: 1000,
          startTime: new Date(),
          endTime: new Date(),
          task: {
            id: testTask.id,
            task: "テストタスク",
            detail: "テスト詳細",
            imageUrl: "https://example.com/image.jpg",
            status: TaskStatus.AUCTION_ACTIVE,
            deliveryMethod: "オンライン",
            creatorId: testUser.id,
          },
          winner: null,
          winnerId: null,
          bidHistories: [],
        };

        mockGetCachedAuctionHistoryCreatedDetail.mockResolvedValue(
          expectedAuction as unknown as Awaited<ReturnType<typeof mockGetCachedAuctionHistoryCreatedDetail>>,
        );

        // Act
        const result = await getAuctionHistoryCreatedDetail(testAuction.id);

        // Assert
        expect(result).toStrictEqual(expectedAuction);
        expect(mockGetCachedAuctionHistoryCreatedDetail).toHaveBeenCalledWith(testAuction.id);
      });

      test("should return null when auction does not exist", async () => {
        // Arrange
        mockGetCachedAuctionHistoryCreatedDetail.mockResolvedValue(null);

        // Act
        const result = await getAuctionHistoryCreatedDetail("non-existent-id");

        // Assert
        expect(result).toBeNull();
        expect(mockGetCachedAuctionHistoryCreatedDetail).toHaveBeenCalledWith("non-existent-id");
      });
    });

    describe("異常系", () => {
      test("should handle error when getCachedAuctionHistoryCreatedDetail throws", async () => {
        // Arrange
        const error = new Error("Database error");
        mockGetCachedAuctionHistoryCreatedDetail.mockRejectedValue(error);

        // Act & Assert
        await expect(getAuctionHistoryCreatedDetail(testAuction.id)).rejects.toThrow("Database error");
      });

      test("should handle empty auctionId", async () => {
        // Arrange
        mockGetCachedAuctionHistoryCreatedDetail.mockResolvedValue(null);

        // Act
        const result = await getAuctionHistoryCreatedDetail("");

        // Assert
        expect(result).toBeNull();
        expect(mockGetCachedAuctionHistoryCreatedDetail).toHaveBeenCalledWith("");
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateDeliveryMethod", () => {
    describe("正常系", () => {
      test("should update delivery method when user is creator", async () => {
        // Arrange
        const newDeliveryMethod = "対面";
        const updatedTask = { ...testTask, deliveryMethod: newDeliveryMethod };

        prismaMock.task.findFirst.mockResolvedValue(testTask);
        prismaMock.task.update.mockResolvedValue(updatedTask);

        // Act
        const result = await updateDeliveryMethod(testTask.id, newDeliveryMethod);

        // Assert
        expect(result).toStrictEqual(updatedTask);
        expect(mockRevalidateTag).toHaveBeenCalledWith(`auction-history-created-detail:${testTask.id}`);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.task.findFirst).toHaveBeenCalledWith({
          where: {
            id: testTask.id,
            OR: [{ creatorId: testUser.id }, { executors: { some: { userId: testUser.id } } }, { reporters: { some: { userId: testUser.id } } }],
          },
        });
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { deliveryMethod: newDeliveryMethod },
        });
      });

      test("should update delivery method when user is executor", async () => {
        // Arrange
        const newDeliveryMethod = "郵送";
        const taskWithExecutor = taskFactory.build({
          id: "test-task-id-2",
          creatorId: "other-user-id",
        });
        const updatedTask = { ...taskWithExecutor, deliveryMethod: newDeliveryMethod };

        prismaMock.task.findFirst.mockResolvedValue(taskWithExecutor);
        prismaMock.task.update.mockResolvedValue(updatedTask);

        // Act
        const result = await updateDeliveryMethod(taskWithExecutor.id, newDeliveryMethod);

        // Assert
        expect(result).toStrictEqual(updatedTask);
        expect(prismaMock.task.findFirst).toHaveBeenCalledWith({
          where: {
            id: taskWithExecutor.id,
            OR: [{ creatorId: testUser.id }, { executors: { some: { userId: testUser.id } } }, { reporters: { some: { userId: testUser.id } } }],
          },
        });
      });

      test("should return early when delivery method is empty", async () => {
        // Act
        const result = await updateDeliveryMethod(testTask.id, "");

        // Assert
        expect(result).toBeUndefined();
        expect(mockRevalidateTag).toHaveBeenCalledWith(`auction-history-created-detail:${testTask.id}`);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.task.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test("should return early when delivery method is only whitespace", async () => {
        // Act
        const result = await updateDeliveryMethod(testTask.id, "   ");

        // Assert
        expect(result).toBeUndefined();
        expect(mockRevalidateTag).toHaveBeenCalledWith(`auction-history-created-detail:${testTask.id}`);
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.task.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });
    });

    describe("異常系", () => {
      test("should throw error when user has no permission", async () => {
        // Arrange
        prismaMock.task.findFirst.mockResolvedValue(null);

        // Act & Assert
        await expect(updateDeliveryMethod(testTask.id, "新しい提供方法")).rejects.toThrow("このタスクを編集する権限がありません");
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test("should throw error when getAuthenticatedSessionUserId fails", async () => {
        // Arrange
        const error = new Error("Authentication failed");
        mockGetAuthenticatedSessionUserId.mockRejectedValue(error);

        // Act & Assert
        await expect(updateDeliveryMethod(testTask.id, "新しい提供方法")).rejects.toThrow("Authentication failed");
        expect(prismaMock.task.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test("should throw error when task.findFirst fails", async () => {
        // Arrange
        const error = new Error("Database error");
        prismaMock.task.findFirst.mockRejectedValue(error);

        // Act & Assert
        await expect(updateDeliveryMethod(testTask.id, "新しい提供方法")).rejects.toThrow("Database error");
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test("should throw error when task.update fails", async () => {
        // Arrange
        const error = new Error("Update failed");
        prismaMock.task.findFirst.mockResolvedValue(testTask);
        prismaMock.task.update.mockRejectedValue(error);

        // Act & Assert
        await expect(updateDeliveryMethod(testTask.id, "新しい提供方法")).rejects.toThrow("Update failed");
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("completeTaskDelivery", () => {
    describe("正常系", () => {
      test("should complete task when user is creator", async () => {
        // Arrange
        const taskWithDetails = {
          creatorId: testUser.id,
          executors: [],
          reporters: [],
          auction: { winnerId: "other-user-id" },
        };

        prismaMock.task.findUnique.mockResolvedValue(taskWithDetails as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        prismaMock.task.update.mockResolvedValue({ ...testTask, status: TaskStatus.SUPPLIER_DONE });

        // Act
        const result = await completeTaskDelivery(testTask.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
        expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
          where: { id: testTask.id },
          select: {
            creatorId: true,
            executors: { select: { id: true } },
            reporters: { select: { id: true } },
            auction: { select: { winnerId: true } },
          },
        });
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { status: TaskStatus.SUPPLIER_DONE },
        });
        expect(mockRevalidateTag).toHaveBeenCalledWith(`auction-history-created-detail:${testTask.id}`);
      });

      test("should complete task when user is executor", async () => {
        // Arrange
        const taskWithDetails = {
          creatorId: "other-user-id",
          executors: [{ id: testUser.id }],
          reporters: [],
          auction: { winnerId: "another-user-id" },
        };

        prismaMock.task.findUnique.mockResolvedValue(taskWithDetails as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        prismaMock.task.update.mockResolvedValue({ ...testTask, status: TaskStatus.SUPPLIER_DONE });

        // Act
        const result = await completeTaskDelivery(testTask.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { status: TaskStatus.SUPPLIER_DONE },
        });
      });

      test("should complete task when user is reporter", async () => {
        // Arrange
        const taskWithDetails = {
          creatorId: "other-user-id",
          executors: [],
          reporters: [{ id: testUser.id }],
          auction: { winnerId: "another-user-id" },
        };

        prismaMock.task.findUnique.mockResolvedValue(taskWithDetails as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        prismaMock.task.update.mockResolvedValue({ ...testTask, status: TaskStatus.SUPPLIER_DONE });

        // Act
        const result = await completeTaskDelivery(testTask.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { status: TaskStatus.SUPPLIER_DONE },
        });
      });

      test("should complete task when user is winner", async () => {
        // Arrange
        const taskWithDetails = {
          creatorId: "other-user-id",
          executors: [],
          reporters: [],
          auction: { winnerId: testUser.id },
        };

        prismaMock.task.findUnique.mockResolvedValue(taskWithDetails as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        prismaMock.task.update.mockResolvedValue({ ...testTask, status: TaskStatus.SUPPLIER_DONE });

        // Act
        const result = await completeTaskDelivery(testTask.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { status: TaskStatus.SUPPLIER_DONE },
        });
      });

      test("should complete task when user has multiple roles", async () => {
        // Arrange
        const taskWithDetails = {
          creatorId: testUser.id,
          executors: [{ id: testUser.id }],
          reporters: [{ id: testUser.id }],
          auction: { winnerId: testUser.id },
        };

        prismaMock.task.findUnique.mockResolvedValue(taskWithDetails as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        prismaMock.task.update.mockResolvedValue({ ...testTask, status: TaskStatus.SUPPLIER_DONE });

        // Act
        const result = await completeTaskDelivery(testTask.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
      });
    });

    describe("異常系", () => {
      test("should throw error when task not found", async () => {
        // Arrange
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(completeTaskDelivery(testTask.id)).rejects.toThrow("タスクが見つかりません");
        expect(prismaMock.task.update).not.toHaveBeenCalled();
        expect(mockRevalidateTag).not.toHaveBeenCalled();
      });

      test("should return error when user has no permission", async () => {
        // Arrange
        const taskWithDetails = {
          creatorId: "other-user-id",
          executors: [],
          reporters: [],
          auction: { winnerId: "another-user-id" },
        };

        prismaMock.task.findUnique.mockResolvedValue(taskWithDetails as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);

        // Act
        const result = await completeTaskDelivery(testTask.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "このタスクを完了する権限がありません",
        });
        expect(prismaMock.task.update).not.toHaveBeenCalled();
        expect(mockRevalidateTag).not.toHaveBeenCalled();
      });

      test("should throw error when getAuthenticatedSessionUserId fails", async () => {
        // Arrange
        const error = new Error("Authentication failed");
        mockGetAuthenticatedSessionUserId.mockRejectedValue(error);

        // Act & Assert
        await expect(completeTaskDelivery(testTask.id)).rejects.toThrow("Authentication failed");
        expect(prismaMock.task.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test("should throw error when task.findUnique fails", async () => {
        // Arrange
        const error = new Error("Database error");
        prismaMock.task.findUnique.mockRejectedValue(error);

        // Act & Assert
        await expect(completeTaskDelivery(testTask.id)).rejects.toThrow("Database error");
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test("should throw error when task.update fails", async () => {
        // Arrange
        const taskWithDetails = {
          creatorId: testUser.id,
          executors: [],
          reporters: [],
          auction: { winnerId: "other-user-id" },
        };
        const error = new Error("Update failed");

        prismaMock.task.findUnique.mockResolvedValue(taskWithDetails as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);
        prismaMock.task.update.mockRejectedValue(error);

        // Act & Assert
        await expect(completeTaskDelivery(testTask.id)).rejects.toThrow("Update failed");
      });

      test("should handle task with null auction", async () => {
        // Arrange
        const taskWithDetails = {
          creatorId: "other-user-id",
          executors: [],
          reporters: [],
          auction: null,
        };

        prismaMock.task.findUnique.mockResolvedValue(taskWithDetails as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);

        // Act
        const result = await completeTaskDelivery(testTask.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "このタスクを完了する権限がありません",
        });
      });

      test("should handle empty taskId", async () => {
        // Arrange
        prismaMock.task.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(completeTaskDelivery("")).rejects.toThrow("タスクが見つかりません");
      });

      test("should handle undefined userId from authentication", async () => {
        // Arrange
        mockGetAuthenticatedSessionUserId.mockResolvedValue(undefined as unknown as string);
        const taskWithDetails = {
          creatorId: "other-user-id",
          executors: [],
          reporters: [],
          auction: { winnerId: "another-user-id" },
        };

        prismaMock.task.findUnique.mockResolvedValue(taskWithDetails as unknown as Awaited<ReturnType<typeof prismaMock.task.findUnique>>);

        // Act
        const result = await completeTaskDelivery(testTask.id);

        // Assert
        expect(result).toStrictEqual({
          success: false,
          error: "このタスクを完了する権限がありません",
        });
      });
    });
  });
});
