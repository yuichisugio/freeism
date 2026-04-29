import type { AuctionHistoryCreatedDetail } from "@/types/auction-types";
import { mockUseSession } from "@/test/setup/setup";
import { AllTheProviders, mockUseMutation, mockUseQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { taskFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useCreatedDetail } from "./use-created-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// ホイストされたモック関数の宣言
const {
  mockSetTab,
  mockGetAuctionHistoryCreatedDetail,
  mockCompleteTaskDelivery,
  mockUpdateDeliveryMethod,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockSetTab: vi.fn(),
  mockGetAuctionHistoryCreatedDetail: vi.fn(),
  mockCompleteTaskDelivery: vi.fn(),
  mockUpdateDeliveryMethod: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

// nuqsのモック
vi.mock("nuqs", () => ({
  useQueryState: vi.fn(() => ["info", mockSetTab]),
}));

// アクション関数のモック
vi.mock("@/lib/auction/action/created-detail", () => ({
  getAuctionHistoryCreatedDetail: mockGetAuctionHistoryCreatedDetail,
  completeTaskDelivery: mockCompleteTaskDelivery,
  updateDeliveryMethod: mockUpdateDeliveryMethod,
}));

// sonnerのモック
vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
const testUser = userFactory.build({
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
});

const testTask = taskFactory.build({
  id: "test-task-id",
  task: "テストタスク",
  deliveryMethod: "オンライン配信",
  status: TaskStatus.AUCTION_ENDED,
  creatorId: testUser.id,
});

const testAuction: AuctionHistoryCreatedDetail = {
  id: "test-auction-id",
  currentHighestBid: 1000,
  startTime: new Date("2024-01-01T00:00:00Z"),
  endTime: new Date("2024-01-02T00:00:00Z"),
  task: {
    id: testTask.id,
    task: testTask.task,
    detail: "詳細説明",
    imageUrl: "https://example.com/image.jpg",
    status: TaskStatus.AUCTION_ENDED,
    deliveryMethod: testTask.deliveryMethod,
    creatorId: testTask.creatorId,
    executors: [],
    reporters: [],
  },
  winner: {
    id: "winner-id",
    name: "Winner User",
    image: null,
  },
  winnerId: "winner-id",
  bidHistories: [],
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストスイート
 */
describe("useCreatedDetail", () => {
  beforeEach(() => {
    // モックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should initialize with correct default values", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: testAuction,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.auction).toStrictEqual(testAuction);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.deliveryMethod).toBe("オンライン配信");
      expect(result.current.isEditingDelivery).toBe(false);
      expect(result.current.isUpdatingDelivery).toBe(false);
      expect(result.current.isCompleting).toBe(false);
      expect(result.current.tab).toBe("info");
      expect(result.current.error).toBeNull();
    });

    test("should return correct loading state when session is loading", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: null,
        status: "loading",
      });

      // セッションがloadingの時はクエリは無効化されるため、isPendingはfalseになる
      mockUseQuery.mockReturnValue({
        data: undefined,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      // Assert
      // セッションがloadingの場合、実際のコードではfalseを返すようです
      expect(result.current.isLoading).toBe(false);
    });

    test("should return correct loading state when query is pending", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: undefined,
        isPending: true,
        isLoading: true,
        isFetching: true,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isLoading).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should handle unauthenticated session", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      mockUseQuery.mockReturnValue({
        data: undefined,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isLoading).toBe(false);
    });

    test("should handle empty auctionId", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: undefined,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail(""), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isLoading).toBe(false);
    });

    test("should handle null auction data", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.auction).toBeNull();
      expect(result.current.deliveryMethod).toBe("");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("編集機能", () => {
    test("should start editing delivery method", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: testAuction,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.startEditingDelivery();
      });

      // Assert
      expect(result.current.isEditingDelivery).toBe(true);
    });

    test("should cancel editing delivery method", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: testAuction,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.startEditingDelivery();
      });

      act(() => {
        result.current.cancelEditingDelivery();
      });

      // Assert
      expect(result.current.isEditingDelivery).toBe(false);
      expect(result.current.deliveryMethod).toBe("オンライン配信");
    });

    test("should update delivery method state", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: testAuction,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.setDeliveryMethod("新しい配信方法");
      });

      // Assert
      expect(result.current.deliveryMethod).toBe("新しい配信方法");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ミューテーション機能", () => {
    test("should handle complete task delivery success", async () => {
      // Arrange
      const mockMutate = vi.fn();

      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: testAuction,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      act(() => {
        void result.current.handleComplete();
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledOnce();
    });

    test("should handle update delivery method success", async () => {
      // Arrange
      const mockMutate = vi.fn();

      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: testAuction,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      act(() => {
        void result.current.handleUpdateDeliveryMethod("新しい配信方法");
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith("新しい配信方法");
    });

    test("should handle mutation loading states", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: testAuction,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isCompleting).toBe(true);
      expect(result.current.isUpdatingDelivery).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリング", () => {
    test("should handle query error", () => {
      // Arrange
      const testError = new Error("Test error");

      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: true,
        error: testError,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.error).toBe("Test error");
    });

    test("should handle mutation error", () => {
      // Arrange
      const testError = new Error("Mutation error");

      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: testAuction,
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
        isError: true,
        error: testError,
        reset: vi.fn(),
        data: undefined,
      });

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.error).toBe("Mutation error");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("タブ管理", () => {
    test("should handle tab state changes", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: testUser,
        },
        status: "authenticated",
      });

      mockUseQuery.mockReturnValue({
        data: testAuction,
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

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useCreatedDetail("test-auction-id"), {
        wrapper: AllTheProviders,
      });

      act(() => {
        void result.current.setTab("history");
      });

      // Assert
      expect(mockSetTab).toHaveBeenCalledWith("history");
    });
  });
});
