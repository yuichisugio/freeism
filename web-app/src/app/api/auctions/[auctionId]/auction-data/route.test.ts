import type { UpdateAuctionWithDetails } from "@/types/auction-types";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUpdatedAuctionByAuctionId } from "@/actions/auction/auction-retrieve";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GET } from "./route";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */
vi.mock("@/lib/auction/action/auction-retrieve", () => ({
  getUpdatedAuctionByAuctionId: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi
      .fn()
      .mockImplementation((data: unknown, options?: { status?: number; headers?: Record<string, string> }) => {
        return {
          json: () => Promise.resolve(data),
          status: options?.status ?? 200,
          headers: options?.headers ?? {},
        };
      }),
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用のモック関数
 */
const mockGetUpdatedAuctionByAuctionId = vi.mocked(getUpdatedAuctionByAuctionId);
const mockNextResponseJson = vi.mocked(NextResponse.json);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用データ
 */
const testAuctionId = "test-auction-id";
const testApiSecret = "test-secret-key";

const mockAuctionData: UpdateAuctionWithDetails = {
  id: testAuctionId,
  currentHighestBid: 1000,
  currentHighestBidderId: "user-123",
  status: TaskStatus.AUCTION_ACTIVE,
  extensionTotalCount: 0,
  extensionLimitCount: 5,
  extensionTime: 10,
  remainingTimeForExtension: 5,
  bidHistories: [
    {
      id: "bid-1",
      amount: 1000,
      createdAt: new Date("2024-01-01T10:00:00Z"),
      isAutoBid: false,
      user: {
        settings: {
          username: "testuser",
        },
      },
    },
  ],
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */
function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  const mockHeaders = new Map(Object.entries(headers));
  return {
    headers: {
      get: vi.fn((key: string) => mockHeaders.get(key) ?? null),
    },
  } as unknown as NextRequest;
}

function createMockParams(auctionId: string): { params: Promise<{ auctionId: string }> } {
  return {
    params: Promise.resolve({ auctionId }),
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("auction-data API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 環境変数を設定
    process.env.FREEISM_APP_API_SECRET_KEY = testApiSecret;
  });

  describe("正常系", () => {
    test("should return auction data when valid API key and auction ID are provided", async () => {
      // Arrange
      mockGetUpdatedAuctionByAuctionId.mockResolvedValue({
        success: true,
        message: "オークション情報を取得しました",
        data: mockAuctionData,
      });
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockGetUpdatedAuctionByAuctionId).toHaveBeenCalledWith(testAuctionId);
      expect(mockNextResponseJson).toHaveBeenCalledWith(mockAuctionData, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
    });

    test("should return 400 when auction is not found", async () => {
      // Arrange
      mockGetUpdatedAuctionByAuctionId.mockResolvedValue({
        success: true,
        message: "オークション情報を取得しました",
        data: null,
      });
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockGetUpdatedAuctionByAuctionId).toHaveBeenCalledWith(testAuctionId);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "オークションが見つかりません" }, { status: 400 });
    });
  });

  describe("異常系", () => {
    test("should return 401 when API secret is missing", async () => {
      // Arrange
      const request = createMockRequest(); // ヘッダーなし
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockGetUpdatedAuctionByAuctionId).not.toHaveBeenCalled();
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "Unauthorized" }, { status: 401 });
    });

    test("should return 401 when API secret is incorrect", async () => {
      // Arrange
      const request = createMockRequest({ "x-internal-secret": "wrong-secret" });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockGetUpdatedAuctionByAuctionId).not.toHaveBeenCalled();
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "Unauthorized" }, { status: 401 });
    });

    test("should return 400 when auction ID is missing", async () => {
      // Arrange
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams(""); // 空のauctionId

      // Act
      await GET(request, params);

      // Assert
      expect(mockGetUpdatedAuctionByAuctionId).not.toHaveBeenCalled();
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "オークションIDが必要です" }, { status: 400 });
    });

    test("should return 500 when getUpdatedAuctionByAuctionId throws error", async () => {
      // Arrange
      mockGetUpdatedAuctionByAuctionId.mockRejectedValue({
        success: false,
        message: "オークション情報を取得できませんでした",
        data: null,
      });
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockGetUpdatedAuctionByAuctionId).toHaveBeenCalledWith(testAuctionId);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "エラーが発生しました" }, { status: 500 });
    });

    test("should return 401 when environment variable is not set", async () => {
      // Arrange
      delete process.env.FREEISM_APP_API_SECRET_KEY;
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockGetUpdatedAuctionByAuctionId).not.toHaveBeenCalled();
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "Unauthorized" }, { status: 401 });
    });
  });

  describe("境界値テスト", () => {
    test("should handle empty string auction ID", async () => {
      // Arrange
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams("");

      // Act
      await GET(request, params);

      // Assert
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "オークションIDが必要です" }, { status: 400 });
    });

    test("should handle null auction data", async () => {
      // Arrange
      mockGetUpdatedAuctionByAuctionId.mockResolvedValue({
        success: true,
        message: "オークション情報を取得しました",
        data: null,
      });
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "オークションが見つかりません" }, { status: 400 });
    });

    test("should handle very long auction ID", async () => {
      // Arrange
      const longAuctionId = "a".repeat(1000);
      mockGetUpdatedAuctionByAuctionId.mockResolvedValue({
        success: true,
        message: "オークション情報を取得しました",
        data: null,
      });
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams(longAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockGetUpdatedAuctionByAuctionId).toHaveBeenCalledWith(longAuctionId);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "オークションが見つかりません" }, { status: 400 });
    });

    test("should handle auction data with null bidHistories", async () => {
      // Arrange
      const auctionDataWithNullBids: UpdateAuctionWithDetails = {
        ...mockAuctionData,
        bidHistories: [],
      };
      mockGetUpdatedAuctionByAuctionId.mockResolvedValue({
        success: true,
        message: "オークション情報を取得しました",
        data: auctionDataWithNullBids,
      });
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockNextResponseJson).toHaveBeenCalledWith(auctionDataWithNullBids, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
    });

    test("should handle auction data with different task statuses", async () => {
      // Arrange
      const testStatuses = [
        TaskStatus.PENDING,
        TaskStatus.AUCTION_ACTIVE,
        TaskStatus.AUCTION_ENDED,
        TaskStatus.SUPPLIER_DONE,
        TaskStatus.TASK_COMPLETED,
      ];

      for (const status of testStatuses) {
        const auctionDataWithStatus: UpdateAuctionWithDetails = {
          ...mockAuctionData,
          status: status,
        };
        mockGetUpdatedAuctionByAuctionId.mockResolvedValue({
          success: true,
          message: "オークション情報を取得しました",
          data: auctionDataWithStatus,
        });
        const request = createMockRequest({ "x-internal-secret": testApiSecret });
        const params = createMockParams(testAuctionId);

        // Act
        await GET(request, params);

        // Assert
        expect(mockNextResponseJson).toHaveBeenCalledWith(auctionDataWithStatus, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
        });
      }
    });

    test("should handle auction data with null currentHighestBidderId", async () => {
      // Arrange
      const auctionDataWithNullBidder: UpdateAuctionWithDetails = {
        ...mockAuctionData,
        currentHighestBidderId: null,
        currentHighestBid: 0,
      };
      mockGetUpdatedAuctionByAuctionId.mockResolvedValue({
        success: true,
        message: "オークション情報を取得しました",
        data: auctionDataWithNullBidder,
      });
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockNextResponseJson).toHaveBeenCalledWith(auctionDataWithNullBidder, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
    });

    test("should handle auction data with user settings as null", async () => {
      // Arrange
      const auctionDataWithNullUserSettings: UpdateAuctionWithDetails = {
        ...mockAuctionData,
        bidHistories: [
          {
            id: "bid-1",
            amount: 1000,
            createdAt: new Date("2024-01-01T10:00:00Z"),
            isAutoBid: false,
            user: {
              settings: null,
            },
          },
        ],
      };
      mockGetUpdatedAuctionByAuctionId.mockResolvedValue({
        success: true,
        message: "オークション情報を取得しました",
        data: auctionDataWithNullUserSettings,
      });
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockNextResponseJson).toHaveBeenCalledWith(auctionDataWithNullUserSettings, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
    });

    test("should handle auction data with extension fields", async () => {
      // Arrange
      const auctionDataWithExtension: UpdateAuctionWithDetails = {
        ...mockAuctionData,
        extensionTotalCount: 3,
        extensionLimitCount: 5,
        extensionTime: 10,
        remainingTimeForExtension: 2,
      };
      mockGetUpdatedAuctionByAuctionId.mockResolvedValue({
        success: true,
        message: "オークション情報を取得しました",
        data: auctionDataWithExtension,
      });
      const request = createMockRequest({ "x-internal-secret": testApiSecret });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockNextResponseJson).toHaveBeenCalledWith(auctionDataWithExtension, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
    });
  });

  describe("セキュリティテスト", () => {
    test("should handle null secret header", async () => {
      // Arrange
      const request = createMockRequest({ "x-internal-secret": "" });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockGetUpdatedAuctionByAuctionId).not.toHaveBeenCalled();
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "Unauthorized" }, { status: 401 });
    });

    test("should handle whitespace only secret", async () => {
      // Arrange
      const request = createMockRequest({ "x-internal-secret": "   " });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockGetUpdatedAuctionByAuctionId).not.toHaveBeenCalled();
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "Unauthorized" }, { status: 401 });
    });

    test("should handle case sensitive secret comparison", async () => {
      // Arrange
      const request = createMockRequest({ "x-internal-secret": testApiSecret.toUpperCase() });
      const params = createMockParams(testAuctionId);

      // Act
      await GET(request, params);

      // Assert
      expect(mockGetUpdatedAuctionByAuctionId).not.toHaveBeenCalled();
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: "Unauthorized" }, { status: 401 });
    });
  });
});
