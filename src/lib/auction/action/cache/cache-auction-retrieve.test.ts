import type { AuctionWithDetails } from "@/types/auction-types";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import {
  auctionFactory,
  bidHistoryFactory,
  groupFactory,
  taskFactory,
  userFactory,
  userSettingsFactory,
} from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象の関数をインポート
import { getCachedAuctionByAuctionId } from "./cache-auction-retrieve";

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// テストデータの定義
const testAuctionId = "test-auction-id";
const testUserId = "test-user-id";
const testGroupId = "test-group-id";
const testTaskId = "test-task-id";

// 共通のテストデータ
const mockUser = userFactory.build({
  id: testUserId,
  name: "テストユーザー",
  email: "test@example.com",
});

const mockUserSettings = userSettingsFactory.build({
  id: "test-user-settings-id",
  userId: testUserId,
  username: "テストユーザー名",
});

const mockGroup = groupFactory.build({
  id: testGroupId,
  name: "テストグループ",
  goal: "テストグループの目標",
  depositPeriod: 7,
  createdBy: testUserId,
  evaluationMethod: "自動評価",
});

const mockTask = taskFactory.build({
  id: testTaskId,
  task: "テストタスク",
  detail: "テストタスクの詳細",
  imageUrl: "https://example.com/image.jpg",
  status: TaskStatus.PENDING,
  category: "プログラミング",
  groupId: testGroupId,
  creatorId: testUserId,
});

const mockBidHistory = bidHistoryFactory.build({
  id: "test-bid-history-id",
  amount: 500,
  auctionId: testAuctionId,
  userId: testUserId,
  isAutoBid: false,
  createdAt: new Date("2024-01-01T12:00:00Z"),
});

const mockAuction = auctionFactory.build({
  id: testAuctionId,
  startTime: new Date("2024-01-01T00:00:00Z"),
  endTime: new Date("2024-12-31T23:59:59Z"),
  currentHighestBid: 500,
  currentHighestBidderId: testUserId,
  extensionTotalCount: 0,
  extensionLimitCount: 3,
  extensionTime: 10,
  remainingTimeForExtension: 5,
  groupId: testGroupId,
  taskId: testTaskId,
});

// Prismaクエリの戻り値のモック
const mockPrismaAuctionResult = {
  id: mockAuction.id,
  startTime: mockAuction.startTime,
  endTime: mockAuction.endTime,
  currentHighestBid: mockAuction.currentHighestBid,
  currentHighestBidderId: mockAuction.currentHighestBidderId,
  extensionTotalCount: mockAuction.extensionTotalCount,
  extensionLimitCount: mockAuction.extensionLimitCount,
  extensionTime: mockAuction.extensionTime,
  remainingTimeForExtension: mockAuction.remainingTimeForExtension,
  bidHistories: [
    {
      id: mockBidHistory.id,
      amount: mockBidHistory.amount,
      createdAt: mockBidHistory.createdAt,
      isAutoBid: mockBidHistory.isAutoBid,
      user: {
        settings: {
          username: mockUserSettings.username,
        },
      },
    },
  ],
  task: {
    task: mockTask.task,
    detail: mockTask.detail,
    imageUrl: mockTask.imageUrl,
    status: mockTask.status,
    category: mockTask.category,
    group: {
      id: mockGroup.id,
      name: mockGroup.name,
      depositPeriod: mockGroup.depositPeriod,
    },
    creator: {
      id: mockUser.id,
      image: mockUser.image,
      settings: {
        username: mockUserSettings.username,
      },
    },
    executors: [
      {
        user: {
          id: testUserId,
          image: mockUser.image,
          settings: {
            username: mockUserSettings.username,
          },
        },
      },
    ],
    reporters: [
      {
        user: {
          id: testUserId,
          image: mockUser.image,
          settings: {
            username: mockUserSettings.username,
          },
        },
      },
    ],
  },
};

