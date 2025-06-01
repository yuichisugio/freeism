import type { Prisma } from "@prisma/client";
import { getCachedAuctionByAuctionId } from "@/lib/auction/action/cache/cache-auction-retrieve";
import { getAuctionUpdateSelect } from "@/lib/constants";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象の関数をインポート
import { getAuctionByAuctionId, getUpdatedAuctionByAuctionId } from "./auction-retrieve";

// 定数とヘルパー関数のモック
const mockSelectObject = {
  id: true,
  currentHighestBid: true,
  currentHighestBidderId: true,
  extensionTotalCount: true,
  extensionLimitCount: true,
  extensionTime: true,
  remainingTimeForExtension: true,
  task: {
    select: {
      status: true,
    },
  },
  bidHistories: {
    take: 11,
    orderBy: { createdAt: "desc" },
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
  },
};

vi.mock("@/lib/constants", () => ({
  AUCTION_CONSTANTS: {
    DISPLAY: {
      BID_HISTORY_LIMIT: 10,
    },
  },
  getAuctionUpdateSelect: vi.fn(() => mockSelectObject),
}));

// キャッシュ関数のモック
vi.mock("@/lib/auction/action/cache/cache-auction-retrieve", () => ({
  getCachedAuctionByAuctionId: vi.fn(),
  __esModule: true,
}));

const mockGetCachedAuctionByAuctionId = vi.mocked(getCachedAuctionByAuctionId);
const mockGetAuctionUpdateSelect = vi.mocked(getAuctionUpdateSelect);

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
  mockGetCachedAuctionByAuctionId.mockReset();
  mockGetAuctionUpdateSelect.mockReset();
  // モック関数のデフォルト戻り値を設定
  mockGetAuctionUpdateSelect.mockReturnValue(mockSelectObject as Prisma.AuctionSelect);
});

// テストデータの定義
const testAuctionId = "test-auction-id";
const testUserId = "test-user-id";
const testGroupId = "test-group-id";

