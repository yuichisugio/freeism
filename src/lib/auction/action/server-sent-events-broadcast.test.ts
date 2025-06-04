import type { TaskStatus } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { Factory } from "fishery";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { UpdateAuctionWithDetails } from "../../../types/auction-types";
import { sendEventToAuctionSubscribers } from "./server-sent-events-broadcast";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// UpdateAuctionWithDetailsファクトリー
const updateAuctionWithDetailsFactory = Factory.define<UpdateAuctionWithDetails>(({ sequence, params }) => ({
  id: params.id ?? `auction-${sequence}`,
  currentHighestBid: params.currentHighestBid ?? faker.number.int({ min: 100, max: 10000 }),
  currentHighestBidderId: params.currentHighestBidderId ?? `bidder-${sequence}`,
  status: params.status ?? ("AUCTION_ACTIVE" as TaskStatus),
  extensionTotalCount: params.extensionTotalCount ?? 0,
  extensionLimitCount: params.extensionLimitCount ?? 3,
  extensionTime: params.extensionTime ?? 10,
  remainingTimeForExtension: params.remainingTimeForExtension ?? 5,
  bidHistories: params.bidHistories ?? [
    {
      id: `bid-${sequence}`,
      amount: faker.number.int({ min: 100, max: 1000 }),
      createdAt: "2025-01-01T00:00:00.000Z", // 固定値を使用してテストの一貫性を保つ
      isAutoBid: false,
      user: {
        settings: {
          username: faker.person.fullName(),
        },
      },
    },
  ],
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

const createTestUpdateAuctionData = (overrides: Partial<UpdateAuctionWithDetails> = {}): UpdateAuctionWithDetails => {
  return updateAuctionWithDetailsFactory.build(overrides);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストセットアップ
 */

// モック変数
let mockFetch: ReturnType<typeof vi.fn>;
let mockDateNow: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // fetchのモック
  mockFetch = vi.fn();
  global.fetch = mockFetch;

  // Date.nowのモック（一貫したタイムスタンプのため）
  mockDateNow = vi.fn().mockReturnValue(1234567890000);
  vi.spyOn(Date, "now").mockImplementation(mockDateNow);

  // 環境変数のモック
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.com");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

  // デフォルトのfetchレスポンス（成功）
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
  } as Response);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストケース
 */

describe("sendEventToAuctionSubscribers", () => {
  describe("正常系", () => {
    test("should send event to Redis Pub/Sub successfully", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        currentHighestBid: 1500,
      });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith("https://test.upstash.com/publish/auction%3Atest-auction-123%3Aevents", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-token",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          data: testData,
          timestamp: 1234567890000,
        }),
        cache: "no-cache",
      });
    });

    test("should handle different auction IDs correctly", async () => {
      // Arrange
      const auctionId = "different-auction-456";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        currentHighestBid: 2000,
      });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.upstash.com/publish/auction%3Adifferent-auction-456%3Aevents",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            data: testData,
            timestamp: 1234567890000,
          }),
        }),
      );
    });

    test("should encode special characters in auction ID", async () => {
      // Arrange
      const auctionId = "auction-with-special-chars!@#$%";
      const testData = createTestUpdateAuctionData({ id: auctionId });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.upstash.com/publish/auction%3Aauction-with-special-chars!%40%23%24%25%3Aevents",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });

  describe("異常系", () => {
    test("should throw error when fetch fails", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });
      const fetchError = new Error("Network error");
      mockFetch.mockRejectedValue(fetchError);

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow("Network error");
    });

    test("should not throw error when Redis returns error status (current implementation)", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      // Act & Assert
      // 現在の実装では、HTTPエラーステータスでも例外を投げない
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("should handle undefined environment variables", async () => {
      // Arrange
      vi.unstubAllEnvs();
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "undefined/publish/auction%3Atest-auction-123%3Aevents",
        expect.objectContaining({
          headers: {
            Authorization: "Bearer undefined",
            Accept: "text/event-stream",
          },
        }),
      );
    });
  });

  describe("境界値テスト", () => {
    test("should handle empty auction ID", async () => {
      // Arrange
      const auctionId = "";
      const testData = createTestUpdateAuctionData({ id: auctionId });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.upstash.com/publish/auction%3A%3Aevents",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    test("should handle very long auction ID", async () => {
      // Arrange
      const auctionId = "a".repeat(1000);
      const testData = createTestUpdateAuctionData({ id: auctionId });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain("auction%3A" + "a".repeat(1000) + "%3Aevents");
    });

    test("should handle minimum bid amount", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        currentHighestBid: 0,
      });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            data: testData,
            timestamp: 1234567890000,
          }),
        }),
      );
    });

    test("should handle maximum bid amount", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        currentHighestBid: Number.MAX_SAFE_INTEGER,
      });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            data: testData,
            timestamp: 1234567890000,
          }),
        }),
      );
    });

    test("should handle null currentHighestBidderId", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        currentHighestBidderId: null,
      });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            data: testData,
            timestamp: 1234567890000,
          }),
        }),
      );
    });

    test("should handle empty bid histories", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        bidHistories: [],
      });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            data: testData,
            timestamp: 1234567890000,
          }),
        }),
      );
    });
  });

  describe("データ形式テスト", () => {
    test("should create correct event payload structure", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        bidHistories: [
          {
            id: "bid-test",
            amount: 1000,
            createdAt: "2025-01-01T00:00:00.000Z",
            isAutoBid: false,
            user: {
              settings: {
                username: "Test User",
              },
            },
          },
        ],
      });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs.length).toBe(2);

      const requestInit = callArgs[1] as RequestInit;
      expect(requestInit.body).toBeDefined();

      const requestBody = JSON.parse(requestInit.body as string) as { data: UpdateAuctionWithDetails; timestamp: number };

      // データ構造の確認
      expect(requestBody).toHaveProperty("data");
      expect(requestBody).toHaveProperty("timestamp");
      expect(requestBody.timestamp).toBe(1234567890000);
      expect(requestBody.data).toStrictEqual(testData);
    });

    test("should use correct Redis channel format", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      const url = callArgs[0];

      expect(url).toBe("https://test.upstash.com/publish/auction%3Atest-auction-123%3Aevents");
    });

    test("should include all required headers", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = callArgs[1].headers as Record<string, string>;

      expect(headers).toStrictEqual({
        Authorization: "Bearer test-token",
        Accept: "text/event-stream",
      });
    });
  });
});
