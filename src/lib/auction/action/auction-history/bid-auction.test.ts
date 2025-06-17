import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { BidStatus, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserBidHistories, getUserBidHistoriesCount } from "./bid-auction";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用定数
 */
const TEST_CONSTANTS = {
  userId: "test-user-id",
  page: 1,
  itemPerPage: 10,
} as const;

/**
 * テストデータファクトリー
 */
const createMockBidHistory = (
  overrides: Partial<{
    auctionId: string;
    status: BidStatus;
    currentHighestBid: number;
    createdAt: Date;
    endTime: Date;
    taskId: string;
    taskName: string;
    taskStatus: TaskStatus;
  }> = {},
) => ({
  auctionId: overrides.auctionId ?? "auction-1",
  status: overrides.status ?? BidStatus.BIDDING,
  auction: {
    currentHighestBid: overrides.currentHighestBid ?? 1000,
    createdAt: overrides.createdAt ?? new Date("2024-01-01"),
    endTime: overrides.endTime ?? new Date("2024-01-02"),
    task: {
      id: overrides.taskId ?? "task-1",
      task: overrides.taskName ?? "Test Task",
      status: overrides.taskStatus ?? TaskStatus.AUCTION_ACTIVE,
    },
  },
});

/**
 * 期待される結果データを生成
 */
const createExpectedResult = (bidHistory: ReturnType<typeof createMockBidHistory>) => ({
  auctionId: bidHistory.auctionId,
  bidStatus: bidHistory.status,
  lastBidAt: bidHistory.auction.createdAt,
  taskId: bidHistory.auction.task.id,
  taskName: bidHistory.auction.task.task,
  taskStatus: bidHistory.auction.task.status,
  currentHighestBid: bidHistory.auction.currentHighestBid,
  auctionEndTime: bidHistory.auction.endTime,
});

/**
 * 共通のPrismaクエリ期待値アサーション
 */
const expectPrismaFindManyCall = (page: number, userId: string, itemPerPage: number) => {
  expect(prismaMock.bidHistory.findMany).toHaveBeenCalledWith({
    skip: (page - 1) * itemPerPage,
    take: itemPerPage,
    where: { userId },
    distinct: ["auctionId"],
    orderBy: { createdAt: "desc" },
    select: {
      auctionId: true,
      status: true,
      auction: {
        select: {
          currentHighestBid: true,
          createdAt: true,
          endTime: true,
          task: {
            select: {
              id: true,
              task: true,
              status: true,
            },
          },
        },
      },
    },
  });
};

