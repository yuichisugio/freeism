import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition, TaskStatus } from "@prisma/client";
import { Factory } from "fishery";
import { describe, expect, test } from "vitest";

import { getUserWonAuctions, getUserWonAuctionsCount, getUserWonAuctionsWhereCondition } from "./won-auction";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用の定数
 */
const CONSTANTS = {
  testUserId: "test-user-id",
  testPage: 1,
  testItemPerPage: 10,
};

/**
 * デフォルトStatusの配列（テストで使用）
 */
const DEFAULT_STATUS_ARRAY = [
  TaskStatus.AUCTION_ENDED,
  TaskStatus.SUPPLIER_DONE,
  TaskStatus.POINTS_DEPOSITED,
  TaskStatus.TASK_COMPLETED,
  TaskStatus.FIXED_EVALUATED,
  TaskStatus.POINTS_AWARDED,
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用ファクトリー
 */
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

describe("won-auction", () => {
  describe("getUserWonAuctionsWhereCondition", () => {
    describe("異常系", () => {
      test.each([
        { case: "no user id", userId: "", wonStatus: "completed", expectedError: "userId is required" },
        { case: "no user id", userId: undefined as never, wonStatus: "completed", expectedError: "userId is required" },
        { case: "no user id", userId: null as never, wonStatus: "completed", expectedError: "userId is required" },
      ])("should throw error when $case", async ({ userId, wonStatus, expectedError }) => {
        // Act & Assert
        await expect(getUserWonAuctionsWhereCondition(userId, wonStatus)).rejects.toThrow(expectedError);
      });
    });
  });

  describe("正常系", () => {
    test.each([
      { case: "empty string", wonStatus: "" as never, statusArray: DEFAULT_STATUS_ARRAY },
      { case: "undefined", wonStatus: undefined as never, statusArray: DEFAULT_STATUS_ARRAY },
      { case: "null", wonStatus: null as never, statusArray: DEFAULT_STATUS_ARRAY },
      { case: "other-status", wonStatus: "other-status" as never, statusArray: DEFAULT_STATUS_ARRAY },
      { case: "completed", wonStatus: "completed", statusArray: [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED] },
      {
        case: "incomplete",
        wonStatus: "incomplete",
        statusArray: [TaskStatus.PENDING, TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED, TaskStatus.SUPPLIER_DONE],
      },
      {
        case: "all",
        wonStatus: "all",
        statusArray: [
          TaskStatus.PENDING,
          TaskStatus.AUCTION_ACTIVE,
          TaskStatus.AUCTION_ENDED,
          TaskStatus.POINTS_DEPOSITED,
          TaskStatus.SUPPLIER_DONE,
          TaskStatus.TASK_COMPLETED,
          TaskStatus.FIXED_EVALUATED,
          TaskStatus.POINTS_AWARDED,
        ],
      },
    ])("should return array when wonStatus is $case", async ({ wonStatus, statusArray }) => {
      // Act
      const result = await getUserWonAuctionsWhereCondition(wonStatus);

      // Assert
      expect(result).toStrictEqual({
        winnerId: CONSTANTS.testUserId,
        task: {
          status: { in: statusArray },
        },
      });
    });
  });

  describe("getUserWonAuctions", () => {
    describe("異常系", () => {
      test.each([
        { case: "userId is empty", page: CONSTANTS.testPage, userId: "", itemPerPage: CONSTANTS.testItemPerPage },
        { case: "userId is undefined", page: CONSTANTS.testPage, userId: undefined as never, itemPerPage: CONSTANTS.testItemPerPage },
        { case: "userId is null", page: CONSTANTS.testPage, userId: null as never, itemPerPage: CONSTANTS.testItemPerPage },
        { case: "itemPerPage is 0", page: CONSTANTS.testPage, userId: CONSTANTS.testUserId, itemPerPage: 0 },
        { case: "itemPerPage is undefined", page: CONSTANTS.testPage, userId: CONSTANTS.testUserId, itemPerPage: undefined as never },
        { case: "itemPerPage is null", page: CONSTANTS.testPage, userId: CONSTANTS.testUserId, itemPerPage: null as never },
        { case: "page is 0", page: 0, userId: CONSTANTS.testUserId, itemPerPage: CONSTANTS.testItemPerPage },
        { case: "page is undefined", page: CONSTANTS.testPage, userId: CONSTANTS.testUserId, itemPerPage: CONSTANTS.testItemPerPage },
        { case: "page is null", page: CONSTANTS.testPage, userId: CONSTANTS.testUserId, itemPerPage: CONSTANTS.testItemPerPage },
        { case: "all required parameters are missing", page: 0, userId: "", itemPerPage: 0 },
      ])("should throw error when $case", async ({ page, userId, itemPerPage }) => {
        // Act & Assert
        await expect(getUserWonAuctions(page, userId, itemPerPage)).rejects.toThrow("userId, itemPerPage, and page are required");
      });
    });

    describe("正常系", () => {
      test("should return won auctions successfully with rating calculation", async () => {
        // Arrange
        const mockWonAuctions = [
          mockAuctionDataFactory.build({
            reviews: [{ rating: 4 }, { rating: 5 }],
          }),
        ];

        prismaMock.auction.findMany.mockResolvedValue(mockWonAuctions as never);

        // Act
        const result = await getUserWonAuctions(CONSTANTS.testPage, CONSTANTS.testUserId, CONSTANTS.testItemPerPage);

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
            winnerId: CONSTANTS.testUserId,
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
                revieweeId: CONSTANTS.testUserId,
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
        const result = await getUserWonAuctions(CONSTANTS.testPage, CONSTANTS.testUserId, CONSTANTS.testItemPerPage);

        // Assert
        expect(result[0].rating).toBeNull();
      });

      test("should return empty array when no data found", async () => {
        // Arrange
        prismaMock.auction.findMany.mockResolvedValue([]);

        // Act
        const result = await getUserWonAuctions(CONSTANTS.testPage, CONSTANTS.testUserId, CONSTANTS.testItemPerPage);

        // Assert
        expect(result).toStrictEqual([]);
      });

      test("should handle pagination correctly", async () => {
        // Arrange
        const page = 3;
        const itemPerPage = 5;
        prismaMock.auction.findMany.mockResolvedValue([]);

        // Act
        await getUserWonAuctions(page, CONSTANTS.testUserId, itemPerPage);

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
        await getUserWonAuctions(CONSTANTS.testPage, CONSTANTS.testUserId, CONSTANTS.testItemPerPage, "completed");

        // Assert
        expect(prismaMock.auction.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              winnerId: CONSTANTS.testUserId,
              task: {
                status: {
                  in: [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED],
                },
              },
            },
          }),
        );
      });
    });
  });

  describe("getUserWonAuctionsCount", () => {
    describe("異常系", () => {
      test.each([
        { case: "userId is empty", userId: "" },
        { case: "userId is undefined", userId: undefined as never },
        { case: "userId is null", userId: null as never },
      ])("should throw error when $case", async ({ userId }) => {
        // Act & Assert
        await expect(getUserWonAuctionsCount(userId)).rejects.toThrow("userId is required");
      });

      test("should throw error when database error occurs", async () => {
        // Arrange
        prismaMock.auction.count.mockRejectedValue(new Error("database error"));

        // Act & Assert
        await expect(getUserWonAuctionsCount(CONSTANTS.testUserId)).rejects.toThrow("database error");
      });
    });

    describe("正常系", () => {
      test("should return count successfully", async () => {
        // Arrange
        prismaMock.auction.count.mockResolvedValue(5);

        // Act
        const result = await getUserWonAuctionsCount(CONSTANTS.testUserId);

        // Assert
        expect(result).toBe(5);
      });

      test("should return 0 when count is 0", async () => {
        // Arrange
        prismaMock.auction.count.mockResolvedValue(0);

        // Act
        const result = await getUserWonAuctionsCount(CONSTANTS.testUserId);

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
        const result = await getUserWonAuctionsCount(CONSTANTS.testUserId, wonStatus);

        // Assert
        expect(result).toBe(expectedCount);
        expect(prismaMock.auction.count).toHaveBeenCalledWith({
          where: {
            winnerId: CONSTANTS.testUserId,
            task: { status: { in: expectedStatusArray } },
          },
        });
      });
    });
  });
});