const expectedAuctionWithDetails: AuctionWithDetails = {
  id: mockAuction.id,
  startTime: mockAuction.startTime,
  endTime: mockAuction.endTime,
  currentHighestBid: mockAuction.currentHighestBid,
  currentHighestBidderId: mockAuction.currentHighestBidderId,
  status: mockTask.status, // task.statusがauction.statusとしてマージされる
  extensionTotalCount: mockAuction.extensionTotalCount,
  extensionLimitCount: mockAuction.extensionLimitCount,
  extensionTime: mockAuction.extensionTime,
  remainingTimeForExtension: mockAuction.remainingTimeForExtension,
  bidHistories: [
    {
      id: mockBidHistory.id,
      amount: mockBidHistory.amount,
      createdAt: mockBidHistory.createdAt,
      isAutoBid: mockBidHistory.isAutoBid,
      user: {
        settings: {
          username: mockUserSettings.username,
        },
      },
    },
  ],
  task: {
    task: mockTask.task,
    detail: mockTask.detail,
    imageUrl: mockTask.imageUrl,
    status: mockTask.status,
    category: mockTask.category,
    group: {
      id: mockGroup.id,
      name: mockGroup.name,
      depositPeriod: mockGroup.depositPeriod,
    },
    creator: {
      id: mockUser.id,
      image: mockUser.image,
      settings: {
        username: mockUserSettings.username,
      },
    },
    executors: [
      {
        user: {
          id: testUserId,
          image: mockUser.image,
          settings: {
            username: mockUserSettings.username,
          },
        },
      },
    ],
    reporters: [
      {
        user: {
          id: testUserId,
          image: mockUser.image,
          settings: {
            username: mockUserSettings.username,
          },
        },
      },
    ],
  },
};

