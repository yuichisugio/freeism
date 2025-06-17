import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserWonAuctions, getUserWonAuctionsCount, getUserWonAuctionsWhereCondition } from "./won-auction";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const testUserId = "test-user-id";
const testPage = 1;
const testItemPerPage = 10;

beforeEach(() => {
  // コンソールログをモック化（テスト出力をクリーンに保つ）
  vi.spyOn(console, "log").mockImplementation(() => {
    // テスト中のコンソール出力を抑制
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("won-auction", () => {
  describe("getUserWonAuctionsWhereCondition", () => {
    test("should return default status array when wonStatus is not specified", async () => {
      // Act
      const result = await getUserWonAuctionsWhereCondition(testUserId);

      // Assert
      expect(result).toStrictEqual({
        winnerId: testUserId,
        task: {
          status: {
            in: [
              TaskStatus.AUCTION_ENDED,
              TaskStatus.SUPPLIER_DONE,
              TaskStatus.POINTS_DEPOSITED,
              TaskStatus.TASK_COMPLETED,
              TaskStatus.FIXED_EVALUATED,
              TaskStatus.POINTS_AWARDED,
            ],
          },
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

    test("should return default status array when wonStatus is invalid value", async () => {
      // Act
      const result = await getUserWonAuctionsWhereCondition(testUserId, "invalid-status");

      // Assert
      expect(result).toStrictEqual({
        winnerId: testUserId,
        task: {
          status: {
            in: [
              TaskStatus.AUCTION_ENDED,
              TaskStatus.SUPPLIER_DONE,
              TaskStatus.POINTS_DEPOSITED,
              TaskStatus.TASK_COMPLETED,
              TaskStatus.FIXED_EVALUATED,
              TaskStatus.POINTS_AWARDED,
            ],
          },
        },
      });
    });

    test("should handle empty string wonStatus", async () => {
      // Act
      const result = await getUserWonAuctionsWhereCondition(testUserId, "");

      // Assert
      expect(result).toStrictEqual({
        winnerId: testUserId,
        task: {
          status: {
            in: [
              TaskStatus.AUCTION_ENDED,
              TaskStatus.SUPPLIER_DONE,
              TaskStatus.POINTS_DEPOSITED,
              TaskStatus.TASK_COMPLETED,
              TaskStatus.FIXED_EVALUATED,
              TaskStatus.POINTS_AWARDED,
            ],
          },
        },
      });
    });
  });

  describe("getUserWonAuctions", () => {
    test("should return won auctions successfully with rating calculation", async () => {
      // Arrange
      const mockWonAuctions = [
        {
          id: "auction-1",
          endTime: new Date("2024-01-02"),
          currentHighestBid: 1500,
          createdAt: new Date("2024-01-01"),
          task: {
            id: "task-1",
            task: "Test Won Task 1",
            status: TaskStatus.AUCTION_ENDED,
            deliveryMethod: "online",
          },
          reviews: [{ rating: 4 }, { rating: 5 }],
        },
      ];

      prismaMock.auction.findMany.mockResolvedValue(mockWonAuctions as never);

      // Act
      const result = await getUserWonAuctions(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        auctionId: "auction-1",
        currentHighestBid: 1500,
        auctionEndTime: new Date("2024-01-02"),
        auctionCreatedAt: new Date("2024-01-01"),
        taskId: "task-1",
        taskName: "Test Won Task 1",
        taskStatus: TaskStatus.AUCTION_ENDED,
        deliveryMethod: "online",
        rating: 4.5, // (4 + 5) / 2
      });

      expect(prismaMock.auction.findMany).toHaveBeenCalledWith({
        where: {
          winnerId: testUserId,
          task: {
            status: {
              in: [
                TaskStatus.AUCTION_ENDED,
                TaskStatus.SUPPLIER_DONE,
                TaskStatus.POINTS_DEPOSITED,
                TaskStatus.TASK_COMPLETED,
                TaskStatus.FIXED_EVALUATED,
                TaskStatus.POINTS_AWARDED,
              ],
            },
          },
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
      const mockWonAuctions = [
        {
          id: "auction-1",
          endTime: new Date("2024-01-02"),
          currentHighestBid: 1500,
          createdAt: new Date("2024-01-01"),
          task: {
            id: "task-1",
            task: "Test Won Task 1",
            status: TaskStatus.AUCTION_ENDED,
            deliveryMethod: "online",
          },
          reviews: [],
        },
      ];

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

    test("should throw error when userId is empty", async () => {
      // Act & Assert
      await expect(getUserWonAuctions(testPage, "", testItemPerPage)).rejects.toThrow("userId, itemPerPage, and page are required");
    });

    test("should throw error when userId is undefined", async () => {
      // Act & Assert
      await expect(getUserWonAuctions(testPage, undefined as never, testItemPerPage)).rejects.toThrow("userId, itemPerPage, and page are required");
    });

    test("should throw error when itemPerPage is 0", async () => {
      // Act & Assert
      await expect(getUserWonAuctions(testPage, testUserId, 0)).rejects.toThrow("userId, itemPerPage, and page are required");
    });

    test("should throw error when page is 0", async () => {
      // Act & Assert
      await expect(getUserWonAuctions(0, testUserId, testItemPerPage)).rejects.toThrow("userId, itemPerPage, and page are required");
    });

    test("should throw error when all required parameters are missing", async () => {
      // Act & Assert
      await expect(getUserWonAuctions(0, "", 0)).rejects.toThrow("userId, itemPerPage, and page are required");
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
          task: {
            status: {
              in: [
                TaskStatus.AUCTION_ENDED,
                TaskStatus.SUPPLIER_DONE,
                TaskStatus.POINTS_DEPOSITED,
                TaskStatus.TASK_COMPLETED,
                TaskStatus.FIXED_EVALUATED,
                TaskStatus.POINTS_AWARDED,
              ],
            },
          },
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

    test("should handle wonStatus filter correctly", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(3);

      // Act
      const result = await getUserWonAuctionsCount(testUserId, "completed");

      // Assert
      expect(result).toBe(3);
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: {
          winnerId: testUserId,
          task: {
            status: {
              in: [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED],
            },
          },
        },
      });
    });

    test("should handle incomplete wonStatus filter", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(2);

      // Act
      const result = await getUserWonAuctionsCount(testUserId, "incomplete");

      // Assert
      expect(result).toBe(2);
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: {
          winnerId: testUserId,
          task: {
            status: {
              in: [TaskStatus.PENDING, TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED, TaskStatus.SUPPLIER_DONE],
            },
          },
        },
      });
    });

    test("should throw error when userId is empty", async () => {
      // Act & Assert
      await expect(getUserWonAuctionsCount("")).rejects.toThrow("userId is required");
    });

    test("should throw error when userId is undefined", async () => {
      // Act & Assert
      await expect(getUserWonAuctionsCount(undefined as never)).rejects.toThrow("userId is required");
    });

    test("should throw error when userId is null", async () => {
      // Act & Assert
      await expect(getUserWonAuctionsCount(null as never)).rejects.toThrow("userId is required");
    });
  });
});
