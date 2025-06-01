import type { GetAuctionListingsParams } from "@/lib/auction/action/cache/cache-auction-listing";
import type { AuctionListingResult, AuctionListingsConditions, Suggestion } from "@/types/auction-types";
import { cachedGetAuctionListingsAndCount, cachedGetSearchSuggestions } from "@/lib/auction/action/cache/cache-auction-listing";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象の関数をインポート（モック設定後）
import { getAuctionListingsAndCount, getSearchSuggestions } from "./auction-listing";

// モック設定
vi.mock("@/lib/auction/action/cache/cache-auction-listing", () => ({
  cachedGetAuctionListingsAndCount: vi.fn(),
  cachedGetSearchSuggestions: vi.fn(),
  __esModule: true,
}));

// モック関数の型アサーション
const mockCachedGetAuctionListingsAndCount = cachedGetAuctionListingsAndCount as ReturnType<typeof vi.fn>;
const mockCachedGetSearchSuggestions = cachedGetSearchSuggestions as ReturnType<typeof vi.fn>;

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
  mockCachedGetAuctionListingsAndCount.mockReset();
  mockCachedGetSearchSuggestions.mockReset();
});

// テストデータの定義
const testUserId = "test-user-id";
const testAuctionId = "test-auction-id";
const testTaskId = "test-task-id";
const testGroupId = "test-group-id";

// 共通のテストデータ
const mockListingsConditions: AuctionListingsConditions = {
  categories: ["プログラミング"],
  status: ["not_ended"],
  statusConditionJoinType: "OR",
  minBid: 100,
  maxBid: 1000,
  minRemainingTime: 1,
  maxRemainingTime: 24,
  groupIds: [testGroupId],
  searchQuery: "テスト",
  sort: [{ field: "newest", direction: "desc" }],
  page: 1,
};

const mockAuctionCard = {
  id: testAuctionId,
  current_highest_bid: 500,
  end_time: new Date("2024-12-31T23:59:59Z"),
  start_time: new Date("2024-01-01T00:00:00Z"),
  status: "PENDING" as const,
  task: "テストタスク",
  detail: "テストタスクの詳細",
  image_url: "https://example.com/image.jpg",
  category: "プログラミング",
  group_id: testGroupId,
  group_name: "テストグループ",
  bids_count: 5,
  is_watched: false,
  score: 0.95,
  task_highlighted: "<mark>テスト</mark>タスク",
  detail_highlighted: "<mark>テスト</mark>タスクの詳細",
  executors_json: [
    {
      id: "executor-1",
      rating: 4.5,
      userId: "executor-user-1",
      userImage: "https://example.com/executor.jpg",
      userSettingsUsername: "実行者1",
    },
  ],
};

const mockAuctionListingResult: AuctionListingResult = [mockAuctionCard];

const mockSuggestion: Suggestion = {
  id: testTaskId,
  text: "テストタスク",
  highlighted: "<mark>テスト</mark>タスク",
  score: 0.95,
};

const mockSuggestions: Suggestion[] = [mockSuggestion];

