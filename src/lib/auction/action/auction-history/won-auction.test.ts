import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { ReviewPosition, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserWonAuctions, getUserWonAuctionsCount, getUserWonAuctionsWithCount } from "./won-auction";

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
});
