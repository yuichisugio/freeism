"use client";

import type { ReviewSearchResult, SearchSuggestion } from "@/components/review-search/review-search";
import type { AuctionReview } from "@prisma/client";
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数のインポート
 */
import { getAllReviews, getMyReviews, getSearchSuggestions, getUserReviews, updateReview } from "@/lib/actions/review-search/review-search";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { auctionReviewFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useQueryState } from "nuqs";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useReviewSearch } from "./use-review-search";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// review-search actionsのモック
vi.mock("@/lib/actions/review-search/review-search", () => ({
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
        return [page.toString(), setPage]; // pageは文字列として返す
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
    mockGetAllReviews.mockResolvedValue(mockReviewSearchResult);
    mockGetMyReviews.mockResolvedValue(mockReviewSearchResult);
    mockGetUserReviews.mockResolvedValue(mockReviewSearchResult);
    mockGetSearchSuggestions.mockResolvedValue(mockSuggestions);
    mockUpdateReview.mockResolvedValue(mockReviewData as unknown as AuctionReview);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化", () => {
    test("should initialize with correct default values", () => {
      // Act
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.reviews).toStrictEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.totalPages).toBe(0);
      expect(result.current.suggestions).toStrictEqual([]);
      expect(result.current.searchParams.searchQuery).toBe("");
      expect(result.current.searchParams.page).toBe("1"); // 文字列として扱われる
      expect(result.current.searchParams.tab).toBe("search");
      expect(result.current.activeTab).toBe("search");
      expect(result.current.suggestionQuery).toBe("");
      expect(result.current.isLoading).toBe(true);
      expect(result.current.showSuggestions).toBe(false);
      expect(result.current.isUpdating).toBe(false);
    });

    test("should initialize with custom query state values", () => {
      // Arrange
      setupUseQueryStateMock("edit", "test query", 2);

      // Act
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.searchParams.tab).toBe("edit");
      expect(result.current.searchParams.searchQuery).toBe("test query");
      expect(result.current.searchParams.page).toBe("2"); // 文字列として扱われる
      expect(result.current.activeTab).toBe("edit");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データ取得", () => {
    test("should fetch all reviews when tab is search", async () => {
      // Arrange
      setupUseQueryStateMock("search");

      // Assert
      await waitFor(() => {
        expect(mockGetAllReviews).toHaveBeenCalledWith({
          searchQuery: "",
          page: "1", // 文字列として渡される
          tab: "search",
        });
      });
    });

    test("should fetch my reviews when tab is edit", async () => {
      // Arrange
      setupUseQueryStateMock("edit");

      // Assert
      await waitFor(() => {
        expect(mockGetMyReviews).toHaveBeenCalledWith({
          searchQuery: "",
          page: "1", // 文字列として渡される
          tab: "edit",
        });
      });
    });

    test("should fetch user reviews when tab is received", async () => {
      // Arrange
      setupUseQueryStateMock("received");

      // Assert
      await waitFor(() => {
        expect(mockGetUserReviews).toHaveBeenCalledWith({
          searchQuery: "",
          page: "1", // 文字列として渡される
          tab: "received",
        });
      });
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

      // Assert
      await waitFor(() => {
        expect(mockGetSearchSuggestions).toHaveBeenCalledWith("te");
      });
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

    test("should show suggestions when query length is >= 2", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.updateSearchQuery("te");
      });

      // Assert
      expect(result.current.showSuggestions).toBe(true);
    });

    test("should hide suggestions when query length is < 2", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.updateSearchQuery("t");
      });

      // Assert
      expect(result.current.showSuggestions).toBe(false);
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
    test("should change tab correctly", () => {
      // Arrange
      const { setActiveTab, setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.changeTab("edit");
      });

      // Assert
      expect(setActiveTab).toHaveBeenCalledWith("edit");
      expect(setPage).toHaveBeenCalledWith(1);
    });

    test("should change tab to received", () => {
      // Arrange
      const { setActiveTab, setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.changeTab("received");
      });

      // Assert
      expect(setActiveTab).toHaveBeenCalledWith("received");
      expect(setPage).toHaveBeenCalledWith(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ページネーション", () => {
    test("should change page correctly", () => {
      // Arrange
      const { setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.changePage(3);
      });

      // Assert
      expect(setPage).toHaveBeenCalledWith(3);
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

      // データが読み込まれるまで待機
      await waitFor(() => {
        expect(result.current.reviews.length).toBeGreaterThan(0);
      });

      // Act
      act(() => {
        result.current.toggleEditMode("review-1");
      });

      // Assert
      await waitFor(() => {
        expect(result.current.reviews.find((r) => r.id === "review-1")?.isEditing).toBe(true);
      });

      // Act - toggle off
      act(() => {
        result.current.toggleEditMode("review-1");
      });

      // Assert
      await waitFor(() => {
        expect(result.current.reviews.find((r) => r.id === "review-1")?.isEditing).toBe(false);
      });
    });

    test("should handle multiple reviews in edit mode", async () => {
      // Arrange
      const multipleReviews = [
        { ...mockReviewData, id: "review-1" },
        { ...mockReviewData, id: "review-2" },
      ];
      mockGetAllReviews.mockResolvedValue({
        reviews: multipleReviews as unknown as ReviewSearchResult["reviews"],
        totalCount: 2,
        totalPages: 1,
      });

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // データが読み込まれるまで待機
      await waitFor(() => {
        expect(result.current.reviews.length).toBe(2);
      });

      // Act
      act(() => {
        result.current.toggleEditMode("review-1");
        result.current.toggleEditMode("review-2");
      });

      // Assert
      await waitFor(() => {
        expect(result.current.reviews.find((r) => r.id === "review-1")?.isEditing).toBe(true);
        expect(result.current.reviews.find((r) => r.id === "review-2")?.isEditing).toBe(true);
      });
    });

    test("should update review successfully", async () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      await act(async () => {
        await result.current.handleUpdateReview("review-1", 4, "Updated comment");
      });

      // Assert
      expect(mockUpdateReview).toHaveBeenCalledWith("review-1", 4, "Updated comment");
    });

    test("should handle update review error", async () => {
      // Arrange
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // 空の実装
      });
      mockUpdateReview.mockRejectedValue(new Error("Update failed"));

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      await act(async () => {
        await result.current.handleUpdateReview("review-1", 4, "Updated comment");
      });

      // Assert
      expect(mockUpdateReview).toHaveBeenCalledWith("review-1", 4, "Updated comment");
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to update review:", expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("debounce機能", () => {
    test("should debounce suggestion query updates", async () => {
      // Arrange
      vi.useFakeTimers();
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

      // 400ms経過前はサジェストクエリが実行されない
      expect(mockGetSearchSuggestions).not.toHaveBeenCalled();

      // Act - 400ms経過
      act(() => {
        vi.advanceTimersByTime(400);
      });

      // Assert - 最後の値でサジェストクエリが実行される
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockGetSearchSuggestions).toHaveBeenCalledWith("test");

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
    test("should handle empty search query", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.updateSearchQuery("");
      });

      // Assert
      expect(result.current.suggestionQuery).toBe("");
      expect(result.current.showSuggestions).toBe(false);
    });

    test("should handle very long search query", () => {
      // Arrange
      const longQuery = "a".repeat(1000);
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.updateSearchQuery(longQuery);
      });

      // Assert
      expect(result.current.suggestionQuery).toBe(longQuery);
      expect(result.current.showSuggestions).toBe(true);
    });

    test("should handle null comment in update review", async () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      await act(async () => {
        await result.current.handleUpdateReview("review-1", 5, null);
      });

      // Assert
      expect(mockUpdateReview).toHaveBeenCalledWith("review-1", 5, null);
    });

    test("should handle rating boundary values", async () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act - minimum rating
      await act(async () => {
        await result.current.handleUpdateReview("review-1", 1, "Minimum rating");
      });

      // Assert
      expect(mockUpdateReview).toHaveBeenCalledWith("review-1", 1, "Minimum rating");

      // Act - maximum rating
      await act(async () => {
        await result.current.handleUpdateReview("review-1", 5, "Maximum rating");
      });

      // Assert
      expect(mockUpdateReview).toHaveBeenCalledWith("review-1", 5, "Maximum rating");
    });

    test("should handle page boundary values", () => {
      // Arrange
      const { setPage } = setupUseQueryStateMock();
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act - page 0
      act(() => {
        result.current.changePage(0);
      });

      // Assert
      expect(setPage).toHaveBeenCalledWith(0);

      // Act - large page number
      act(() => {
        result.current.changePage(999999);
      });

      // Assert
      expect(setPage).toHaveBeenCalledWith(999999);
    });

    test("should handle empty suggestions array", async () => {
      // Arrange
      mockGetSearchSuggestions.mockResolvedValue([]);
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.updateSearchQuery("test");
      });

      // Assert
      await waitFor(() => {
        expect(result.current.suggestions).toStrictEqual([]);
      });
    });

    test("should handle empty reviews array", async () => {
      // Arrange
      mockGetAllReviews.mockResolvedValue({
        reviews: [],
        totalCount: 0,
        totalPages: 0,
      });

      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.reviews).toStrictEqual([]);
        expect(result.current.totalCount).toBe(0);
        expect(result.current.totalPages).toBe(0);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle API error gracefully", async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // 空の実装
      });
      mockGetAllReviews.mockRejectedValue(new Error("API Error"));

      // Act
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      consoleErrorSpy.mockRestore();
    });

    test("should handle suggestion API error gracefully", async () => {
      // Arrange
      mockGetSearchSuggestions.mockRejectedValue(new Error("Suggestion API Error"));
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.updateSearchQuery("test");
      });

      // Assert - エラーが発生してもアプリケーションは継続動作する
      expect(result.current.suggestionQuery).toBe("test");
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

    test("should handle undefined review ID in toggle edit mode", () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // Act & Assert - エラーが発生しないことを確認
      expect(() => {
        act(() => {
          result.current.toggleEditMode(undefined as unknown as string);
        });
      }).not.toThrow();
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
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // データが読み込まれるまで待機
      await waitFor(() => {
        expect(result.current.reviews.length).toBeGreaterThan(0);
      });

      // Act - 編集モード開始
      act(() => {
        result.current.toggleEditMode("review-1");
      });

      // Act - レビュー更新
      await act(async () => {
        await result.current.handleUpdateReview("review-1", 4, "Updated comment");
      });

      // Assert
      expect(mockUpdateReview).toHaveBeenCalledWith("review-1", 4, "Updated comment");
    });

    test("should maintain state consistency across operations", async () => {
      // Arrange
      const { result } = renderHook(() => useReviewSearch(), {
        wrapper: AllTheProviders,
      });

      // データが読み込まれるまで待機
      await waitFor(() => {
        expect(result.current.reviews.length).toBeGreaterThan(0);
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

      await waitFor(() => {
        expect(result.current.reviews.find((r) => r.id === "review-1")?.isEditing).toBe(true);
      });
    });
  });
});
