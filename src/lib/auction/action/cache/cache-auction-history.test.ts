import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象の関数をインポート
import { getCachedAuctionHistoryCreatedDetail } from "./cache-auction-history";

// Next.jsのキャッシュ機能をモック
vi.mock("next/cache", () => ({
  unstable_cacheTag: vi.fn(),
}));

// Prismaクエリ結果の型定義
type MockPrismaAuctionData = Prisma.AuctionGetPayload<{
  select: {
    id: true;
    currentHighestBid: true;
    startTime: true;
    endTime: true;
    task: {
      select: {
        id: true;
        task: true;
        detail: true;
        imageUrl: true;
        status: true;
        deliveryMethod: true;
        creatorId: true;
        executors: {
          select: {
            userId: true;
          };
        };
        reporters: {
          select: {
            userId: true;
          };
        };
      };
    };
    winner: {
      select: {
        id: true;
        name: true;
        image: true;
      };
    };
    winnerId: true;
    bidHistories: {
      select: {
        id: true;
        amount: true;
        isAutoBid: true;
        createdAt: true;
        user: {
          select: {
            id: true;
            name: true;
            image: true;
          };
        };
      };
    };
  };
}>;

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// テストデータの定義
const testAuctionId = "test-auction-id";
const testTaskId = "test-task-id";
const testUserId = "test-user-id";
const testCreatorId = "test-creator-id";
const testWinnerId = "test-winner-id";
const testBidHistoryId = "test-bid-history-id";

// Prismaクエリ結果のモックデータ
const mockPrismaAuctionData: MockPrismaAuctionData = {
  id: testAuctionId,
  currentHighestBid: 500,
  startTime: new Date("2024-01-01T00:00:00Z"),
  endTime: new Date("2024-12-31T23:59:59Z"),
  task: {
    id: testTaskId,
    task: "テストタスク",
    detail: "テストタスクの詳細",
    imageUrl: "https://example.com/image.jpg",
    status: TaskStatus.PENDING,
    deliveryMethod: "オンライン",
    creatorId: testCreatorId,
    executors: [
      {
        userId: testUserId,
      },
    ],
    reporters: [
      {
        userId: testUserId,
      },
    ],
  },
  winner: {
    id: testWinnerId,
    name: "落札者",
    image: "https://example.com/winner.jpg",
  },
  winnerId: testWinnerId,
  bidHistories: [
    {
      id: testBidHistoryId,
      amount: 500,
      isAutoBid: false,
      createdAt: new Date("2024-01-01T12:00:00Z"),
      user: {
        id: testUserId,
        name: "テストユーザー",
        image: "https://example.com/user.jpg",
      },
    },
  ],
};

const mockExpectedResult = {
  id: testAuctionId,
  currentHighestBid: 500,
  startTime: new Date("2024-01-01T00:00:00Z"),
  endTime: new Date("2024-12-31T23:59:59Z"),
  status: TaskStatus.PENDING,
  task: {
    id: testTaskId,
    task: "テストタスク",
    detail: "テストタスクの詳細",
    imageUrl: "https://example.com/image.jpg",
    status: TaskStatus.PENDING,
    deliveryMethod: "オンライン",
    creatorId: testCreatorId,
    executors: [
      {
        userId: testUserId,
      },
    ],
    reporters: [
      {
        userId: testUserId,
      },
    ],
  },
  winner: {
    id: testWinnerId,
    name: "落札者",
    image: "https://example.com/winner.jpg",
  },
  winnerId: testWinnerId,
  bidHistories: [
    {
      id: testBidHistoryId,
      amount: 500,
      isAutoBid: false,
      createdAt: new Date("2024-01-01T12:00:00Z"),
      user: {
        id: testUserId,
        name: "テストユーザー",
        image: "https://example.com/user.jpg",
      },
    },
  ],
};