describe("auction-retrieve", () => {
  // getUpdatedAuctionByAuctionIdのテスト
  describe("getUpdatedAuctionByAuctionId", () => {
    test("should return updated auction data when auction exists", async () => {
      // Arrange
      const mockAuctionRaw = {
        id: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        extensionTotalCount: 0,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        task: {
          status: TaskStatus.AUCTION_ACTIVE,
        },
        bidHistories: [
          {
            id: "bid-1",
            amount: 100,
            createdAt: new Date("2024-01-01T10:00:00Z"),
            isAutoBid: false,
            user: {
              settings: {
                username: "テストユーザー",
              },
            },
          },
        ],
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getUpdatedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        id: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        status: TaskStatus.AUCTION_ACTIVE,
        extensionTotalCount: 0,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        bidHistories: [
          {
            id: "bid-1",
            amount: 100,
            createdAt: new Date("2024-01-01T10:00:00Z"),
            isAutoBid: false,
            user: { settings: { username: "テストユーザー" } },
          },
        ],
      });

      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: testAuctionId },
        select: mockSelectObject,
      });
    });

    test("should return null when auction does not exist", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getUpdatedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: testAuctionId },
        select: mockSelectObject,
      });
    });

    test("should handle auction with null currentHighestBidderId", async () => {
      // Arrange
      const mockAuctionRaw = {
        id: testAuctionId,
        currentHighestBid: 0,
        currentHighestBidderId: null,
        extensionTotalCount: 0,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        task: {
          status: TaskStatus.PENDING,
        },
        bidHistories: [],
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getUpdatedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toStrictEqual({
        id: testAuctionId,
        currentHighestBid: 0,
        currentHighestBidderId: null,
        status: TaskStatus.PENDING,
        extensionTotalCount: 0,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        bidHistories: [],
      });
    });

    test("should handle auction with multiple bid histories", async () => {
      // Arrange
      const mockAuctionRaw = {
        id: testAuctionId,
        currentHighestBid: 200,
        currentHighestBidderId: testUserId,
        extensionTotalCount: 1,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        task: {
          status: TaskStatus.AUCTION_ACTIVE,
        },
        bidHistories: [
          {
            id: "bid-1",
            amount: 200,
            createdAt: new Date("2024-01-01T12:00:00Z"),
            isAutoBid: true,
            user: {
              settings: {
                username: "ユーザー1",
              },
            },
          },
          {
            id: "bid-2",
            amount: 150,
            createdAt: new Date("2024-01-01T11:00:00Z"),
            isAutoBid: false,
            user: {
              settings: {
                username: "ユーザー2",
              },
            },
          },
        ],
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getUpdatedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result?.bidHistories).toHaveLength(2);
      expect(result?.bidHistories[0].amount).toBe(200);
      expect(result?.bidHistories[0].isAutoBid).toBe(true);
      expect(result?.bidHistories[1].amount).toBe(150);
      expect(result?.bidHistories[1].isAutoBid).toBe(false);
    });

    test("should handle auction with user settings null", async () => {
      // Arrange
      const mockAuctionRaw = {
        id: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        extensionTotalCount: 0,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        task: {
          status: TaskStatus.AUCTION_ACTIVE,
        },
        bidHistories: [
          {
            id: "bid-1",
            amount: 100,
            createdAt: new Date("2024-01-01T10:00:00Z"),
            isAutoBid: false,
            user: {
              settings: null,
            },
          },
        ],
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getUpdatedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result?.bidHistories[0].user.settings).toBeNull();
    });

    test("should return null when database error occurs", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await getUpdatedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toBeNull();
    });

    test("should handle empty string auctionId", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getUpdatedAuctionByAuctionId("");

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: "" },
        select: mockSelectObject,
      });
    });

    test("should handle undefined auctionId", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getUpdatedAuctionByAuctionId(undefined as unknown as string);

      // Assert
      expect(result).toBeNull();
    });

    test("should handle different task statuses", async () => {
      // Arrange
      const testCases = [
        TaskStatus.PENDING,
        TaskStatus.AUCTION_ACTIVE,
        TaskStatus.AUCTION_ENDED,
        TaskStatus.SUPPLIER_DONE,
        TaskStatus.TASK_COMPLETED,
      ];

      for (const status of testCases) {
        const mockAuctionRaw = {
          id: testAuctionId,
          currentHighestBid: 100,
          currentHighestBidderId: testUserId,
          extensionTotalCount: 0,
          extensionLimitCount: 5,
          extensionTime: 10,
          remainingTimeForExtension: 5,
          task: {
            status: status,
          },
          bidHistories: [],
        };

        prismaMock.auction.findUnique.mockResolvedValue(mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

        // Act
        const result = await getUpdatedAuctionByAuctionId(testAuctionId);

        // Assert
        expect(result?.status).toBe(status);
      }
    });

    test("should handle large bid amounts", async () => {
      // Arrange
      const largeBidAmount = 999999999;
      const mockAuctionRaw = {
        id: testAuctionId,
        currentHighestBid: largeBidAmount,
        currentHighestBidderId: testUserId,
        extensionTotalCount: 0,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        task: {
          status: TaskStatus.AUCTION_ACTIVE,
        },
        bidHistories: [
          {
            id: "bid-1",
            amount: largeBidAmount,
            createdAt: new Date("2024-01-01T10:00:00Z"),
            isAutoBid: false,
            user: {
              settings: {
                username: "テストユーザー",
              },
            },
          },
        ],
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getUpdatedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result?.currentHighestBid).toBe(largeBidAmount);
      expect(result?.bidHistories[0].amount).toBe(largeBidAmount);
    });
  });

  // getAuctionByAuctionIdのテスト
  describe("getAuctionByAuctionId", () => {
    test("should return auction data when cache returns data", async () => {
      // Arrange
      const mockAuctionWithDetails = {
        id: testAuctionId,
        startTime: new Date("2024-01-01T09:00:00Z"),
        endTime: new Date("2024-01-02T09:00:00Z"),
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        status: TaskStatus.AUCTION_ACTIVE,
        extensionTotalCount: 0,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        bidHistories: [
          {
            id: "bid-1",
            amount: 100,
            createdAt: new Date("2024-01-01T10:00:00Z"),
            isAutoBid: false,
            user: {
              settings: {
                username: "テストユーザー",
              },
            },
          },
        ],
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: "https://example.com/image.jpg",
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: testGroupId,
            name: "テストグループ",
            depositPeriod: 7,
          },
          executors: [],
          creator: {
            id: testUserId,
            image: "https://example.com/avatar.jpg",
            settings: {
              username: "作成者",
            },
          },
          reporters: [],
        },
      };

      mockGetCachedAuctionByAuctionId.mockResolvedValue(mockAuctionWithDetails);

      // Act
      const result = await getAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toStrictEqual(mockAuctionWithDetails);
      expect(mockGetCachedAuctionByAuctionId).toHaveBeenCalledWith(testAuctionId);
    });

    test("should return null when cache returns null", async () => {
      // Arrange
      mockGetCachedAuctionByAuctionId.mockResolvedValue(null);

      // Act
      const result = await getAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(mockGetCachedAuctionByAuctionId).toHaveBeenCalledWith(testAuctionId);
    });

    test("should return null when cache throws error", async () => {
      // Arrange
      mockGetCachedAuctionByAuctionId.mockRejectedValue(new Error("Cache error"));

      // Act
      const result = await getAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(mockGetCachedAuctionByAuctionId).toHaveBeenCalledWith(testAuctionId);
    });

    test("should handle empty string auctionId", async () => {
      // Arrange
      mockGetCachedAuctionByAuctionId.mockResolvedValue(null);

      // Act
      const result = await getAuctionByAuctionId("");

      // Assert
      expect(result).toBeNull();
      expect(mockGetCachedAuctionByAuctionId).toHaveBeenCalledWith("");
    });

    test("should handle undefined auctionId", async () => {
      // Arrange
      mockGetCachedAuctionByAuctionId.mockResolvedValue(null);

      // Act
      const result = await getAuctionByAuctionId(undefined as unknown as string);

      // Assert
      expect(result).toBeNull();
      expect(mockGetCachedAuctionByAuctionId).toHaveBeenCalledWith(undefined);
    });

    test("should handle auction with complex task data", async () => {
      // Arrange
      const mockComplexAuction = {
        id: testAuctionId,
        startTime: new Date("2024-01-01T09:00:00Z"),
        endTime: new Date("2024-01-02T09:00:00Z"),
        currentHighestBid: 500,
        currentHighestBidderId: testUserId,
        status: TaskStatus.AUCTION_ACTIVE,
        extensionTotalCount: 2,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 3,
        bidHistories: [
          {
            id: "bid-1",
            amount: 500,
            createdAt: new Date("2024-01-01T12:00:00Z"),
            isAutoBid: true,
            user: {
              settings: {
                username: "自動入札ユーザー",
              },
            },
          },
          {
            id: "bid-2",
            amount: 400,
            createdAt: new Date("2024-01-01T11:00:00Z"),
            isAutoBid: false,
            user: {
              settings: {
                username: "手動入札ユーザー",
              },
            },
          },
        ],
        task: {
          task: "複雑なテストタスク",
          detail: "これは複雑なテストタスクの詳細説明です。",
          imageUrl: "https://example.com/complex-image.jpg",
          status: TaskStatus.AUCTION_ACTIVE,
          category: "開発",
          group: {
            id: testGroupId,
            name: "開発グループ",
            depositPeriod: 14,
          },
          executors: [
            {
              user: {
                id: "executor-1",
                image: "https://example.com/executor1.jpg",
                settings: {
                  username: "実行者1",
                },
              },
            },
            {
              user: {
                id: "executor-2",
                image: "https://example.com/executor2.jpg",
                settings: {
                  username: "実行者2",
                },
              },
            },
          ],
          creator: {
            id: testUserId,
            image: "https://example.com/creator.jpg",
            settings: {
              username: "タスク作成者",
            },
          },
          reporters: [
            {
              user: {
                id: "reporter-1",
                image: "https://example.com/reporter1.jpg",
                settings: {
                  username: "報告者1",
                },
              },
            },
          ],
        },
      };

      mockGetCachedAuctionByAuctionId.mockResolvedValue(mockComplexAuction);

      // Act
      const result = await getAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toStrictEqual(mockComplexAuction);
      expect(result?.task.executors).toHaveLength(2);
      expect(result?.task.reporters).toHaveLength(1);
      expect(result?.bidHistories).toHaveLength(2);
    });

    test("should handle auction with null values in task data", async () => {
      // Arrange
      const mockAuctionWithNulls = {
        id: testAuctionId,
        startTime: new Date("2024-01-01T09:00:00Z"),
        endTime: new Date("2024-01-02T09:00:00Z"),
        currentHighestBid: 0,
        currentHighestBidderId: null,
        status: TaskStatus.PENDING,
        extensionTotalCount: 0,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        bidHistories: [],
        task: {
          task: "タスク名のみ",
          detail: null,
          imageUrl: null,
          status: TaskStatus.PENDING,
          category: null,
          group: {
            id: testGroupId,
            name: "グループ名",
            depositPeriod: 7,
          },
          executors: [],
          creator: {
            id: testUserId,
            image: null,
            settings: null,
          },
          reporters: [],
        },
      };

      mockGetCachedAuctionByAuctionId.mockResolvedValue(mockAuctionWithNulls);

      // Act
      const result = await getAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result).toStrictEqual(mockAuctionWithNulls);
      expect(result?.task.detail).toBeNull();
      expect(result?.task.imageUrl).toBeNull();
      expect(result?.task.category).toBeNull();
      expect(result?.task.creator.image).toBeNull();
      expect(result?.task.creator.settings).toBeNull();
    });
  });

  // 境界値テスト
  describe("boundary value tests", () => {
    test("should handle zero bid amount in getUpdatedAuctionByAuctionId", async () => {
      // Arrange
      const mockAuctionRaw = {
        id: testAuctionId,
        currentHighestBid: 0,
        currentHighestBidderId: null,
        extensionTotalCount: 0,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        task: {
          status: TaskStatus.PENDING,
        },
        bidHistories: [],
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getUpdatedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result?.currentHighestBid).toBe(0);
      expect(result?.currentHighestBidderId).toBeNull();
    });

    test("should handle maximum extension count", async () => {
      // Arrange
      const mockAuctionRaw = {
        id: testAuctionId,
        currentHighestBid: 100,
        currentHighestBidderId: testUserId,
        extensionTotalCount: 5,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 0,
        task: {
          status: TaskStatus.AUCTION_ACTIVE,
        },
        bidHistories: [],
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getUpdatedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result?.extensionTotalCount).toBe(5);
      expect(result?.extensionLimitCount).toBe(5);
      expect(result?.remainingTimeForExtension).toBe(0);
    });

    test("should handle very long auction ID", async () => {
      // Arrange
      const longAuctionId = "a".repeat(1000);
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getUpdatedAuctionByAuctionId(longAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: longAuctionId },
        select: mockSelectObject,
      });
    });
  });

  // 異常系テスト（不正な引数）
  describe("invalid input tests", () => {
    test("should handle null auctionId in getUpdatedAuctionByAuctionId", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getUpdatedAuctionByAuctionId(null as unknown as string);

      // Assert
      expect(result).toBeNull();
    });

    test("should handle null auctionId in getAuctionByAuctionId", async () => {
      // Arrange
      mockGetCachedAuctionByAuctionId.mockResolvedValue(null);

      // Act
      const result = await getAuctionByAuctionId(null as unknown as string);

      // Assert
      expect(result).toBeNull();
      expect(mockGetCachedAuctionByAuctionId).toHaveBeenCalledWith(null);
    });

    test("should handle special characters in auctionId", async () => {
      // Arrange
      const specialCharAuctionId = "auction-!@#$%^&*()_+-=[]{}|;':\",./<>?";
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act
      const result = await getUpdatedAuctionByAuctionId(specialCharAuctionId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith({
        where: { id: specialCharAuctionId },
        select: mockSelectObject,
      });
    });

    test("should handle malformed auction data from database", async () => {
      // Arrange
      const malformedAuctionRaw = {
        id: testAuctionId,
        // currentHighestBid: undefined, // 必須フィールドが欠けている
        currentHighestBidderId: testUserId,
        extensionTotalCount: 0,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        task: {
          status: TaskStatus.AUCTION_ACTIVE,
        },
        bidHistories: [],
      };

      prismaMock.auction.findUnique.mockResolvedValue(malformedAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getUpdatedAuctionByAuctionId(testAuctionId);

      // Assert
      // 不正なデータでもエラーを投げずにnullを返すか、適切に処理されることを確認
      expect(result).toBeDefined();
    });
  });

  // パフォーマンステスト
  describe("performance tests", () => {
    test("should handle large number of bid histories", async () => {
      // Arrange
      const largeBidHistories = Array.from({ length: 100 }, (_, index) => ({
        id: `bid-${index}`,
        amount: 100 + index,
        createdAt: new Date(`2024-01-01T${String(10 + (index % 14)).padStart(2, "0")}:00:00Z`),
        isAutoBid: index % 2 === 0,
        user: {
          settings: {
            username: `ユーザー${index}`,
          },
        },
      }));

      const mockAuctionRaw = {
        id: testAuctionId,
        currentHighestBid: 199,
        currentHighestBidderId: testUserId,
        extensionTotalCount: 0,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 5,
        task: {
          status: TaskStatus.AUCTION_ACTIVE,
        },
        bidHistories: largeBidHistories,
      };

      prismaMock.auction.findUnique.mockResolvedValue(mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>);

      // Act
      const result = await getUpdatedAuctionByAuctionId(testAuctionId);

      // Assert
      expect(result?.bidHistories).toHaveLength(100);
      expect(result?.bidHistories[0].amount).toBe(100);
      expect(result?.bidHistories[99].amount).toBe(199);
    });
  });
});
