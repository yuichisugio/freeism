import type { AuctionCreatedTabFilter } from "@/types/auction-types";
import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { BidStatus, ReviewPosition, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  getUserBidHistories,
  getUserBidHistoriesWithCount,
  getUserBidHistoryCount,
  getUserCreatedAuctionsCount,
  getUserCreatedAuctionsWithCount,
  getUserWonAuctions,
  getUserWonAuctionsCount,
  getUserWonAuctionsWithCount,
} from "./auction-history";

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserWonAuctions", () => {
    test("should return user won auctions successfully", async () => {
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

      prismaMock.auction.findMany.mockResolvedValue(mockWonAuctions as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

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
        skip: (testPage - 1) * testItemPerPage,
        take: testItemPerPage,
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

    test("should return empty array when no won auctions found", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([]);

      // Act
      const result = await getUserWonAuctions(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result).toStrictEqual([]);
    });

    test("should handle wonStatus filter correctly - completed", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([]);

      // Act
      await getUserWonAuctions(testPage, testUserId, testItemPerPage, "completed");

      // Assert
      expect(prismaMock.auction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            task: {
              status: {
                in: [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED],
              },
            },
          }) as unknown as Prisma.AuctionWhereInput,
        }),
      );
    });

    test("should handle wonStatus filter correctly - incomplete", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([]);

      // Act
      await getUserWonAuctions(testPage, testUserId, testItemPerPage, "incomplete");

      // Assert
      expect(prismaMock.auction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            task: {
              status: {
                in: [TaskStatus.PENDING, TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED, TaskStatus.SUPPLIER_DONE],
              },
            },
          }) as unknown as Prisma.AuctionWhereInput,
        }),
      );
    });

    test("should calculate rating as null when no reviews", async () => {
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

      prismaMock.auction.findMany.mockResolvedValue(mockWonAuctions as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);

      // Act
      const result = await getUserWonAuctions(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result[0].rating).toBeNull();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserWonAuctionsCount", () => {
    test("should return correct count of won auctions", async () => {
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

    test("should return 0 when no won auctions found", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(0);

      // Act
      const result = await getUserWonAuctionsCount(testUserId);

      // Assert
      expect(result).toBe(0);
    });

    test("should handle wonStatus filter correctly in count", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(3);

      // Act
      await getUserWonAuctionsCount(testUserId, "completed");

      // Assert
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
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserWonAuctionsWithCount", () => {
    test("should return won auctions with count successfully", async () => {
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
          reviews: [{ rating: 4 }],
        },
      ];

      prismaMock.auction.findMany.mockResolvedValue(mockWonAuctions as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(3);

      // Act
      const result = await getUserWonAuctionsWithCount(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.count).toBe(3);
      expect(result.data[0]).toStrictEqual({
        auctionId: "auction-1",
        currentHighestBid: 1500,
        auctionEndTime: new Date("2024-01-02"),
        auctionCreatedAt: new Date("2024-01-01"),
        taskId: "task-1",
        taskName: "Test Won Task 1",
        taskStatus: TaskStatus.AUCTION_ENDED,
        deliveryMethod: "online",
        rating: 4,
      });
    });

    test("should handle wonStatus filter in count", async () => {
      // Arrange

      prismaMock.auction.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(2);

      // Act
      const result = await getUserWonAuctionsWithCount(testPage, testUserId, testItemPerPage, "completed");

      // Assert
      expect(result.count).toBe(2);
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
      prismaMock.auction.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(3);

      // Act
      const result = await getUserWonAuctionsWithCount(testPage, testUserId, testItemPerPage, "incomplete");

      // Assert
      expect(result.count).toBe(3);
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

    test("should handle default wonStatus (no filter)", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(4);

      // Act
      const result = await getUserWonAuctionsWithCount(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result.count).toBe(4);
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
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserCreatedAuctionsCount", () => {
    test("should return correct count of created auctions", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(7);

      // Act
      const result = await getUserCreatedAuctionsCount(testUserId, [], "and");

      // Assert
      expect(result).toBe(7);
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: {
          task: {
            OR: [{ creatorId: testUserId }, { executors: { some: { userId: testUserId } } }, { reporters: { some: { userId: testUserId } } }],
          },
        },
      });
    });

    test("should handle filter conditions correctly", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(3);
      const filters: AuctionCreatedTabFilter[] = ["creator", "active"];

      // Act
      await getUserCreatedAuctionsCount(testUserId, filters, "or");

      // Assert
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              task: {
                OR: [{ creatorId: testUserId }],
              },
            },
            {
              task: {
                status: {
                  in: [TaskStatus.AUCTION_ACTIVE],
                },
              },
            },
          ],
        },
      });
    });

    test("should handle multiple filter conditions with AND logic", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(2);
      const filters: AuctionCreatedTabFilter[] = ["creator", "executor", "pending", "supplier_done"];

      // Act
      await getUserCreatedAuctionsCount(testUserId, filters, "and");

      // Assert
      expect(prismaMock.auction.count).toHaveBeenCalledTimes(1);
      const callArgs = prismaMock.auction.count.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();

      if (callArgs?.where && "AND" in callArgs.where) {
        const andConditions = callArgs.where.AND as Array<Record<string, unknown>>;
        expect(andConditions).toHaveLength(2);
      }
    });

    test("should handle single role filter condition", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(1);
      const filters: AuctionCreatedTabFilter[] = ["executor"];

      // Act
      await getUserCreatedAuctionsCount(testUserId, filters, "and");

      // Assert
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: {
          task: {
            AND: [{ executors: { some: { userId: testUserId } } }],
          },
        },
      });
    });

    test("should handle single status filter condition", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(1);
      const filters: AuctionCreatedTabFilter[] = ["pending"];

      // Act
      await getUserCreatedAuctionsCount(testUserId, filters, "and");

      // Assert
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              task: {
                OR: [{ creatorId: testUserId }, { executors: { some: { userId: testUserId } } }, { reporters: { some: { userId: testUserId } } }],
              },
            },
            {
              task: {
                status: {
                  in: [TaskStatus.PENDING],
                },
              },
            },
          ],
        },
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserCreatedAuctionsWithCount", () => {
    test("should return created auctions with count successfully", async () => {
      // Arrange
      const mockCreatedAuctions = [
        {
          id: "auction-1",
          currentHighestBid: 2000,
          endTime: new Date("2024-01-03"),
          createdAt: new Date("2024-01-01"),
          task: {
            id: "task-1",
            task: "Test Created Task 1",
            status: TaskStatus.AUCTION_ACTIVE,
            deliveryMethod: "online",
            creator: { id: testUserId },
            executors: [{ userId: testUserId }],
            reporters: [{ userId: "reporter-1" }],
          },
          winner: {
            id: "winner-1",
            name: "Winner Name",
          },
        },
      ];

      prismaMock.auction.findMany.mockResolvedValue(mockCreatedAuctions as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(5);

      // Act
      const result = await getUserCreatedAuctionsWithCount(testPage, testUserId, testItemPerPage, [], "and");

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.count).toBe(5);
      expect(result.data[0]).toStrictEqual({
        auctionId: "auction-1",
        currentHighestBid: 2000,
        auctionEndTime: new Date("2024-01-03"),
        taskStatus: TaskStatus.AUCTION_ACTIVE,
        auctionCreatedAt: new Date("2024-01-01"),
        taskId: "task-1",
        taskName: "Test Created Task 1",
        deliveryMethod: "online",
        winnerId: "winner-1",
        winnerName: "Winner Name",
        isCreator: true,
        isExecutor: true,
        isReporter: false,
        taskRole: ["SUPPLIER", "EXECUTOR"],
      });
    });

    test("should return empty data and zero count when no created auctions", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(0);

      // Act
      const result = await getUserCreatedAuctionsWithCount(testPage, testUserId, testItemPerPage, [], "and");

      // Assert
      expect(result.data).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle filter conditions in created auctions", async () => {
      // Arrange
      const filters: AuctionCreatedTabFilter[] = ["ended"];
      prismaMock.auction.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(0);

      // Act
      await getUserCreatedAuctionsWithCount(testPage, testUserId, testItemPerPage, filters, "and");

      // Assert
      expect(prismaMock.auction.findMany).toHaveBeenCalledTimes(1);
      const callArgs = prismaMock.auction.findMany.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();

      if (callArgs?.where && "AND" in callArgs.where) {
        const andConditions = callArgs.where.AND as Array<Record<string, unknown>>;
        expect(andConditions).toHaveLength(2);

        // タスクロール条件の確認
        const roleCondition = andConditions.find((condition) => "task" in condition && "OR" in (condition.task as Record<string, unknown>));
        expect(roleCondition).toBeDefined();

        // ステータス条件の確認
        const statusCondition = andConditions.find((condition) => "task" in condition && "status" in (condition.task as Record<string, unknown>));
        expect(statusCondition).toBeDefined();

        if (statusCondition && "task" in statusCondition) {
          const taskCondition = statusCondition.task as Record<string, unknown>;
          if ("status" in taskCondition) {
            const statusObj = taskCondition.status as Record<string, unknown>;
            if ("in" in statusObj) {
              const statusArray = statusObj.in as TaskStatus[];
              expect(statusArray).toContain(TaskStatus.AUCTION_ENDED);
            }
          }
        }
      }
    });
  });
});
