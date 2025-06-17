import type { AuctionCreatedTabFilter, FilterCondition } from "@/types/auction-types";
import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserCreatedAuctions, getUserCreatedAuctionsCount, getUserCreatedAuctionsWhereCondition } from "./created-auction";

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

describe("created-auction", () => {
  describe("getUserCreatedAuctionsWhereCondition", () => {
    test("should throw error when userId is missing", async () => {
      // Act & Assert
      await expect(getUserCreatedAuctionsWhereCondition("", [], "and")).rejects.toThrow("userId, filter, and filterCondition are required");
    });

    test("should throw error when filter is null", async () => {
      // Act & Assert
      await expect(getUserCreatedAuctionsWhereCondition(testUserId, null as unknown as AuctionCreatedTabFilter[], "and")).rejects.toThrow(
        "userId, filter, and filterCondition are required",
      );
    });

    test("should throw error when filterCondition is null", async () => {
      // Act & Assert
      await expect(getUserCreatedAuctionsWhereCondition(testUserId, [], null as unknown as FilterCondition)).rejects.toThrow(
        "userId, filter, and filterCondition are required",
      );
    });

    test("should return default role condition when filter is empty", async () => {
      // Act
      const result = await getUserCreatedAuctionsWhereCondition(testUserId, [], "and");

      // Assert
      expect(result).toStrictEqual({
        task: {
          OR: [{ creatorId: testUserId }, { executors: { some: { userId: testUserId } } }, { reporters: { some: { userId: testUserId } } }],
        },
      });
    });

    test("should handle creator filter with AND condition", async () => {
      // Act
      const result = await getUserCreatedAuctionsWhereCondition(testUserId, ["creator"], "and");

      // Assert
      expect(result).toStrictEqual({
        task: { AND: [{ creatorId: testUserId }] },
      });
    });

    test("should handle multiple role filters with AND condition", async () => {
      // Act
      const result = await getUserCreatedAuctionsWhereCondition(testUserId, ["creator", "executor"], "and");

      // Assert
      expect(result).toStrictEqual({
        task: {
          AND: [{ creatorId: testUserId }, { executors: { some: { userId: testUserId } } }],
        },
      });
    });

    test("should handle multiple role filters with OR condition", async () => {
      // Act
      const result = await getUserCreatedAuctionsWhereCondition(testUserId, ["creator", "executor"], "or");

      // Assert
      expect(result).toStrictEqual({
        task: {
          OR: [{ creatorId: testUserId }, { executors: { some: { userId: testUserId } } }],
        },
      });
    });

    test("should handle status filter active", async () => {
      // Act
      const result = await getUserCreatedAuctionsWhereCondition(testUserId, ["active"], "and");

      // Assert
      expect(result).toStrictEqual({
        AND: [
          {
            task: {
              OR: [{ creatorId: testUserId }, { executors: { some: { userId: testUserId } } }, { reporters: { some: { userId: testUserId } } }],
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
      });
    });

    test("should handle status filter ended", async () => {
      // Act
      const result = await getUserCreatedAuctionsWhereCondition(testUserId, ["ended"], "and");

      // Assert
      expect(result).toStrictEqual({
        AND: [
          {
            task: {
              OR: [{ creatorId: testUserId }, { executors: { some: { userId: testUserId } } }, { reporters: { some: { userId: testUserId } } }],
            },
          },
          {
            task: {
              status: {
                in: [TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED],
              },
            },
          },
        ],
      });
    });

    test("should handle status filter pending", async () => {
      // Act
      const result = await getUserCreatedAuctionsWhereCondition(testUserId, ["pending"], "and");

      // Assert
      expect(result).toStrictEqual({
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
      });
    });

    test("should handle status filter supplier_done", async () => {
      // Act
      const result = await getUserCreatedAuctionsWhereCondition(testUserId, ["supplier_done"], "and");

      // Assert
      expect(result).toStrictEqual({
        AND: [
          {
            task: {
              OR: [{ creatorId: testUserId }, { executors: { some: { userId: testUserId } } }, { reporters: { some: { userId: testUserId } } }],
            },
          },
          {
            task: {
              status: {
                in: [TaskStatus.SUPPLIER_DONE, TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED],
              },
            },
          },
        ],
      });
    });

    test("should handle multiple status filters", async () => {
      // Act
      const result = await getUserCreatedAuctionsWhereCondition(testUserId, ["active", "ended"], "and");

      // Assert
      expect(result).toStrictEqual({
        AND: [
          {
            task: {
              OR: [{ creatorId: testUserId }, { executors: { some: { userId: testUserId } } }, { reporters: { some: { userId: testUserId } } }],
            },
          },
          {
            task: {
              status: {
                in: [TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED],
              },
            },
          },
        ],
      });
    });

    test("should handle role and status filters with OR condition", async () => {
      // Act
      const result = await getUserCreatedAuctionsWhereCondition(testUserId, ["creator", "active"], "or");

      // Assert
      expect(result).toStrictEqual({
        OR: [
          {
            task: { OR: [{ creatorId: testUserId }] },
          },
          {
            task: {
              status: {
                in: [TaskStatus.AUCTION_ACTIVE],
              },
            },
          },
        ],
      });
    });

    test("should handle all filter types", async () => {
      // Act
      const result = await getUserCreatedAuctionsWhereCondition(
        testUserId,
        ["creator", "executor", "reporter", "active", "ended", "pending", "supplier_done"],
        "and",
      );

      // Assert
      expect(result).toStrictEqual({
        AND: [
          {
            task: {
              AND: [{ creatorId: testUserId }, { executors: { some: { userId: testUserId } } }, { reporters: { some: { userId: testUserId } } }],
            },
          },
          {
            task: {
              status: {
                in: [
                  TaskStatus.AUCTION_ACTIVE,
                  TaskStatus.AUCTION_ENDED,
                  TaskStatus.POINTS_DEPOSITED,
                  TaskStatus.PENDING,
                  TaskStatus.SUPPLIER_DONE,
                  TaskStatus.TASK_COMPLETED,
                  TaskStatus.FIXED_EVALUATED,
                  TaskStatus.POINTS_AWARDED,
                ],
              },
            },
          },
        ],
      });
    });
  });

  describe("getUserCreatedAuctions", () => {
    test("should throw error when userId is missing", async () => {
      // Act & Assert
      await expect(getUserCreatedAuctions(testPage, "", testItemPerPage, [], "and")).rejects.toThrow(
        "userId, itemPerPage, page, filter, and filterCondition are required",
      );
    });

    test("should throw error when itemPerPage is 0", async () => {
      // Act & Assert
      await expect(getUserCreatedAuctions(testPage, testUserId, 0, [], "and")).rejects.toThrow(
        "userId, itemPerPage, page, filter, and filterCondition are required",
      );
    });

    test("should throw error when page is 0", async () => {
      // Act & Assert
      await expect(getUserCreatedAuctions(0, testUserId, testItemPerPage, [], "and")).rejects.toThrow(
        "userId, itemPerPage, page, filter, and filterCondition are required",
      );
    });

    test("should throw error when filter is null", async () => {
      // Act & Assert
      await expect(
        getUserCreatedAuctions(testPage, testUserId, testItemPerPage, null as unknown as AuctionCreatedTabFilter[], "and"),
      ).rejects.toThrow("userId, itemPerPage, page, filter, and filterCondition are required");
    });

    test("should throw error when filterCondition is null", async () => {
      // Act & Assert
      await expect(getUserCreatedAuctions(testPage, testUserId, testItemPerPage, [], null as unknown as FilterCondition)).rejects.toThrow(
        "userId, itemPerPage, page, filter, and filterCondition are required",
      );
    });

    test("should return empty array when no auctions found", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([]);

      // Act
      const result = await getUserCreatedAuctions(testPage, testUserId, testItemPerPage, [], "and");

      // Assert
      expect(result).toStrictEqual([]);
    });

    test("should return formatted auction data successfully", async () => {
      // Arrange
      const mockAuctionData = [
        {
          id: "auction-1",
          currentHighestBid: 2000,
          endTime: new Date("2024-01-03"),
          createdAt: new Date("2024-01-01"),
          task: {
            id: "task-1",
            task: "Test Task 1",
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

      prismaMock.auction.findMany.mockResolvedValue(mockAuctionData as never);

      // Act
      const result = await getUserCreatedAuctions(testPage, testUserId, testItemPerPage, [], "and");

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        auctionId: "auction-1",
        currentHighestBid: 2000,
        auctionEndTime: new Date("2024-01-03"),
        auctionCreatedAt: new Date("2024-01-01"),
        taskId: "task-1",
        taskName: "Test Task 1",
        taskStatus: TaskStatus.AUCTION_ACTIVE,
        deliveryMethod: "online",
        winnerId: "winner-1",
        winnerName: "Winner Name",
        isCreator: true,
        isExecutor: true,
        isReporter: false,
        taskRole: ["SUPPLIER", "EXECUTOR"],
      });
    });

    test("should handle auction with no winner", async () => {
      // Arrange
      const mockAuctionData = [
        {
          id: "auction-1",
          currentHighestBid: 1000,
          endTime: new Date("2024-01-03"),
          createdAt: new Date("2024-01-01"),
          task: {
            id: "task-1",
            task: "Test Task 1",
            status: TaskStatus.AUCTION_ACTIVE,
            deliveryMethod: "online",
            creator: { id: "other-user" },
            executors: [],
            reporters: [{ userId: testUserId }],
          },
          winner: null,
        },
      ];

      prismaMock.auction.findMany.mockResolvedValue(mockAuctionData as never);

      // Act
      const result = await getUserCreatedAuctions(testPage, testUserId, testItemPerPage, [], "and");

      // Assert
      expect(result[0]).toStrictEqual({
        auctionId: "auction-1",
        currentHighestBid: 1000,
        auctionEndTime: new Date("2024-01-03"),
        auctionCreatedAt: new Date("2024-01-01"),
        taskId: "task-1",
        taskName: "Test Task 1",
        taskStatus: TaskStatus.AUCTION_ACTIVE,
        deliveryMethod: "online",
        winnerId: null,
        winnerName: null,
        isCreator: false,
        isExecutor: false,
        isReporter: true,
        taskRole: ["REPORTER"],
      });
    });

    test("should handle multiple task roles correctly", async () => {
      // Arrange
      const mockAuctionData = [
        {
          id: "auction-1",
          currentHighestBid: 1500,
          endTime: new Date("2024-01-03"),
          createdAt: new Date("2024-01-01"),
          task: {
            id: "task-1",
            task: "Test Task 1",
            status: TaskStatus.AUCTION_ACTIVE,
            deliveryMethod: "online",
            creator: { id: testUserId },
            executors: [{ userId: testUserId }],
            reporters: [{ userId: testUserId }],
          },
          winner: null,
        },
      ];

      prismaMock.auction.findMany.mockResolvedValue(mockAuctionData as never);

      // Act
      const result = await getUserCreatedAuctions(testPage, testUserId, testItemPerPage, [], "and");

      // Assert
      expect(result[0].taskRole).toStrictEqual(["SUPPLIER", "EXECUTOR", "REPORTER"]);
      expect(result[0].isCreator).toBe(true);
      expect(result[0].isExecutor).toBe(true);
      expect(result[0].isReporter).toBe(true);
    });

    test("should handle pagination parameters correctly", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([]);

      // Act
      await getUserCreatedAuctions(2, testUserId, 5, [], "and");

      // Assert
      expect(prismaMock.auction.findMany).toHaveBeenCalledWith({
        where: expect.any(Object) as Prisma.AuctionWhereInput,
        orderBy: { createdAt: "desc" },
        skip: 5, // (page - 1) * itemPerPage = (2 - 1) * 5
        take: 5,
        select: expect.any(Object) as Prisma.AuctionSelect,
      });
    });
  });

  describe("getUserCreatedAuctionsCount", () => {
    test("should throw error when userId is missing", async () => {
      // Act & Assert
      await expect(getUserCreatedAuctionsCount("", [], "and")).rejects.toThrow("userId, filter, and filterCondition are required");
    });

    test("should throw error when filter is null", async () => {
      // Act & Assert
      await expect(getUserCreatedAuctionsCount(testUserId, null as unknown as AuctionCreatedTabFilter[], "and")).rejects.toThrow(
        "userId, filter, and filterCondition are required",
      );
    });

    test("should throw error when filterCondition is null", async () => {
      // Act & Assert
      await expect(getUserCreatedAuctionsCount(testUserId, [], null as unknown as FilterCondition)).rejects.toThrow(
        "userId, filter, and filterCondition are required",
      );
    });

    test("should return 0 when no auctions found", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(0);

      // Act
      const result = await getUserCreatedAuctionsCount(testUserId, [], "and");

      // Assert
      expect(result).toBe(0);
    });

    test("should return correct count when auctions exist", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(15);

      // Act
      const result = await getUserCreatedAuctionsCount(testUserId, [], "and");

      // Assert
      expect(result).toBe(15);
    });

    test("should call prisma count with correct parameters", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(10);

      // Act
      await getUserCreatedAuctionsCount(testUserId, ["active"], "and");

      // Assert
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          AND: expect.any(Array) as Prisma.AuctionWhereInput[],
        }) as Prisma.AuctionWhereInput,
      });
    });

    test("should handle different filter conditions", async () => {
      // Arrange
      prismaMock.auction.count.mockResolvedValue(5);

      // Act
      const result = await getUserCreatedAuctionsCount(testUserId, ["creator", "ended"], "or");

      // Assert
      expect(result).toBe(5);
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: expect.any(Array) as Prisma.AuctionWhereInput[],
        }) as Prisma.AuctionWhereInput,
      });
    });
  });
});
