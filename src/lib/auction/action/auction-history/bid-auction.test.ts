import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { BidStatus, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserBidHistories, getUserBidHistoriesCount } from "./bid-auction";

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

describe("bid-auction", () => {
  describe("getUserBidHistories", () => {
    test("should return bid histories successfully", async () => {
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

    test("should return empty array when no bid histories", async () => {
      // Arrange
      prismaMock.bidHistory.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistories(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result).toStrictEqual([]);
    });

    test("should handle multiple bid histories correctly", async () => {
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
        {
          auctionId: "auction-2",
          status: BidStatus.LOST,
          auction: {
            currentHighestBid: 2000,
            createdAt: new Date("2024-01-03"),
            endTime: new Date("2024-01-04"),
            task: {
              id: "task-2",
              task: "Test Task 2",
              status: TaskStatus.AUCTION_ENDED,
            },
          },
        },
      ];

      prismaMock.bidHistory.findMany.mockResolvedValue(mockBidHistories as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistories(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result).toHaveLength(2);
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
      expect(result[1]).toStrictEqual({
        auctionId: "auction-2",
        bidStatus: BidStatus.LOST,
        lastBidAt: new Date("2024-01-03"),
        taskId: "task-2",
        taskName: "Test Task 2",
        taskStatus: TaskStatus.AUCTION_ENDED,
        currentHighestBid: 2000,
        auctionEndTime: new Date("2024-01-04"),
      });
    });

    // パラメータ検証のテスト
    test("should throw error when userId is missing", async () => {
      // Act & Assert
      await expect(getUserBidHistories(testPage, "", testItemPerPage)).rejects.toThrow("userId, itemPerPage, and page are required");
    });

    test("should throw error when itemPerPage is missing", async () => {
      // Act & Assert
      await expect(getUserBidHistories(testPage, testUserId, 0)).rejects.toThrow("userId, itemPerPage, and page are required");
    });

    test("should throw error when page is missing", async () => {
      // Act & Assert
      await expect(getUserBidHistories(0, testUserId, testItemPerPage)).rejects.toThrow("userId, itemPerPage, and page are required");
    });

    // 境界値テスト
    test("should handle page 1 correctly", async () => {
      // Arrange
      prismaMock.bidHistory.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      await getUserBidHistories(1, testUserId, testItemPerPage);

      // Assert
      expect(prismaMock.bidHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0, // (1 - 1) * 10 = 0
          take: testItemPerPage,
        }),
      );
    });

    test("should handle page 2 correctly", async () => {
      // Arrange
      prismaMock.bidHistory.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      await getUserBidHistories(2, testUserId, testItemPerPage);

      // Assert
      expect(prismaMock.bidHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (2 - 1) * 10 = 10
          take: testItemPerPage,
        }),
      );
    });

    test("should handle different itemPerPage values", async () => {
      // Arrange
      const customItemPerPage = 5;
      prismaMock.bidHistory.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      await getUserBidHistories(testPage, testUserId, customItemPerPage);

      // Assert
      expect(prismaMock.bidHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: customItemPerPage,
        }),
      );
    });

    // データベースエラーのテスト
    test("should handle database error", async () => {
      // Arrange
      const databaseError = new Error("Database connection failed");
      prismaMock.bidHistory.findMany.mockRejectedValue(databaseError);

      // Act & Assert
      await expect(getUserBidHistories(testPage, testUserId, testItemPerPage)).rejects.toThrow("Database connection failed");
    });

    test("should handle different bid status values", async () => {
      // Arrange
      const mockBidHistories = [
        {
          auctionId: "auction-won",
          status: BidStatus.WON,
          auction: {
            currentHighestBid: 1500,
            createdAt: new Date("2024-01-05"),
            endTime: new Date("2024-01-06"),
            task: {
              id: "task-won",
              task: "Won Task",
              status: TaskStatus.AUCTION_ENDED,
            },
          },
        },
        {
          auctionId: "auction-lost",
          status: BidStatus.LOST,
          auction: {
            currentHighestBid: 2000,
            createdAt: new Date("2024-01-07"),
            endTime: new Date("2024-01-08"),
            task: {
              id: "task-lost",
              task: "Lost Task",
              status: TaskStatus.AUCTION_ENDED,
            },
          },
        },
      ];

      prismaMock.bidHistory.findMany.mockResolvedValue(mockBidHistories as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistories(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].bidStatus).toBe(BidStatus.WON);
      expect(result[1].bidStatus).toBe(BidStatus.LOST);
    });

    test("should handle different task status values", async () => {
      // Arrange
      const mockBidHistories = [
        {
          auctionId: "auction-pending",
          status: BidStatus.BIDDING,
          auction: {
            currentHighestBid: 800,
            createdAt: new Date("2024-01-09"),
            endTime: new Date("2024-01-10"),
            task: {
              id: "task-pending",
              task: "Pending Task",
              status: TaskStatus.PENDING,
            },
          },
        },
        {
          auctionId: "auction-canceled",
          status: BidStatus.LOST,
          auction: {
            currentHighestBid: 1200,
            createdAt: new Date("2024-01-11"),
            endTime: new Date("2024-01-12"),
            task: {
              id: "task-canceled",
              task: "Canceled Task",
              status: TaskStatus.AUCTION_CANCELED,
            },
          },
        },
      ];

      prismaMock.bidHistory.findMany.mockResolvedValue(mockBidHistories as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistories(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].taskStatus).toBe(TaskStatus.PENDING);
      expect(result[1].taskStatus).toBe(TaskStatus.AUCTION_CANCELED);
    });

    test("should handle zero currentHighestBid correctly", async () => {
      // Arrange
      const mockBidHistories = [
        {
          auctionId: "auction-zero-bid",
          status: BidStatus.BIDDING,
          auction: {
            currentHighestBid: 0,
            createdAt: new Date("2024-01-13"),
            endTime: new Date("2024-01-14"),
            task: {
              id: "task-zero-bid",
              task: "Zero Bid Task",
              status: TaskStatus.AUCTION_ACTIVE,
            },
          },
        },
      ];

      prismaMock.bidHistory.findMany.mockResolvedValue(mockBidHistories as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistories(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result[0].currentHighestBid).toBe(0);
    });

    test("should handle very large bid amounts", async () => {
      // Arrange
      const largeBidAmount = 999999999;
      const mockBidHistories = [
        {
          auctionId: "auction-large-bid",
          status: BidStatus.BIDDING,
          auction: {
            currentHighestBid: largeBidAmount,
            createdAt: new Date("2024-01-15"),
            endTime: new Date("2024-01-16"),
            task: {
              id: "task-large-bid",
              task: "Large Bid Task",
              status: TaskStatus.AUCTION_ACTIVE,
            },
          },
        },
      ];

      prismaMock.bidHistory.findMany.mockResolvedValue(mockBidHistories as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistories(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result[0].currentHighestBid).toBe(largeBidAmount);
    });

    test("should handle special characters in task names", async () => {
      // Arrange
      const specialTaskName = "Test Task with 特殊文字 & symbols @#$%";
      const mockBidHistories = [
        {
          auctionId: "auction-special-chars",
          status: BidStatus.BIDDING,
          auction: {
            currentHighestBid: 1000,
            createdAt: new Date("2024-01-17"),
            endTime: new Date("2024-01-18"),
            task: {
              id: "task-special-chars",
              task: specialTaskName,
              status: TaskStatus.AUCTION_ACTIVE,
            },
          },
        },
      ];

      prismaMock.bidHistory.findMany.mockResolvedValue(mockBidHistories as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistories(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result[0].taskName).toBe(specialTaskName);
    });

    test("should handle date edge cases", async () => {
      // Arrange
      const futureDate = new Date("2030-01-01");
      const pastDate = new Date("2020-01-01");
      const mockBidHistories = [
        {
          auctionId: "auction-date-edge",
          status: BidStatus.BIDDING,
          auction: {
            currentHighestBid: 1000,
            createdAt: pastDate,
            endTime: futureDate,
            task: {
              id: "task-date-edge",
              task: "Date Edge Task",
              status: TaskStatus.AUCTION_ACTIVE,
            },
          },
        },
      ];

      prismaMock.bidHistory.findMany.mockResolvedValue(mockBidHistories as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistories(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result[0].lastBidAt).toStrictEqual(pastDate);
      expect(result[0].auctionEndTime).toStrictEqual(futureDate);
    });
  });

  describe("getUserBidHistoriesCount", () => {
    test("should return count of bid histories successfully", async () => {
      // Arrange
      const mockCountResult = [{ count: BigInt(5) }];
      prismaMock.$queryRaw.mockResolvedValue(mockCountResult);

      // Act
      const result = await getUserBidHistoriesCount(testUserId);

      // Assert
      expect(result).toBe(5);
      expect(prismaMock.$queryRaw).toHaveBeenCalledWith(expect.anything(), testUserId);
    });

    test("should return 0 when no bid histories", async () => {
      // Arrange
      const mockCountResult = [{ count: BigInt(0) }];
      prismaMock.$queryRaw.mockResolvedValue(mockCountResult);

      // Act
      const result = await getUserBidHistoriesCount(testUserId);

      // Assert
      expect(result).toBe(0);
    });

    test("should handle large count values correctly", async () => {
      // Arrange
      const mockCountResult = [{ count: BigInt(999) }];
      prismaMock.$queryRaw.mockResolvedValue(mockCountResult);

      // Act
      const result = await getUserBidHistoriesCount(testUserId);

      // Assert
      expect(result).toBe(999);
    });

    // パラメータ検証のテスト
    test("should throw error when userId is missing", async () => {
      // Act & Assert
      await expect(getUserBidHistoriesCount("")).rejects.toThrow("userId is required");
    });

    test("should throw error when userId is null", async () => {
      // Act & Assert
      await expect(getUserBidHistoriesCount(null as unknown as string)).rejects.toThrow("userId is required");
    });

    test("should throw error when userId is undefined", async () => {
      // Act & Assert
      await expect(getUserBidHistoriesCount(undefined as unknown as string)).rejects.toThrow("userId is required");
    });

    // データベースエラーのテスト
    test("should handle database error", async () => {
      // Arrange
      const databaseError = new Error("Database query failed");
      prismaMock.$queryRaw.mockRejectedValue(databaseError);

      // Act & Assert
      await expect(getUserBidHistoriesCount(testUserId)).rejects.toThrow("Database query failed");
    });

    // 境界値テスト
    test("should handle very large count values", async () => {
      // Arrange
      const mockCountResult = [{ count: BigInt(Number.MAX_SAFE_INTEGER) }];
      prismaMock.$queryRaw.mockResolvedValue(mockCountResult);

      // Act
      const result = await getUserBidHistoriesCount(testUserId);

      // Assert
      expect(result).toBe(Number.MAX_SAFE_INTEGER);
    });

    test("should handle count value of 1", async () => {
      // Arrange
      const mockCountResult = [{ count: BigInt(1) }];
      prismaMock.$queryRaw.mockResolvedValue(mockCountResult);

      // Act
      const result = await getUserBidHistoriesCount(testUserId);

      // Assert
      expect(result).toBe(1);
    });

    test("should handle empty query result", async () => {
      // Arrange
      prismaMock.$queryRaw.mockResolvedValue([]);

      // Act & Assert
      // 現在の実装では空の配列の場合、TypeError: Cannot read property 'count' of undefinedが発生する
      await expect(getUserBidHistoriesCount(testUserId)).rejects.toThrow();
    });

    test("should handle malformed query result", async () => {
      // Arrange
      prismaMock.$queryRaw.mockResolvedValue([{ wrongField: BigInt(5) }]);

      // Act
      const result = await getUserBidHistoriesCount(testUserId);

      // Assert
      // 現在の実装では count フィールドが存在しない場合、Number(undefined) で NaN が返される
      expect(result).toBeNaN();
    });
  });
});
