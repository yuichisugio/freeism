import type { AuctionListingsConditions } from "@/types/auction-types";
import { useAuctionFilters } from "@/hooks/auction/listing/use-auction-filters";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { fireEvent, render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AuctionFilters } from "./auction-listing-filters";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// useAuctionFiltersフックのモック
vi.mock("@/hooks/auction/listing/use-auction-filters", () => ({
  useAuctionFilters: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ファクトリー定義
 */

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

const createTestListingsConditions = (
  overrides: Partial<AuctionListingsConditions> = {},
): AuctionListingsConditions => {
  return auctionListingsConditionsFactory.build(overrides);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * useAuctionFiltersフックのデフォルトモック戻り値
 */
const createMockHookReturn = (overrides = {}) => ({
  // state
  listingsConditions: createTestListingsConditions(),
  draftConditions: createTestListingsConditions(),
  showFilters: false,
  activeFilterCount: 0,
  openGroupCombobox: false,
  changingSearchQuery: null,
  categoriesList: AUCTION_CONSTANTS.AUCTION_CATEGORIES,
  areAllGroupsSelected: true,
  joinTypeinedGroupList: [],

  // loading states
  isSuggestionsLoading: false,
  isUserGroupsLoading: false,

  // action
  setListingsConditionsAction: vi.fn(),
  handleSearchQueryEnter: vi.fn(),
  setChangingSearchQuery: vi.fn(),
  setOpenGroupCombobox: vi.fn(),
  handleCategorySelect: vi.fn(),
  handleStatusSelect: vi.fn(),
  handleStatusJoinTypeChange: vi.fn(),
  handleGroupSelect: vi.fn(),
  handlePriceRangeChange: vi.fn(),
  handlePriceRangeApply: vi.fn(),
  handleTimeRangeChange: vi.fn(),
  handleTimeRangeApply: vi.fn(),
  toggleFilterDisplay: vi.fn(),
  setPricePreset: vi.fn(),
  setTimePreset: vi.fn(),
  resetPriceRange: vi.fn(),
  resetTimeRange: vi.fn(),
  handleFilterChange: vi.fn(),
  handleSortChange: vi.fn(),
  handleSortDirectionToggle: vi.fn(),
  handleResetAllFilters: vi.fn(),
  applyAllFilters: vi.fn(),

  // サジェスト関連
  suggestions: [],
  highlightedIndex: -1,
  selectSuggestion: vi.fn(),
  handleKeyDown: vi.fn(),
  closeSuggestions: vi.fn(),

  // utilities
  formatTimeDisplay: vi.fn((hours: number) => `${hours}時間`),
  isCategorySelected: vi.fn(() => false),
  isStatusSelected: vi.fn(() => false),
  isGroupSelected: vi.fn(() => false),
  getSortField: vi.fn(() => "newest" as const),
  getSortDirection: vi.fn(() => "asc" as const),

  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストスイート
 */

describe("AuctionFilters", () => {
  // テスト用データ
  const testListingsConditions = createTestListingsConditions();
  const mockSetListingsConditionsAction = vi.fn();

  beforeEach(() => {
    // モックをリセット
    vi.clearAllMocks();

    // デフォルトのモック設定
    vi.mocked(useAuctionFilters).mockReturnValue(createMockHookReturn());
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本レンダリング", () => {
    test("should render with default state", () => {
      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.getByPlaceholderText("商品名や説明文で検索...")).toBeInTheDocument();
      expect(screen.getByText("検索")).toBeInTheDocument();
      expect(screen.getByText("並び替え・フィルター")).toBeInTheDocument();
      expect(screen.getByText("フィルターを適用")).toBeInTheDocument();
    });

    test("should render category tabs", () => {
      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert - カテゴリタブがレンダリングされることを確認
      AUCTION_CONSTANTS.AUCTION_CATEGORIES.forEach((category) => {
        expect(screen.getByText(category)).toBeInTheDocument();
      });
    });

    test("should show active filter count when filters are active", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          activeFilterCount: 3,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.getByText("3")).toBeInTheDocument(); // フィルターカウント
      expect(screen.getByText("リセット")).toBeInTheDocument(); // リセットボタン
    });

    test("should not show reset button when no filters are active", () => {
      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.queryByText("リセット")).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("検索機能", () => {
    test("should render search input with placeholder", () => {
      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      const searchInput = screen.getByPlaceholderText("商品名や説明文で検索...");
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute("type", "search");
    });

    test("should show suggestions when search query exists", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          changingSearchQuery: "テスト",
          suggestions: [
            {
              id: "suggestion-1",
              text: "テスト商品1",
              highlighted: "テスト商品1",
              score: 1.0,
            },
            {
              id: "suggestion-2",
              text: "テスト商品2",
              highlighted: "テスト商品2",
              score: 0.8,
            },
          ],
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.getByText("テスト商品1")).toBeInTheDocument();
      expect(screen.getByText("テスト商品2")).toBeInTheDocument();
    });

    test("should not show suggestions when search query is empty", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          changingSearchQuery: "",
          suggestions: [],
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    test("should highlight selected suggestion", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          changingSearchQuery: "テスト",
          suggestions: [
            {
              id: "suggestion-1",
              text: "テスト商品1",
              highlighted: "テスト商品1",
              score: 1.0,
            },
            {
              id: "suggestion-2",
              text: "テスト商品2",
              highlighted: "テスト商品2",
              score: 0.8,
            },
          ],
          highlightedIndex: 1,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      const highlightedItem = screen.getByRole("option", { selected: true });
      expect(highlightedItem).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フィルターパネル表示・非表示", () => {
    test("should show filter panel when showFilters is true", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.getByText("フィルター設定")).toBeInTheDocument();
      expect(screen.getByText("並び替え")).toBeInTheDocument();
      expect(screen.getByText("ステータス")).toBeInTheDocument();
      expect(screen.getByText("グループ")).toBeInTheDocument();
      expect(screen.getByText("残り時間")).toBeInTheDocument();
      expect(screen.getByText("価格帯")).toBeInTheDocument();
    });

    test("should not show filter panel when showFilters is false", () => {
      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.queryByText("フィルター設定")).not.toBeInTheDocument();
    });

    test("should call toggleFilterDisplay when filter button is clicked", () => {
      // Arrange
      const mockToggleFilterDisplay = vi.fn();
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          toggleFilterDisplay: mockToggleFilterDisplay,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      const filterButton = screen.getByText("並び替え・フィルター");
      fireEvent.click(filterButton);

      // Assert
      expect(mockToggleFilterDisplay).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("カテゴリ選択", () => {
    test("should call handleCategorySelect when category button is clicked", () => {
      // Arrange
      const mockHandleCategorySelect = vi.fn();
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          handleCategorySelect: mockHandleCategorySelect,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      const categoryButton = screen.getByText("食品");
      fireEvent.click(categoryButton);

      // Assert
      expect(mockHandleCategorySelect).toHaveBeenCalledWith("食品");
    });

    test("should show selected category with different styling", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          isCategorySelected: vi.fn((category: string) => category === "食品"),
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      const selectedCategory = screen.getByText("食品");
      expect(selectedCategory).toHaveClass("bg-blue-500", "text-white");
    });

    test("should show unselected category with default styling", () => {
      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      const unselectedCategory = screen.getByText("コード");
      expect(unselectedCategory).toHaveClass("bg-gray-100", "text-gray-700");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フィルター適用とリセット", () => {
    test("should call applyAllFilters when apply button is clicked", () => {
      // Arrange
      const mockApplyAllFilters = vi.fn();
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          applyAllFilters: mockApplyAllFilters,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      const applyButton = screen.getByText("フィルターを適用");
      fireEvent.click(applyButton);

      // Assert
      expect(mockApplyAllFilters).toHaveBeenCalledTimes(1);
    });

    test("should call handleResetAllFilters when reset button is clicked", () => {
      // Arrange
      const mockHandleResetAllFilters = vi.fn();
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          activeFilterCount: 2,
          handleResetAllFilters: mockHandleResetAllFilters,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      const resetButton = screen.getByText("リセット");
      fireEvent.click(resetButton);

      // Assert
      expect(mockHandleResetAllFilters).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ソート機能", () => {
    test("should show sort options when filter panel is open", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.getByText("関連度順")).toBeInTheDocument();
      expect(screen.getByText("新着順")).toBeInTheDocument();
      expect(screen.getByText("終了時間順")).toBeInTheDocument();
      expect(screen.getByText("入札額")).toBeInTheDocument();
      expect(screen.getByText("入札数順")).toBeInTheDocument();
    });

    test("should show sort direction buttons", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.getByText("昇順")).toBeInTheDocument();
      expect(screen.getByText("降順")).toBeInTheDocument();
    });

    test("should call handleSortDirectionToggle when direction button is clicked", async () => {
      // Arrange
      const mockHandleSortDirectionToggle = vi.fn();
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
          handleSortDirectionToggle: mockHandleSortDirectionToggle,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      const ascButton = await screen.findByText("昇順");
      fireEvent.click(ascButton);

      // Assert
      expect(mockHandleSortDirectionToggle).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ステータスフィルター", () => {
    test("should show status filter options when filter panel is open", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert - ステータスセクション内の特定の要素を確認
      expect(screen.getByText("ステータス")).toBeInTheDocument();
      expect(screen.getByText("ウォッチリスト")).toBeInTheDocument();
      expect(screen.getByText("未入札")).toBeInTheDocument();
      expect(screen.getByText("入札済み")).toBeInTheDocument();
      expect(screen.getByText("終了済み以外")).toBeInTheDocument();
      expect(screen.getByText("終了済み")).toBeInTheDocument();
    });

    test("should show status join type buttons", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.getByText("OR条件")).toBeInTheDocument();
      expect(screen.getByText("AND条件")).toBeInTheDocument();
    });

    test("should call handleStatusJoinTypeChange when join type button is clicked", () => {
      // Arrange
      const mockHandleStatusJoinTypeChange = vi.fn();
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
          handleStatusJoinTypeChange: mockHandleStatusJoinTypeChange,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      const orButton = screen.getByText("OR条件");
      fireEvent.click(orButton);

      // Assert
      expect(mockHandleStatusJoinTypeChange).toHaveBeenCalledWith("OR");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("価格範囲フィルター", () => {
    test("should show price range inputs when filter panel is open", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.getByLabelText("最小価格")).toBeInTheDocument();
      expect(screen.getByLabelText("最大価格")).toBeInTheDocument();
    });

    test("should show price preset buttons", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.getByText("500P以下")).toBeInTheDocument();
      expect(screen.getByText("1000P以下")).toBeInTheDocument();
      expect(screen.getByText("5000P以下")).toBeInTheDocument();
    });

    test("should call handlePriceRangeApply when apply button is clicked", () => {
      // Arrange
      const mockHandlePriceRangeApply = vi.fn();
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
          handlePriceRangeApply: mockHandlePriceRangeApply,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      const applyButton = screen.getByText("価格帯を適用");
      fireEvent.click(applyButton);

      // Assert
      expect(mockHandlePriceRangeApply).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("時間範囲フィルター", () => {
    test("should show time range inputs when filter panel is open", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.getByLabelText("最小時間")).toBeInTheDocument();
      expect(screen.getByLabelText("最大時間")).toBeInTheDocument();
    });

    test("should show time preset buttons", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert - プリセットボタンが存在することを確認
      const timePresetButtons = screen.getAllByText("1時間以内");
      expect(timePresetButtons.length).toBeGreaterThan(0);
      const dayPresetButtons = screen.getAllByText("24時間以内");
      expect(dayPresetButtons.length).toBeGreaterThan(0);
      const threeDayButtons = screen.getAllByText("3日以内");
      expect(threeDayButtons.length).toBeGreaterThan(0);
    });

    test("should call handleTimeRangeApply when apply button is clicked", () => {
      // Arrange
      const mockHandleTimeRangeApply = vi.fn();
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
          handleTimeRangeApply: mockHandleTimeRangeApply,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      const applyButton = screen.getByText("残り時間を適用");
      fireEvent.click(applyButton);

      // Assert
      expect(mockHandleTimeRangeApply).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリングとエッジケース", () => {
    test("should handle empty categories list", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          categoriesList: [],
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.getByText("カテゴリが読み込まれていません")).toBeInTheDocument();
    });

    test("should handle null listingsConditions props", () => {
      // Arrange
      const nullConditions = createTestListingsConditions({
        categories: null,
        status: null,
        groupIds: null,
        searchQuery: null,
        sort: null,
      });

      // Act
      expect(() => {
        render(
          <AuctionFilters
            listingsConditions={nullConditions}
            setListingsConditionsAction={mockSetListingsConditionsAction}
          />,
        );
      }).not.toThrow();
    });

    test("should handle undefined props gracefully", () => {
      // Arrange
      const mockHookReturn = createMockHookReturn({
        changingSearchQuery: null,
        suggestions: [],
        draftConditions: createTestListingsConditions({
          categories: null,
          status: null,
        }),
      });

      vi.mocked(useAuctionFilters).mockReturnValue(mockHookReturn);

      // Act
      expect(() => {
        render(
          <AuctionFilters
            listingsConditions={testListingsConditions}
            setListingsConditionsAction={mockSetListingsConditionsAction}
          />,
        );
      }).not.toThrow();
    });

    test("should handle large numbers in price and time ranges", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
          draftConditions: createTestListingsConditions({
            minBid: 999999,
            maxBid: 10000000,
            minRemainingTime: 10000,
            maxRemainingTime: 100000,
          }),
          formatTimeDisplay: vi.fn((hours: number) => {
            if (hours > 8760) return `${Math.floor(hours / 8760)}年`;
            return `${hours}時間`;
          }),
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert - 大きな数値でもクラッシュしないことを確認
      expect(screen.getByText("価格帯")).toBeInTheDocument();
      expect(screen.getByText("残り時間")).toBeInTheDocument();
    });

    test("should handle empty suggestions array", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          changingSearchQuery: "検索中",
          suggestions: [],
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    test("should handle invalid highlighted index", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          changingSearchQuery: "テスト",
          suggestions: [
            {
              id: "suggestion-1",
              text: "テスト商品1",
              highlighted: "テスト商品1",
              score: 1.0,
            },
          ],
          highlightedIndex: 999, // 無効なインデックス
        }),
      );

      // Act
      expect(() => {
        render(
          <AuctionFilters
            listingsConditions={testListingsConditions}
            setListingsConditionsAction={mockSetListingsConditionsAction}
          />,
        );
      }).not.toThrow();
    });

    test("should handle missing function props", () => {
      // Arrange
      const incompleteHookReturn = createMockHookReturn({
        handleCategorySelect: undefined,
        handleStatusSelect: undefined,
        toggleFilterDisplay: undefined,
      });

      vi.mocked(useAuctionFilters).mockReturnValue(incompleteHookReturn);

      // Act
      expect(() => {
        render(
          <AuctionFilters
            listingsConditions={testListingsConditions}
            setListingsConditionsAction={mockSetListingsConditionsAction}
          />,
        );
      }).not.toThrow();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("アクセシビリティ", () => {
    test("should have proper ARIA attributes for search input", () => {
      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      const searchInput = screen.getByPlaceholderText("商品名や説明文で検索...");
      expect(searchInput).toHaveAttribute("role", "combobox");
      expect(searchInput).toHaveAttribute("aria-autocomplete", "list");
      expect(searchInput).toHaveAttribute("aria-expanded", "false");
    });

    test("should have proper ARIA attributes for suggestions", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          changingSearchQuery: "テスト",
          suggestions: [
            {
              id: "suggestion-1",
              text: "テスト商品1",
              highlighted: "テスト商品1",
              score: 1.0,
            },
          ],
          highlightedIndex: 0,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      const suggestionsList = screen.getByRole("listbox");
      expect(suggestionsList).toBeInTheDocument();
      expect(suggestionsList).toHaveAttribute("id", "suggestions-list");

      const suggestion = screen.getByRole("option");
      expect(suggestion).toHaveAttribute("aria-selected", "true");
    });

    test("should have proper button types for form elements", () => {
      // Arrange
      vi.mocked(useAuctionFilters).mockReturnValue(
        createMockHookReturn({
          showFilters: true,
        }),
      );

      // Act
      render(
        <AuctionFilters
          listingsConditions={testListingsConditions}
          setListingsConditionsAction={mockSetListingsConditionsAction}
        />,
      );

      // Assert
      const sortButtons = screen.getAllByRole("button").filter((button) => button.getAttribute("type") === "button");
      expect(sortButtons.length).toBeGreaterThan(0);
    });
  });
});
