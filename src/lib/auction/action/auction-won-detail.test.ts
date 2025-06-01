import type { Prisma } from "@prisma/client";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
// 既存のPrismaモックセットアップを使用
import { prismaMock } from "@/test/setup/prisma-orm-setup";
// テストユーティリティのインポート
import { auctionFactory, auctionReviewFactory, taskFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象の関数をインポート（モック設定後）
import { getAuctionWonDetail } from "./auction-won-detail";

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
  __esModule: true,
}));

// モック関数の型アサーション
const mockGetAuthenticatedSessionUserId = getAuthenticatedSessionUserId as ReturnType<typeof vi.fn>;

// Prismaクエリの戻り値の型定義
type MockAuctionData = {
  id: string;
  endTime: Date;
  startTime: Date;
  currentHighestBid: number;
  winnerId: string | null;
  reviews: Array<{
    id: string;
    reviewerId: string;
    rating: number;
    comment: string | null;
  }>;
  task: {
    id: string;
    task: string;
    detail: string | null;
    status: TaskStatus;
    imageUrl: string | null;
    creatorId: string;
    deliveryMethod: string | null;
    creator: {
      id: string;
      image: string | null;
      settings: {
        username: string;
      } | null;
    } | null;
    reporters: Array<{
      user: {
        id: string;
        image: string | null;
        settings: {
          username: string;
        } | null;
      } | null;
    }>;
    executors: Array<{
      user: {
        id: string;
        image: string | null;
        settings: {
          username: string;
        } | null;
      } | null;
    }>;
  };
};

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthenticatedSessionUserId.mockReset();
});

// テストデータの定義
const testAuctionId = "test-auction-id";
const testUserId = "test-user-id";
const testTaskId = "test-task-id";
const testCreatorId = "test-creator-id";
const testReporterId = "test-reporter-id";
const testExecutorId = "test-executor-id";

const mockTask = taskFactory.build({
  id: testTaskId,
  task: "テストタスク",
  detail: "テストタスクの詳細",
  status: TaskStatus.TASK_COMPLETED,
  imageUrl: "https://example.com/image.jpg",
  creatorId: testCreatorId,
  deliveryMethod: "オンライン",
});

const mockAuctionReview = auctionReviewFactory.build({
  auctionId: testAuctionId,
  reviewerId: testUserId,
  revieweeId: testCreatorId,
  rating: 5,
  comment: "素晴らしい取引でした",
});

const mockAuction = auctionFactory.build({
  id: testAuctionId,
  taskId: testTaskId,
  currentHighestBid: 500,
  winnerId: testUserId,
  startTime: new Date("2024-01-01T10:00:00Z"),
  endTime: new Date("2024-01-02T10:00:00Z"),
});

