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

// checkIsOwnerのモック
vi.mock("@/lib/actions/permission", () => ({
  checkIsOwner: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockGetAuthenticatedSessionUserId = vi.mocked((await import("@/lib/utils")).getAuthenticatedSessionUserId);
const mockGetCachedAuctionHistoryCreatedDetail = vi.mocked(
  (await import("./cache/cache-auction-history")).getCachedAuctionHistoryCreatedDetail,
);
const mockRevalidateTag = vi.mocked((await import("next/cache")).revalidateTag);
const mockCheckIsOwner = vi.mocked((await import("@/actions/permission/permission")).checkIsPermission);

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

      test("should throw error when auction does not exist", async () => {
        // Arrange
        mockGetCachedAuctionHistoryCreatedDetail.mockRejectedValue(new Error("auction not found"));

        // Act & Assert
        await expect(getAuctionHistoryCreatedDetail("non-existent-id")).rejects.toThrow("auction not found");
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

      test("should throw error when auctionId is empty", async () => {
        // Arrange
        mockGetCachedAuctionHistoryCreatedDetail.mockRejectedValue(new Error("auctionId is required"));

        // Act & Assert
        await expect(getAuctionHistoryCreatedDetail("")).rejects.toThrow("auctionId is required");
        expect(mockGetCachedAuctionHistoryCreatedDetail).toHaveBeenCalledWith("");
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateDeliveryMethod", () => {
    describe("正常系", () => {
      test("should update delivery method when user has permission", async () => {
        // Arrange
        const newDeliveryMethod = "対面";
        const updatedTask = { ...testTask, deliveryMethod: newDeliveryMethod };

        mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.update.mockResolvedValue(updatedTask);

        // Act
        const result = await updateDeliveryMethod(testTask.id, newDeliveryMethod, testUser.id);

        // Assert
        expect(result).toStrictEqual(updatedTask);
        expect(mockCheckIsOwner).toHaveBeenCalledWith(testUser.id, undefined, testTask.id, true);
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { deliveryMethod: newDeliveryMethod },
        });
        expect(mockRevalidateTag).toHaveBeenCalledWith(`auction-history-created-detail:${testTask.id}`);
      });

      test("should trim whitespace from delivery method", async () => {
        // Arrange
        const newDeliveryMethod = "  対面  ";
        const trimmedDeliveryMethod = "対面";
        const updatedTask = { ...testTask, deliveryMethod: trimmedDeliveryMethod };

        mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.update.mockResolvedValue(updatedTask);

        // Act
        const result = await updateDeliveryMethod(testTask.id, newDeliveryMethod, testUser.id);

        // Assert
        expect(result).toStrictEqual(updatedTask);
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { deliveryMethod: trimmedDeliveryMethod },
        });
      });
    });

    describe("異常系", () => {
      test("should throw error when taskId is missing", async () => {
        // Act & Assert
        await expect(updateDeliveryMethod("", "新しい提供方法", testUser.id)).rejects.toThrow(
          "タスクID、提供方法、ユーザーIDが必要です",
        );
      });

      test("should throw error when deliveryMethod is missing", async () => {
        // Act & Assert
        await expect(updateDeliveryMethod(testTask.id, "", testUser.id)).rejects.toThrow(
          "タスクID、提供方法、ユーザーIDが必要です",
        );
      });

      test("should throw error when userId is missing", async () => {
        // Act & Assert
        await expect(updateDeliveryMethod(testTask.id, "新しい提供方法", "")).rejects.toThrow(
          "タスクID、提供方法、ユーザーIDが必要です",
        );
      });

      test("should throw error when deliveryMethod is only whitespace", async () => {
        // Act & Assert
        await expect(updateDeliveryMethod(testTask.id, "   ", testUser.id)).rejects.toThrow(
          "提供方法を入力してください",
        );
      });

      test("should throw error when user has no permission with error message", async () => {
        // Arrange
        mockCheckIsOwner.mockResolvedValue({ success: false, message: "Permission check failed" });

        // Act & Assert
        await expect(updateDeliveryMethod(testTask.id, "新しい提供方法", testUser.id)).rejects.toThrow(
          "権限がありません",
        );
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test("should throw error when checkIsOwner fails without error message", async () => {
        // Arrange
        mockCheckIsOwner.mockResolvedValue({ success: false, message: "Permission check failed" });

        // Act & Assert
        await expect(updateDeliveryMethod(testTask.id, "新しい提供方法", testUser.id)).rejects.toThrow(
          "このタスクを編集する権限がありません",
        );
      });

      test("should throw error when task.update fails", async () => {
        // Arrange
        const error = new Error("Update failed");
        mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.update.mockRejectedValue(error);

        // Act & Assert
        await expect(updateDeliveryMethod(testTask.id, "新しい提供方法", testUser.id)).rejects.toThrow("Update failed");
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("completeTaskDelivery", () => {
    describe("正常系", () => {
      test("should complete task when user has permission", async () => {
        // Arrange
        mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.update.mockResolvedValue({ ...testTask, status: TaskStatus.SUPPLIER_DONE });

        // Act
        const result = await completeTaskDelivery(testTask.id, testUser.id);

        // Assert
        expect(result).toStrictEqual({ success: true });
        expect(mockCheckIsOwner).toHaveBeenCalledWith(testUser.id, undefined, testTask.id, true);
        expect(prismaMock.task.update).toHaveBeenCalledWith({
          where: { id: testTask.id },
          data: { status: TaskStatus.SUPPLIER_DONE },
        });
        expect(mockRevalidateTag).toHaveBeenCalledWith(`auction-history-created-detail:${testTask.id}`);
      });
    });

    describe("異常系", () => {
      test("should throw error when taskId is missing", async () => {
        // Act & Assert
        await expect(completeTaskDelivery("", testUser.id)).rejects.toThrow("タスクID、ユーザーIDが必要です");
      });

      test("should throw error when userId is missing", async () => {
        // Act & Assert
        await expect(completeTaskDelivery(testTask.id, "")).rejects.toThrow("タスクID、ユーザーIDが必要です");
      });

      test("should throw error when user has no permission", async () => {
        // Arrange
        mockCheckIsOwner.mockResolvedValue({ success: false, message: "Permission check failed" });

        // Act & Assert
        await expect(completeTaskDelivery(testTask.id, testUser.id)).rejects.toThrow("権限がありません");
        expect(prismaMock.task.update).not.toHaveBeenCalled();
      });

      test("should throw error when checkIsOwner fails without error message", async () => {
        // Arrange
        mockCheckIsOwner.mockResolvedValue({ success: false, message: "Permission check failed" });

        // Act & Assert
        await expect(completeTaskDelivery(testTask.id, testUser.id)).rejects.toThrow(
          "このタスクを編集する権限がありません",
        );
      });

      test("should throw error when task.update fails", async () => {
        // Arrange
        const error = new Error("Update failed");
        mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });
        prismaMock.task.update.mockRejectedValue(error);

        // Act & Assert
        await expect(completeTaskDelivery(testTask.id, testUser.id)).rejects.toThrow("Update failed");
      });
    });
  });
});
