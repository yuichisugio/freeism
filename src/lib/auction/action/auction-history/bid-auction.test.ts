import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { BidStatus, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserBidHistories, getUserBidHistoriesWithCount, getUserBidHistoryCount } from "./bid-auction";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("auction-history", () => {
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

  describe("getUserBidHistories", () => {
    test("should return user bid histories successfully", async () => {
      // Arrange
      const mockBidHistories = [
        {
          auctionId: "auction-1",
          status: BidStatus.BIDDING,
          auction: {
            currentHighestBid: 1000,
            createdAt: new Date("2024-01-01"),
            endTime: new Date("2024-01-02"),
            task: {
              id: "task-1",
              task: "Test Task 1",
              status: TaskStatus.AUCTION_ACTIVE,
            },
          },
        },
      ];

      prismaMock.bidHistory.findMany.mockResolvedValue(mockBidHistories as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistories(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        auctionId: "auction-1",
        bidStatus: BidStatus.BIDDING,
        lastBidAt: new Date("2024-01-01"),
        taskId: "task-1",
        taskName: "Test Task 1",
        taskStatus: TaskStatus.AUCTION_ACTIVE,
        currentHighestBid: 1000,
        auctionEndTime: new Date("2024-01-02"),
      });

      expect(prismaMock.bidHistory.findMany).toHaveBeenCalledWith({
        skip: (testPage - 1) * testItemPerPage,
        take: testItemPerPage,
        where: { userId: testUserId },
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
    });

    test("should return empty array when no bid histories found", async () => {
      // Arrange
      prismaMock.bidHistory.findMany.mockResolvedValue([]);

      // Act
      const result = await getUserBidHistories(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result).toStrictEqual([]);
      expect(prismaMock.bidHistory.findMany).toHaveBeenCalledTimes(1);
    });

    test("should handle pagination correctly", async () => {
      // Arrange
      const page = 2;
      const itemPerPage = 5;
      prismaMock.bidHistory.findMany.mockResolvedValue([]);

      // Act
      await getUserBidHistories(page, testUserId, itemPerPage);

      // Assert
      expect(prismaMock.bidHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: (page - 1) * itemPerPage, // 5
          take: itemPerPage, // 5
        }),
      );
    });

    test("should use default page value when not provided", async () => {
      // Arrange
      prismaMock.bidHistory.findMany.mockResolvedValue([]);

      // Act
      await getUserBidHistories(undefined, testUserId, testItemPerPage);

      // Assert
      expect(prismaMock.bidHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0, // (1 - 1) * testItemPerPage
        }),
      );
    });

    test("should handle condition parameter (currently unused)", async () => {
      // Arrange
      prismaMock.bidHistory.findMany.mockResolvedValue([]);

      // Act
      await getUserBidHistories(testPage, testUserId, testItemPerPage, "and");

      // Assert
      expect(prismaMock.bidHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: (testPage - 1) * testItemPerPage,
          take: testItemPerPage,
          where: { userId: testUserId },
        }),
      );
    });

    test("should handle database error gracefully", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      prismaMock.bidHistory.findMany.mockRejectedValue(dbError);

      // Act & Assert
      await expect(getUserBidHistories(testPage, testUserId, testItemPerPage)).rejects.toThrow("Database connection failed");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserBidHistoryCount", () => {
    test("should return correct count of distinct bid histories", async () => {
      // Arrange
      const mockDistinctBids = [{ auctionId: "auction-1" }, { auctionId: "auction-2" }, { auctionId: "auction-3" }];

      prismaMock.bidHistory.findMany.mockResolvedValue(mockDistinctBids as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistoryCount(testUserId);

      // Assert
      expect(result).toBe(3);
      expect(prismaMock.bidHistory.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        distinct: ["auctionId"],
        select: { auctionId: true },
      });
    });

    test("should return 0 when no bid histories found", async () => {
      // Arrange
      prismaMock.bidHistory.findMany.mockResolvedValue([]);

      // Act
      const result = await getUserBidHistoryCount(testUserId);

      // Assert
      expect(result).toBe(0);
    });

    test("should handle database error in count", async () => {
      // Arrange
      const dbError = new Error("Database error");
      prismaMock.bidHistory.findMany.mockRejectedValue(dbError);

      // Act & Assert
      await expect(getUserBidHistoryCount(testUserId)).rejects.toThrow("Database error");
    });
  });
  describe("getUserBidHistoriesWithCount", () => {
    test("should return bid histories with count successfully", async () => {
      // Arrange
      const mockBidHistories = [
        {
          auctionId: "auction-1",
          status: BidStatus.BIDDING,
          auction: {
            currentHighestBid: 1000,
            createdAt: new Date("2024-01-01"),
            endTime: new Date("2024-01-02"),
            task: {
              id: "task-1",
              task: "Test Task 1",
              status: TaskStatus.AUCTION_ACTIVE,
            },
          },
        },
      ];
      const mockDistinctBids = [{ auctionId: "auction-1" }, { auctionId: "auction-2" }];

      // Promise.allの結果をモック

      prismaMock.bidHistory.findMany.mockResolvedValueOnce(mockBidHistories as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      prismaMock.bidHistory.findMany.mockResolvedValueOnce(mockDistinctBids as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistoriesWithCount(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.count).toBe(2);
      expect(result.data[0]).toStrictEqual({
        auctionId: "auction-1",
        bidStatus: BidStatus.BIDDING,
        lastBidAt: new Date("2024-01-01"),
        taskId: "task-1",
        taskName: "Test Task 1",
        taskStatus: TaskStatus.AUCTION_ACTIVE,
        currentHighestBid: 1000,
        auctionEndTime: new Date("2024-01-02"),
      });

      expect(prismaMock.bidHistory.findMany).toHaveBeenCalledTimes(2);
    });

    test("should return empty data and zero count when no bid histories", async () => {
      // Arrange

      prismaMock.bidHistory.findMany.mockResolvedValueOnce([] as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      prismaMock.bidHistory.findMany.mockResolvedValueOnce([] as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistoriesWithCount(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result.data).toStrictEqual([]);
      expect(result.count).toBe(0);
    });
  });
});
