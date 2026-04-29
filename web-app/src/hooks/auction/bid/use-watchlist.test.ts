import { mockUseSession } from "@/test/setup/setup";
import { AllTheProviders, mockUseMutation, mockUseQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useWatchlist } from "./use-watchlist";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// サーバーアクションのモック
vi.mock("@/lib/auction/action/watchlist", () => ({
  serverIsAuctionWatched: vi.fn(),
  serverToggleWatchlist: vi.fn(),
}));

// queryCacheKeysのモック
vi.mock("@/lib/tanstack-query", () => ({
  queryCacheKeys: {
    watchlist: {
      userAuction: vi.fn((userId: string, auctionId: string) => ["watchlist", "userAuction", userId, auctionId]),
      update: vi.fn((userId: string) => ["watchlist", "update", userId]),
    },
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useWatchlist", () => {
  const testAuctionId = "test-auction-id";
  const testUserId = "test-user-id";

  beforeEach(() => {
    // デフォルトのセッション状態を設定
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: testUserId,
          email: "test@example.com",
          name: "Test User",
        },
      },
      status: "authenticated",
    });

    // デフォルトのクエリクライアントモック
    const mockQueryClient = {
      cancelQueries: vi.fn(),
      getQueryData: vi.fn(),
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    };
    mockUseQueryClient.mockReturnValue(mockQueryClient);
  });

  describe("正常系", () => {
    test("should return initial watchlist state correctly", () => {
      // Arrange
      const initialData = true;
      mockUseQuery.mockReturnValue({
        data: initialData,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      // Act
      const { result } = renderHook(() => useWatchlist(testAuctionId, initialData), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isWatchlisted).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(typeof result.current.toggleWatchlist).toBe("function");
    });

    test("should return false when initialData is null", () => {
      // Arrange
      const initialData = null;
      mockUseQuery.mockReturnValue({
        data: null,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      // Act
      const { result } = renderHook(() => useWatchlist(testAuctionId, initialData), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isWatchlisted).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    test("should return loading state when query is pending", () => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: undefined,
        isPending: true,
        isLoading: true,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      // Act
      const { result } = renderHook(() => useWatchlist(testAuctionId, null), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isLoading).toBe(true);
    });

    test("should return loading state when mutation is pending", () => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: false,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: true,
        isLoading: true,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      // Act
      const { result } = renderHook(() => useWatchlist(testAuctionId, null), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("境界値テスト", () => {
    test("should handle false initialData correctly", () => {
      // Arrange
      const initialData = false;
      mockUseQuery.mockReturnValue({
        data: false,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      // Act
      const { result } = renderHook(() => useWatchlist(testAuctionId, initialData), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isWatchlisted).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    test("should handle empty auctionId", () => {
      // Arrange
      const emptyAuctionId = "";
      mockUseQuery.mockReturnValue({
        data: null,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      // Act
      const { result } = renderHook(() => useWatchlist(emptyAuctionId, null), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isWatchlisted).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("toggleWatchlist機能", () => {
    test("should call toggleWatchlist function", () => {
      // Arrange
      const mockMutate = vi.fn();
      mockUseQuery.mockReturnValue({
        data: false,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: vi.fn(),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      // Act
      const { result } = renderHook(() => useWatchlist(testAuctionId, null), {
        wrapper: AllTheProviders,
      });

      result.current.toggleWatchlist();

      // Assert
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    test("should verify mutation is configured", () => {
      // Arrange
      const mockMutate = vi.fn();

      mockUseQuery.mockReturnValue({
        data: false,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: vi.fn(),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      // Act
      renderHook(() => useWatchlist(testAuctionId, null), {
        wrapper: AllTheProviders,
      });

      // Assert - useMutationが呼ばれているか確認
      expect(mockUseMutation).toHaveBeenCalledTimes(1);
    });
  });
});
