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

// テストデータファクトリー
const createTestData = () => ({
  testAuctionId: "test-auction-id",
  testTaskId: "test-task-id",
  testUserId: "test-user-id",
  testCreatorId: "test-creator-id",
  testWinnerId: "test-winner-id",
  testBidHistoryId: "test-bid-history-id",
});

// 基本的なモックデータを作成するヘルパー関数
const createBaseMockData = (overrides: Record<string, unknown> = {}): MockPrismaAuctionData => {
  const testData = createTestData();

  const baseData: MockPrismaAuctionData = {
    id: testData.testAuctionId,
    currentHighestBid: 500,
    startTime: new Date("2024-01-01T00:00:00Z"),
    endTime: new Date("2024-12-31T23:59:59Z"),
    task: {
      id: testData.testTaskId,
      task: "テストタスク",
      detail: "テストタスクの詳細",
      imageUrl: "https://example.com/image.jpg",
      status: TaskStatus.PENDING,
      deliveryMethod: "オンライン",
      creatorId: testData.testCreatorId,
      executors: [{ userId: testData.testUserId }],
      reporters: [{ userId: testData.testUserId }],
    },
    winner: {
      id: testData.testWinnerId,
      name: "落札者",
      image: "https://example.com/winner.jpg",
    },
    winnerId: testData.testWinnerId,
    bidHistories: [
      {
        id: testData.testBidHistoryId,
        amount: 500,
        isAutoBid: false,
        createdAt: new Date("2024-01-01T12:00:00Z"),
        user: {
          id: testData.testUserId,
          name: "テストユーザー",
          image: "https://example.com/user.jpg",
        },
      },
    ],
  };

  // Simple merge for overrides
  return { ...baseData, ...overrides } as MockPrismaAuctionData;
};

// 期待される結果を作成するヘルパー関数
const createExpectedResult = (mockData: MockPrismaAuctionData) => ({
  ...mockData,
  status: mockData.task.status,
});

// 共通のPrismaクエリ期待値
const getExpectedPrismaQuery = (auctionId: string) => ({
  where: { id: auctionId },
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
        executors: { select: { userId: true } },
        reporters: { select: { userId: true } },
      },
    },
    winner: { select: { id: true, name: true, image: true } },
    winnerId: true,
    bidHistories: {
      orderBy: { amount: "desc" },
      take: 100,
      select: {
        id: true,
        amount: true,
        isAutoBid: true,
        createdAt: true,
        user: { select: { id: true, name: true, image: true } },
      },
    },
  },
});

