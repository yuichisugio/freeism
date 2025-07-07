import type { AuctionHistoryCreatedDetail } from "@/types/auction-types";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedAuctionHistoryCreatedDetail } from "./cache-auction-history";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */
vi.mock("next/cache", () => ({
  unstable_cacheTag: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モックリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータファクトリー
 */
const CONSTANTS = {
  testAuctionId: "test-auction-id",
  testTaskId: "test-task-id",
  testUserId: "test-user-id",
  testCreatorId: "test-creator-id",
  testWinnerId: "test-winner-id",
  testBidHistoryId: "test-bid-history-id",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 基本的なモックデータを作成するヘルパー関数
 */
const createBaseMockData = (overrides: Partial<AuctionHistoryCreatedDetail> = {}): AuctionHistoryCreatedDetail => {
  const baseData: AuctionHistoryCreatedDetail = {
    id: CONSTANTS.testAuctionId,
    currentHighestBid: 500,
    startTime: new Date("2024-01-01T00:00:00Z"),
    endTime: new Date("2024-12-31T23:59:59Z"),
    task: {
      id: CONSTANTS.testTaskId,
      task: "テストタスク",
      detail: "テストタスクの詳細",
      imageUrl: "https://example.com/image.jpg",
      status: TaskStatus.PENDING,
      deliveryMethod: "オンライン",
      creatorId: CONSTANTS.testCreatorId,
      executors: [{ userId: CONSTANTS.testUserId }],
      reporters: [{ userId: CONSTANTS.testUserId }],
    },
    winner: {
      id: CONSTANTS.testWinnerId,
      name: "落札者",
      image: "https://example.com/winner.jpg",
    },
    winnerId: CONSTANTS.testWinnerId,
    bidHistories: [
      {
        id: CONSTANTS.testBidHistoryId,
        amount: 500,
        isAutoBid: false,
        createdAt: new Date("2024-01-01T12:00:00Z"),
        user: {
          id: CONSTANTS.testUserId,
          name: "テストユーザー",
          image: "https://example.com/user.jpg",
        },
      },
    ],
  };

  return {
    ...baseData,
    ...overrides,
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 期待される結果構造を作成するヘルパー関数
 */
const createExpectedResult = (data: AuctionHistoryCreatedDetail) => ({
  success: true,
  message: "出品商品の詳細を取得しました",
  data,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通のPrismaクエリ期待値
 */
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストケース
 */
describe("cache-auction-history", () => {
  describe("getCachedAuctionHistoryCreatedDetail", () => {
    describe("正常系", () => {
      test("オークション履歴詳細が正常に取得できる", async () => {
        // Arrange
        const mockData = createBaseMockData();
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(prismaMock.auction.findUnique).toHaveBeenCalledWith(getExpectedPrismaQuery(CONSTANTS.testAuctionId));
      });

      test("複数の入札履歴がある場合", async () => {
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
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result.data.bidHistories).toHaveLength(2);
        expect(result.data.bidHistories[0].amount).toBe(1000);
        expect(result.data.bidHistories[1].amount).toBe(500);
      });

      test("100件の入札履歴がある場合（制限値）", async () => {
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
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result.data.bidHistories).toHaveLength(100);
      });

      test("キャッシュタグが正しく設定される", async () => {
        // Arrange
        const mockData = createBaseMockData();
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );
        const { unstable_cacheTag } = await import("next/cache");

        // Act
        await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(vi.mocked(unstable_cacheTag)).toHaveBeenCalledWith(
          `auctionHistory:auctionByAuctionId:${CONSTANTS.testAuctionId}`,
        );
      });

      test("winner情報がnullの場合", async () => {
        // Arrange
        const mockData = createBaseMockData({ winner: null, winnerId: null });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.winner).toBeNull();
        expect(result.data.winnerId).toBeNull();
      });

      test("bidHistoriesが空の場合", async () => {
        // Arrange
        const mockData = createBaseMockData({ bidHistories: [] });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.bidHistories).toHaveLength(0);
      });

      test("task.detailがnullの場合", async () => {
        // Arrange
        const mockData = createBaseMockData({
          task: {
            detail: null,
            id: CONSTANTS.testTaskId,
            task: "テスク",
            imageUrl: "https://example.com/image.jpg",
            status: TaskStatus.PENDING,
            deliveryMethod: "オンライン",
            creatorId: CONSTANTS.testCreatorId,
            executors: [{ userId: CONSTANTS.testUserId }],
            reporters: [{ userId: CONSTANTS.testUserId }],
          },
        });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.task.detail).toBeNull();
      });

      test("task.imageUrlがnullの場合", async () => {
        // Arrange
        const mockData = createBaseMockData({
          task: {
            imageUrl: null,
            id: CONSTANTS.testTaskId,
            task: "テスク",
            detail: "テスクの詳細",
            status: TaskStatus.PENDING,
            deliveryMethod: "オンライン",
            creatorId: CONSTANTS.testCreatorId,
            executors: [{ userId: CONSTANTS.testUserId }],
            reporters: [{ userId: CONSTANTS.testUserId }],
          },
        });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.task.imageUrl).toBeNull();
      });

      test("task.deliveryMethodがnullの場合", async () => {
        // Arrange
        const mockData = createBaseMockData({
          task: {
            deliveryMethod: null,
            id: CONSTANTS.testTaskId,
            task: "テスク",
            detail: "テスクの詳細",
            status: TaskStatus.PENDING,
            imageUrl: "https://example.com/image.jpg",
            creatorId: CONSTANTS.testCreatorId,
            executors: [{ userId: CONSTANTS.testUserId }],
            reporters: [{ userId: CONSTANTS.testUserId }],
          },
        });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.task.deliveryMethod).toBeNull();
      });

      test("executorsが空の場合", async () => {
        // Arrange
        const mockData = createBaseMockData({
          task: {
            executors: [],
            id: CONSTANTS.testTaskId,
            imageUrl: null,
            task: "テスク",
            detail: "テスクの詳細",
            status: TaskStatus.PENDING,
            deliveryMethod: "オンライン",
            creatorId: CONSTANTS.testCreatorId,
            reporters: [{ userId: CONSTANTS.testUserId }],
          },
        });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.task.executors).toHaveLength(0);
      });

      test("reportersが空の場合", async () => {
        // Arrange
        const mockData = createBaseMockData({
          task: {
            reporters: [],
            id: CONSTANTS.testTaskId,
            imageUrl: null,
            task: "テスク",
            detail: "テスクの詳細",
            status: TaskStatus.PENDING,
            deliveryMethod: "オンライン",
            creatorId: CONSTANTS.testCreatorId,
            executors: [{ userId: CONSTANTS.testUserId }],
          },
        });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.task.reporters).toHaveLength(0);
      });
    });

    describe("異常系", () => {
      test("auctionIdが空文字の場合はエラーが発生する", async () => {
        // Act & Assert
        await expect(getCachedAuctionHistoryCreatedDetail("")).rejects.toThrow("auctionId is required");
      });

      test("auctionIdがnullの場合はエラーが発生する", async () => {
        // Act & Assert
        await expect(getCachedAuctionHistoryCreatedDetail(null as unknown as string)).rejects.toThrow(
          "auctionId is required",
        );
      });

      test("auctionIdがundefinedの場合はエラーが発生する", async () => {
        // Act & Assert
        await expect(getCachedAuctionHistoryCreatedDetail(undefined as unknown as string)).rejects.toThrow(
          "auctionId is required",
        );
      });

      test("オークションが見つからない場合はエラーが発生する", async () => {
        // Arrange
        prismaMock.auction.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(getCachedAuctionHistoryCreatedDetail("non-existent-id")).rejects.toThrow("auction not found");
      });

      test("データベースエラーが発生する場合", async () => {
        // Arrange
        const error = new Error("Database connection error");
        prismaMock.auction.findUnique.mockRejectedValue(error);

        // Act & Assert
        await expect(getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId)).rejects.toThrow(
          "Database connection error",
        );
      });

      test("オークションが見つからない場合はキャッシュタグが設定されない", async () => {
        // Arrange
        prismaMock.auction.findUnique.mockResolvedValue(null);
        const { unstable_cacheTag } = await import("next/cache");

        // Act & Assert
        await expect(getCachedAuctionHistoryCreatedDetail("non-existent-id")).rejects.toThrow("auction not found");
        expect(vi.mocked(unstable_cacheTag)).not.toHaveBeenCalled();
      });

      // 不正な引数のテストケースをパラメータ化
      test.each([
        { description: "空文字", value: "" },
        { description: "null", value: null },
        { description: "undefined", value: undefined },
        { description: "数値", value: 123 as unknown as string },
        { description: "真偽値", value: true as unknown as string },
        { description: "オブジェクト", value: { id: "test" } as unknown as string },
        { description: "配列", value: ["test"] as unknown as string },
      ])("不正な引数テスト: auctionIdが$descriptionの場合", async ({ value }) => {
        // Act & Assert
        await expect(getCachedAuctionHistoryCreatedDetail(value as unknown as string)).rejects.toThrow(
          "auctionId is required",
        );
        expect(prismaMock.auction.findUnique).not.toHaveBeenCalled();
      });
    });

    describe("境界値テスト", () => {
      test("currentHighestBidが0の場合", async () => {
        // Arrange
        const mockData = createBaseMockData({ currentHighestBid: 0 });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.currentHighestBid).toBe(0);
      });

      test("currentHighestBidが最大値の場合", async () => {
        // Arrange
        const mockData = createBaseMockData({ currentHighestBid: Number.MAX_SAFE_INTEGER });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.currentHighestBid).toBe(Number.MAX_SAFE_INTEGER);
      });

      test("過去の日付の場合", async () => {
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
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.startTime).toStrictEqual(pastDate);
        expect(result.data.endTime).toStrictEqual(pastDate);
      });

      test("未来の日付の場合", async () => {
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
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.startTime).toStrictEqual(futureDate);
        expect(result.data.endTime).toStrictEqual(futureDate);
      });

      test("task.statusがTASK_COMPLETEDの場合", async () => {
        // Arrange
        const mockData = createBaseMockData({
          task: {
            status: TaskStatus.TASK_COMPLETED,
            id: CONSTANTS.testTaskId,
            task: "テスク",
            detail: "テスクの詳細",
            imageUrl: "https://example.com/image.jpg",
            deliveryMethod: "オンライン",
            creatorId: CONSTANTS.testCreatorId,
            executors: [{ userId: CONSTANTS.testUserId }],
            reporters: [{ userId: CONSTANTS.testUserId }],
          },
        });
        prismaMock.auction.findUnique.mockResolvedValue(
          mockData as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getCachedAuctionHistoryCreatedDetail(CONSTANTS.testAuctionId);

        // Assert
        expect(result).toStrictEqual(createExpectedResult(mockData));
        expect(result.data.task.status).toBe(TaskStatus.TASK_COMPLETED);
      });
    });
  });
});