describe("auction-listing", () => {
  describe("getAuctionListingsAndCount", () => {
    test("should return auction listings and count successfully", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const mockCachedData = {
        listings: mockAuctionListingResult,
        count: 1,
      };

      mockCachedGetAuctionListingsAndCount.mockResolvedValue(mockCachedData);

      // Act
      const result = await getAuctionListingsAndCount(mockParams);

      // Assert
      expect(result).toStrictEqual(mockCachedData);
      expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledWith(mockParams);
      expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledTimes(1);
    });

    test("should throw error when cached data is null", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      mockCachedGetAuctionListingsAndCount.mockResolvedValue(null);

      // Act & Assert
      await expect(getAuctionListingsAndCount(mockParams)).rejects.toThrow("オークション一覧と件数の取得中に予期せぬエラーが発生しました。");

      expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledWith(mockParams);
      expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledTimes(1);
    });

    test("should throw error when cached data is undefined", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      mockCachedGetAuctionListingsAndCount.mockResolvedValue(undefined);

      // Act & Assert
      await expect(getAuctionListingsAndCount(mockParams)).rejects.toThrow("オークション一覧と件数の取得中に予期せぬエラーが発生しました。");

      expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledWith(mockParams);
    });

    test("should handle empty listings array", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const mockCachedData = {
        listings: [],
        count: 0,
      };

      mockCachedGetAuctionListingsAndCount.mockResolvedValue(mockCachedData);

      // Act
      const result = await getAuctionListingsAndCount(mockParams);

      // Assert
      expect(result).toStrictEqual(mockCachedData);
      expect(result.listings).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    test("should handle large count value", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const mockCachedData = {
        listings: mockAuctionListingResult,
        count: 999999,
      };

      mockCachedGetAuctionListingsAndCount.mockResolvedValue(mockCachedData);

      // Act
      const result = await getAuctionListingsAndCount(mockParams);

      // Assert
      expect(result).toStrictEqual(mockCachedData);
      expect(result.count).toBe(999999);
    });

    test("should propagate error from cached function", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const mockError = new Error("Database connection error");
      mockCachedGetAuctionListingsAndCount.mockRejectedValue(mockError);

      // Act & Assert
      await expect(getAuctionListingsAndCount(mockParams)).rejects.toThrow("Database connection error");

      expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledWith(mockParams);
    });

    test("should handle null listingsConditions", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: null as unknown as AuctionListingsConditions,
        userId: testUserId,
      };

      mockCachedGetAuctionListingsAndCount.mockRejectedValue(new Error("Invalid conditions"));

      // Act & Assert
      await expect(getAuctionListingsAndCount(mockParams)).rejects.toThrow("Invalid conditions");
    });

    test("should handle empty userId", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: "",
      };

      const mockCachedData = {
        listings: [],
        count: 0,
      };

      mockCachedGetAuctionListingsAndCount.mockResolvedValue(mockCachedData);

      // Act
      const result = await getAuctionListingsAndCount(mockParams);

      // Assert
      expect(result).toStrictEqual(mockCachedData);
      expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledWith(mockParams);
    });

    test("should handle undefined userId", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: undefined as unknown as string,
      };

      mockCachedGetAuctionListingsAndCount.mockRejectedValue(new Error("Invalid userId"));

      // Act & Assert
      await expect(getAuctionListingsAndCount(mockParams)).rejects.toThrow("Invalid userId");
    });
  });

  describe("getSearchSuggestions", () => {
    test("should return search suggestions successfully", async () => {
      // Arrange
      const query = "テスト";
      mockCachedGetSearchSuggestions.mockResolvedValue(mockSuggestions);

      // Act
      const result = await getSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual(mockSuggestions);
      expect(mockCachedGetSearchSuggestions).toHaveBeenCalledWith(query, testUserId);
      expect(mockCachedGetSearchSuggestions).toHaveBeenCalledTimes(1);
    });

    test("should throw error when cached data is null", async () => {
      // Arrange
      const query = "テスト";
      mockCachedGetSearchSuggestions.mockResolvedValue(null);

      // Act & Assert
      await expect(getSearchSuggestions(query, testUserId)).rejects.toThrow("検索サジェストのキャッシュデータがありません");

      expect(mockCachedGetSearchSuggestions).toHaveBeenCalledWith(query, testUserId);
    });

    test("should throw error when cached data is undefined", async () => {
      // Arrange
      const query = "テスト";
      mockCachedGetSearchSuggestions.mockResolvedValue(undefined);

      // Act & Assert
      await expect(getSearchSuggestions(query, testUserId)).rejects.toThrow("検索サジェストのキャッシュデータがありません");
    });

    test("should handle empty suggestions array", async () => {
      // Arrange
      const query = "存在しないクエリ";
      mockCachedGetSearchSuggestions.mockResolvedValue([]);

      // Act
      const result = await getSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(result).toHaveLength(0);
    });

    test("should handle multiple suggestions", async () => {
      // Arrange
      const query = "テスト";
      const multipleSuggestions: Suggestion[] = [
        {
          id: "task-1",
          text: "テストタスク1",
          highlighted: "<mark>テスト</mark>タスク1",
          score: 0.95,
        },
        {
          id: "task-2",
          text: "テストタスク2",
          highlighted: "<mark>テスト</mark>タスク2",
          score: 0.85,
        },
        {
          id: "task-3",
          text: "テストタスク3",
          highlighted: "<mark>テスト</mark>タスク3",
          score: 0.75,
        },
      ];

      mockCachedGetSearchSuggestions.mockResolvedValue(multipleSuggestions);

      // Act
      const result = await getSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual(multipleSuggestions);
      expect(result).toHaveLength(3);
    });

    test("should propagate error from cached function", async () => {
      // Arrange
      const query = "テスト";
      const mockError = new Error("Database connection error");
      mockCachedGetSearchSuggestions.mockRejectedValue(mockError);

      // Act & Assert
      await expect(getSearchSuggestions(query, testUserId)).rejects.toThrow("Database connection error");

      expect(mockCachedGetSearchSuggestions).toHaveBeenCalledWith(query, testUserId);
    });

    test("should handle empty query string", async () => {
      // Arrange
      const query = "";
      mockCachedGetSearchSuggestions.mockResolvedValue([]);

      // Act
      const result = await getSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(mockCachedGetSearchSuggestions).toHaveBeenCalledWith(query, testUserId);
    });

    test("should handle whitespace-only query", async () => {
      // Arrange
      const query = "   ";
      mockCachedGetSearchSuggestions.mockResolvedValue([]);

      // Act
      const result = await getSearchSuggestions(query, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(mockCachedGetSearchSuggestions).toHaveBeenCalledWith(query, testUserId);
    });

    test("should handle null query", async () => {
      // Arrange
      const query = null as unknown as string;
      mockCachedGetSearchSuggestions.mockRejectedValue(new Error("Invalid query"));

      // Act & Assert
      await expect(getSearchSuggestions(query, testUserId)).rejects.toThrow("Invalid query");
    });

    test("should handle undefined query", async () => {
      // Arrange
      const query = undefined as unknown as string;
      mockCachedGetSearchSuggestions.mockRejectedValue(new Error("Invalid query"));

      // Act & Assert
      await expect(getSearchSuggestions(query, testUserId)).rejects.toThrow("Invalid query");
    });

    test("should handle empty userId", async () => {
      // Arrange
      const query = "テスト";
      const emptyUserId = "";
      mockCachedGetSearchSuggestions.mockResolvedValue([]);

      // Act
      const result = await getSearchSuggestions(query, emptyUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(mockCachedGetSearchSuggestions).toHaveBeenCalledWith(query, emptyUserId);
    });

    test("should handle undefined userId", async () => {
      // Arrange
      const query = "テスト";
      const undefinedUserId = undefined as unknown as string;
      mockCachedGetSearchSuggestions.mockRejectedValue(new Error("Invalid userId"));

      // Act & Assert
      await expect(getSearchSuggestions(query, undefinedUserId)).rejects.toThrow("Invalid userId");
    });

    test("should handle very long query string", async () => {
      // Arrange
      const longQuery = "a".repeat(1000);
      mockCachedGetSearchSuggestions.mockResolvedValue([]);

      // Act
      const result = await getSearchSuggestions(longQuery, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(mockCachedGetSearchSuggestions).toHaveBeenCalledWith(longQuery, testUserId);
    });

    test("should handle special characters in query", async () => {
      // Arrange
      const specialQuery = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      mockCachedGetSearchSuggestions.mockResolvedValue([]);

      // Act
      const result = await getSearchSuggestions(specialQuery, testUserId);

      // Assert
      expect(result).toStrictEqual([]);
      expect(mockCachedGetSearchSuggestions).toHaveBeenCalledWith(specialQuery, testUserId);
    });
  });

  // 境界値テスト
  describe("boundary value tests", () => {
    test("should handle zero count in auction listings", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const mockCachedData = {
        listings: [],
        count: 0,
      };

      mockCachedGetAuctionListingsAndCount.mockResolvedValue(mockCachedData);

      // Act
      const result = await getAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.count).toBe(0);
      expect(result.listings).toHaveLength(0);
    });

    test("should handle maximum integer count", async () => {
      // Arrange
      const mockParams: GetAuctionListingsParams = {
        listingsConditions: mockListingsConditions,
        userId: testUserId,
      };

      const maxCount = Number.MAX_SAFE_INTEGER;
      const mockCachedData = {
        listings: mockAuctionListingResult,
        count: maxCount,
      };

      mockCachedGetAuctionListingsAndCount.mockResolvedValue(mockCachedData);

      // Act
      const result = await getAuctionListingsAndCount(mockParams);

      // Assert
      expect(result.count).toBe(maxCount);
    });

    test("should handle zero score in suggestions", async () => {
      // Arrange
      const query = "テスト";
      const zeroScoreSuggestions: Suggestion[] = [
        {
          id: "task-1",
          text: "テストタスク",
          highlighted: "テストタスク",
          score: 0,
        },
      ];

      mockCachedGetSearchSuggestions.mockResolvedValue(zeroScoreSuggestions);

      // Act
      const result = await getSearchSuggestions(query, testUserId);

      // Assert
      expect(result[0].score).toBe(0);
    });

    test("should handle maximum score in suggestions", async () => {
      // Arrange
      const query = "テスト";
      const maxScoreSuggestions: Suggestion[] = [
        {
          id: "task-1",
          text: "テストタスク",
          highlighted: "<mark>テスト</mark>タスク",
          score: 1.0,
        },
      ];

      mockCachedGetSearchSuggestions.mockResolvedValue(maxScoreSuggestions);

      // Act
      const result = await getSearchSuggestions(query, testUserId);

      // Assert
      expect(result[0].score).toBe(1.0);
    });
  });

  // 異常系テスト（不正な引数）
  describe("invalid input tests", () => {
    test("should handle malformed listingsConditions object", async () => {
      // Arrange
      const malformedParams = {
        listingsConditions: { invalidField: "invalid" } as unknown as AuctionListingsConditions,
        userId: testUserId,
      };

      mockCachedGetAuctionListingsAndCount.mockRejectedValue(new Error("Invalid conditions format"));

      // Act & Assert
      await expect(getAuctionListingsAndCount(malformedParams)).rejects.toThrow("Invalid conditions format");
    });

    test("should handle non-string query parameter", async () => {
      // Arrange
      const nonStringQuery = 123 as unknown as string;
      mockCachedGetSearchSuggestions.mockRejectedValue(new Error("Query must be string"));

      // Act & Assert
      await expect(getSearchSuggestions(nonStringQuery, testUserId)).rejects.toThrow("Query must be string");
    });

    test("should handle non-string userId parameter in getSearchSuggestions", async () => {
      // Arrange
      const query = "テスト";
      const nonStringUserId = 123 as unknown as string;
      mockCachedGetSearchSuggestions.mockRejectedValue(new Error("UserId must be string"));

      // Act & Assert
      await expect(getSearchSuggestions(query, nonStringUserId)).rejects.toThrow("UserId must be string");
    });

    test("should handle non-string userId parameter in getAuctionListingsAndCount", async () => {
      // Arrange
      const malformedParams = {
        listingsConditions: mockListingsConditions,
        userId: 123 as unknown as string,
      };

      mockCachedGetAuctionListingsAndCount.mockRejectedValue(new Error("UserId must be string"));

      // Act & Assert
      await expect(getAuctionListingsAndCount(malformedParams)).rejects.toThrow("UserId must be string");
    });
  });
});
