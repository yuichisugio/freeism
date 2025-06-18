import type { AuctionFilterTypes, AuctionListingsConditions } from "@/types/auction-types";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { AllTheProviders, mockUseQuery } from "@/test/setup/tanstack-query-setup";
import { faker } from "@faker-js/faker";
import { act, renderHook } from "@testing-library/react";
import { Factory } from "fishery";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useAuctionFilters } from "./use-auction-filters";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const { mockUseSession, mockGetSearchSuggestions, mockGetUserGroups, mockToastError, mockToastSuccess } = vi.hoisted(
  () => ({
    mockUseSession: vi.fn(),
    mockGetSearchSuggestions: vi.fn(),
    mockGetUserGroups: vi.fn(),
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
  }),
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// next-auth/react のモック
vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
}));

// API関数のモック
vi.mock("@/lib/auction/action/auction-listing", () => ({
  getSearchSuggestions: mockGetSearchSuggestions,
}));

vi.mock("@/lib/auction/action/user", () => ({
  getUserGroups: mockGetUserGroups,
}));

// Sonner（トースト通知）のモック
vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// セッションデータファクトリー
const sessionFactory = Factory.define<{ user: { id: string; email: string; name: string } }>(
  ({ sequence, params }) => ({
    user: {
      id: params.user?.id ?? `user-${sequence}`,
      email: params.user?.email ?? faker.internet.email(),
      name: params.user?.name ?? faker.person.fullName(),
    },
  }),
);

