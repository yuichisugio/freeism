import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition, TaskStatus } from "@prisma/client";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserWonAuctions, getUserWonAuctionsCount, getUserWonAuctionsWhereCondition } from "./won-auction";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テスト用の定数
const testUserId = "test-user-id";
const testPage = 1;
const testItemPerPage = 10;

// デフォルトStatusの配列（テストで使用）
const DEFAULT_STATUS_ARRAY = [
  TaskStatus.AUCTION_ENDED,
  TaskStatus.SUPPLIER_DONE,
  TaskStatus.POINTS_DEPOSITED,
  TaskStatus.TASK_COMPLETED,
  TaskStatus.FIXED_EVALUATED,
  TaskStatus.POINTS_AWARDED,
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テスト用ファクトリー
const mockAuctionDataFactory = Factory.define<{
  id: string;
  endTime: Date;
  currentHighestBid: number;
  createdAt: Date;
  task: {
    id: string;
    task: string;
    status: TaskStatus;
    deliveryMethod: string;
  };
  reviews: Array<{ rating: number }>;
}>(({ sequence, params }) => ({
  id: params.id ?? `auction-${sequence}`,
  endTime: params.endTime ?? new Date("2024-01-02"),
  currentHighestBid: params.currentHighestBid ?? 1500,
  createdAt: params.createdAt ?? new Date("2024-01-01"),
  task: {
    id: `task-${sequence}`,
    task: "Test Won Task 1",
    status: TaskStatus.AUCTION_ENDED,
    deliveryMethod: "online",
    ...params.task,
  },
  reviews: params.reviews ?? [],
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

beforeEach(() => {
  // コンソールログをモック化（テスト出力をクリーンに保つ）
  vi.spyOn(console, "log").mockImplementation(() => {
    // テスト中のコンソール出力を抑制
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("won-auction", () => {
  describe("getUserWonAuctionsWhereCondition", () => {
    // デフォルトStatusを返すケースのParameterized Test
    test.each([
      { case: "undefined", wonStatus: undefined },
      { case: "invalid value", wonStatus: "invalid-status" },
      { case: "empty string", wonStatus: "" },
    ])("should return default status array when wonStatus is $case", async ({ wonStatus }) => {
      // Act
      const result = await getUserWonAuctionsWhereCondition(testUserId, wonStatus);

      // Assert
      expect(result).toStrictEqual({
        winnerId: testUserId,
        task: {
          status: { in: DEFAULT_STATUS_ARRAY },
        },
      });
    });

    test("should return completed status array when wonStatus is 'completed'", async () => {
      // Act
      const result = await getUserWonAuctionsWhereCondition(testUserId, "completed");

      // Assert
      expect(result).toStrictEqual({
        winnerId: testUserId,
        task: {
          status: {
            in: [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED],
          },
        },
      });
    });

    test("should return incomplete status array when wonStatus is 'incomplete'", async () => {
      // Act
      const result = await getUserWonAuctionsWhereCondition(testUserId, "incomplete");

      // Assert
      expect(result).toStrictEqual({
        winnerId: testUserId,
        task: {
          status: {
            in: [TaskStatus.PENDING, TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED, TaskStatus.SUPPLIER_DONE],
          },
        },
      });
    });
  });

  describe("getUserWonAuctions", () => {
    test("should return won auctions successfully with rating calculation", async () => {
      // Arrange
      const mockWonAuctions = [
        mockAuctionDataFactory.build({
          reviews: [{ rating: 4 }, { rating: 5 }],
        }),
      ];

      prismaMock.auction.findMany.mockResolvedValue(mockWonAuctions as never);

      // Act
      const result = await getUserWonAuctions(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        auctionId: mockWonAuctions[0].id,
        currentHighestBid: mockWonAuctions[0].currentHighestBid,
        auctionEndTime: mockWonAuctions[0].endTime,
        auctionCreatedAt: mockWonAuctions[0].createdAt,
        taskId: mockWonAuctions[0].task.id,
        taskName: mockWonAuctions[0].task.task,
        taskStatus: mockWonAuctions[0].task.status,
        deliveryMethod: mockWonAuctions[0].task.deliveryMethod,
        rating: 4.5, // (4 + 5) / 2
      });

      expect(prismaMock.auction.findMany).toHaveBeenCalledWith({
        where: {
          winnerId: testUserId,
          task: { status: { in: DEFAULT_STATUS_ARRAY } },
        },
        orderBy: { endTime: "desc" },
        skip: 0,
        take: 10,
        select: {
          id: true,
          endTime: true,
          currentHighestBid: true,
          createdAt: true,
          task: {
            select: {
              id: true,
              task: true,
              status: true,
              deliveryMethod: true,
            },
          },
          reviews: {
            where: {
              revieweeId: testUserId,
              reviewPosition: ReviewPosition.BUYER_TO_SELLER,
            },
            select: { rating: true },
          },
        },
      });
    });

    test("should return won auctions with null rating when no reviews", async () => {
      // Arrange
      const mockWonAuctions = [mockAuctionDataFactory.build({ reviews: [] })];
      prismaMock.auction.findMany.mockResolvedValue(mockWonAuctions as never);

      // Act
      const result = await getUserWonAuctions(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result[0].rating).toBeNull();
    });

    test("should return empty array when no data found", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([]);

      // Act
      const result = await getUserWonAuctions(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result).toStrictEqual([]);
    });

    test("should handle pagination correctly", async () => {
      // Arrange
      const page = 3;
      const itemPerPage = 5;
      prismaMock.auction.findMany.mockResolvedValue([]);

      // Act
      await getUserWonAuctions(page, testUserId, itemPerPage);

      // Assert
      expect(prismaMock.auction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (3 - 1) * 5
          take: 5,
        }),
      );
    });

    test("should pass wonStatus filter to where condition", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([]);

      // Act
      await getUserWonAuctions(testPage, testUserId, testItemPerPage, "completed");

      // Assert
      expect(prismaMock.auction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            winnerId: testUserId,
            task: {
              status: {
                in: [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED],
              },
            },
          },
        }),
      );
    });

    // エラーケースのParameterized Test
    test.each([
      { case: "userId is empty", page: testPage, userId: "", itemPerPage: testItemPerPage },
      { case: "userId is undefined", page: testPage, userId: undefined as never, itemPerPage: testItemPerPage },
      { case: "itemPerPage is 0", page: testPage, userId: testUserId, itemPerPage: 0 },
      { case: "page is 0", page: 0, userId: testUserId, itemPerPage: testItemPerPage },
      { case: "all required parameters are missing", page: 0, userId: "", itemPerPage: 0 },
    ])("should throw error when $case", async ({ page, userId, itemPerPage }) => {
      // Act & Assert
      await expect(getUserWonAuctions(page, userId, itemPerPage)).rejects.toThrow("userId, itemPerPage, and page are required");
    });
  });

  describe("getUserWonAuctionsCount", () => {
    test("should return count successfully", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(5);

      // Act
      const result = await getUserWonAuctionsCount(testUserId);

      // Assert
      expect(result).toBe(5);
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: {
          winnerId: testUserId,
          task: { status: { in: DEFAULT_STATUS_ARRAY } },
        },
      });
    });

    test("should return 0 when count is 0", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(0);

      // Act
      const result = await getUserWonAuctionsCount(testUserId);

      // Assert
      expect(result).toBe(0);
    });

    test.each([
      {
        case: "completed status filter",
        wonStatus: "completed",
        expectedCount: 3,
        expectedStatusArray: [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED],
      },
      {
        case: "incomplete status filter",
        wonStatus: "incomplete",
        expectedCount: 2,
        expectedStatusArray: [
          TaskStatus.PENDING,
          TaskStatus.AUCTION_ACTIVE,
          TaskStatus.AUCTION_ENDED,
          TaskStatus.POINTS_DEPOSITED,
          TaskStatus.SUPPLIER_DONE,
        ],
      },
    ])("should handle $case correctly", async ({ wonStatus, expectedCount, expectedStatusArray }) => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(expectedCount);

      // Act
      const result = await getUserWonAuctionsCount(testUserId, wonStatus);

      // Assert
      expect(result).toBe(expectedCount);
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: {
          winnerId: testUserId,
          task: { status: { in: expectedStatusArray } },
        },
      });
    });

    // エラーケースのParameterized Test
    test.each([
      { case: "userId is empty", userId: "" },
      { case: "userId is undefined", userId: undefined as never },
      { case: "userId is null", userId: null as never },
    ])("should throw error when $case", async ({ userId }) => {
      // Act & Assert
      await expect(getUserWonAuctionsCount(userId)).rejects.toThrow("userId is required");
    });
  });
});