describe("cache-auction-retrieve", () => {
  describe("getCachedAuctionByAuctionId", () => {
    test("should return auction details successfully", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(
        mockPrismaAuctionResult as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toStrictEqual(expectedAuctionWithDetails);
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: testAuctionId },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          currentHighestBid: true,
          currentHighestBidderId: true,
          extensionTotalCount: true,
          extensionLimitCount: true,
          extensionTime: true,
          remainingTimeForExtension: true,
          bidHistories: {
            select: {
              id: true,
              amount: true,
              createdAt: true,
              isAutoBid: true,
              user: {
                select: {
                  settings: {
                    select: {
                      username: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 26, // AUCTION_CONSTANTS.DISPLAY.BID_HISTORY_LIMIT + 1
          },
          task: {
            select: {
              task: true,
              detail: true,
              imageUrl: true,
              status: true,
              category: true,
              group: {
                select: {
                  id: true,
                  name: true,
                  depositPeriod: true,
                },
              },
              creator: {
                select: {
                  id: true,
                  image: true,
                  settings: {
                    select: {
                      username: true,
                    },
                  },
                },
              },
              executors: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      image: true,
                      settings: {
                        select: {
                          username: true,
                        },
                      },
                    },
                  },
                },
              },
              reporters: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      image: true,
                      settings: {
                        select: {
                          username: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      } as unknown as object);
      expect(prismaMock.auction.findUnique).toHaveBeenCalledTimes(1);
    });

    test("should return null when auction is not found", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: testAuctionId },
        select: expect.any(Object) as unknown as object,
      });
      expect(prismaMock.auction.findUnique).toHaveBeenCalledTimes(1);
    });

    test("should return null when auctionId is empty string", async () => {
      // Arrange
      const emptyAuctionId = "";

      // Act
      const result = await getCachedAuctionByAuctionId(emptyAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).not.toHaveBeenCalled();
    });

    test("should return null when auctionId is null", async () => {
      // Arrange
      const nullAuctionId = null as unknown as string;

      // Act
      const result = await getCachedAuctionByAuctionId(nullAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).not.toHaveBeenCalled();
    });

    test("should return null when auctionId is undefined", async () => {
      // Arrange
      const undefinedAuctionId = undefined as unknown as string;

      // Act
      const result = await getCachedAuctionByAuctionId(undefinedAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).not.toHaveBeenCalled();
    });

    test("should handle auction with empty bid histories", async () => {
      // Arrange
      const mockAuctionWithoutBids = {
        ...mockPrismaAuctionResult,
        bidHistories: [],
      };
      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionWithoutBids as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.bidHistories).toHaveLength(0);
      expect(result?.status).toBe(mockTask.status);
    });

    test("should handle auction with null currentHighestBidderId", async () => {
      // Arrange
      const mockAuctionWithNullBidder = {
        ...mockPrismaAuctionResult,
        currentHighestBidderId: null,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithNullBidder as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.currentHighestBidderId).toBeNull();
      expect(result?.status).toBe(mockTask.status);
    });

    test("should handle auction with different task status", async () => {
      // Arrange
      const mockAuctionWithActiveTask = {
        ...mockPrismaAuctionResult,
        task: {
          ...mockPrismaAuctionResult.task,
          status: TaskStatus.AUCTION_ACTIVE,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithActiveTask as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.status).toBe(TaskStatus.AUCTION_ACTIVE);
      expect(result?.task.status).toBe(TaskStatus.AUCTION_ACTIVE);
    });

    test("should handle auction with null task detail", async () => {
      // Arrange
      const mockAuctionWithNullDetail = {
        ...mockPrismaAuctionResult,
        task: {
          ...mockPrismaAuctionResult.task,
          detail: null,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithNullDetail as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.task.detail).toBeNull();
    });

    test("should handle auction with null task imageUrl", async () => {
      // Arrange
      const mockAuctionWithNullImage = {
        ...mockPrismaAuctionResult,
        task: {
          ...mockPrismaAuctionResult.task,
          imageUrl: null,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithNullImage as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.task.imageUrl).toBeNull();
    });

    test("should handle auction with null task category", async () => {
      // Arrange
      const mockAuctionWithNullCategory = {
        ...mockPrismaAuctionResult,
        task: {
          ...mockPrismaAuctionResult.task,
          category: null,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithNullCategory as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.task.category).toBeNull();
    });

    test("should handle auction with empty executors array", async () => {
      // Arrange
      const mockAuctionWithoutExecutors = {
        ...mockPrismaAuctionResult,
        task: {
          ...mockPrismaAuctionResult.task,
          executors: [],
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithoutExecutors as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.task.executors).toHaveLength(0);
    });

    test("should handle auction with empty reporters array", async () => {
      // Arrange
      const mockAuctionWithoutReporters = {
        ...mockPrismaAuctionResult,
        task: {
          ...mockPrismaAuctionResult.task,
          reporters: [],
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithoutReporters as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.task.reporters).toHaveLength(0);
    });

    test("should handle auction with null user settings", async () => {
      // Arrange
      const mockAuctionWithNullSettings = {
        ...mockPrismaAuctionResult,
        task: {
          ...mockPrismaAuctionResult.task,
          creator: {
            ...mockPrismaAuctionResult.task.creator,
            settings: null,
          },
        },
        bidHistories: [
          {
            ...mockPrismaAuctionResult.bidHistories[0],
            user: {
              settings: null,
            },
          },
        ],
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithNullSettings as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.task.creator.settings).toBeNull();
      expect(result?.bidHistories[0].user.settings).toBeNull();
    });

    test("should handle auction with null user image", async () => {
      // Arrange
      const mockAuctionWithNullImage = {
        ...mockPrismaAuctionResult,
        task: {
          ...mockPrismaAuctionResult.task,
          creator: {
            ...mockPrismaAuctionResult.task.creator,
            image: null,
          },
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithNullImage as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.task.creator.image).toBeNull();
    });

    test("should return null when database error occurs", async () => {
      // Arrange
      const mockError = new Error("Database connection error");
      prismaMock.auction.findUnique.mockRejectedValue(mockError);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: testAuctionId },
        select: expect.any(Object) as unknown as object,
      });
    });

    test("should handle auction with maximum extension count", async () => {
      // Arrange
      const mockAuctionWithMaxExtension = {
        ...mockPrismaAuctionResult,
        extensionTotalCount: 10,
        extensionLimitCount: 10,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithMaxExtension as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.extensionTotalCount).toBe(10);
      expect(result?.extensionLimitCount).toBe(10);
    });

    test("should handle auction with zero extension time", async () => {
      // Arrange
      const mockAuctionWithZeroExtension = {
        ...mockPrismaAuctionResult,
        extensionTime: 0,
        remainingTimeForExtension: 0,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithZeroExtension as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.extensionTime).toBe(0);
      expect(result?.remainingTimeForExtension).toBe(0);
    });

    test("should handle auction with zero current highest bid", async () => {
      // Arrange
      const mockAuctionWithZeroBid = {
        ...mockPrismaAuctionResult,
        currentHighestBid: 0,
      };
      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionWithZeroBid as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.currentHighestBid).toBe(0);
    });

    test("should handle auction with auto bid history", async () => {
      // Arrange
      const mockAuctionWithAutoBid = {
        ...mockPrismaAuctionResult,
        bidHistories: [
          {
            ...mockPrismaAuctionResult.bidHistories[0],
            isAutoBid: true,
          },
        ],
      };
      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionWithAutoBid as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.bidHistories[0].isAutoBid).toBe(true);
    });

    test("should handle auction with multiple bid histories", async () => {
      // Arrange
      const multipleBidHistories = [
        {
          id: "bid-1",
          amount: 500,
          createdAt: new Date("2024-01-01T12:00:00Z"),
          isAutoBid: false,
          user: {
            settings: {
              username: "ユーザー1",
            },
          },
        },
        {
          id: "bid-2",
          amount: 400,
          createdAt: new Date("2024-01-01T11:00:00Z"),
          isAutoBid: true,
          user: {
            settings: {
              username: "ユーザー2",
            },
          },
        },
      ];
      const mockAuctionWithMultipleBids = {
        ...mockPrismaAuctionResult,
        bidHistories: multipleBidHistories,
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithMultipleBids as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.bidHistories).toHaveLength(2);
      expect(result?.bidHistories[0].amount).toBe(500);
      expect(result?.bidHistories[1].amount).toBe(400);
      expect(result?.bidHistories[0].isAutoBid).toBe(false);
      expect(result?.bidHistories[1].isAutoBid).toBe(true);
    });

    test("should handle auction with null executor user", async () => {
      // Arrange
      const mockAuctionWithNullExecutorUser = {
        ...mockPrismaAuctionResult,
        task: {
          ...mockPrismaAuctionResult.task,
          executors: [
            {
              user: null,
            },
          ],
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithNullExecutorUser as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.task.executors[0].user).toBeNull();
    });

    test("should handle auction with null reporter user", async () => {
      // Arrange
      const mockAuctionWithNullReporterUser = {
        ...mockPrismaAuctionResult,
        task: {
          ...mockPrismaAuctionResult.task,
          reporters: [
            {
              user: null,
            },
          ],
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionWithNullReporterUser as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.task.reporters[0].user).toBeNull();
    });
  });

  // 境界値テスト
  describe("boundary value tests", () => {
    test("should handle auction with very long auctionId", async () => {
      // Arrange
      const longAuctionId = "a".repeat(1000);
      prismaMock.auction.findUnique.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(longAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: longAuctionId },
        select: expect.any(Object) as unknown as object,
      });
    });

    test("should handle auction with special characters in auctionId", async () => {
      // Arrange
      const specialAuctionId = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      prismaMock.auction.findUnique.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(specialAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: specialAuctionId },
        select: expect.any(Object) as unknown as object,
      });
    });

    test("should handle auction with maximum integer values", async () => {
      // Arrange
      const maxValues = {
        ...mockPrismaAuctionResult,
        currentHighestBid: Number.MAX_SAFE_INTEGER,
        extensionTotalCount: Number.MAX_SAFE_INTEGER,
        extensionLimitCount: Number.MAX_SAFE_INTEGER,
        extensionTime: Number.MAX_SAFE_INTEGER,
        remainingTimeForExtension: Number.MAX_SAFE_INTEGER,
      };
      prismaMock.auction.findUnique.mockResolvedValue(maxValues as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.currentHighestBid).toBe(Number.MAX_SAFE_INTEGER);
      expect(result?.extensionTotalCount).toBe(Number.MAX_SAFE_INTEGER);
      expect(result?.extensionLimitCount).toBe(Number.MAX_SAFE_INTEGER);
      expect(result?.extensionTime).toBe(Number.MAX_SAFE_INTEGER);
      expect(result?.remainingTimeForExtension).toBe(Number.MAX_SAFE_INTEGER);
    });

    test("should handle auction with minimum date values", async () => {
      // Arrange
      const minDate = new Date(0); // Unix epoch
      const minDateValues = {
        ...mockPrismaAuctionResult,
        startTime: minDate,
        endTime: minDate,
        bidHistories: [
          {
            ...mockPrismaAuctionResult.bidHistories[0],
            createdAt: minDate,
          },
        ],
      };
      prismaMock.auction.findUnique.mockResolvedValue(minDateValues as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.startTime).toStrictEqual(minDate);
      expect(result?.endTime).toStrictEqual(minDate);
      expect(result?.bidHistories[0].createdAt).toStrictEqual(minDate);
    });

    test("should handle auction with maximum date values", async () => {
      // Arrange
      const maxDate = new Date(8640000000000000); // Maximum valid date
      const maxDateValues = {
        ...mockPrismaAuctionResult,
        startTime: maxDate,
        endTime: maxDate,
        bidHistories: [
          {
            ...mockPrismaAuctionResult.bidHistories[0],
            createdAt: maxDate,
          },
        ],
      };
      prismaMock.auction.findUnique.mockResolvedValue(maxDateValues as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.startTime).toStrictEqual(maxDate);
      expect(result?.endTime).toStrictEqual(maxDate);
      expect(result?.bidHistories[0].createdAt).toStrictEqual(maxDate);
    });
  });

  // 異常系テスト（不正な引数）
  describe("invalid input tests", () => {
    test("should handle non-string auctionId parameter", async () => {
      // Arrange
      const nonStringAuctionId = 123 as unknown as string;
      prismaMock.auction.findUnique.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(nonStringAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: 123 },
        select: expect.any(Object) as unknown as object,
      });
    });

    test("should handle boolean auctionId parameter", async () => {
      // Arrange
      const booleanAuctionId = true as unknown as string;
      prismaMock.auction.findUnique.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(booleanAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: true },
        select: expect.any(Object) as unknown as object,
      });
    });

    test("should handle object auctionId parameter", async () => {
      // Arrange
      const objectAuctionId = { id: "test" } as unknown as string;
      prismaMock.auction.findUnique.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(objectAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: { id: "test" } },
        select: expect.any(Object) as unknown as object,
      });
    });

    test("should handle array auctionId parameter", async () => {
      // Arrange
      const arrayAuctionId = ["test"] as unknown as string;
      prismaMock.auction.findUnique.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(arrayAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: ["test"] },
        select: expect.any(Object) as unknown as object,
      });
    });

    test("should handle whitespace-only auctionId", async () => {
      // Arrange
      const whitespaceAuctionId = "   ";
      prismaMock.auction.findUnique.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getCachedAuctionByAuctionId(whitespaceAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: "   " },
        select: expect.any(Object) as unknown as object,
      });
    });

    test("should handle tab and newline characters in auctionId", async () => {
      // Arrange
      const tabNewlineAuctionId = "\t\n\r";
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getCachedAuctionByAuctionId(tabNewlineAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: "\t\n\r" },
        select: expect.any(Object) as unknown as object,
      });
    });
  });

  // エラーハンドリングテスト
  describe("error handling tests", () => {
    test("should handle Prisma connection timeout", async () => {
      // Arrange
      const timeoutError = new Error("Connection timeout");
      timeoutError.name = "PrismaClientKnownRequestError";
      prismaMock.auction.findUnique.mockRejectedValue(timeoutError);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toBeNull();
    });

    test("should handle Prisma validation error", async () => {
      // Arrange
      const validationError = new Error("Invalid field");
      validationError.name = "PrismaClientValidationError";
      prismaMock.auction.findUnique.mockRejectedValue(validationError);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toBeNull();
    });

    test("should handle unexpected error types", async () => {
      // Arrange
      const unexpectedError = "String error" as unknown as Error;
      prismaMock.auction.findUnique.mockRejectedValue(unexpectedError);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toBeNull();
    });

    test("should handle null error", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockRejectedValue(null);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toBeNull();
    });

    test("should handle undefined error", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockRejectedValue(undefined);

      // Act
      const result = await getCachedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toBeNull();
    });
  });
});
