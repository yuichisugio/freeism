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

import { getCachedAuctionByAuctionId } from "./cache-auction-retrieve";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの定義
 */
const CONSTANTS = {
  testAuctionId: "test-auction-id",
  testUserId: "test-user-id",
  testGroupId: "test-group-id",
  testTaskId: "test-task-id",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通のテストデータ生成関数
 */
function createMockData() {
  const mockUser = userFactory.build({
    id: CONSTANTS.testUserId,
    name: "テストユーザー",
    email: "test@example.com",
    image: "https://example.com/avatar.jpg",
  });

  const mockUserSettings = userSettingsFactory.build({
    id: "test-user-settings-id",
    userId: CONSTANTS.testUserId,
    username: "テストユーザー名",
  });

  const mockGroup = groupFactory.build({
    id: CONSTANTS.testGroupId,
    name: "テストグループ",
    goal: "テストグループの目標",
    depositPeriod: 7,
    createdBy: CONSTANTS.testUserId,
    evaluationMethod: "自動評価",
  });

  const mockTask = taskFactory.build({
    id: CONSTANTS.testTaskId,
    task: "テストタスク",
    detail: "テストタスクの詳細",
    imageUrl: "https://example.com/image.jpg",
    status: TaskStatus.PENDING,
    category: "プログラミング",
    groupId: CONSTANTS.testGroupId,
    creatorId: CONSTANTS.testUserId,
  });

  const mockBidHistory = bidHistoryFactory.build({
    id: "test-bid-history-id",
    amount: 500,
    auctionId: CONSTANTS.testAuctionId,
    userId: CONSTANTS.testUserId,
    isAutoBid: false,
    createdAt: new Date("2024-01-01T12:00:00Z"),
  });

  const mockAuction = auctionFactory.build({
    id: CONSTANTS.testAuctionId,
    startTime: new Date("2024-01-01T00:00:00Z"),
    endTime: new Date("2024-12-31T23:59:59Z"),
    currentHighestBid: 500,
    currentHighestBidderId: CONSTANTS.testUserId,
    extensionTotalCount: 0,
    extensionLimitCount: 3,
    extensionTime: 10,
    remainingTimeForExtension: 5,
    groupId: CONSTANTS.testGroupId,
    taskId: CONSTANTS.testTaskId,
  });

  return { mockUser, mockUserSettings, mockGroup, mockTask, mockBidHistory, mockAuction };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Prismaクエリの戻り値のモック生成関数
 */
function createMockPrismaAuctionResult(overrides = {}) {
  const { mockUser, mockUserSettings, mockGroup, mockTask, mockBidHistory, mockAuction } = createMockData();

  return {
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
            id: CONSTANTS.testUserId,
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
            id: CONSTANTS.testUserId,
            image: mockUser.image,
            settings: {
              username: mockUserSettings.username,
            },
          },
        },
      ],
    },
    ...overrides,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 期待される結果生成関数
 */
