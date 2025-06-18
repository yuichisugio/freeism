import { mockUseSession } from "@/test/setup/setup";
// テストセットアップのインポート
import { AllTheProviders, mockUseMutation, mockUseQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象のインポート
import { useAutoBid } from "./use-auto-bid";

// 自動入札API関数のモック
vi.mock("@/lib/auction/action/auto-bid", () => ({
  getAutoBidByUserId: vi.fn(),
  setAutoBid: vi.fn(),
  cancelAutoBid: vi.fn(),
  processAutoBid: vi.fn(),
  __esModule: true,
}));

// queryCacheKeysのモック
vi.mock("@/lib/tanstack-query", () => ({
  queryCacheKeys: {
    auction: {
      autoBid: vi.fn().mockReturnValue(["auction", "autoBid", "test-auction", "test-user", 100]),
      detail: vi.fn().mockReturnValue(["auction", "detail", "test-auction"]),
    },
  },
  __esModule: true,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useAutoBid", () => {
  // テストデータ
  const testAuctionId = "test-auction-id";
  const testCurrentHighestBid = 100;
  const testCurrentHighestBidderId = "other-user-id";
  const testUserId = "test-user-id";

  // モック関数
  const mockInvalidateQueries = vi.fn();
  const mockMutate = vi.fn();
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

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

    // QueryClientのモック設定
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });

    // デフォルトのuseQueryモック設定
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    // デフォルトのuseMutationモック設定
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化", () => {
    test("should initialize with correct default values", () => {
      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.autoBidSettings).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isAutoBidding).toBe(false);
      expect(result.current.maxBidAmount).toBe(testCurrentHighestBid + 1); // 101
      expect(result.current.bidIncrement).toBe(100);
      expect(typeof result.current.handleSetupAutoBid).toBe("function");
      expect(typeof result.current.cancelAutoBidding).toBe("function");
      expect(typeof result.current.setMaxBidAmount).toBe("function");
      expect(typeof result.current.setBidIncrement).toBe("function");
    });

    test("should handle user not logged in", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.autoBidSettings).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isAutoBidding).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("自動入札設定の取得", () => {
    test("should fetch auto bid settings successfully", async () => {
      // Arrange
      const mockAutoBidData = {
        success: true,
        message: "取得成功",
        autoBid: {
          id: "auto-bid-1",
          maxBidAmount: 500,
          bidIncrement: 50,
        },
      };

      mockUseQuery.mockReturnValue({
        data: mockAutoBidData,
        isLoading: false,
        error: null,
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.autoBidSettings).toStrictEqual({
          id: "auto-bid-1",
          maxBidAmount: 500,
          bidIncrement: 50,
          isActive: true,
        });
        expect(result.current.isAutoBidding).toBe(true);
      });
    });

    test("should handle fetch auto bid settings failure", async () => {
      // Arrange
      const mockAutoBidData = {
        success: false,
        message: "取得失敗",
        autoBid: null,
      };

      mockUseQuery.mockReturnValue({
        data: mockAutoBidData,
        isLoading: false,
        error: null,
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.autoBidSettings).toBeNull();
        expect(result.current.isAutoBidding).toBe(false);
        expect(result.current.error).toBe("取得失敗");
      });
    });

    test("should handle loading state", () => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.loading).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("入力値の更新", () => {
    test("should update maxBidAmount", () => {
      // Arrange
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.setMaxBidAmount(200);
      });

      // Assert
      expect(result.current.maxBidAmount).toBe(200);
    });

    test("should update bidIncrement", () => {
      // Arrange
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.setBidIncrement(50);
      });

      // Assert
      expect(result.current.bidIncrement).toBe(50);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("自動入札の設定", () => {
    test("should setup auto bid successfully", async () => {
      // Arrange
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

      // useMutationのモックを設定（setupAutoBidMutate用）
      mockUseMutation.mockReturnValueOnce({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: false,
        error: null,
      });

      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // 入札額を設定
      act(() => {
        result.current.setMaxBidAmount(200);
        result.current.setBidIncrement(50);
      });

      // Act
      await act(async () => {
        await result.current.handleSetupAutoBid(mockEvent);
      });

      // Assert
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockMutate).toHaveBeenCalledWith({
        maxBidAmount: 200,
        bidIncrement: 50,
      });
    });

    test("should prevent setup when maxBidAmount is not higher than currentHighestBid", async () => {
      // Arrange
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // 現在の最高入札額以下に設定
      act(() => {
        result.current.setMaxBidAmount(100); // currentHighestBid と同じ
      });

      // Act
      await act(async () => {
        await result.current.handleSetupAutoBid(mockEvent);
      });

      // Assert
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    test("should handle setup auto bid loading state", () => {
      // Arrange
      mockUseMutation.mockReturnValueOnce({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: true, // ローディング状態
        error: null,
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.loading).toBe(true);
    });

    test("should handle setup auto bid error", () => {
      // Arrange
      const mockError = new Error("設定エラー");
      mockUseMutation.mockReturnValueOnce({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: false,
        error: mockError,
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.error).toBe("設定エラー");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("自動入札の取り消し", () => {
    test("should cancel auto bid successfully", async () => {
      // Arrange
      mockUseMutation
        .mockReturnValueOnce({
          mutate: mockMutate,
          mutateAsync: mockMutateAsync,
          isPending: false,
          error: null,
        })
        .mockReturnValueOnce({
          mutate: mockMutate,
          mutateAsync: vi.fn().mockResolvedValue({ success: true }),
          isPending: false,
          error: null,
        });

      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Act
      let cancelResult: boolean;
      await act(async () => {
        cancelResult = await result.current.cancelAutoBidding();
      });

      // Assert
      expect(cancelResult!).toBe(true);
    });

    test("should handle cancel auto bid failure", async () => {
      // Arrange
      mockUseMutation
        .mockReturnValueOnce({
          mutate: mockMutate,
          mutateAsync: mockMutateAsync,
          isPending: false,
          error: null,
        })
        .mockReturnValueOnce({
          mutate: mockMutate,
          mutateAsync: vi.fn().mockResolvedValue({ success: false }),
          isPending: false,
          error: null,
        });

      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Act
      let cancelResult: boolean;
      await act(async () => {
        cancelResult = await result.current.cancelAutoBidding();
      });

      // Assert
      expect(cancelResult!).toBe(false);
    });

    test("should handle cancel auto bid error", async () => {
      // Arrange
      mockUseMutation
        .mockReturnValueOnce({
          mutate: mockMutate,
          mutateAsync: mockMutateAsync,
          isPending: false,
          error: null,
        })
        .mockReturnValueOnce({
          mutate: mockMutate,
          mutateAsync: vi.fn().mockRejectedValue(new Error("取り消しエラー")),
          isPending: false,
          error: null,
        });

      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Act
      let cancelResult: boolean;
      await act(async () => {
        cancelResult = await result.current.cancelAutoBidding();
      });

      // Assert
      expect(cancelResult!).toBe(false);
    });

    test("should handle cancel auto bid loading state", () => {
      // Arrange
      mockUseMutation
        .mockReturnValueOnce({
          mutate: mockMutate,
          mutateAsync: mockMutateAsync,
          isPending: false,
          error: null,
        })
        .mockReturnValueOnce({
          mutate: mockMutate,
          mutateAsync: mockMutateAsync,
          isPending: true, // ローディング状態
          error: null,
        });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.loading).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle maxBidAmount equal to currentHighestBid", async () => {
      // Arrange
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // 現在の最高入札額と同じ値に設定
      act(() => {
        result.current.setMaxBidAmount(testCurrentHighestBid); // 100
      });

      // Act
      await act(async () => {
        await result.current.handleSetupAutoBid(mockEvent);
      });

      // Assert
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    test("should handle maxBidAmount one unit higher than currentHighestBid", async () => {
      // Arrange
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // 現在の最高入札額より1高い値に設定
      act(() => {
        result.current.setMaxBidAmount(testCurrentHighestBid + 1); // 101
      });

      // Act
      await act(async () => {
        await result.current.handleSetupAutoBid(mockEvent);
      });

      // Assert
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockMutate).toHaveBeenCalledWith({
        maxBidAmount: 101,
        bidIncrement: 100,
      });
    });

    test("should handle very large bid amounts", () => {
      // Arrange
      const largeBidAmount = 999999999;

      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.setMaxBidAmount(largeBidAmount);
      });

      // Assert
      expect(result.current.maxBidAmount).toBe(largeBidAmount);
    });

    test("should handle zero bid increment", () => {
      // Arrange
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.setBidIncrement(0);
      });

      // Assert
      expect(result.current.bidIncrement).toBe(0);
    });

    test("should handle negative bid increment", () => {
      // Arrange
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Act
      act(() => {
        result.current.setBidIncrement(-10);
      });

      // Assert
      expect(result.current.bidIncrement).toBe(-10);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle empty auctionId", () => {
      // Arrange & Act
      const { result } = renderHook(() => useAutoBid("", testCurrentHighestBid, testCurrentHighestBidderId), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.autoBidSettings).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test("should handle null currentHighestBidderId", () => {
      // Arrange & Act
      const { result } = renderHook(() => useAutoBid(testAuctionId, testCurrentHighestBid, null), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.autoBidSettings).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test("should handle zero currentHighestBid", () => {
      // Arrange & Act
      const { result } = renderHook(() => useAutoBid(testAuctionId, 0, testCurrentHighestBidderId), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.maxBidAmount).toBe(1); // 0 + 1
    });

    test("should handle negative currentHighestBid", () => {
      // Arrange & Act
      const { result } = renderHook(() => useAutoBid(testAuctionId, -100, testCurrentHighestBidderId), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.maxBidAmount).toBe(-99); // -100 + 1
    });

    test("should handle session with undefined user", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: undefined,
        },
        status: "authenticated",
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.autoBidSettings).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    test("should handle session with user without id", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: {
            email: "test@example.com",
            name: "Test User",
            // id がない
          },
        },
        status: "authenticated",
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.autoBidSettings).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    test("should handle useQuery error", () => {
      // Arrange
      const mockError = new Error("クエリエラー");
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError,
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.error).toBe("クエリエラー");
    });

    test("should handle auto bid data with null autoBid", async () => {
      // Arrange
      const mockAutoBidData = {
        success: true,
        message: "自動入札設定なし",
        autoBid: null,
      };

      mockUseQuery.mockReturnValue({
        data: mockAutoBidData,
        isLoading: false,
        error: null,
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.autoBidSettings).toBeNull();
        expect(result.current.isAutoBidding).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });

    test("should handle auto bid data with undefined autoBid", async () => {
      // Arrange
      const mockAutoBidData = {
        success: true,
        message: "自動入札設定なし",
        autoBid: undefined,
      };

      mockUseQuery.mockReturnValue({
        data: mockAutoBidData,
        isLoading: false,
        error: null,
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.autoBidSettings).toBeNull();
        expect(result.current.isAutoBidding).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリングの優先順位", () => {
    test("should prioritize useQuery error over mutation error", () => {
      // Arrange
      const queryError = new Error("クエリエラー");
      const mutationError = new Error("ミューテーションエラー");

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: queryError,
      });

      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: false,
        error: mutationError,
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.error).toBe("クエリエラー");
    });

    test("should show mutation error when no query error", () => {
      // Arrange
      const mutationError = new Error("ミューテーションエラー");

      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: false,
        error: mutationError,
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      expect(result.current.error).toBe("ミューテーションエラー");
    });

    test("should show API response error message when available", async () => {
      // Arrange
      const mockAutoBidData = {
        success: false,
        message: "API応答エラー",
        autoBid: null,
      };

      mockUseQuery.mockReturnValue({
        data: mockAutoBidData,
        isLoading: false,
        error: null,
      });

      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: false,
        error: null,
      });

      // Act
      const { result } = renderHook(
        () => useAutoBid(testAuctionId, testCurrentHighestBid, testCurrentHighestBidderId),
        { wrapper: AllTheProviders },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe("API応答エラー");
      });
    });
  });
});
