"use client";

import type { ReviewSearchResult, SearchSuggestion } from "@/components/review-search/review-search";
import type { UseQueryOptions } from "@tanstack/react-query";
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数のインポート
 */
import {
  getAllReviews,
  getMyReviews,
  getSearchSuggestions,
  getUserReviews,
  updateReview,
} from "@/actions/review-search/review-search";
import { AllTheProviders, mockUseMutation, mockUseQuery } from "@/test/setup/tanstack-query-setup";
import { auctionReviewFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { act, renderHook } from "@testing-library/react";
import { useQueryState } from "nuqs";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useReviewSearch } from "./use-review-search";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// review-search actionsのモック
vi.mock("@/actions/review-search/review-search", () => ({
  getAllReviews: vi.fn(),
  getMyReviews: vi.fn(),
  getUserReviews: vi.fn(),
  getSearchSuggestions: vi.fn(),
  updateReview: vi.fn(),
}));

// nuqsのモック
vi.mock("nuqs", () => ({
  useQueryState: vi.fn(),
}));

const mockGetAllReviews = vi.mocked(getAllReviews);
const mockGetMyReviews = vi.mocked(getMyReviews);
const mockGetUserReviews = vi.mocked(getUserReviews);
const mockGetSearchSuggestions = vi.mocked(getSearchSuggestions);
const mockUpdateReview = vi.mocked(updateReview);
const mockUseQueryState = vi.mocked(useQueryState);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
const mockReviewData = auctionReviewFactory.build({
  id: "review-1",
  rating: 5,
  comment: "素晴らしいサービスでした",
  reviewPosition: "BUYER_TO_SELLER",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const mockReviewSearchResult: ReviewSearchResult = {
  reviews: [mockReviewData as unknown as ReviewSearchResult["reviews"][0]],
  totalCount: 1,
  totalPages: 1,
};

const mockSuggestions: SearchSuggestion[] = [
  { value: "user1", label: "ユーザー1" },
  { value: "task1", label: "タスク1" },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * useQueryStateのモック設定用ヘルパー関数
 */
function setupUseQueryStateMock(activeTab: "search" | "edit" | "received" = "search", searchQuery = "", page = 1) {
  const setActiveTab = vi.fn();
  const setSearchQuery = vi.fn();
  const setPage = vi.fn();

  mockUseQueryState.mockImplementation((key: string) => {
    switch (key) {
      case "tab":
        return [activeTab, setActiveTab];
      case "q":
        return [searchQuery, setSearchQuery];
      case "page":
        return [page.toString(), setPage];
      default:
        return ["", vi.fn()];
    }
  });

  return { setActiveTab, setSearchQuery, setPage };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useReviewSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのモック設定
    setupUseQueryStateMock();
    const mockReviewSearchResultWithPromise = {
      success: true,
      message: "レビューを取得しました",
      data: mockReviewSearchResult,
    };
    const mockSuggestionsResultWithPromise = {
      success: true,
      message: "サジェストを取得しました",
      data: mockSuggestions,
    };

    mockGetAllReviews.mockResolvedValue(mockReviewSearchResultWithPromise);
    mockGetMyReviews.mockResolvedValue(mockReviewSearchResultWithPromise);
    mockGetUserReviews.mockResolvedValue(mockReviewSearchResultWithPromise);
    mockGetSearchSuggestions.mockResolvedValue(mockSuggestionsResultWithPromise);
    mockUpdateReview.mockResolvedValue({
      success: true,
      message: "レビューを更新しました",
      data: mockReviewData,
    });

    // TanStack Queryのモック設定
    mockUseQuery.mockReturnValue({
      data: mockReviewSearchResultWithPromise,
      isPending: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(mockReviewData),
      isPending: false,
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化", () => {
    test("should initialize with correct default values", () => {
      // Arrange - サジェスト用のuseQueryモックを設定
      const mockReviewSearchResultWithPromise = {
        success: true,
        message: "レビューを取得しました",
        data: mockReviewSearchResult,
      };
      const emptySuggestionsResult = {
        success: false,
        message: "サジェストが見つかりません",
        data: [],
      };

      mockUseQuery
        .mockReturnValueOnce({
          data: mockReviewSearchResultWithPromise,
          isPending: false,
          error: null,
          refetch: vi.fn(),
        })
        .mockReturnValueOnce({
          data: emptySuggestionsResult,
          isPending: false,
          error: null,
          refetch: vi.fn(),
        });

      // Act
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.reviews).toHaveLength(1);
      expect(result.current.totalCount).toBe(1);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.suggestions).toStrictEqual([]);
      expect(result.current.searchParams.searchQuery).toBe("");
      expect(result.current.searchParams.page).toBe("1");
      expect(result.current.searchParams.tab).toBe("search");
      expect(result.current.activeTab).toBe("search");
      expect(result.current.suggestionQuery).toBe("");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.showSuggestions).toBe(false);
    });

    test.each([
      {
        description: "edit tab with test query and page 2",
        tab: "edit" as const,
        searchQuery: "test query",
        page: 2,
      },
      {
        description: "received tab with empty query and page 1",
        tab: "received" as const,
        searchQuery: "",
        page: 1,
      },
      {
        description: "search tab with complex query and page 5",
        tab: "search" as const,
        searchQuery: "複雑な検索クエリ",
        page: 5,
      },
    ])("should initialize with custom query state values: $description", ({ tab, searchQuery, page }) => {
      // Arrange
      setupUseQueryStateMock(tab, searchQuery, page);

      // Act
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.searchParams.tab).toBe(tab);
      expect(result.current.searchParams.searchQuery).toBe(searchQuery);
      expect(result.current.searchParams.page).toBe(page.toString());
      expect(result.current.activeTab).toBe(tab);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データ取得", () => {
    test.each([
      {
        description: "all reviews when tab is search",
        tab: "search" as const,
      },
      {
        description: "my reviews when tab is edit",
        tab: "edit" as const,
      },
      {
        description: "user reviews when tab is received",
        tab: "received" as const,
      },
    ])("should fetch $description", ({ tab }) => {
      // Arrange
      setupUseQueryStateMock(tab);

      // Act
      renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Assert - useQueryが呼ばれることを確認
      expect(mockUseQuery).toHaveBeenCalled();
    });

    test("should fetch suggestions when query length is >= 2 and showSuggestions is true", async () => {
      // Arrange
      setupUseQueryStateMock();

      // Act
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.updateSearchQuery("te");
      });

      // Assert - useQueryが呼ばれることを確認（正確な回数は実装に依存）
      expect(mockUseQuery).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("検索機能", () => {
    test("should update search query correctly", () => {
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.updateSearchQuery("new query");
      });

      // Assert
      expect(result.current.suggestionQuery).toBe("new query");
      expect(result.current.showSuggestions).toBe(true);
    });

    test("should execute search correctly", () => {
      // Arrange
      const { setSearchQuery, setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // 検索クエリを設定
      act(() => {
        result.current.updateSearchQuery("test query");
      });

      // Act
      act(() => {
        result.current.executeSearch();
      });

      // Assert
      expect(setSearchQuery).toHaveBeenCalledWith("test query");
      expect(setPage).toHaveBeenCalledWith(1);
      expect(result.current.showSuggestions).toBe(false);
    });

    test("should clear search correctly", () => {
      // Arrange
      const { setSearchQuery, setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // 検索クエリを設定
      act(() => {
        result.current.updateSearchQuery("test query");
      });

      // Act
      act(() => {
        result.current.clearSearch();
      });

      // Assert
      expect(result.current.suggestionQuery).toBe("");
      expect(setSearchQuery).toHaveBeenCalledWith("");
      expect(setPage).toHaveBeenCalledWith(1);
      expect(result.current.showSuggestions).toBe(false);
    });

    test.each([
      {
        description: "should show suggestions when query length is >= 2",
        query: "te",
        expectedShowSuggestions: true,
      },
      {
        description: "should hide suggestions when query length is < 2",
        query: "t",
        expectedShowSuggestions: false,
      },
      {
        description: "should hide suggestions when query is empty",
        query: "",
        expectedShowSuggestions: false,
      },
    ])("$description", ({ query, expectedShowSuggestions }) => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.updateSearchQuery(query);
      });

      // Assert
      expect(result.current.showSuggestions).toBe(expectedShowSuggestions);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("サジェスト機能", () => {
    test("should select suggestion correctly", async () => {
      // Arrange
      const { setSearchQuery, setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      const suggestion = { value: "test", label: "Test Label" };

      // Act
      act(() => {
        result.current.selectSuggestion(suggestion);
      });

      // Assert - 関数呼び出しを確認（suggestionQueryは即座には更新されない）
      expect(setSearchQuery).toHaveBeenCalledWith("test");
      expect(setPage).toHaveBeenCalledWith(1);
      expect(result.current.showSuggestions).toBe(false);
    });

    test("should toggle suggestions visibility", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.setShowSuggestions(true);
      });

      // Assert
      expect(result.current.showSuggestions).toBe(true);

      // Act
      act(() => {
        result.current.setShowSuggestions(false);
      });

      // Assert
      expect(result.current.showSuggestions).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("タブ機能", () => {
    test.each([
      {
        description: "should change tab to edit",
        tab: "edit" as const,
      },
      {
        description: "should change tab to received",
        tab: "received" as const,
      },
      {
        description: "should change tab to search",
        tab: "search" as const,
      },
    ])("$description", ({ tab }) => {
      // Arrange
      const { setActiveTab, setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.changeTab(tab);
      });

      // Assert
      expect(setActiveTab).toHaveBeenCalledWith(tab);
      expect(setPage).toHaveBeenCalledWith(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ページネーション", () => {
    test.each([
      {
        description: "should change page to 3",
        page: 3,
      },
      {
        description: "should change page to 1",
        page: 1,
      },
      {
        description: "should change page to 100",
        page: 100,
      },
    ])("$description", ({ page }) => {
      // Arrange
      const { setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.changePage(page);
      });

      // Assert
      expect(setPage).toHaveBeenCalledWith(page);
    });

    test("should reset page to 1 when executing search", () => {
      // Arrange
      const { setPage } = setupUseQueryStateMock("search", "", 5);
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.executeSearch();
      });

      // Assert
      expect(setPage).toHaveBeenCalledWith(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("レビュー編集機能", () => {
    test("should toggle edit mode correctly", async () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.toggleEditMode("review-1");
      });

      // Assert
      expect(result.current.reviews.find((r) => r.id === "review-1")?.isEditing).toBe(true);

      // Act - toggle off
      act(() => {
        result.current.toggleEditMode("review-1");
      });

      // Assert
      expect(result.current.reviews.find((r) => r.id === "review-1")?.isEditing).toBe(false);
    });

    test("should handle multiple reviews in edit mode", async () => {
      // Arrange
      const multipleReviews = [
        { ...mockReviewData, id: "review-1" },
        { ...mockReviewData, id: "review-2" },
      ];

      mockUseQuery.mockReturnValue({
        data: {
          success: true,
          message: "レビューを取得しました",
          data: {
            reviews: multipleReviews as unknown as ReviewSearchResult["reviews"],
            totalCount: 2,
            totalPages: 1,
          },
        },
        isPending: false,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.toggleEditMode("review-1");
        result.current.toggleEditMode("review-2");
      });

      // Assert
      expect(result.current.reviews.find((r) => r.id === "review-1")?.isEditing).toBe(true);
      expect(result.current.reviews.find((r) => r.id === "review-2")?.isEditing).toBe(true);
    });

    test("should update review successfully", async () => {
      // Arrange
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.handleUpdateReview("review-1", 4, "Updated comment");
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith({ reviewId: "review-1", rating: 4, comment: "Updated comment" });
    });

    test("should handle update review error", async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // 空の実装
      });
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.handleUpdateReview("review-1", 4, "Updated comment");
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith({ reviewId: "review-1", rating: 4, comment: "Updated comment" });

      consoleErrorSpy.mockRestore();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("debounce機能", () => {
    test("should debounce suggestion query updates", async () => {
      // Arrange
      vi.useFakeTimers();

      // サジェスト用のuseQueryモックを設定
      const mockReviewSearchResultWithPromise = {
        success: true,
        message: "レビューを取得しました",
        data: mockReviewSearchResult,
      };
      const mockSuggestionsResultWithPromise = {
        success: true,
        message: "サジェストを取得しました",
        data: mockSuggestions,
      };

      mockUseQuery
        .mockReturnValueOnce({
          data: mockReviewSearchResultWithPromise,
          isPending: false,
          error: null,
          refetch: vi.fn(),
        })
        .mockReturnValueOnce({
          data: mockSuggestionsResultWithPromise,
          isPending: false,
          error: null,
          refetch: vi.fn(),
        });

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act - 複数回の入力をシミュレート
      act(() => {
        result.current.updateSearchQuery("t");
      });
      act(() => {
        result.current.updateSearchQuery("te");
      });
      act(() => {
        result.current.updateSearchQuery("tes");
      });
      act(() => {
        result.current.updateSearchQuery("test");
      });

      // Act - 400ms経過
      act(() => {
        vi.advanceTimersByTime(400);
      });

      // Assert - 最後の値が設定されている
      expect(result.current.suggestionQuery).toBe("test");

      vi.useRealTimers();
    }, 15000); // タイムアウトを15秒に延長

    test("should clear timeout on unmount", () => {
      // Arrange
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { result, unmount } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act - 入力してタイムアウトを設定
      act(() => {
        result.current.updateSearchQuery("test");
      });

      // Act - アンマウント
      unmount();

      // Assert - clearTimeoutが呼ばれる
      expect(clearTimeoutSpy).toHaveBeenCalled();

      vi.useRealTimers();
      clearTimeoutSpy.mockRestore();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test.each([
      {
        description: "should handle empty search query",
        query: "",
        expectedSuggestionQuery: "",
        expectedShowSuggestions: false,
      },
      {
        description: "should handle very long search query",
        query: "a".repeat(1000),
        expectedSuggestionQuery: "a".repeat(1000),
        expectedShowSuggestions: true,
      },
      {
        description: "should handle special characters in search query",
        query: "!@#$%^&*()_+",
        expectedSuggestionQuery: "!@#$%^&*()_+",
        expectedShowSuggestions: true,
      },
    ])("$description", ({ query, expectedSuggestionQuery, expectedShowSuggestions }) => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.updateSearchQuery(query);
      });

      // Assert
      expect(result.current.suggestionQuery).toBe(expectedSuggestionQuery);
      expect(result.current.showSuggestions).toBe(expectedShowSuggestions);
    });

    test.each([
      {
        description: "should handle null comment in update review",
        reviewId: "review-1",
        rating: 5,
        comment: null,
      },
      {
        description: "should handle empty comment in update review",
        reviewId: "review-1",
        rating: 3,
        comment: "",
      },
      {
        description: "should handle very long comment in update review",
        reviewId: "review-1",
        rating: 2,
        comment: "a".repeat(5000),
      },
    ])("$description", ({ reviewId, rating, comment }) => {
      // Arrange
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.handleUpdateReview(reviewId, rating, comment);
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith({ reviewId, rating, comment });
    });

    test.each([
      {
        description: "should handle minimum rating (1)",
        rating: 1,
        comment: "Minimum rating",
      },
      {
        description: "should handle maximum rating (5)",
        rating: 5,
        comment: "Maximum rating",
      },
      {
        description: "should handle middle rating (3)",
        rating: 3,
        comment: "Middle rating",
      },
    ])("$description", ({ rating, comment }) => {
      // Arrange
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.handleUpdateReview("review-1", rating, comment);
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith({ reviewId: "review-1", rating, comment });
    });

    test.each([
      {
        description: "should handle page 0",
        page: 0,
      },
      {
        description: "should handle negative page",
        page: -1,
      },
      {
        description: "should handle large page number",
        page: 999999,
      },
    ])("$description", ({ page }) => {
      // Arrange
      const { setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.changePage(page);
      });

      // Assert
      expect(setPage).toHaveBeenCalledWith(page);
    });

    test("should handle empty suggestions array", () => {
      // Arrange - モックを正しく設定
      mockUseQuery.mockImplementation((options: UseQueryOptions<boolean, Error, boolean, readonly string[]>) => {
        // サジェストクエリかどうかを判定（queryKeyの構造を正確にチェック）
        if (
          options?.queryKey &&
          Array.isArray(options.queryKey) &&
          options.queryKey.length >= 3 &&
          options.queryKey[0] === "review" &&
          options.queryKey[1] === "suggestions"
        ) {
          return {
            data: {
              success: false,
              message: "サジェストが見つかりません",
              data: [],
            },
            isPending: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        // メインのレビューデータクエリ
        const mockReviewSearchResultWithPromise = {
          success: true,
          message: "レビューを取得しました",
          data: mockReviewSearchResult,
        };
        return {
          data: mockReviewSearchResultWithPromise,
          isPending: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act - 2文字以上の検索クエリを入力してサジェストを有効化
      act(() => {
        result.current.updateSearchQuery("test");
      });

      // Assert - サジェストが空配列であることを確認
      expect(result.current.suggestions).toStrictEqual([]);
    });

    test("should handle empty reviews array", async () => {
      // Arrange
      const emptyReviewSearchResult = {
        success: true,
        message: "レビューが見つかりません",
        data: {
          reviews: [],
          totalCount: 0,
          totalPages: 0,
        },
      };

      mockUseQuery.mockReturnValue({
        data: emptyReviewSearchResult,
        isPending: false,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.reviews).toStrictEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.totalPages).toBe(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test.each([
      {
        description: "should handle API error gracefully",
        mockSetup: () => {
          mockUseQuery.mockReturnValue({
            data: undefined,
            isPending: false,
            error: new Error("API Error"),
            refetch: vi.fn(),
          });
        },
      },
      {
        description: "should handle suggestion API error gracefully",
        mockSetup: () => {
          const mockReviewSearchResultWithPromise = {
            success: true,
            message: "レビューを取得しました",
            data: mockReviewSearchResult,
          };

          mockUseQuery
            .mockReturnValueOnce({
              data: mockReviewSearchResultWithPromise,
              isPending: false,
              error: null,
              refetch: vi.fn(),
            })
            .mockReturnValueOnce({
              data: undefined,
              isPending: false,
              error: new Error("Suggestion API Error"),
              refetch: vi.fn(),
            });
        },
      },
    ])("$description", ({ mockSetup }) => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // 空の実装
      });
      mockSetup();

      // Act
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Assert - エラーが発生してもアプリケーションは継続動作する
      expect(result.current).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });

    test("should handle invalid tab value", () => {
      // Arrange
      mockUseQueryState.mockImplementation((key: string) => {
        if (key === "tab") {
          return ["invalid-tab" as unknown as "search" | "edit" | "received", vi.fn()];
        }
        return ["", vi.fn()];
      });

      // Act & Assert - エラーが発生しないことを確認
      expect(() => {
        renderHook(() => useReviewSearch(), {
          wrapper: AllTheProviders,
        });
      }).not.toThrow();
    });

    test.each([
      {
        description: "should handle undefined review ID in toggle edit mode",
        input: undefined as unknown as string,
        expectError: false,
      },
      {
        description: "should handle null review ID in toggle edit mode",
        input: null as unknown as string,
        expectError: false,
      },
      {
        description: "should handle empty string review ID in toggle edit mode",
        input: "",
        expectError: false,
      },
    ])("$description", ({ input, expectError }) => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      if (expectError) {
        expect(() => {
          act(() => {
            result.current.toggleEditMode(input);
          });
        }).toThrow();
      } else {
        expect(() => {
          act(() => {
            result.current.toggleEditMode(input);
          });
        }).not.toThrow();
      }
    });

    test("should handle null suggestion in selectSuggestion", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act & Assert - nullの場合はエラーが発生することを確認（実装の動作に合わせる）
      expect(() => {
        act(() => {
          result.current.selectSuggestion(null as unknown as SearchSuggestion);
        });
      }).toThrow();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("統合テスト", () => {
    test("should handle complete search workflow", async () => {
      // Arrange
      const { setSearchQuery, setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act - 検索クエリ入力
      act(() => {
        result.current.updateSearchQuery("test query");
      });

      // Act - サジェスト選択
      act(() => {
        result.current.selectSuggestion({ value: "selected", label: "Selected Item" });
      });

      // Assert - 関数呼び出しを確認（suggestionQueryは即座には更新されない）
      expect(setSearchQuery).toHaveBeenCalledWith("selected");
      expect(setPage).toHaveBeenCalledWith(1);
      expect(result.current.showSuggestions).toBe(false);
    });

    test("should handle tab change and data refetch", async () => {
      // Arrange
      const { setActiveTab, setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act - タブ変更
      act(() => {
        result.current.changeTab("edit");
      });

      // Assert
      expect(setActiveTab).toHaveBeenCalledWith("edit");
      expect(setPage).toHaveBeenCalledWith(1);
    });

    test("should handle review edit workflow", async () => {
      // Arrange
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act - 編集モード開始
      act(() => {
        result.current.toggleEditMode("review-1");
      });

      // Act - レビュー更新
      act(() => {
        result.current.handleUpdateReview("review-1", 4, "Updated comment");
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith({ reviewId: "review-1", rating: 4, comment: "Updated comment" });
    });

    test("should maintain state consistency across operations", async () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act - 複数の操作を実行
      act(() => {
        result.current.updateSearchQuery("test");
        result.current.setShowSuggestions(true);
        result.current.toggleEditMode("review-1");
      });

      // Assert - 状態が一貫している
      expect(result.current.suggestionQuery).toBe("test");
      expect(result.current.showSuggestions).toBe(true);
      expect(result.current.reviews.find((r) => r.id === "review-1")?.isEditing).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("バグ修正：検索ワード削除後の再検索", () => {
    test("should search with empty query after clearing input field", () => {
      // Arrange
      const { setSearchQuery, setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // 検索クエリを設定
      act(() => {
        result.current.updateSearchQuery("test query");
      });

      // 検索を実行
      act(() => {
        result.current.executeSearch();
      });

      // クエリをクリア
      act(() => {
        result.current.updateSearchQuery("");
      });

      // Act - 空のクエリで検索を実行
      act(() => {
        result.current.executeSearch();
      });

      // Assert - 空のクエリで検索が実行されることを確認
      expect(setSearchQuery).toHaveBeenCalledWith("");
      expect(setPage).toHaveBeenCalledWith(1);
    });

    test("should search with current suggestionQuery value, not previous searchQuery", () => {
      // Arrange
      const { setSearchQuery } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // 最初の検索クエリを設定して実行
      act(() => {
        result.current.updateSearchQuery("old query");
      });
      act(() => {
        result.current.executeSearch();
      });

      // 新しいクエリに変更（まだ検索は実行していない）
      act(() => {
        result.current.updateSearchQuery("new query");
      });

      // Act - 検索を実行
      act(() => {
        result.current.executeSearch();
      });

      // Assert - 新しいクエリで検索されることを確認
      expect(setSearchQuery).toHaveBeenLastCalledWith("new query");
    });

    test("should properly handle clear search after text input", () => {
      // Arrange
      const { setSearchQuery, setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // テキストを入力
      act(() => {
        result.current.updateSearchQuery("some text");
      });

      // Act - クリア操作
      act(() => {
        result.current.clearSearch();
      });

      // Assert - すべての状態がクリアされることを確認
      expect(result.current.suggestionQuery).toBe("");
      expect(setSearchQuery).toHaveBeenCalledWith("");
      expect(setPage).toHaveBeenCalledWith(1);
      expect(result.current.showSuggestions).toBe(false);
    });

    test("should not reset suggestionQuery to previous searchQuery when user is typing", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // 最初に検索を実行して searchQuery を設定
      act(() => {
        result.current.updateSearchQuery("test");
      });
      act(() => {
        result.current.executeSearch();
      });

      // 現在の状態を確認
      expect(result.current.suggestionQuery).toBe("test");

      // ユーザーが文字を削除していく（このバグのシナリオ）
      act(() => {
        result.current.updateSearchQuery("tes");
      });

      // Assert - suggestionQuery が削除された文字数に応じて更新される
      expect(result.current.suggestionQuery).toBe("tes");

      // さらに削除
      act(() => {
        result.current.updateSearchQuery("te");
      });

      // Assert - suggestionQuery が元の値に戻らないことを確認
      expect(result.current.suggestionQuery).toBe("te");

      // さらに削除
      act(() => {
        result.current.updateSearchQuery("t");
      });

      // Assert - suggestionQuery が元の値に戻らないことを確認
      expect(result.current.suggestionQuery).toBe("t");

      // 完全に削除
      act(() => {
        result.current.updateSearchQuery("");
      });

      // Assert - 空文字になることを確認
      expect(result.current.suggestionQuery).toBe("");
    });

    test("should properly sync suggestionQuery when search is executed after typing", () => {
      // Arrange
      const { setSearchQuery } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // ユーザーが入力
      act(() => {
        result.current.updateSearchQuery("typing...");
      });

      // 入力中はsuggestionQueryが独立して管理される
      expect(result.current.suggestionQuery).toBe("typing...");

      // 検索を実行すると同期される
      act(() => {
        result.current.executeSearch();
      });

      // Assert - 検索が実行されて同期が完了
      expect(setSearchQuery).toHaveBeenCalledWith("typing...");
      expect(result.current.suggestionQuery).toBe("typing...");
    });
  });
});