describe("cache-auction-history", () => {
  describe("getCachedAuctionHistoryCreatedDetail", () => {
    test("should return auction history detail successfully", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(
        mockPrismaAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result).toStrictEqual(mockExpectedResult);
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: testAuctionId,
        },
        select: {
          id: true,
          currentHighestBid: true,
          startTime: true,
          endTime: true,
          task: {
            select: {
              id: true,
              task: true,
              detail: true,
              imageUrl: true,
              status: true,
              deliveryMethod: true,
              creatorId: true,
              executors: {
                select: {
                  userId: true,
                },
              },
              reporters: {
                select: {
                  userId: true,
                },
              },
            },
          },
          winner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          winnerId: true,
          bidHistories: {
            orderBy: {
              amount: "desc",
            },
            take: 100,
            select: {
              id: true,
              amount: true,
              isAutoBid: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      });
    });

    test("should return null when auction is not found", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail("non-existent-id");

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: "non-existent-id",
        },
        select: {
          id: true,
          currentHighestBid: true,
          startTime: true,
          endTime: true,
          task: {
            select: {
              id: true,
              task: true,
              detail: true,
              imageUrl: true,
              status: true,
              deliveryMethod: true,
              creatorId: true,
              executors: {
                select: {
                  userId: true,
                },
              },
              reporters: {
                select: {
                  userId: true,
                },
              },
            },
          },
          winner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          winnerId: true,
          bidHistories: {
            orderBy: {
              amount: "desc",
            },
            take: 100,
            select: {
              id: true,
              amount: true,
              isAutoBid: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      });
    });

    test("should handle auction with null winner", async () => {
      // Arrange
      const mockDataWithNullWinner: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        winner: null,
        winnerId: null,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithNullWinner as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        ...mockExpectedResult,
        winner: null,
        winnerId: null,
      });
    });

    test("should handle auction with empty bid histories", async () => {
      // Arrange
      const mockDataWithEmptyBids: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        bidHistories: [],
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithEmptyBids as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        ...mockExpectedResult,
        bidHistories: [],
      });
    });

    test("should handle auction with null task detail", async () => {
      // Arrange
      const mockDataWithNullDetail: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        task: {
          ...mockPrismaAuctionData.task,
          detail: null,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithNullDetail as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        ...mockExpectedResult,
        task: {
          ...mockExpectedResult.task,
          detail: null,
        },
      });
    });

    test("should handle auction with null task imageUrl", async () => {
      // Arrange
      const mockDataWithNullImage: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        task: {
          ...mockPrismaAuctionData.task,
          imageUrl: null,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithNullImage as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        ...mockExpectedResult,
        task: {
          ...mockExpectedResult.task,
          imageUrl: null,
        },
      });
    });

    test("should handle auction with null deliveryMethod", async () => {
      // Arrange
      const mockDataWithNullDelivery: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        task: {
          ...mockPrismaAuctionData.task,
          deliveryMethod: null,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithNullDelivery as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        ...mockExpectedResult,
        task: {
          ...mockExpectedResult.task,
          deliveryMethod: null,
        },
      });
    });

    test("should handle auction with empty executors", async () => {
      // Arrange
      const mockDataWithEmptyExecutors: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        task: {
          ...mockPrismaAuctionData.task,
          executors: [],
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithEmptyExecutors as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.task.id).toBe(testTaskId);
    });

    test("should handle auction with empty reporters", async () => {
      // Arrange
      const mockDataWithEmptyReporters: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        task: {
          ...mockPrismaAuctionData.task,
          reporters: [],
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithEmptyReporters as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.task.id).toBe(testTaskId);
    });

    test("should handle auction with multiple bid histories", async () => {
      // Arrange
      const multipleBidHistories = [
        {
          id: "bid-1",
          amount: 1000,
          isAutoBid: true,
          createdAt: new Date("2024-01-02T12:00:00Z"),
          user: {
            id: "user-1",
            name: "ユーザー1",
            image: "https://example.com/user1.jpg",
          },
        },
        {
          id: "bid-2",
          amount: 500,
          isAutoBid: false,
          createdAt: new Date("2024-01-01T12:00:00Z"),
          user: {
            id: "user-2",
            name: "ユーザー2",
            image: "https://example.com/user2.jpg",
          },
        },
      ];
      const mockDataWithMultipleBids: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        bidHistories: multipleBidHistories,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithMultipleBids as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result?.bidHistories).toHaveLength(2);
      expect(result?.bidHistories[0].amount).toBe(1000);
      expect(result?.bidHistories[1].amount).toBe(500);
    });

    test("should handle auction with different task status", async () => {
      // Arrange
      const mockDataWithCompletedStatus: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        task: {
          ...mockPrismaAuctionData.task,
          status: TaskStatus.TASK_COMPLETED,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithCompletedStatus as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result?.task.status).toBe(TaskStatus.TASK_COMPLETED);
    });

    test("should handle auction with null user names in bid histories", async () => {
      // Arrange
      const mockDataWithNullUserNames: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        bidHistories: [
          {
            id: testBidHistoryId,
            amount: 500,
            isAutoBid: false,
            createdAt: new Date("2024-01-01T12:00:00Z"),
            user: {
              id: testUserId,
              name: null,
              image: null,
            },
          },
        ],
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithNullUserNames as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result?.bidHistories[0].user.name).toBeNull();
      expect(result?.bidHistories[0].user.image).toBeNull();
    });

    test("should handle auction with null winner name and image", async () => {
      // Arrange
      const mockDataWithNullWinnerInfo: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        winner: {
          id: testWinnerId,
          name: null,
          image: null,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithNullWinnerInfo as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result?.winner?.name).toBeNull();
      expect(result?.winner?.image).toBeNull();
    });

    test("should handle database error gracefully", async () => {
      // Arrange
      const error = new Error("Database connection error");
      prismaMock.auction.findUnique.mockRejectedValue(error);

      // Act & Assert
      await expect(getCachedAuctionHistoryCreatedDetail(testAuctionId)).rejects.toThrow("Database connection error");
    });

    test("should handle empty string auctionId", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail("");

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: "",
        } as unknown as Prisma.AuctionWhereInput,
        select: expect.objectContaining({
          id: true,
          currentHighestBid: true,
          startTime: true,
          endTime: true,
        }) as unknown as Prisma.AuctionSelect,
      });
    });

    test("should handle null auctionId parameter", async () => {
      // Arrange
      const nullAuctionId: string = null as unknown as string;
      prismaMock.auction.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(nullAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: nullAuctionId,
        } as unknown as Prisma.AuctionWhereInput,
        select: expect.objectContaining({
          id: true,
          currentHighestBid: true,
          startTime: true,
          endTime: true,
        }) as unknown as Prisma.AuctionSelect,
      });
    });

    test("should handle undefined auctionId parameter", async () => {
      // Arrange
      const undefinedAuctionId: string = undefined as unknown as string;
      prismaMock.auction.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(undefinedAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: undefinedAuctionId,
        } as unknown as Prisma.AuctionWhereInput,
        select: expect.objectContaining({
          id: true,
          currentHighestBid: true,
          startTime: true,
          endTime: true,
        }) as unknown as Prisma.AuctionSelect,
      });
    });

    test("should handle very long auctionId string", async () => {
      // Arrange
      const longAuctionId = "a".repeat(1000);
      prismaMock.auction.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(longAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: longAuctionId,
        } as unknown as Prisma.AuctionWhereInput,
        select: expect.objectContaining({
          id: true,
          currentHighestBid: true,
          startTime: true,
          endTime: true,
        }) as unknown as Prisma.AuctionSelect,
      });
    });

    test("should handle special characters in auctionId", async () => {
      // Arrange
      const specialCharAuctionId = "!@#$%^&*()";
      prismaMock.auction.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(specialCharAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: specialCharAuctionId,
        } as unknown as Prisma.AuctionWhereInput,
        select: expect.objectContaining({
          id: true,
          currentHighestBid: true,
          startTime: true,
          endTime: true,
        }) as unknown as Prisma.AuctionSelect,
      });
    });

    test("should call cacheTag with correct parameter when auction is found", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(
        mockPrismaAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );
      const { unstable_cacheTag } = await import("next/cache");

      // Act
      await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(vi.mocked(unstable_cacheTag)).toHaveBeenCalledWith(`auction-history-created-detail:${testTaskId}`);
    });

    test("should not call cacheTag when auction is not found", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );
      const { unstable_cacheTag } = await import("next/cache");

      // Act
      await getCachedAuctionHistoryCreatedDetail("non-existent-id");

      // Assert
      expect(vi.mocked(unstable_cacheTag)).not.toHaveBeenCalled();
    });
  });

  // 境界値テスト
  describe("boundary value tests", () => {
    test("should handle zero currentHighestBid", async () => {
      // Arrange
      const mockDataWithZeroBid: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        currentHighestBid: 0,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithZeroBid as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result?.currentHighestBid).toBe(0);
    });

    test("should handle maximum integer currentHighestBid", async () => {
      // Arrange
      const maxBid = Number.MAX_SAFE_INTEGER;
      const mockDataWithMaxBid: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        currentHighestBid: maxBid,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithMaxBid as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result?.currentHighestBid).toBe(maxBid);
    });

    test("should handle past dates for auction times", async () => {
      // Arrange
      const pastDate = new Date("2020-01-01T00:00:00Z");
      const mockDataWithPastDates: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        startTime: pastDate,
        endTime: pastDate,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithPastDates as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result?.startTime).toStrictEqual(pastDate);
      expect(result?.endTime).toStrictEqual(pastDate);
    });

    test("should handle future dates for auction times", async () => {
      // Arrange
      const futureDate = new Date("2030-12-31T23:59:59Z");
      const mockDataWithFutureDates: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        startTime: futureDate,
        endTime: futureDate,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithFutureDates as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result?.startTime).toStrictEqual(futureDate);
      expect(result?.endTime).toStrictEqual(futureDate);
    });

    test("should handle exactly 100 bid histories (limit)", async () => {
      // Arrange
      const exactlyHundredBids = Array.from({ length: 100 }, (_, index) => ({
        id: `bid-${index}`,
        amount: 100 + index,
        isAutoBid: index % 2 === 0,
        createdAt: new Date(`2024-01-${String(index + 1).padStart(2, "0")}T12:00:00Z`),
        user: {
          id: `user-${index}`,
          name: `ユーザー${index}`,
          image: `https://example.com/user${index}.jpg`,
        },
      }));
      const mockDataWithHundredBids: MockPrismaAuctionData = {
        ...mockPrismaAuctionData,
        bidHistories: exactlyHundredBids,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockDataWithHundredBids as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testAuctionId);

      // Assert
      expect(result?.bidHistories).toHaveLength(100);
    });
  });

  // 異常系テスト（不正な引数）
  describe("invalid input tests", () => {
    test("should handle non-string auctionId parameter", async () => {
      // Arrange
      const nonStringAuctionId: string = 123 as unknown as string;
      prismaMock.auction.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(nonStringAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: nonStringAuctionId,
        } as unknown as Prisma.AuctionWhereInput,
        select: expect.objectContaining({
          id: true,
          currentHighestBid: true,
          startTime: true,
          endTime: true,
        }) as unknown as Prisma.AuctionSelect,
      });
    });

    test("should handle boolean auctionId parameter", async () => {
      // Arrange
      const booleanAuctionId: string = true as unknown as string;
      prismaMock.auction.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(booleanAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: booleanAuctionId,
        } as unknown as Prisma.AuctionWhereInput,
        select: expect.objectContaining({
          id: true,
          currentHighestBid: true,
          startTime: true,
          endTime: true,
        }) as unknown as Prisma.AuctionSelect,
      });
    });

    test("should handle object auctionId parameter", async () => {
      // Arrange
      const objectAuctionId: string = { id: "test" } as unknown as string;
      prismaMock.auction.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(objectAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: objectAuctionId,
        } as unknown as Prisma.AuctionWhereInput,
        select: expect.objectContaining({
          id: true,
          currentHighestBid: true,
          startTime: true,
          endTime: true,
        }) as unknown as Prisma.AuctionSelect,
      });
    });

    test("should handle array auctionId parameter", async () => {
      // Arrange
      const arrayAuctionId: string = ["test"] as unknown as string;
      prismaMock.auction.findUnique.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(arrayAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: arrayAuctionId,
        } as unknown as Prisma.AuctionWhereInput,
        select: expect.objectContaining({
          id: true,
          currentHighestBid: true,
          startTime: true,
          endTime: true,
        }) as unknown as Prisma.AuctionSelect,
      });
    });
  });
});
