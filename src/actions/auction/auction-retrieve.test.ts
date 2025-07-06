import type { AuctionWithDetails } from "@/types/auction-types";
import type { Prisma } from "@prisma/client";
import { getCachedAuctionByAuctionId } from "@/actions/auction/cache/cache-auction-retrieve";
import { getAuctionUpdateSelect } from "@/lib/constants";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getAuctionByAuctionId, getUpdatedAuctionByAuctionId } from "./auction-retrieve";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モックのオブジェクト
 */
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 定数とヘルパー関数のモック
 */
vi.mock("@/lib/constants", () => ({
  AUCTION_CONSTANTS: {
    DISPLAY: {
      BID_HISTORY_LIMIT: 10,
    },
  },
  getAuctionUpdateSelect: vi.fn(() => mockSelectObject),
}));

vi.mock("@/actions/auction/cache/cache-auction-retrieve", () => ({
  getCachedAuctionByAuctionId: vi.fn(),
  __esModule: true,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * キャッシュ関数のモック
 */
const mockGetCachedAuctionByAuctionId = vi.mocked(getCachedAuctionByAuctionId);
const mockGetAuctionUpdateSelect = vi.mocked(getAuctionUpdateSelect);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
  // mockGetCachedAuctionByAuctionId.mockReset(); は削除 - vitest のモック関数にはmockResetメソッドがない場合がある
  mockGetAuctionUpdateSelect.mockReset();
  // モック関数のデフォルト戻り値を設定
  mockGetAuctionUpdateSelect.mockReturnValue(mockSelectObject as Prisma.AuctionSelect);
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの定義
 */
const testAuctionId = "test-auction-id";
const testUserId = "test-user-id";
const testGroupId = "test-group-id";

/**
 * 共通のテストデータファクトリー関数
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockAuctionRaw = (overrides: Partial<any> = {}) => ({
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
  ...overrides,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockAuctionWithDetails = (overrides: Partial<any> = {}) => ({
  id: testAuctionId,
  startTime: new Date("2024-01-01T09:00:00Z"),
  endTime: new Date("2024-01-02T09:00:00Z"),
  createdAt: new Date("2024-01-01T08:00:00Z"),
  updatedAt: new Date("2024-01-01T08:00:00Z"),
  taskId: "test-task-id",
  winnerId: null,
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
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("auction-retrieve", () => {
  // getUpdatedAuctionByAuctionIdのテスト
  describe("getUpdatedAuctionByAuctionId", () => {
    describe("正常系", () => {
      test("should return updated auction data when auction exists", async () => {
        // Arrange
        const mockAuctionRaw = createMockAuctionRaw();
        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

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

      test("should handle auction with multiple bid histories", async () => {
        // Arrange
        const mockAuctionRaw = createMockAuctionRaw({
          currentHighestBid: 200,
          extensionTotalCount: 1,
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
        });

        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getUpdatedAuctionByAuctionId(testAuctionId);

        // Assert
        expect(result?.bidHistories).toHaveLength(2);
        expect(result?.bidHistories[0].amount).toBe(200);
        expect(result?.bidHistories[0].isAutoBid).toBe(true);
        expect(result?.bidHistories[1].amount).toBe(150);
        expect(result?.bidHistories[1].isAutoBid).toBe(false);
      });

      test.each([
        TaskStatus.PENDING,
        TaskStatus.AUCTION_ACTIVE,
        TaskStatus.AUCTION_ENDED,
        TaskStatus.SUPPLIER_DONE,
        TaskStatus.TASK_COMPLETED,
      ])("should handle different task statuses", async (status) => {
        // Arrange
        const mockAuctionRaw = createMockAuctionRaw({
          task: { status },
          bidHistories: [],
        });

        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getUpdatedAuctionByAuctionId(testAuctionId);

        // Assert
        expect(result?.status).toBe(status);
      });

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

        const mockAuctionRaw = createMockAuctionRaw({
          currentHighestBid: 199,
          bidHistories: largeBidHistories,
        });

        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getUpdatedAuctionByAuctionId(testAuctionId);

        // Assert
        expect(result?.bidHistories).toHaveLength(100);
        expect(result?.bidHistories[0].amount).toBe(100);
        expect(result?.bidHistories[99].amount).toBe(199);
      });
    });

    describe("境界値・null値のテスト", () => {
      test("should handle auction with user settings null", async () => {
        // Arrange
        const mockAuctionRaw = createMockAuctionRaw({
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
        });

        prismaMock.auction.findUnique.mockResolvedValue(
          mockAuctionRaw as unknown as Awaited<ReturnType<typeof prismaMock.auction.findUnique>>,
        );

        // Act
        const result = await getUpdatedAuctionByAuctionId(testAuctionId);

        // Assert
        expect(result?.bidHistories[0].user.settings).toBeNull();
      });
    });

    describe("異常系・エラーハンドリング", () => {
      test.each(["", null, undefined])("should throw error when auctionId is empty or falsy", async (invalidId) => {
        // Act & Assert
        await expect(getUpdatedAuctionByAuctionId(invalidId as unknown as string)).rejects.toThrow(
          "オークションIDが指定されていません",
        );
      });

      test("should throw error when auction does not exist", async () => {
        // Arrange
        prismaMock.auction.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(getUpdatedAuctionByAuctionId(testAuctionId)).rejects.toThrow("オークション情報が見つかりません");
      });

      test("should throw error when database error occurs", async () => {
        // Arrange
        prismaMock.auction.findUnique.mockRejectedValue(new Error("Database error"));

        // Act & Assert
        await expect(getUpdatedAuctionByAuctionId(testAuctionId)).rejects.toThrow("Database error");
      });
    });
  });

  // getAuctionByAuctionIdのテスト
  describe("getAuctionByAuctionId", () => {
    describe("正常系", () => {
      test("should return auction data when cache returns data", async () => {
        // Arrange
        const mockAuctionWithDetails = createMockAuctionWithDetails();
        mockGetCachedAuctionByAuctionId.mockResolvedValue(mockAuctionWithDetails);

        // Act
        const result = await getAuctionByAuctionId(testAuctionId);

        // Assert
        expect(result).toStrictEqual(mockAuctionWithDetails);
        expect(mockGetCachedAuctionByAuctionId).toHaveBeenCalledWith(testAuctionId);
      });

      test.each(["", null, undefined])("should return null for invalid auctionId values", async (invalidId) => {
        // Arrange
        mockGetCachedAuctionByAuctionId.mockResolvedValue(null as unknown as AuctionWithDetails);

        // Act
        const result = await getAuctionByAuctionId(invalidId as unknown as string);

        // Assert
        expect(result).toBeNull();
        expect(mockGetCachedAuctionByAuctionId).toHaveBeenCalledWith(invalidId);
      });

      test("should propagate error when cache throws error", async () => {
        // Arrange
        mockGetCachedAuctionByAuctionId.mockRejectedValue(new Error("Cache error"));

        // Act & Assert
        await expect(getAuctionByAuctionId(testAuctionId)).rejects.toThrow("Cache error");

        expect(mockGetCachedAuctionByAuctionId).toHaveBeenCalledWith(testAuctionId);
      });
    });
  });
});