beforeEach(() => {
  // コンソールログをモック化（テスト出力をクリーンに保つ）
  vi.spyOn(console, "log").mockImplementation(() => {
    // テスト中のコンソール出力を抑制
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("bid-auction", () => {
  describe("getUserBidHistories", () => {
    describe("正常系", () => {
      test("should return single bid history successfully", async () => {
        // Arrange
        const mockBidHistory = createMockBidHistory();
        prismaMock.bidHistory.findMany.mockResolvedValue([mockBidHistory] as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

        // Act
        const result = await getUserBidHistories(TEST_CONSTANTS.page, TEST_CONSTANTS.userId, TEST_CONSTANTS.itemPerPage);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toStrictEqual(createExpectedResult(mockBidHistory));
        expectPrismaFindManyCall(TEST_CONSTANTS.page, TEST_CONSTANTS.userId, TEST_CONSTANTS.itemPerPage);
      });

      test("should return multiple bid histories correctly", async () => {
        // Arrange
        const mockBidHistories = [
          createMockBidHistory({
            auctionId: "auction-1",
            status: BidStatus.BIDDING,
            taskStatus: TaskStatus.AUCTION_ACTIVE,
          }),
          createMockBidHistory({
            auctionId: "auction-2",
            status: BidStatus.LOST,
            currentHighestBid: 2000,
            createdAt: new Date("2024-01-03"),
            endTime: new Date("2024-01-04"),
            taskId: "task-2",
            taskName: "Test Task 2",
            taskStatus: TaskStatus.AUCTION_ENDED,
          }),
        ];
        prismaMock.bidHistory.findMany.mockResolvedValue(mockBidHistories as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

        // Act
        const result = await getUserBidHistories(TEST_CONSTANTS.page, TEST_CONSTANTS.userId, TEST_CONSTANTS.itemPerPage);

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0]).toStrictEqual(createExpectedResult(mockBidHistories[0]));
        expect(result[1]).toStrictEqual(createExpectedResult(mockBidHistories[1]));
      });

      test("should return empty array when no bid histories", async () => {
        // Arrange
        prismaMock.bidHistory.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

        // Act
        const result = await getUserBidHistories(TEST_CONSTANTS.page, TEST_CONSTANTS.userId, TEST_CONSTANTS.itemPerPage);

        // Assert
        expect(result).toStrictEqual([]);
      });
    });

    describe("異常系", () => {
      test.each([
        { params: [TEST_CONSTANTS.page, "", TEST_CONSTANTS.itemPerPage], description: "userId is empty" },
        { params: [TEST_CONSTANTS.page, TEST_CONSTANTS.userId, 0], description: "itemPerPage is 0" },
        { params: [0, TEST_CONSTANTS.userId, TEST_CONSTANTS.itemPerPage], description: "page is 0" },
      ])("should throw error when $description", async ({ params }) => {
        // Act & Assert
        await expect(getUserBidHistories(...(params as [number, string, number]))).rejects.toThrow("userId, itemPerPage, and page are required");
      });

      test.each([
        { page: 1, itemPerPage: 10, expectedSkip: 0, description: "page 1" },
        { page: 2, itemPerPage: 10, expectedSkip: 10, description: "page 2" },
        { page: 3, itemPerPage: 10, expectedSkip: 20, description: "page 3" },
        { page: 1, itemPerPage: 5, expectedSkip: 0, description: "page 1 with itemPerPage 5" },
        { page: 2, itemPerPage: 7, expectedSkip: 7, description: "page 2 with itemPerPage 7" },
        { page: 3, itemPerPage: 1, expectedSkip: 2, description: "page 3 with itemPerPage 1" },
      ])("should handle $description correctly", async ({ page, itemPerPage, expectedSkip }) => {
        // Arrange
        prismaMock.bidHistory.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

        // Act
        await getUserBidHistories(page, TEST_CONSTANTS.userId, itemPerPage);

        // Assert
        expect(prismaMock.bidHistory.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: expectedSkip,
            take: itemPerPage,
          }),
        );
      });
    });
  });

  test("should handle database error", async () => {
    // Arrange
    const databaseError = new Error("Database connection failed");
    prismaMock.bidHistory.findMany.mockRejectedValue(databaseError);

    // Act & Assert
    await expect(getUserBidHistories(TEST_CONSTANTS.page, TEST_CONSTANTS.userId, TEST_CONSTANTS.itemPerPage)).rejects.toThrow(
      "Database connection failed",
    );
  });

  describe("getUserBidHistoriesCount", () => {
    describe("正常系", () => {
      test.each([
        { count: 0, description: "no bid histories" },
        { count: 1, description: "single bid history" },
        { count: 5, description: "multiple bid histories" },
        { count: 999, description: "large count" },
        { count: Number.MAX_SAFE_INTEGER, description: "maximum safe integer" },
      ])("should return count correctly when $description", async ({ count }) => {
        // Arrange
        prismaMock.$queryRaw.mockResolvedValue([{ count: BigInt(count) }]);

        // Act
        const result = await getUserBidHistoriesCount(TEST_CONSTANTS.userId);

        // Assert
        expect(result).toBe(count);
        expect(prismaMock.$queryRaw).toHaveBeenCalledWith(expect.anything(), TEST_CONSTANTS.userId);
      });
    });

    describe("異常系", () => {
      test.each([
        { userId: "", description: "empty string" },
        { userId: null as unknown as string, description: "null" },
        { userId: undefined as unknown as string, description: "undefined" },
      ])("should throw error when userId is $description", async ({ userId }) => {
        // Act & Assert
        await expect(getUserBidHistoriesCount(userId)).rejects.toThrow("userId is required");
      });

      test("should handle database error", async () => {
        // Arrange
        const databaseError = new Error("Database query failed");
        prismaMock.$queryRaw.mockRejectedValue(databaseError);

        // Act & Assert
        await expect(getUserBidHistoriesCount(TEST_CONSTANTS.userId)).rejects.toThrow("Database query failed");
      });

      test("should handle empty query result", async () => {
        // Arrange
        prismaMock.$queryRaw.mockResolvedValue([]);

        // Act & Assert
        await expect(getUserBidHistoriesCount(TEST_CONSTANTS.userId)).rejects.toThrow("Invalid query result");
      });

      test("should handle malformed query result", async () => {
        // Arrange
        prismaMock.$queryRaw.mockResolvedValue([{ wrongField: BigInt(5) }]);

        // Act & Assert
        await expect(getUserBidHistoriesCount(TEST_CONSTANTS.userId)).rejects.toThrow("Invalid query result");
      });
    });
  });
});
