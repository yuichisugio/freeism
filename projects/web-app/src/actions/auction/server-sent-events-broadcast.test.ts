import type { UpdateAuctionWithDetails } from "@/types/auction-types";
import { sendEventToAuctionSubscribers } from "@/actions/auction/server-sent-events-broadcast";
import { faker } from "@faker-js/faker";
import { Factory } from "fishery";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// UpdateAuctionWithDetailsファクトリー
const updateAuctionWithDetailsFactory = Factory.define<UpdateAuctionWithDetails>(({ sequence, params }) => ({
  id: params.id ?? `auction-${sequence}`,
  currentHighestBid: params.currentHighestBid ?? faker.number.int({ min: 100, max: 10000 }),
  currentHighestBidderId: params.currentHighestBidderId ?? `bidder-${sequence}`,
  status: params.status ?? "AUCTION_ACTIVE",
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
  });
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

    test("should encode special characters in auction ID", async () => {
      // Arrange
      const auctionId = "auction-with-special-chars!@#$%";
      const testData = createTestUpdateAuctionData({ id: auctionId });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.upstash.com/publish/auction%3Aauction-with-special-chars!%40%23%24%25%3Aevents",
        {
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
        },
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
  });

  describe("異常系 - 基本的なバリデーション", () => {
    test("should throw error when auctionId is empty string", async () => {
      // Arrange
      const auctionId = "";
      const testData = createTestUpdateAuctionData();

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "auctionId must be a non-empty string",
      );
    });

    test("should throw error when auctionId is not a string", async () => {
      // Arrange
      const auctionId = 123 as unknown as string;
      const testData = createTestUpdateAuctionData();

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "auctionId must be a non-empty string",
      );
    });

    test("should throw error when data is null", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = null as unknown as UpdateAuctionWithDetails;

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow("data must be a valid object");
    });

    test("should throw error when data is undefined", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = undefined as unknown as UpdateAuctionWithDetails;

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow("data must be a valid object");
    });
  });

  describe("異常系 - 環境変数", () => {
    test("should throw error when UPSTASH_REDIS_REST_URL is missing", async () => {
      // Arrange
      vi.unstubAllEnvs();
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "UPSTASH_REDIS_REST_URL environment variable is required",
      );
    });

    test("should throw error when UPSTASH_REDIS_REST_TOKEN is missing", async () => {
      // Arrange
      vi.unstubAllEnvs();
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.com");
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "UPSTASH_REDIS_REST_TOKEN environment variable is required",
      );
    });

    test("should throw error when both environment variables are missing", async () => {
      // Arrange
      vi.unstubAllEnvs();
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "UPSTASH_REDIS_REST_URL environment variable is required",
      );
    });
  });

  describe("異常系 - UpdateAuctionWithDetailsバリデーション", () => {
    test("should throw error when id is missing", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData();
      // @ts-expect-error - テスト用に意図的にidを削除
      delete testData.id;

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "Required field 'id' is missing or null in UpdateAuctionWithDetails",
      );
    });

    test("should throw error when currentHighestBid is missing", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData();
      // @ts-expect-error - テスト用に意図的にcurrentHighestBidを削除
      delete testData.currentHighestBid;

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "Required field 'currentHighestBid' is missing or null in UpdateAuctionWithDetails",
      );
    });

    test("should throw error when currentHighestBid is negative", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        currentHighestBid: -100,
      });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "currentHighestBid must be a non-negative number",
      );
    });

    test("should throw error when status is missing", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData();
      // @ts-expect-error - テスト用に意図的にstatusを削除
      delete testData.status;

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "Required field 'status' is missing or null in UpdateAuctionWithDetails",
      );
    });

    test("should throw error when bidHistories is not an array", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        bidHistories: "not-an-array" as unknown as UpdateAuctionWithDetails["bidHistories"],
      });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow("bidHistories must be an array");
    });

    test("should throw error when extensionTotalCount is negative", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        extensionTotalCount: -1,
      });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "extensionTotalCount must be a non-negative integer",
      );
    });

    test("should throw error when extensionTotalCount is not an integer", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        extensionTotalCount: 1.5,
      });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "extensionTotalCount must be a non-negative integer",
      );
    });

    test("should throw error when extensionLimitCount is negative", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        extensionLimitCount: -1,
      });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "extensionLimitCount must be a non-negative integer",
      );
    });

    test("should throw error when extensionTime is negative", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        extensionTime: -1,
      });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "extensionTime must be a non-negative number",
      );
    });

    test("should throw error when remainingTimeForExtension is negative", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        remainingTimeForExtension: -1,
      });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "remainingTimeForExtension must be a non-negative number",
      );
    });
  });

  describe("異常系 - HTTPエラー", () => {
    test("should throw error when fetch fails", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });
      const fetchError = new Error("Network error");
      mockFetch.mockRejectedValue(fetchError);

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow("Network error");
    });

    test("should throw error when Redis returns 500 status", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow(
        "HTTP Error: 500 Internal Server Error",
      );
    });

    test("should throw error when Redis returns 404 status", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow("HTTP Error: 404 Not Found");
    });

    test("should throw error when Redis returns 401 status", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({ id: auctionId });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      // Act & Assert
      await expect(sendEventToAuctionSubscribers(auctionId, testData)).rejects.toThrow("HTTP Error: 401 Unauthorized");
    });
  });

  describe("境界値テスト", () => {
    test("should handle minimum bid amount (0)", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        currentHighestBid: 0,
      });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
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

    test("should handle zero extension counts", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        extensionTotalCount: 0,
        extensionLimitCount: 0,
      });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("should handle zero extension times", async () => {
      // Arrange
      const auctionId = "test-auction-123";
      const testData = createTestUpdateAuctionData({
        id: auctionId,
        extensionTime: 0,
        remainingTimeForExtension: 0,
      });

      // Act
      await sendEventToAuctionSubscribers(auctionId, testData);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
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

      const requestBody = JSON.parse(requestInit.body as string) as {
        data: UpdateAuctionWithDetails;
        timestamp: number;
      };

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
