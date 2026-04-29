import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { ContributionType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { bulkCreateTask } from "./bulk-create-task";

// モック設定
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// モック関数の型定義
const mockRevalidatePath = vi.mocked(revalidatePath);

describe("bulkCreateTask", () => {
  const testUserId = "test-user-id";
  const testGroupId = "test-group-id";

  // 共通のテストデータ
  const validTaskData = [
    {
      task: "テストタスク1",
      detail: "詳細1",
      reference: "https://example.com",
      info: "情報1",
      contributionType: ContributionType.NON_REWARD,
      deliveryMethod: "オンライン",
    },
    {
      task: "テストタスク2",
      detail: "詳細2",
      reference: null,
      info: null,
      contributionType: ContributionType.REWARD,
      deliveryMethod: "オフライン",
      auctionStartTime: new Date("2024-01-01T10:00:00Z"),
      auctionEndTime: new Date("2024-01-08T10:00:00Z"),
    },
  ];

  // 共通のモック設定ヘルパー関数
  const setupSuccessfulMocks = () => {
    const group = groupFactory.build({ id: testGroupId });
    prismaMock.group.findUnique.mockResolvedValue(group);

    prismaMock.$transaction.mockImplementation(async (callback) => {
      const mockTx = {
        task: {
          create: vi.fn().mockImplementation(() => {
            return Promise.resolve({ id: `task-${Math.random()}` });
          }),
        },
        auction: {
          create: vi.fn().mockResolvedValue({ id: "auction-1" }),
        },
      };
      return callback(mockTx as unknown as Prisma.TransactionClient);
    });
  };

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    test("should create tasks successfully with valid data", async () => {
      // Arrange
      setupSuccessfulMocks();

      // Act
      const result = await bulkCreateTask(validTaskData, testGroupId, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { id: testGroupId },
        select: { id: true },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/dashboard/group/${testGroupId}`);
    });

    test("should create auction when contributionType is REWARD", async () => {
      // Arrange
      const rewardTaskData = [
        {
          task: "報酬タスク",
          contributionType: ContributionType.REWARD,
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
      const result = await bulkCreateTask(rewardTaskData, testGroupId, testUserId);

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
          contributionType: ContributionType.REWARD,
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
      const result = await bulkCreateTask(invalidDateTaskData, testGroupId, testUserId);

      // Assert
      expect(result.success).toBe(true);
      // デフォルトの日時が使用されることを確認
      expect(mockAuctionCreate).toHaveBeenCalled();
    });
  });

  describe("異常系", () => {
    test.each([
      ["groupId is empty", "", testUserId, validTaskData],
      ["groupId is null", null as unknown as string, testUserId, validTaskData],
      ["userId is empty", testGroupId, "", validTaskData],
      ["userId is null", testGroupId, null as unknown as string, validTaskData],
      ["data is null", testGroupId, testUserId, null as unknown as typeof validTaskData],
      ["data is empty array", testGroupId, testUserId, []],
    ])("should return error when %s", async (_description, groupId, userId, data) => {
      // Act & Assert
      try {
        await bulkCreateTask(data, groupId, userId);
        expect.fail("Expected function to throw error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("パラメータが不正です");
      }
    });

    test("should return error when group does not exist", async () => {
      // Arrange
      prismaMock.group.findUnique.mockResolvedValue(null);

      // Act & Assert
      try {
        await bulkCreateTask(validTaskData, testGroupId, testUserId);
        expect.fail("Expected function to throw error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("指定されたグループが見つかりません");
      }

      expect(prismaMock.group.findUnique).toHaveBeenCalledWith({
        where: { id: testGroupId },
        select: { id: true },
      });
    });

    test("should handle database transaction error", async () => {
      // Arrange
      const group = groupFactory.build({ id: testGroupId });
      prismaMock.group.findUnique.mockResolvedValue(group);
      prismaMock.$transaction.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      try {
        await bulkCreateTask(validTaskData, testGroupId, testUserId);
        expect.fail("Expected function to throw error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Database error");
      }
    });

    test("should handle general error", async () => {
      // Arrange
      const group = groupFactory.build({ id: testGroupId });
      prismaMock.group.findUnique.mockResolvedValue(group);
      prismaMock.$transaction.mockRejectedValue("Non-error object");

      // Act & Assert
      try {
        await bulkCreateTask(validTaskData, testGroupId, testUserId);
        expect.fail("Expected function to throw error");
      } catch (error) {
        expect(error).toBe("Non-error object");
      }
    });
  });

  describe("境界値テスト", () => {
    test("should handle single task data", async () => {
      // Arrange
      const singleTaskData = [validTaskData[0]];
      setupSuccessfulMocks();

      // Act
      const result = await bulkCreateTask(singleTaskData, testGroupId, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test("should handle tasks with minimal data", async () => {
      // Arrange
      const minimalTaskData = [
        {
          task: "最小限タスク",
        },
      ];
      setupSuccessfulMocks();

      // Act
      const result = await bulkCreateTask(minimalTaskData, testGroupId, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test("should handle large number of tasks", async () => {
      // Arrange
      const largeBatchData = Array.from({ length: 100 }, (_, i) => ({
        task: `大量タスク${i + 1}`,
        contributionType: ContributionType.NON_REWARD,
      }));
      setupSuccessfulMocks();

      // Act
      const result = await bulkCreateTask(largeBatchData, testGroupId, testUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });
});
