import type { GetAuctionListingsParams } from "@/lib/actions/auction/cache/cache-auction-listing";
import type { AuctionListingResult, AuctionListingsConditions, Suggestion } from "@/types/auction-types";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getAuctionListingsAndCount, getSearchSuggestions } from "./auction-listing";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * キャッシュ関数をモック
 */
vi.mock("@/lib/auction/action/cache/cache-auction-listing", () => ({
  cachedGetAuctionListingsAndCount: vi.fn(),
  cachedGetSearchSuggestions: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockCachedGetAuctionListingsAndCount = vi.mocked(
  (await import("@/lib/actions/auction/cache/cache-auction-listing")).cachedGetAuctionListingsAndCount,
);
const mockCachedGetSearchSuggestions = vi.mocked(
  (await import("@/lib/actions/auction/cache/cache-auction-suggestion")).cachedGetSearchSuggestions,
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用データ
 */
const testUserId = "test-user-id";
const testGroupId = "test-group-id";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数：基本的なAuctionListingsConditionsを作成
 */
const createBaseListingsConditions = (
  overrides: Partial<AuctionListingsConditions> = {},
): AuctionListingsConditions => ({
  categories: null,
  status: ["all"],
  joinType: "OR",
  minBid: null,
  maxBid: null,
  minRemainingTime: null,
  maxRemainingTime: null,
  groupIds: null,
  searchQuery: null,
  sort: null,
  page: 1,
  ...overrides,
});

/**
 * テストヘルパー関数：GetAuctionListingsParamsを作成
 */
const createAuctionListingsParams = (
  listingsConditions: AuctionListingsConditions,
  userId: string = testUserId,
): GetAuctionListingsParams => ({
  listingsConditions,
  userId,
  userGroupIds: [],
});

/**
 * テストヘルパー関数：空の結果を作成
 */
const createEmptyResult = (count = 0) => ({
  listings: [] as AuctionListingResult,
  count,
});

/**
 * テストヘルパー関数：サンプルオークション結果を作成
 */
const createSampleAuctionResult = (): AuctionListingResult => [
  {
    id: "auction-1",
    current_highest_bid: 1000,
    end_time: new Date("2024-12-31T23:59:59"),
    start_time: new Date("2024-01-01T00:00:00"),
    status: TaskStatus.AUCTION_ACTIVE,
    task: "テストタスク",
    detail: "テストの詳細",
    image_url: "https://example.com/image.jpg",
    category: "プログラミング",
    group_id: testGroupId,
    group_name: "テストグループ",
    bids_count: 5,
    is_watched: false,
    score: null,
    task_highlighted: null,
    detail_highlighted: null,
    executors_json: [],
  },
];

/**
 * テストヘルパー関数：サンプルサジェストを作成
 */
const createSampleSuggestions = (query = "プログラミング"): Suggestion[] => [
  {
    id: "suggestion-1",
    text: `${query}タスク`,
    highlighted: `<mark>${query}</mark>タスク`,
    score: 0.95,
  },
  {
    id: "suggestion-2",
    text: `${query}学習`,
    highlighted: `<mark>${query}</mark>学習`,
    score: 0.85,
  },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("auction-listing", () => {
  describe("getAuctionListingsAndCount", () => {
    describe("正常系", () => {
      test("should return auction listings and count successfully", async () => {
        // Arrange
        const listingsConditions = createBaseListingsConditions({
          categories: ["プログラミング"],
          groupIds: [testGroupId],
        });
        const params = createAuctionListingsParams(listingsConditions);
        const expectedResult = {
          listings: createSampleAuctionResult(),
          count: 1,
        };

        mockCachedGetAuctionListingsAndCount.mockResolvedValue(expectedResult);

        // Act
        const result = await getAuctionListingsAndCount(params);

        // Assert
        expect(result).toStrictEqual(expectedResult);
        expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledWith(params);
        expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledTimes(1);
      });

      test("should handle empty results", async () => {
        // Arrange
        const listingsConditions = createBaseListingsConditions();
        const params = createAuctionListingsParams(listingsConditions);
        const expectedResult = createEmptyResult();

        mockCachedGetAuctionListingsAndCount.mockResolvedValue(expectedResult);

        // Act
        const result = await getAuctionListingsAndCount(params);

        // Assert
        expect(result).toStrictEqual(expectedResult);
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(0);
        expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledWith(params);
      });

      test("should handle complex filter conditions", async () => {
        // Arrange
        const listingsConditions = createBaseListingsConditions({
          categories: ["プログラミング", "デザイン", "マーケティング"],
          status: ["not_ended", "started", "bidded"],
          joinType: "AND",
          minBid: 100,
          maxBid: 5000,
          minRemainingTime: 3600, // 1時間
          maxRemainingTime: 86400, // 24時間
          groupIds: [testGroupId, "group-2", "group-3"],
          searchQuery: "テスト 検索 クエリ",
          sort: [
            { field: "price", direction: "desc" },
            { field: "time_remaining", direction: "asc" },
          ],
          page: 2,
        });
        const params = createAuctionListingsParams(listingsConditions);
        const expectedResult = createEmptyResult();

        mockCachedGetAuctionListingsAndCount.mockResolvedValue(expectedResult);

        // Act
        const result = await getAuctionListingsAndCount(params);

        // Assert
        expect(result).toStrictEqual(expectedResult);
        expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledWith(params);
      });
    });

    describe("異常系・境界値", () => {
      test("should throw error null", async () => {
        // Arrange
        mockCachedGetAuctionListingsAndCount.mockRejectedValue(new Error("test"));
        const listingsConditions = createBaseListingsConditions();
        const params = createAuctionListingsParams(listingsConditions);

        // Act
        const result = await getAuctionListingsAndCount(params);

        // Assert
        expect(result).toThrowError();
        expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledWith(params);
      });

      test("should handle [0, 0]", async () => {
        // Arrange
        mockCachedGetAuctionListingsAndCount.mockResolvedValue({
          listings: [],
          count: 0,
        });
        const listingsConditions = createBaseListingsConditions();
        const params = createAuctionListingsParams(listingsConditions);

        // Act
        const result = await getAuctionListingsAndCount(params);

        // Assert
        expect(result).toStrictEqual({
          listings: [],
          count: 0,
        });
        expect(mockCachedGetAuctionListingsAndCount).toHaveBeenCalledWith(params);
      });
    });
  });

  describe("getSearchSuggestions", () => {
    describe("正常系", () => {
      test("should return search suggestions successfully", async () => {
        // Arrange
        const query = "プログラミング";
        const expectedSuggestions = createSampleSuggestions(query);

        mockCachedGetSearchSuggestions.mockResolvedValue(expectedSuggestions);

        // Act
        const result = await getSearchSuggestions({ query, userId: testUserId, userGroupIds: [] });

        // Assert
        expect(result).toStrictEqual(expectedSuggestions);
        expect(mockCachedGetSearchSuggestions).toHaveBeenCalledWith({ query, userId: testUserId, userGroupIds: [] });
        expect(mockCachedGetSearchSuggestions).toHaveBeenCalledTimes(1);
      });
    });

    describe("異常系・境界値", () => {
      test("should handle null", async () => {
        // Arrange
        mockCachedGetSearchSuggestions.mockRejectedValue(new Error("test"));
        const query = "テスト";
        const userId = null as unknown as string;

        // Act
        const result = await getSearchSuggestions({ query, userId, userGroupIds: [] });

        // Assert
        expect(result).toThrowError();
        expect(mockCachedGetSearchSuggestions).toHaveBeenCalledWith({ query, userId, userGroupIds: [] });
      });

      test("should handle empty query", async () => {
        // Arrange
        const query = "";
        const userId = testUserId;
        const expectedSuggestions: Suggestion[] = [];

        mockCachedGetSearchSuggestions.mockResolvedValue(expectedSuggestions);

        // Act
        const result = await getSearchSuggestions({ query, userId, userGroupIds: [] });

        // Assert
        expect(result).toStrictEqual(expectedSuggestions);
        expect(mockCachedGetSearchSuggestions).toHaveBeenCalledWith({ query, userId, userGroupIds: [] });
      });
    });
  });
});