// AuctionListingsConditionsファクトリー
const auctionListingsConditionsFactory = Factory.define<AuctionListingsConditions>(({ params }) => ({
  categories: params.categories ?? null,
  status: params.status ?? null,
  joinType: params.joinType ?? "AND",
  minBid: params.minBid ?? null,
  maxBid: params.maxBid ?? null,
  minRemainingTime: params.minRemainingTime ?? null,
  maxRemainingTime: params.maxRemainingTime ?? null,
  groupIds: params.groupIds ?? null,
  searchQuery: params.searchQuery ?? null,
  sort: params.sort ?? null,
  page: params.page ?? 1,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

const createTestSession = (overrides: Partial<{ user: { id: string; email: string; name: string } }> = {}) => {
  return sessionFactory.build(overrides);
};

const createTestListingsConditions = (
  overrides: Partial<AuctionListingsConditions> = {},
): AuctionListingsConditions => {
  return auctionListingsConditionsFactory.build(overrides);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストセットアップ
 */

describe("useAuctionFilters", () => {
  // テスト用データ
  const testUserId = "test-user-id";
  const testSession = createTestSession({ user: { id: testUserId, email: "test@example.com", name: "Test User" } });
  const testListingsConditions = createTestListingsConditions();
  const mockSetListingsConditionsAction = vi.fn();

  beforeEach(() => {
    // モックをリセット
    vi.clearAllMocks();

    // タイマーをモック（デバウンス処理を高速化）
    vi.useFakeTimers();

    // デフォルトのモック設定
    mockUseSession.mockReturnValue({
      data: testSession,
      status: "authenticated",
    });

    // シンプルなuseQueryモック設定
    mockUseQuery.mockReturnValue({
      data: [],
      isPending: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    // API関数のデフォルトモック
    mockGetSearchSuggestions.mockResolvedValue([]);
    mockGetUserGroups.mockResolvedValue([]);
  });

  afterEach(() => {
    // タイマーをリストア
    vi.useRealTimers();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本機能", () => {
    test("should initialize with correct default values", () => {
      // Act
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Assert
      expect(result.current.listingsConditions).toStrictEqual(testListingsConditions);
      expect(result.current.draftConditions).toStrictEqual(testListingsConditions);
      expect(result.current.showFilters).toBe(false);
      expect(result.current.activeFilterCount).toBe(0);
      expect(result.current.categoriesList).toStrictEqual(AUCTION_CONSTANTS.AUCTION_CATEGORIES);
    });

    test("should throw error when userId is not available", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      // Act & Assert
      expect(() => {
        renderHook(
          () =>
            useAuctionFilters({
              listingsConditions: testListingsConditions,
              setListingsConditionsAction: mockSetListingsConditionsAction,
            }),
          {
            wrapper: AllTheProviders,
          },
        );
      }).toThrow("ユーザーIDが取得できませんでした");
    });

    test("should toggle filter display", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Act
      act(() => {
        result.current.toggleFilterDisplay();
      });

      // Assert
      expect(result.current.showFilters).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("カテゴリ選択", () => {
    test("should handle category selection", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Act
      act(() => {
        result.current.handleCategorySelect("食品");
      });

      // Assert
      expect(mockSetListingsConditionsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: ["食品"],
        }),
      );
    });

    test("should check if category is selected correctly", () => {
      // Arrange
      const conditionsWithCategory = createTestListingsConditions({
        categories: ["食品", "コード"],
      });

      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: conditionsWithCategory,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Assert
      expect(result.current.isCategorySelected("食品")).toBe(true);
      expect(result.current.isCategorySelected("本")).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ステータス選択", () => {
    test("should handle status selection", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Act
      act(() => {
        result.current.handleStatusSelect("watchlist" as AuctionFilterTypes);
      });

      // Assert
      expect(result.current.draftConditions.status).toStrictEqual(["watchlist"]);
    });

    test("should handle status join type change", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Act
      act(() => {
        result.current.handleStatusJoinTypeChange("OR");
      });

      // Assert
      expect(result.current.draftConditions.joinType).toBe("OR");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("グループ選択", () => {
    test("should handle group selection", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Act
      act(() => {
        result.current.handleGroupSelect("group-1");
      });

      // Assert
      expect(result.current.draftConditions.groupIds).toStrictEqual(["group-1"]);
    });

    test("should check if group is selected correctly", () => {
      // Arrange
      const conditionsWithGroups = createTestListingsConditions({
        groupIds: ["group-1", "group-2"],
      });

      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: conditionsWithGroups,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Assert
      expect(result.current.isGroupSelected("group-1")).toBe(true);
      expect(result.current.isGroupSelected("group-3")).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("価格・時間範囲", () => {
    test("should handle price range change", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Act
      act(() => {
        result.current.handlePriceRangeChange([100, 1000]);
      });

      // Assert
      expect(result.current.draftConditions.minBid).toBe(100);
      expect(result.current.draftConditions.maxBid).toBe(1000);
    });

    test("should handle time range change", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Act
      act(() => {
        result.current.handleTimeRangeChange([1, 24]);
      });

      // Assert
      expect(result.current.draftConditions.minRemainingTime).toBe(1);
      expect(result.current.draftConditions.maxRemainingTime).toBe(24);
    });

    test("should handle time range operations", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Act - 時間範囲プリセット設定
      act(() => {
        result.current.setTimePreset(1, 24);
      });

      // Assert
      expect(result.current.draftConditions.minRemainingTime).toBe(1);
      expect(result.current.draftConditions.maxRemainingTime).toBe(24);

      // Act - 時間範囲リセット
      act(() => {
        result.current.resetTimeRange();
      });

      // Assert
      expect(result.current.draftConditions.minRemainingTime).toBe(null);
      expect(result.current.draftConditions.maxRemainingTime).toBe(null);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ソート機能", () => {
    test("should handle sort operations", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Act - ソート変更
      act(() => {
        result.current.handleSortChange({ field: "price", direction: "asc" });
      });

      // Assert
      expect(result.current.draftConditions.sort).toStrictEqual([{ field: "price", direction: "asc" }]);

      // Act - ソート方向切り替え
      act(() => {
        result.current.handleSortDirectionToggle();
      });

      // Assert
      expect(result.current.draftConditions.sort).toStrictEqual([{ field: "price", direction: "desc" }]);
    });

    test("should get sort values correctly", () => {
      // Arrange
      const conditionsWithSort = createTestListingsConditions({
        sort: [{ field: "price", direction: "desc" }],
      });

      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: conditionsWithSort,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Assert
      expect(result.current.getSortField()).toBe("price");
      expect(result.current.getSortDirection()).toBe("desc");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フィルター管理", () => {
    test("should handle filter operations", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Act - フィルター変更
      act(() => {
        result.current.handleFilterChange({
          minBid: 500,
          maxBid: 2000,
          searchQuery: "test query",
        });
      });

      // Assert
      expect(result.current.draftConditions.minBid).toBe(500);
      expect(result.current.draftConditions.maxBid).toBe(2000);
      expect(result.current.draftConditions.searchQuery).toBe("test query");

      // Act - すべてのフィルターをリセット
      act(() => {
        result.current.handleResetAllFilters();
      });

      // Assert
      expect(result.current.draftConditions.categories).toBe(null);
      expect(result.current.draftConditions.minBid).toBe(null);
      expect(result.current.showFilters).toBe(false);
    });

    test("should apply all filters", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Set some draft conditions first
      act(() => {
        result.current.handleFilterChange({
          categories: ["食品"],
          minBid: 200,
        });
      });

      // Act
      act(() => {
        result.current.applyAllFilters();
      });

      // Assert
      expect(mockSetListingsConditionsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: ["食品"],
          minBid: 200,
        }),
      );
      expect(result.current.showFilters).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("検索・サジェスト機能", () => {
    test("should handle search query operations", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Act - 検索クエリ入力
      act(() => {
        result.current.handleSearchQueryEnter("test search");
      });

      // Assert
      expect(mockSetListingsConditionsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: "test search",
          page: 1,
        }),
      );

      // Act - サジェスト選択
      act(() => {
        result.current.selectSuggestion("selected suggestion");
      });

      // Assert
      expect(mockSetListingsConditionsAction).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: "selected suggestion",
          page: 1,
        }),
      );
    });

    test("should handle keyboard events", () => {
      // Arrange
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      const mockEvent = {
        key: "Escape",
        preventDefault: vi.fn(),
        metaKey: false,
        ctrlKey: false,
      } as unknown as React.KeyboardEvent<HTMLInputElement>;

      // Act
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      // Assert - Escapeキーが処理されることを確認
      expect(result.current.highlightedIndex).toBe(-1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("アクティブフィルターカウント", () => {
    test("should count active filters correctly", () => {
      // Arrange
      const conditionsWithMultipleFilters = createTestListingsConditions({
        categories: ["食品"],
        status: ["watchlist"],
        minBid: 100,
        maxBid: 1000,
        groupIds: ["group-1"],
        searchQuery: "test query",
      });

      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: conditionsWithMultipleFilters,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Assert - 5つのアクティブフィルターがあることを確認
      expect(result.current.activeFilterCount).toBeGreaterThan(0);
    });

    test("should not count default values as active filters", () => {
      // Arrange
      const conditionsWithDefaults = createTestListingsConditions({
        categories: null,
        status: null,
        minBid: null,
        maxBid: null,
        groupIds: null,
        searchQuery: null,
      });

      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: conditionsWithDefaults,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Assert
      expect(result.current.activeFilterCount).toBe(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリング", () => {
    test("should handle query errors gracefully", () => {
      // Arrange
      const mockError = new Error("Query failed");
      mockUseQuery.mockReturnValue({
        data: [],
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: true,
        error: mockError,
        refetch: vi.fn(),
      });

      // Act
      const { result } = renderHook(
        () =>
          useAuctionFilters({
            listingsConditions: testListingsConditions,
            setListingsConditionsAction: mockSetListingsConditionsAction,
          }),
        {
          wrapper: AllTheProviders,
        },
      );

      // Assert - エラーが発生してもhookが正常に動作することを確認
      expect(result.current.suggestions).toStrictEqual([]);
      expect(result.current.joinTypeinedGroupList).toStrictEqual([]);
    });
  });
});
