import type { AuctionFilterTypes, AuctionSortField, SortDirection } from "@/types/auction-types";
import { mockUseSession } from "@/test/setup/setup";
import { AllTheProviders, mockUseQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useAuctionListings } from "./use-auction-listings";

// nuqsのモック
const mockSetParams = vi.fn();
vi.mock("nuqs", () => ({
  parseAsArrayOf: vi.fn(() => ({ withDefault: vi.fn(() => ({})) })),
  parseAsInteger: { withDefault: vi.fn(() => ({})) },
  parseAsString: { withDefault: vi.fn(() => ({})) },
  useQueryStates: vi.fn(() => [
    {
      page: 1,
      category: ["すべて"],
      status: ["all"],
      status_join_type: "AND",
      sort: null,
      sort_direction: "desc",
      q: null,
      min_bid: null,
      max_bid: null,
      min_remaining_time: null,
      max_remaining_time: null,
      group_id: null,
    },
    mockSetParams,
  ]),
}));

// next/navigationのモック
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// auction-listingアクションのモック
vi.mock("@/lib/auction/action/auction-listing", () => ({
  getAuctionListingsAndCount: vi.fn(),
}));

// constantsのモック
vi.mock("@/lib/constants", () => ({
  AUCTION_CONSTANTS: {
    DISPLAY: {
      PAGE_SIZE: 10,
    },
  },
}));

// tanstack-queryのキャッシュキーのモック
vi.mock("@/lib/tanstack-query", () => ({
  queryCacheKeys: {
    auction: {
      userAllListings: vi.fn(() => ["auction", "userAllListings"]),
    },
  },
}));

