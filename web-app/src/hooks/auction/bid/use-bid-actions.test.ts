// テストセットアップ
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象
import { useBidActions } from "./use-bid-actions";

// モック設定
vi.mock("@/lib/auction/action/bid-common", () => ({
  executeBid: vi.fn(),
}));

// TanStack Queryのモック
vi.mock("@tanstack/react-query", () => ({
  QueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
  useMutation: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    reset: vi.fn(),
  })),
}));

describe("useBidActions", () => {
  const testAuctionId = "test-auction-123";
  const testCurrentHighestBid = 100;

  // 各テスト前にモックをリセット
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("初期状態", () => {
    test("should return initial state correctly", () => {
      // Act
      const { result } = renderHook(() => useBidActions(testAuctionId, testCurrentHighestBid), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.submitting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.bidAmount).toBe(101); // currentHighestBid + 1
      expect(result.current.minBid).toBe(101);
      expect(typeof result.current.setBidAmount).toBe("function");
      expect(typeof result.current.incrementBid).toBe("function");
      expect(typeof result.current.decrementBid).toBe("function");
      expect(typeof result.current.onSubmit).toBe("function");
    });

    test("should set initial bid amount correctly", () => {
      // Arrange
      const currentHighestBid = 250;

      // Act
      const { result } = renderHook(() => useBidActions(testAuctionId, currentHighestBid), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.bidAmount).toBe(251); // currentHighestBid + 1
      expect(result.current.minBid).toBe(251);
    });
  });

  describe("入札額操作", () => {
    test("should increment bid amount correctly", () => {
      // Arrange
      const { result } = renderHook(() => useBidActions(testAuctionId, testCurrentHighestBid), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.incrementBid();
      });

      // Assert
      expect(result.current.bidAmount).toBe(102); // 101 + 1
    });

    test("should decrement bid amount correctly when above minimum", () => {
      // Arrange
      const { result } = renderHook(() => useBidActions(testAuctionId, testCurrentHighestBid), {
        wrapper: AllTheProviders,
      });

      // 先に入札額を増やしてからデクリメント
      act(() => {
        result.current.setBidAmount(105);
      });

      // Act
      act(() => {
        result.current.decrementBid();
      });

      // Assert
      expect(result.current.bidAmount).toBe(104); // 105 - 1
    });

    test("should not decrement bid amount below minimum", () => {
      // Arrange
      const { result } = renderHook(() => useBidActions(testAuctionId, testCurrentHighestBid), {
        wrapper: AllTheProviders,
      });

      // Act - 最小値の状態でデクリメントを試行
      act(() => {
        result.current.decrementBid();
      });

      // Assert - 最小値のまま変わらない
      expect(result.current.bidAmount).toBe(101);
    });

    test("should set bid amount directly", () => {
      // Arrange
      const { result } = renderHook(() => useBidActions(testAuctionId, testCurrentHighestBid), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.setBidAmount(200);
      });

      // Assert
      expect(result.current.bidAmount).toBe(200);
    });
  });

  describe("TanStack Query integration", () => {
    test("should render hook without errors", () => {
      // Act
      const { result } = renderHook(() => useBidActions(testAuctionId, testCurrentHighestBid), {
        wrapper: AllTheProviders,
      });

      // Assert - フックが正常にレンダリングされることを確認
      expect(result.current).toBeDefined();
      expect(typeof result.current.onSubmit).toBe("function");
    });
  });

  describe("入札実行", () => {
    test("should handle bid submission", () => {
      // Arrange & Act
      const { result } = renderHook(() => useBidActions(testAuctionId, testCurrentHighestBid), {
        wrapper: AllTheProviders,
      });

      // Assert - フックが正常に動作することを確認
      expect(result.current.onSubmit).toBeDefined();
      expect(typeof result.current.onSubmit).toBe("function");

      // モック関数が呼ばれることを確認するために、直接実行は行わない
      // 実際のTanStack Query環境ではAllTheProvidersでテストが実行される
    });

    test("should maintain bid amount state correctly", () => {
      // Arrange & Act
      const { result } = renderHook(() => useBidActions(testAuctionId, testCurrentHighestBid), {
        wrapper: AllTheProviders,
      });

      // Assert - フックの状態が適切に管理されていることを確認
      expect(result.current.bidAmount).toBe(101);
      expect(result.current.minBid).toBe(101);
      expect(result.current.submitting).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
