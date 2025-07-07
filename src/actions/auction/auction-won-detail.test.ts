import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionFactory, auctionReviewFactory, taskFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getAuctionWonDetail } from "./auction-won-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの定義（定数）
 */
const TEST_IDS = {
  auctionId: "test-auction-id",
  userId: "test-user-id",
  taskId: "test-task-id",
  creatorId: "test-creator-id",
  reporterId: "test-reporter-id",
  executorId: "test-executor-id",
} as const;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ファクトリーを使用したベースモックデータ
 */
const baseMockTask = taskFactory.build({
  id: TEST_IDS.taskId,
  task: "テストタスク",
  detail: "テストタスクの詳細",
  status: TaskStatus.TASK_COMPLETED,
  imageUrl: "https://example.com/image.jpg",
  creatorId: TEST_IDS.creatorId,
  deliveryMethod: "オンライン",
});

const baseMockAuction = auctionFactory.build({
  id: TEST_IDS.auctionId,
  taskId: TEST_IDS.taskId,
  currentHighestBid: 500,
  winnerId: TEST_IDS.userId,
  startTime: new Date("2024-01-01T10:00:00Z"),
  endTime: new Date("2024-01-02T10:00:00Z"),
});

const baseMockReview = auctionReviewFactory.build({
  auctionId: TEST_IDS.auctionId,
  reviewerId: TEST_IDS.userId,
  revieweeId: TEST_IDS.creatorId,
  rating: 5,
  comment: "素晴らしい取引でした",
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ヘルパー関数：基本的なオークションデータを作成
 */
const createBaseMockAuctionData = (overrides: Record<string, unknown> = {}) => ({
  id: baseMockAuction.id,
  endTime: baseMockAuction.endTime,
  startTime: baseMockAuction.startTime,
  currentHighestBid: baseMockAuction.currentHighestBid,
  winnerId: baseMockAuction.winnerId,
  reviews: [baseMockReview],
  task: {
    id: baseMockTask.id,
    task: baseMockTask.task,
    detail: baseMockTask.detail,
    status: baseMockTask.status,
    imageUrl: baseMockTask.imageUrl,
    creatorId: baseMockTask.creatorId,
    deliveryMethod: baseMockTask.deliveryMethod,
    creator: {
      id: TEST_IDS.creatorId,
      image: "https://example.com/creator.jpg",
      settings: {
        username: "テストユーザー",
      },
    },
    reporters: [
      {
        user: {
          id: TEST_IDS.reporterId,
          image: "https://example.com/reporter.jpg",
          settings: {
            username: "レポーター",
          },
        },
      },
    ],
    executors: [
      {
        user: {
          id: TEST_IDS.executorId,
          image: "https://example.com/executor.jpg",
          settings: {
            username: "実行者",
          },
        },
      },
    ],
    ...overrides,
  },
});

/**
 * ヘルパー関数：Prismaクエリのアサーション用オブジェクト
 */
const getExpectedPrismaQuery = (auctionId: string, userId: string) => ({
  where: {
    id: auctionId,
    winnerId: userId,
  },
  select: {
    id: true,
    endTime: true,
    startTime: true,
    currentHighestBid: true,
    winnerId: true,
    reviews: {
      where: {
        OR: [{ reviewerId: userId }, { revieweeId: userId }],
      },
      select: {
        id: true,
        reviewerId: true,
        rating: true,
        comment: true,
      },
    },
    task: {
      select: {
        id: true,
        task: true,
        detail: true,
        status: true,
        imageUrl: true,
        creatorId: true,
        deliveryMethod: true,
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
        reporters: {
          select: {
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
        executors: {
          select: {
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
});

/**
 * ヘルパー関数：期待される結果オブジェクトを作成
 */
const createExpectedResult = (overrides: Record<string, unknown> = {}) => ({
  auctionId: TEST_IDS.auctionId,
  auctionEndTime: baseMockAuction.endTime,
  auctionStartTime: baseMockAuction.startTime,
  currentHighestBid: 500,
  winnerId: TEST_IDS.userId,
  reviews: [baseMockReview],
  taskId: TEST_IDS.taskId,
  taskName: "テストタスク",
  taskDetail: "テストタスクの詳細",
  taskStatus: TaskStatus.TASK_COMPLETED,
  taskDeliveryMethod: "オンライン",
  taskImageUrl: "https://example.com/image.jpg",
  creator: {
    creatorUserId: TEST_IDS.creatorId,
    creatorAppUserName: "テストユーザー",
    creatorUserImage: "https://example.com/creator.jpg",
  },
  reporters: [
    {
      reporterUserId: TEST_IDS.reporterId,
      reporterAppUserName: "レポーター",
      reporterUserImage: "https://example.com/reporter.jpg",
    },
  ],
  executors: [
    {
      executorUserId: TEST_IDS.executorId,
      executorAppUserName: "実行者",
      executorUserImage: "https://example.com/executor.jpg",
    },
  ],
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("auction-won-detail_getAuctionWonDetail", () => {
  describe("正常系", () => {
    test("should return auction won detail successfully", async () => {
      // Arrange
      const mockAuctionData = createBaseMockAuctionData();
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getAuctionWonDetail(TEST_IDS.auctionId, TEST_IDS.userId);

      // Assert
      expect(result).toStrictEqual({
        success: true,
        message: "落札したオークションの詳細を取得しました",
        auctionWonDetail: createExpectedResult(),
      });
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith(
        getExpectedPrismaQuery(TEST_IDS.auctionId, TEST_IDS.userId),
      );
    });

    test("should handle missing creator settings with default values", async () => {
      // Arrange
      const mockAuctionData = createBaseMockAuctionData({
        creator: {
          id: TEST_IDS.creatorId,
          image: null,
          settings: null,
        },
        reporters: [],
        executors: [],
      });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getAuctionWonDetail(TEST_IDS.auctionId, TEST_IDS.userId);

      // Assert
      expect(result.data?.creator).toStrictEqual({
        creatorUserId: TEST_IDS.creatorId,
        creatorAppUserName: "未設定",
        creatorUserImage: null,
      });
      expect(result.data?.reporters).toStrictEqual([]);
      expect(result.data?.executors).toStrictEqual([]);
    });

    test("should handle missing reporter and executor user data with default values", async () => {
      // Arrange
      const mockAuctionData = createBaseMockAuctionData({
        reporters: [{ user: null }],
        executors: [
          {
            user: {
              id: TEST_IDS.executorId,
              image: null,
              settings: null,
            },
          },
        ],
      });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getAuctionWonDetail(TEST_IDS.auctionId, TEST_IDS.userId);

      // Assert
      expect(result.data?.reporters).toStrictEqual([
        {
          reporterUserId: "未登録ユーザー",
          reporterAppUserName: "未設定",
          reporterUserImage: null,
        },
      ]);
      expect(result.data?.executors).toStrictEqual([
        {
          executorUserId: TEST_IDS.executorId,
          executorAppUserName: "未設定",
          executorUserImage: null,
        },
      ]);
    });

    test("should handle missing reporter and executor user data with default values(null)", async () => {
      // Arrange
      const mockAuctionData = createBaseMockAuctionData({
        reporters: [{ user: null }],
        executors: [{ user: null }],
      });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getAuctionWonDetail(TEST_IDS.auctionId, TEST_IDS.userId);

      // Assert
      expect(result.data?.reporters).toStrictEqual([
        {
          reporterUserId: "未登録ユーザー",
          reporterAppUserName: "未設定",
          reporterUserImage: null,
        },
      ]);
      expect(result.data?.executors).toStrictEqual([
        {
          executorUserId: "未登録ユーザー",
          executorAppUserName: "未設定",
          executorUserImage: null,
        },
      ]);
    });

    test("should handle multiple reviews", async () => {
      // Arrange
      const mockReview1 = auctionReviewFactory.build({
        auctionId: TEST_IDS.auctionId,
        reviewerId: TEST_IDS.userId,
        revieweeId: TEST_IDS.creatorId,
        rating: 5,
        comment: "素晴らしい取引でした",
      });
      const mockReview2 = auctionReviewFactory.build({
        auctionId: TEST_IDS.auctionId,
        reviewerId: TEST_IDS.creatorId,
        revieweeId: TEST_IDS.userId,
        rating: 4,
        comment: "良い落札者でした",
      });
      const mockAuctionData = createBaseMockAuctionData();
      mockAuctionData.reviews = [mockReview1, mockReview2];
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getAuctionWonDetail(TEST_IDS.auctionId, TEST_IDS.userId);

      // Assert
      expect(result.data?.reviews).toHaveLength(2);
      expect(result.data?.reviews).toStrictEqual([mockReview1, mockReview2]);
    });

    test("should handle null values in task data", async () => {
      // Arrange
      const mockAuctionData = createBaseMockAuctionData({
        detail: null,
        imageUrl: null,
      });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getAuctionWonDetail(TEST_IDS.auctionId, TEST_IDS.userId);

      // Assert
      expect(result.data?.taskDetail).toBe(null);
      expect(result.data?.taskImageUrl).toBe(null);
    });

    test("should return success when auction is not found", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act & Assert
      const result = await getAuctionWonDetail(TEST_IDS.auctionId, TEST_IDS.userId);
      expect(result).toStrictEqual({
        success: true,
        message: "落札したオークションが見つかりません",
        auctionWonDetail: null,
      });
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith(
        getExpectedPrismaQuery(TEST_IDS.auctionId, TEST_IDS.userId),
      );
    });
  });

  describe("異常系", () => {
    test.each([
      ["", TEST_IDS.userId],
      [TEST_IDS.auctionId, ""],
    ])("should return error when parameters are invalid", async (auctionId, userId) => {
      // Act
      const result = await getAuctionWonDetail(auctionId, userId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "オークションIDまたはユーザーIDが無効です",
        auctionWonDetail: null,
      });
    });

    test("should handle database error", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockRejectedValue(new Error("Database connection error"));

      // Act
      const result = await getAuctionWonDetail(TEST_IDS.auctionId, TEST_IDS.userId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "Database connection error",
        auctionWonDetail: null,
      });
    });

    test("should handle database error(null)", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockRejectedValue(null);

      // Act
      const result = await getAuctionWonDetail(TEST_IDS.auctionId, TEST_IDS.userId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "不明なエラーが発生しました",
        auctionWonDetail: null,
      });
    });

    test("should handle empty auctionId", async () => {
      // Act
      const result = await getAuctionWonDetail("", TEST_IDS.userId);

      // Assert
      expect(result).toStrictEqual({
        success: false,
        message: "オークションIDまたはユーザーIDが無効です",
        auctionWonDetail: null,
      });
      // 空のauctionIdの場合、バリデーションでエラーになるためPrismaは呼ばれない
      expect(prismaMock.auction.findUnique).not.toHaveBeenCalled();
    });
  });
});
