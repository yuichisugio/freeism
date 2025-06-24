import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { checkIsPermission } from "@/lib/actions/permission";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { contributionType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { bulkCreateTask } from "./bulk-create-task";

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
const mockRevalidatePath = vi.mocked(revalidatePath);

describe("upload-modal", () => {
  const testUserId = "test-user-id";
  const testGroupId = "test-group-id";

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
    mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
    mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });
  });

  describe("bulkCreateTasks", () => {
    const validTaskData = [
      {
        task: "テストタスク1",
        detail: "詳細1",
        reference: "https://example.com",
        info: "情報1",
        contributionType: contributionType.NON_REWARD,
        deliveryMethod: "オンライン",
      },
      {
        task: "テストタスク2",
        detail: "詳細2",
        reference: null,
        info: null,
        contributionType: contributionType.REWARD,
        deliveryMethod: "オフライン",
        auctionStartTime: new Date("2024-01-01T10:00:00Z"),
        auctionEndTime: new Date("2024-01-08T10:00:00Z"),
      },
    ];

    test("should create tasks successfully with valid data", async () => {
      // Arrange
      const group = groupFactory.build({ id: testGroupId });
      const createdTasks = validTaskData.map((_, index) => ({ id: `task-${index + 1}` }));

      prismaMock.group.findUnique.mockResolvedValue(group);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            create: vi.fn().mockImplementation(() => {
              const index = createdTasks.length - validTaskData.length + 1;
              return Promise.resolve({ id: `task-${index}` });
            }),
          },
          auction: {
            create: vi.fn().mockResolvedValue({ id: "auction-1" }),
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkCreateTask(validTaskData, testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.tasks).toBeDefined();
      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { id: testGroupId },
        select: { id: true },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroupId}`);
    });

    test("should return error when groupId is empty", async () => {
      // Act
      const result = await bulkCreateTask(validTaskData, "");

      // Assert
      expect(result.error).toBe("グループIDが指定されていません");
      expect(result.success).toBeUndefined();
    });

    test("should return error when groupId is null", async () => {
      // Act
      const result = await bulkCreateTask(validTaskData, null as unknown as string);

      // Assert
      expect(result.error).toBe("グループIDが指定されていません");
    });

    test("should return error when group does not exist", async () => {
      // Arrange
      prismaMock.group.findUnique.mockResolvedValue(null);

      // Act
      const result = await bulkCreateTask(validTaskData, testGroupId);

      // Assert
      expect(result.error).toBe("指定されたグループが見つかりません");
      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { id: testGroupId },
        select: { id: true },
      });
    });

    test("should create auction when contributionType is REWARD", async () => {
      // Arrange
      const rewardTaskData = [
        {
          task: "報酬タスク",
          contributionType: contributionType.REWARD,
          auctionStartTime: new Date("2024-01-01T10:00:00Z"),
          auctionEndTime: new Date("2024-01-08T10:00:00Z"),
        },
      ];

      const group = groupFactory.build({ id: testGroupId });
      prismaMock.group.findUnique.mockResolvedValue(group);

      const mockAuctionCreate = vi.fn().mockResolvedValue({ id: "auction-1" });
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            create: vi.fn().mockResolvedValue({ id: "task-1" }),
          },
          auction: {
            create: mockAuctionCreate,
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkCreateTask(rewardTaskData, testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(mockAuctionCreate).toHaveBeenCalledWith({
        data: {
          taskId: "task-1",
          startTime: new Date("2024-01-01T10:00:00Z"),
          endTime: new Date("2024-01-08T10:00:00Z"),
          currentHighestBid: 0,
          extensionTotalCount: 0,
          extensionLimitCount: 3,
          extensionTime: 10,
          remainingTimeForExtension: 10,
          groupId: testGroupId,
        },
      });
    });

    test("should handle invalid date strings gracefully", async () => {
      // Arrange
      const invalidDateTaskData = [
        {
          task: "無効な日付タスク",
          contributionType: contributionType.REWARD,
          auctionStartTime: "invalid-date",
          auctionEndTime: "invalid-date",
        },
      ];

      const group = groupFactory.build({ id: testGroupId });
      prismaMock.group.findUnique.mockResolvedValue(group);

      const mockAuctionCreate = vi.fn().mockResolvedValue({ id: "auction-1" });
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            create: vi.fn().mockResolvedValue({ id: "task-1" }),
          },
          auction: {
            create: mockAuctionCreate,
          },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkCreateTask(invalidDateTaskData, testGroupId);

      // Assert
      expect(result.success).toBe(true);
      // デフォルトの日時が使用されることを確認
      expect(mockAuctionCreate).toHaveBeenCalled();
    });

    test("should handle empty data array", async () => {
      // Arrange
      const group = groupFactory.build({ id: testGroupId });
      prismaMock.group.findUnique.mockResolvedValue(group);
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: { create: vi.fn() },
          auction: { create: vi.fn() },
        };
        return callback(mockTx as unknown as Prisma.TransactionClient);
      });

      // Act
      const result = await bulkCreateTask([], testGroupId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.tasks).toEqual([]);
    });

    test("should handle database transaction error", async () => {
      // Arrange
      const group = groupFactory.build({ id: testGroupId });
      prismaMock.group.findUnique.mockResolvedValue(group);
      prismaMock.$transaction.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await bulkCreateTask(validTaskData, testGroupId);

      // Assert
      expect(result.error).toBe("タスクの一括登録中にエラーが発生しました");
      expect(result.success).toBeUndefined();
    });
  });
});