describe("auction-won-detail", () => {
  describe("getAuctionWonDetail", () => {
    test("should return auction won detail successfully", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);

      const mockAuctionData: MockAuctionData = {
        id: mockAuction.id,
        endTime: mockAuction.endTime,
        startTime: mockAuction.startTime,
        currentHighestBid: mockAuction.currentHighestBid,
        winnerId: mockAuction.winnerId,
        reviews: [mockAuctionReview],
        task: {
          id: mockTask.id,
          task: mockTask.task,
          detail: mockTask.detail,
          status: mockTask.status,
          imageUrl: mockTask.imageUrl,
          creatorId: mockTask.creatorId,
          deliveryMethod: mockTask.deliveryMethod,
          creator: {
            id: testCreatorId,
            image: "https://example.com/creator.jpg",
            settings: {
              username: "テストユーザー",
            },
          },
          reporters: [
            {
              user: {
                id: testReporterId,
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
                id: testExecutorId,
                image: "https://example.com/executor.jpg",
                settings: {
                  username: "実行者",
                },
              },
            },
          ],
        },
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getAuctionWonDetail(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        auctionId: testAuctionId,
        auctionEndTime: mockAuction.endTime,
        auctionStartTime: mockAuction.startTime,
        currentHighestBid: 500,
        winnerId: testUserId,
        reviews: [mockAuctionReview],
        taskId: testTaskId,
        taskName: "テストタスク",
        taskDetail: "テストタスクの詳細",
        taskStatus: TaskStatus.TASK_COMPLETED,
        taskDeliveryMethod: "オンライン",
        taskImageUrl: "https://example.com/image.jpg",
        creator: {
          creatorUserId: testCreatorId,
          creatorAppUserName: "テストユーザー",
          creatorUserImage: "https://example.com/creator.jpg",
        },
        reporters: [
          {
            reporterUserId: testReporterId,
            reporterAppUserName: "レポーター",
            reporterUserImage: "https://example.com/reporter.jpg",
          },
        ],
        executors: [
          {
            executorUserId: testExecutorId,
            executorAppUserName: "実行者",
            executorUserImage: "https://example.com/executor.jpg",
          },
        ],
      });

      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: testAuctionId,
          winnerId: testUserId,
        },
        select: {
          id: true,
          endTime: true,
          startTime: true,
          currentHighestBid: true,
          winnerId: true,
          reviews: {
            where: {
              OR: [{ reviewerId: testUserId }, { revieweeId: testUserId }],
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
    });

    test("should handle missing creator settings with default values", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);

      const mockAuctionData: MockAuctionData = {
        id: mockAuction.id,
        endTime: mockAuction.endTime,
        startTime: mockAuction.startTime,
        currentHighestBid: mockAuction.currentHighestBid,
        winnerId: mockAuction.winnerId,
        reviews: [],
        task: {
          id: mockTask.id,
          task: mockTask.task,
          detail: mockTask.detail,
          status: mockTask.status,
          imageUrl: mockTask.imageUrl,
          creatorId: mockTask.creatorId,
          deliveryMethod: mockTask.deliveryMethod,
          creator: {
            id: testCreatorId,
            image: null,
            settings: null, // settingsがnull
          },
          reporters: [],
          executors: [],
        },
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getAuctionWonDetail(testAuctionId);

      // Assert
      expect(result.creator).toStrictEqual({
        creatorUserId: testCreatorId,
        creatorAppUserName: "未設定",
        creatorUserImage: null,
      });
      expect(result.reporters).toStrictEqual([]);
      expect(result.executors).toStrictEqual([]);
    });

    test("should handle missing reporter and executor user data with default values", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);

      const mockAuctionData: MockAuctionData = {
        id: mockAuction.id,
        endTime: mockAuction.endTime,
        startTime: mockAuction.startTime,
        currentHighestBid: mockAuction.currentHighestBid,
        winnerId: mockAuction.winnerId,
        reviews: [],
        task: {
          id: mockTask.id,
          task: mockTask.task,
          detail: mockTask.detail,
          status: mockTask.status,
          imageUrl: mockTask.imageUrl,
          creatorId: mockTask.creatorId,
          deliveryMethod: mockTask.deliveryMethod,
          creator: {
            id: testCreatorId,
            image: "https://example.com/creator.jpg",
            settings: {
              username: "テストユーザー",
            },
          },
          reporters: [
            {
              user: null, // userがnull
            },
          ],
          executors: [
            {
              user: {
                id: testExecutorId,
                image: null,
                settings: null, // settingsがnull
              },
            },
          ],
        },
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getAuctionWonDetail(testAuctionId);

      // Assert
      expect(result.reporters).toStrictEqual([
        {
          reporterUserId: "未設定",
          reporterAppUserName: "未設定",
          reporterUserImage: null,
        },
      ]);
      expect(result.executors).toStrictEqual([
        {
          executorUserId: testExecutorId,
          executorAppUserName: "未設定",
          executorUserImage: null,
        },
      ]);
    });

    test("should throw error when auction is not found", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(getAuctionWonDetail(testAuctionId)).rejects.toThrow("落札したオークションが見つかりません");

      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: testAuctionId,
          winnerId: testUserId,
        },
        select: expect.any(Object) as unknown as Prisma.AuctionSelect,
      });
    });

    test("should throw error when user is not authenticated", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("認証が必要です"));

      // Act & Assert
      await expect(getAuctionWonDetail(testAuctionId)).rejects.toThrow("認証が必要です");

      expect(prismaMock.auction.findUnique).not.toHaveBeenCalled();
    });

    test("should handle database error", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auction.findUnique.mockRejectedValue(new Error("Database connection error"));

      // Act & Assert
      await expect(getAuctionWonDetail(testAuctionId)).rejects.toThrow("Database connection error");
    });

    test("should handle empty auctionId", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(getAuctionWonDetail("")).rejects.toThrow("落札したオークションが見つかりません");

      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: "",
          winnerId: testUserId,
        },
        select: expect.any(Object) as unknown as Prisma.AuctionSelect,
      });
    });

    test("should handle null values in task data", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);

      const mockAuctionData: MockAuctionData = {
        id: mockAuction.id,
        endTime: mockAuction.endTime,
        startTime: mockAuction.startTime,
        currentHighestBid: mockAuction.currentHighestBid,
        winnerId: mockAuction.winnerId,
        reviews: [],
        task: {
          id: mockTask.id,
          task: mockTask.task,
          detail: null, // detailがnull
          status: mockTask.status,
          imageUrl: null, // imageUrlがnull
          creatorId: mockTask.creatorId,
          deliveryMethod: mockTask.deliveryMethod,
          creator: {
            id: testCreatorId,
            image: "https://example.com/creator.jpg",
            settings: {
              username: "テストユーザー",
            },
          },
          reporters: [],
          executors: [],
        },
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getAuctionWonDetail(testAuctionId);

      // Assert
      expect(result.taskDetail).toBe(null);
      expect(result.taskImageUrl).toBe(null);
    });

    test("should handle multiple reviews", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);

      const mockReview1 = auctionReviewFactory.build({
        auctionId: testAuctionId,
        reviewerId: testUserId,
        revieweeId: testCreatorId,
        rating: 5,
        comment: "素晴らしい取引でした",
      });

      const mockReview2 = auctionReviewFactory.build({
        auctionId: testAuctionId,
        reviewerId: testCreatorId,
        revieweeId: testUserId,
        rating: 4,
        comment: "良い落札者でした",
      });

      const mockAuctionData: MockAuctionData = {
        id: mockAuction.id,
        endTime: mockAuction.endTime,
        startTime: mockAuction.startTime,
        currentHighestBid: mockAuction.currentHighestBid,
        winnerId: mockAuction.winnerId,
        reviews: [mockReview1, mockReview2],
        task: {
          id: mockTask.id,
          task: mockTask.task,
          detail: mockTask.detail,
          status: mockTask.status,
          imageUrl: mockTask.imageUrl,
          creatorId: mockTask.creatorId,
          deliveryMethod: mockTask.deliveryMethod,
          creator: {
            id: testCreatorId,
            image: "https://example.com/creator.jpg",
            settings: {
              username: "テストユーザー",
            },
          },
          reporters: [],
          executors: [],
        },
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getAuctionWonDetail(testAuctionId);

      // Assert
      expect(result.reviews).toHaveLength(2);
      expect(result.reviews).toStrictEqual([mockReview1, mockReview2]);
    });

    test("should handle zero bid amount", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);

      const mockAuctionData: MockAuctionData = {
        id: mockAuction.id,
        endTime: mockAuction.endTime,
        startTime: mockAuction.startTime,
        currentHighestBid: 0, // 0円の入札
        winnerId: mockAuction.winnerId,
        reviews: [],
        task: {
          id: mockTask.id,
          task: mockTask.task,
          detail: mockTask.detail,
          status: mockTask.status,
          imageUrl: mockTask.imageUrl,
          creatorId: mockTask.creatorId,
          deliveryMethod: mockTask.deliveryMethod,
          creator: {
            id: testCreatorId,
            image: "https://example.com/creator.jpg",
            settings: {
              username: "テストユーザー",
            },
          },
          reporters: [],
          executors: [],
        },
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getAuctionWonDetail(testAuctionId);

      // Assert
      expect(result.currentHighestBid).toBe(0);
    });
  });

  // 境界値テスト
  describe("boundary value tests", () => {
    test("should handle very large bid amount", async () => {
      // Arrange
      const largeBidAmount = 999999999;
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);

      const mockAuctionData: MockAuctionData = {
        id: mockAuction.id,
        endTime: mockAuction.endTime,
        startTime: mockAuction.startTime,
        currentHighestBid: largeBidAmount,
        winnerId: mockAuction.winnerId,
        reviews: [],
        task: {
          id: mockTask.id,
          task: mockTask.task,
          detail: mockTask.detail,
          status: mockTask.status,
          imageUrl: mockTask.imageUrl,
          creatorId: mockTask.creatorId,
          deliveryMethod: mockTask.deliveryMethod,
          creator: {
            id: testCreatorId,
            image: "https://example.com/creator.jpg",
            settings: {
              username: "テストユーザー",
            },
          },
          reporters: [],
          executors: [],
        },
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getAuctionWonDetail(testAuctionId);

      // Assert
      expect(result.currentHighestBid).toBe(largeBidAmount);
    });

    test("should handle very long task name and detail", async () => {
      // Arrange
      const longTaskName = "a".repeat(1000);
      const longTaskDetail = "b".repeat(5000);
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);

      const mockAuctionData: MockAuctionData = {
        id: mockAuction.id,
        endTime: mockAuction.endTime,
        startTime: mockAuction.startTime,
        currentHighestBid: mockAuction.currentHighestBid,
        winnerId: mockAuction.winnerId,
        reviews: [],
        task: {
          id: mockTask.id,
          task: longTaskName,
          detail: longTaskDetail,
          status: mockTask.status,
          imageUrl: mockTask.imageUrl,
          creatorId: mockTask.creatorId,
          deliveryMethod: mockTask.deliveryMethod,
          creator: {
            id: testCreatorId,
            image: "https://example.com/creator.jpg",
            settings: {
              username: "テストユーザー",
            },
          },
          reporters: [],
          executors: [],
        },
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getAuctionWonDetail(testAuctionId);

      // Assert
      expect(result.taskName).toBe(longTaskName);
      expect(result.taskDetail).toBe(longTaskDetail);
    });
  });

  // 異常系テスト（不正な引数）
  describe("invalid input tests", () => {
    test("should handle undefined auctionId", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(getAuctionWonDetail(undefined as unknown as string)).rejects.toThrow("落札したオークションが見つかりません");
    });

    test("should handle null auctionId", async () => {
      // Arrange
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(getAuctionWonDetail(null as unknown as string)).rejects.toThrow("落札したオークションが見つかりません");
    });

    test("should handle invalid auctionId format", async () => {
      // Arrange
      const invalidAuctionId = "invalid-auction-id-format-!@#$%";
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(getAuctionWonDetail(invalidAuctionId)).rejects.toThrow("落札したオークションが見つかりません");

      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: {
          id: invalidAuctionId,
          winnerId: testUserId,
        },
        select: expect.any(Object) as unknown as object,
      });
    });
  });
});