describe("cache-auction-history", () => {
  describe("getCachedAuctionHistoryCreatedDetail", () => {
    const testData = createTestData();

    test("正常系: オークション履歴詳細が正常に取得できる", async () => {
      // Arrange
      const mockData = createBaseMockData();
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith(getExpectedPrismaQuery(testData.testAuctionId));
    });

    test("異常系: auctionIdが空文字の場合はエラーが発生する", async () => {
      // Act & Assert
      await expect(getCachedAuctionHistoryCreatedDetail("")).rejects.toThrow("auctionId is required");
    });

    test("異常系: auctionIdがnullの場合はエラーが発生する", async () => {
      // Act & Assert
      await expect(getCachedAuctionHistoryCreatedDetail(null as unknown as string)).rejects.toThrow(
        "auctionId is required",
      );
    });

    test("異常系: auctionIdがundefinedの場合はエラーが発生する", async () => {
      // Act & Assert
      await expect(getCachedAuctionHistoryCreatedDetail(undefined as unknown as string)).rejects.toThrow(
        "auctionId is required",
      );
    });

    test("異常系: オークションが見つからない場合はエラーが発生する", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(getCachedAuctionHistoryCreatedDetail("non-existent-id")).rejects.toThrow("auction not found");
    });

    test("異常系: データベースエラーが発生する場合", async () => {
      // Arrange
      const error = new Error("Database connection error");
      prismaMock.auction.findUnique.mockRejectedValue(error);

      // Act & Assert
      await expect(getCachedAuctionHistoryCreatedDetail(testData.testAuctionId)).rejects.toThrow(
        "Database connection error",
      );
    });

    test("正常系: winner情報がnullの場合", async () => {
      // Arrange
      const mockData = createBaseMockData({ winner: null, winnerId: null });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.winner).toBeNull();
      expect(result.winnerId).toBeNull();
    });

    test("正常系: bidHistoriesが空の場合", async () => {
      // Arrange
      const mockData = createBaseMockData({ bidHistories: [] });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.bidHistories).toHaveLength(0);
    });

    test("正常系: task.detailがnullの場合", async () => {
      // Arrange
      const baseData = createBaseMockData();
      const mockData = {
        ...baseData,
        task: {
          ...baseData.task,
          detail: null,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.task.detail).toBeNull();
    });

    test("正常系: task.imageUrlがnullの場合", async () => {
      // Arrange
      const baseData = createBaseMockData();
      const mockData = {
        ...baseData,
        task: {
          ...baseData.task,
          imageUrl: null,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.task.imageUrl).toBeNull();
    });

    test("正常系: task.deliveryMethodがnullの場合", async () => {
      // Arrange
      const baseData = createBaseMockData();
      const mockData = {
        ...baseData,
        task: {
          ...baseData.task,
          deliveryMethod: null,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.task.deliveryMethod).toBeNull();
    });

    test("正常系: executorsが空の場合", async () => {
      // Arrange
      const baseData = createBaseMockData();
      const mockData = {
        ...baseData,
        task: {
          ...baseData.task,
          executors: [],
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.task.executors).toHaveLength(0);
    });

    test("正常系: reportersが空の場合", async () => {
      // Arrange
      const baseData = createBaseMockData();
      const mockData = {
        ...baseData,
        task: {
          ...baseData.task,
          reporters: [],
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.task.reporters).toHaveLength(0);
    });

    // 境界値テストケース
    test("境界値テスト: currentHighestBidが0の場合", async () => {
      // Arrange
      const mockData = createBaseMockData({ currentHighestBid: 0 });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.currentHighestBid).toBe(0);
    });

    test("境界値テスト: currentHighestBidが最大値の場合", async () => {
      // Arrange
      const mockData = createBaseMockData({ currentHighestBid: Number.MAX_SAFE_INTEGER });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.currentHighestBid).toBe(Number.MAX_SAFE_INTEGER);
    });

    test("境界値テスト: 過去の日付の場合", async () => {
      // Arrange
      const pastDate = new Date("2020-01-01T00:00:00Z");
      const mockData = createBaseMockData({
        startTime: pastDate,
        endTime: pastDate,
      });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.startTime).toStrictEqual(pastDate);
      expect(result.endTime).toStrictEqual(pastDate);
    });

    test("境界値テスト: 未来の日付の場合", async () => {
      // Arrange
      const futureDate = new Date("2030-12-31T23:59:59Z");
      const mockData = createBaseMockData({
        startTime: futureDate,
        endTime: futureDate,
      });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.startTime).toStrictEqual(futureDate);
      expect(result.endTime).toStrictEqual(futureDate);
    });

    test("境界値テスト: task.statusがTASK_COMPLETEDの場合", async () => {
      // Arrange
      const baseData = createBaseMockData();
      const mockData = {
        ...baseData,
        task: {
          ...baseData.task,
          status: TaskStatus.TASK_COMPLETED,
        },
      };
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result).toStrictEqual(createExpectedResult(mockData));
      expect(result.task.status).toBe(TaskStatus.TASK_COMPLETED);
      expect(result.status).toBe(TaskStatus.TASK_COMPLETED);
    });

    test("正常系: 複数の入札履歴がある場合", async () => {
      // Arrange
      const multipleBidHistories = [
        {
          id: "bid-1",
          amount: 1000,
          isAutoBid: true,
          createdAt: new Date("2024-01-02T12:00:00Z"),
          user: { id: "user-1", name: "ユーザー1", image: "https://example.com/user1.jpg" },
        },
        {
          id: "bid-2",
          amount: 500,
          isAutoBid: false,
          createdAt: new Date("2024-01-01T12:00:00Z"),
          user: { id: "user-2", name: "ユーザー2", image: "https://example.com/user2.jpg" },
        },
      ];
      const mockData = createBaseMockData({ bidHistories: multipleBidHistories });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result.bidHistories).toHaveLength(2);
      expect(result.bidHistories[0].amount).toBe(1000);
      expect(result.bidHistories[1].amount).toBe(500);
    });

    test("正常系: 100件の入札履歴がある場合（制限値）", async () => {
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
      const mockData = createBaseMockData({ bidHistories: exactlyHundredBids });
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );

      // Act
      const result = await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(result.bidHistories).toHaveLength(100);
    });

    test("正常系: キャッシュタグが正しく設定される", async () => {
      // Arrange
      const mockData = createBaseMockData();
      prismaMock.auction.findUnique.mockResolvedValue(
        mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
      );
      const { unstable_cacheTag } = await import("next/cache");

      // Act
      await getCachedAuctionHistoryCreatedDetail(testData.testAuctionId);

      // Assert
      expect(vi.mocked(unstable_cacheTag)).toHaveBeenCalledWith(
        `auction-history-created-detail:${testData.testTaskId}`,
      );
    });

    test("異常系: オークションが見つからない場合はキャッシュタグが設定されない", async () => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);
      const { unstable_cacheTag } = await import("next/cache");

      // Act & Assert
      await expect(getCachedAuctionHistoryCreatedDetail("non-existent-id")).rejects.toThrow("auction not found");
      expect(vi.mocked(unstable_cacheTag)).not.toHaveBeenCalled();
    });

    // 不正な引数のテストケースをパラメータ化
    test.each([
      { description: "数値", value: 123 as unknown as string },
      { description: "真偽値", value: true as unknown as string },
      { description: "オブジェクト", value: { id: "test" } as unknown as string },
      { description: "配列", value: ["test"] as unknown as string },
      { description: "特殊文字", value: "!@#$%^&*()" },
      { description: "長い文字列", value: "a".repeat(1000) },
    ])("不正な引数テスト: auctionIdが$descriptionの場合", async ({ value }) => {
      // Arrange
      prismaMock.auction.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(getCachedAuctionHistoryCreatedDetail(value)).rejects.toThrow("auction not found");
      expect(prismaMock.auction.findUnique).toHaveBeenCalledWith(getExpectedPrismaQuery(value));
    });
  });
});