function createExpectedAuctionWithDetails(overrides = {}) {
  const mockPrismaResult = createMockPrismaAuctionResult(overrides);
  return {
    ...mockPrismaResult,
    status: mockPrismaResult.task.status, // task.statusがauction.statusとしてマージされる
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 期待されるPrisma select オブジェクト
 */
const expectedSelectObject = {
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
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cache-auction-retrieve", () => {
  describe("getCachedAuctionByAuctionId", () => {
    describe("正常系", () => {
      test("should return auction details successfully", async () => {
        // Arrange
        const mockPrismaResult = createMockPrismaAuctionResult();
        prismaMock.auction.findUnique.mockResolvedValue(
          mockPrismaResult as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionByAuctionId(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedAuctionWithDetails());
        expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
          where: { id: CONSTANTS.testAuctionId },
          select: expectedSelectObject,
        });
        expect(prismaMock.auction.findUnique).toHaveBeenCalledTimes(1);
      });

      test.each([
        {
          description: "empty bid histories",
          overrides: { bidHistories: [] },
          assertions: (result: AuctionWithDetails | null) => {
            expect(result?.bidHistories).toHaveLength(0);
          },
        },
        {
          description: "null currentHighestBidderId",
          overrides: { currentHighestBidderId: null },
          assertions: (result: AuctionWithDetails | null) => {
            expect(result?.currentHighestBidderId).toBeNull();
          },
        },
        {
          description: "different task status",
          overrides: { task: { status: TaskStatus.AUCTION_ACTIVE } },
          assertions: (result: AuctionWithDetails | null) => {
            expect(result?.status).toBe(TaskStatus.AUCTION_ACTIVE);
          },
        },
        {
          description: "null task fields",
          overrides: {
            task: {
              detail: null,
              imageUrl: null,
              category: null,
            },
          },
          assertions: (result: AuctionWithDetails | null) => {
            expect(result?.task.detail).toBeNull();
            expect(result?.task.imageUrl).toBeNull();
            expect(result?.task.category).toBeNull();
          },
        },
        {
          description: "empty executors and reporters arrays",
          overrides: {
            task: {
              executors: [],
              reporters: [],
            },
          },
          assertions: (result: AuctionWithDetails | null) => {
            expect(result?.task.executors).toHaveLength(0);
            expect(result?.task.reporters).toHaveLength(0);
          },
        },
      ])("should handle auction with $description", async ({ overrides, assertions }) => {
        // Arrange
        const mockPrismaResult = createMockPrismaAuctionResult(overrides);
        prismaMock.auction.findUnique.mockResolvedValue(
          mockPrismaResult as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionByAuctionId(CONSTANTS.testAuctionId);

        // Assert
        expect(result).not.toBeNull();
        assertions(result?.data);
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
        const mockPrismaResult = createMockPrismaAuctionResult({
          bidHistories: multipleBidHistories,
        });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockPrismaResult as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionByAuctionId(CONSTANTS.testAuctionId);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.data?.bidHistories).toHaveLength(2);
        expect(result?.data?.bidHistories[0].amount).toBe(500);
        expect(result?.data?.bidHistories[1].amount).toBe(400);
        expect(result?.data?.bidHistories[0].isAutoBid).toBe(false);
        expect(result?.data?.bidHistories[1].isAutoBid).toBe(true);
      });
    });

    describe("異常系", () => {
      test.each([
        {
          description: "database connection error",
          error: new Error("Database connection error"),
        },
        {
          description: "Prisma timeout error",
          error: (() => {
            const err = new Error("Connection timeout");
            err.name = "PrismaClientKnownRequestError";
            return err;
          })(),
        },
        {
          description: "Prisma validation error",
          error: (() => {
            const err = new Error("Invalid field");
            err.name = "PrismaClientValidationError";
            return err;
          })(),
        },
        {
          description: "null error",
          error: null,
        },
        {
          description: "undefined error",
          error: undefined,
        },
      ])("should handle $description", async ({ error }) => {
        // Arrange
        prismaMock.auction.findUnique.mockRejectedValue(error);

        // Act & Assert
        await expect(getCachedAuctionByAuctionId(CONSTANTS.testAuctionId)).rejects.toThrow(
          error instanceof Error ? error.message : "不明なエラーが発生しました",
        );
        expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
          where: { id: CONSTANTS.testAuctionId },
          select: expectedSelectObject,
        });
        expect(prismaMock.auction.findUnique).toHaveBeenCalledTimes(1);
      });

      test.each([
        {
          description: "empty string",
          auctionId: "",
        },
        {
          description: "null",
          auctionId: null,
        },
        {
          description: "undefined",
          auctionId: undefined,
        },
      ])("should handle auctionId is $description", async ({ auctionId }) => {
        // Act & Assert
        await expect(getCachedAuctionByAuctionId(auctionId as unknown as string)).rejects.toThrow(
          "オークションIDが指定されていません",
        );
        expect(prismaMock.auction.findUnique).not.toHaveBeenCalled();
      });

      test("should throw error when auction is not found", async () => {
        // Arrange
        prismaMock.auction.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(getCachedAuctionByAuctionId(CONSTANTS.testAuctionId)).rejects.toThrow(
          "オークション情報が見つかりません",
        );
        expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
          where: { id: CONSTANTS.testAuctionId },
          select: expectedSelectObject,
        });
        expect(prismaMock.auction.findUnique).toHaveBeenCalledTimes(1);
      });
    });
  });
});