describe("useAuctionListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのセッション状態を設定
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
        },
      },
      status: "authenticated",
    });

    // デフォルトのuseQueryの戻り値を設定
    mockUseQuery.mockReturnValue({
      data: {
        listings: [],
        count: 0,
      },
      isPending: false,
      isPlaceholderData: false,
    });

    // デフォルトのuseQueryClientの戻り値を設定
    mockUseQueryClient.mockReturnValue({
      prefetchQuery: vi.fn(),
    });
  });

  test("should return initial state correctly", () => {
    const { result } = renderHook(() => useAuctionListings(), {
      wrapper: AllTheProviders,
    });

    expect(result.current.auctions).toEqual([]);
    expect(result.current.totalAuctionsCount).toBe(0);
    expect(result.current.listingsConditions).toEqual({
      categories: ["すべて"],
      status: ["all"],
      statusConditionJoinType: "AND",
      minBid: null,
      maxBid: null,
      minRemainingTime: null,
      maxRemainingTime: null,
      groupIds: null,
      searchQuery: null,
      sort: null,
      page: 1,
    });
    expect(typeof result.current.setListingsConditions).toBe("function");
  });

  test("should handle loading state correctly", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isPlaceholderData: false,
    });

    const { result } = renderHook(() => useAuctionListings(), {
      wrapper: AllTheProviders,
    });

    expect(result.current.isLoading).toBe(true);
  });

  test("should return auction data when available", () => {
    const mockAuctionData = {
      listings: [
        {
          id: "auction-1",
          current_highest_bid: 1000,
          end_time: new Date("2024-12-31"),
          start_time: new Date("2024-01-01"),
          status: "ACTIVE",
          task: "Test Task",
          detail: "Test Detail",
          image_url: null,
          category: "テスト",
          group_id: "group-1",
          group_name: "Test Group",
          bids_count: 5,
          is_watched: false,
          score: null,
          task_highlighted: null,
          detail_highlighted: null,
          executors_json: [],
        },
      ],
      count: 1,
    };

    mockUseQuery.mockReturnValue({
      data: mockAuctionData,
      isPending: false,
      isPlaceholderData: false,
    });

    const { result } = renderHook(() => useAuctionListings(), {
      wrapper: AllTheProviders,
    });

    expect(result.current.auctions).toEqual(mockAuctionData.listings);
    expect(result.current.totalAuctionsCount).toBe(1);
    expect(result.current.isLoading).toBe(false);
  });

  test("should handle undefined data gracefully", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isPlaceholderData: false,
    });

    const { result } = renderHook(() => useAuctionListings(), {
      wrapper: AllTheProviders,
    });

    expect(result.current.auctions).toEqual([]);
    expect(result.current.totalAuctionsCount).toBe(0);
  });

  describe("setListingsConditions", () => {
    test("should call setParams when conditions change", () => {
      const { result } = renderHook(() => useAuctionListings(), {
        wrapper: AllTheProviders,
      });

      const newConditions = {
        categories: ["開発"],
        status: ["not_bidded" as AuctionFilterTypes],
        joinType: "OR" as const,
        minBid: 100,
        maxBid: 1000,
        minRemainingTime: null,
        maxRemainingTime: null,
        groupIds: ["group-1"],
        searchQuery: "test query",
        sort: [{ field: "price" as AuctionSortField, direction: "asc" as SortDirection }],
        page: 1,
      };

      act(() => {
        result.current.setListingsConditions(newConditions);
      });

      expect(mockSetParams).toHaveBeenCalledWith({
        page: null, // ページは1なのでnull
        q: "test query",
        min_bid: 100,
        max_bid: 1000,
        min_remaining_time: null,
        max_remaining_time: null,
        category: ["開発"],
        status: ["not_bidded"],
        status_join_type: "OR",
        sort: "price",
        sort_direction: "asc",
        group_id: ["group-1"],
      });
    });

    test("should reset page to 1 when search conditions change", () => {
      const { result } = renderHook(() => useAuctionListings(), {
        wrapper: AllTheProviders,
      });

      const newConditions = {
        categories: ["すべて"],
        status: ["all" as AuctionFilterTypes],
        joinType: "AND" as const,
        minBid: null,
        maxBid: null,
        minRemainingTime: null,
        maxRemainingTime: null,
        groupIds: null,
        searchQuery: "new search",
        sort: null,
        page: 5, // 5ページ目だが、検索条件が変わるので1に戻る
      };

      act(() => {
        result.current.setListingsConditions(newConditions);
      });

      expect(mockSetParams).toHaveBeenCalledWith({
        page: null, // 1ページ目なのでnull
        q: "new search",
        min_bid: null,
        max_bid: null,
        min_remaining_time: null,
        max_remaining_time: null,
      });
    });

    test("should preserve page when only page changes", () => {
      const { result } = renderHook(() => useAuctionListings(), {
        wrapper: AllTheProviders,
      });

      const newConditions = {
        categories: ["すべて"],
        status: ["all" as AuctionFilterTypes],
        joinType: "AND" as const,
        minBid: null,
        maxBid: null,
        minRemainingTime: null,
        maxRemainingTime: null,
        groupIds: null,
        searchQuery: null,
        sort: null,
        page: 3, // ページのみ変更
      };

      act(() => {
        result.current.setListingsConditions(newConditions);
      });

      expect(mockSetParams).toHaveBeenCalledWith({
        page: 3,
        q: null,
        min_bid: null,
        max_bid: null,
        min_remaining_time: null,
        max_remaining_time: null,
      });
    });

    test("should handle null values correctly", () => {
      const { result } = renderHook(() => useAuctionListings(), {
        wrapper: AllTheProviders,
      });

      const newConditions = {
        categories: null,
        status: null,
        joinType: "AND" as const,
        minBid: null,
        maxBid: null,
        minRemainingTime: null,
        maxRemainingTime: null,
        groupIds: null,
        searchQuery: null,
        sort: null,
        page: 1,
      };

      act(() => {
        result.current.setListingsConditions(newConditions);
      });

      expect(mockSetParams).toHaveBeenCalledWith({
        page: null,
        q: null,
        min_bid: null,
        max_bid: null,
        min_remaining_time: null,
        max_remaining_time: null,
        category: null,
        status: null,
      });
    });
  });

  describe("error handling", () => {
    test("should handle prefetch when next page is available", () => {
      const mockPrefetchQuery = vi.fn();
      mockUseQueryClient.mockReturnValue({
        prefetchQuery: mockPrefetchQuery,
      });

      mockUseQuery.mockReturnValue({
        data: {
          listings: [],
          count: 25, // 3ページ分のデータ（PAGE_SIZE=10の場合）
        },
        isPending: false,
        isPlaceholderData: false,
      });

      renderHook(() => useAuctionListings(), {
        wrapper: AllTheProviders,
      });

      expect(mockPrefetchQuery).toHaveBeenCalled();
    });

    test("should handle query error gracefully", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isPlaceholderData: false,
        isError: true,
        error: new Error("Query failed"),
      });

      const { result } = renderHook(() => useAuctionListings(), {
        wrapper: AllTheProviders,
      });

      expect(result.current.auctions).toEqual([]);
      expect(result.current.totalAuctionsCount).toBe(0);
    });
  });

  describe("edge cases", () => {
    test("should handle empty listings array", () => {
      mockUseQuery.mockReturnValue({
        data: {
          listings: [],
          count: 0,
        },
        isPending: false,
        isPlaceholderData: false,
      });

      const { result } = renderHook(() => useAuctionListings(), {
        wrapper: AllTheProviders,
      });

      expect(result.current.auctions).toEqual([]);
      expect(result.current.totalAuctionsCount).toBe(0);
    });

    test("should handle large auction count", () => {
      const mockData = {
        listings: [],
        count: 999999,
      };

      mockUseQuery.mockReturnValue({
        data: mockData,
        isPending: false,
        isPlaceholderData: false,
      });

      const { result } = renderHook(() => useAuctionListings(), {
        wrapper: AllTheProviders,
      });

      expect(result.current.totalAuctionsCount).toBe(999999);
    });

    test("should handle undefined searchQuery correctly", () => {
      const { result } = renderHook(() => useAuctionListings(), {
        wrapper: AllTheProviders,
      });

      // searchQueryがundefinedの場合、nullに変換されることを確認
      expect(result.current.listingsConditions.searchQuery).toBe(null);
    });
  });

  describe("helper functions", () => {
    test("should handle array comparison correctly", () => {
      const { result } = renderHook(() => useAuctionListings(), {
        wrapper: AllTheProviders,
      });

      // 同じ配列の場合、setParamsが呼ばれないことを確認
      const currentConditions = result.current.listingsConditions;

      act(() => {
        result.current.setListingsConditions(currentConditions);
      });

      // 条件が変わっていないので、ページのみの更新になる
      expect(mockSetParams).toHaveBeenCalledWith({
        page: null, // page: 1なのでnull
        q: null,
        min_bid: null,
        max_bid: null,
        min_remaining_time: null,
        max_remaining_time: null,
      });
    });

    test("should handle sort array comparison correctly", () => {
      const { result } = renderHook(() => useAuctionListings(), {
        wrapper: AllTheProviders,
      });

      const newConditions = {
        ...result.current.listingsConditions,
        sort: [
          { field: "newest" as AuctionSortField, direction: "desc" as SortDirection },
          { field: "price" as AuctionSortField, direction: "asc" as SortDirection }, // 2番目の要素は無視される
        ],
      };

      act(() => {
        result.current.setListingsConditions(newConditions);
      });

      expect(mockSetParams).toHaveBeenCalledWith({
        page: null,
        q: null,
        min_bid: null,
        max_bid: null,
        min_remaining_time: null,
        max_remaining_time: null,
        sort: "newest",
        sort_direction: null, // descはデフォルトなのでnull
      });
    });
  });
});
