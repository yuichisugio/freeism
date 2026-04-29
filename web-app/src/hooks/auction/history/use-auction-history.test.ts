import type {
  AuctionCreatedTabFilter,
  BidHistoryItem,
  CreatedAuctionItem,
  FilterCondition,
  WonAuctionItem,
} from "@/types/auction-types";
import { AllTheProviders, mockUseQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { faker } from "@faker-js/faker";
import { BidStatus, TaskStatus } from "@prisma/client";
import { act, renderHook } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useAuctionHistory } from "./use-auction-history";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const {
  mockGetUserBidHistoriesWithCount,
  mockGetUserWonAuctionsWithCount,
  mockGetUserCreatedAuctionsWithCount,
  mockSetParams,
  mockUseSession,
  mockPush,
  mockUseQueryStates,
} = vi.hoisted(() => ({
  mockGetUserBidHistoriesWithCount: vi.fn(),
  mockGetUserWonAuctionsWithCount: vi.fn(),
  mockGetUserCreatedAuctionsWithCount: vi.fn(),
  mockSetParams: vi.fn(),
  mockUseSession: vi.fn(),
  mockPush: vi.fn(),
  mockUseQueryStates: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// オークション履歴アクションのモック
vi.mock("@/lib/auction/action/auction-history", () => ({
  getUserBidHistoriesWithCount: mockGetUserBidHistoriesWithCount,
  getUserWonAuctionsWithCount: mockGetUserWonAuctionsWithCount,
  getUserCreatedAuctionsWithCount: mockGetUserCreatedAuctionsWithCount,
}));

// next-auth/reactのモック（auth-js-setupを上書き）
vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// next/navigationのモック
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  redirect: vi.fn(),
}));

// nuqsのモック
vi.mock("nuqs", () => ({
  parseAsArrayOf: vi.fn(() => ({ withDefault: vi.fn(() => ({})) })),
  parseAsInteger: { withDefault: vi.fn(() => ({})) },
  parseAsString: { withDefault: vi.fn(() => ({})) },
  useQueryStates: mockUseQueryStates,
}));

// constantsのモック
vi.mock("@/lib/constants", () => ({
  AUCTION_HISTORY_CONSTANTS: {
    ITEMS_PER_PAGE: 21,
  },
}));

// tanstack-queryのモック
vi.mock("@/lib/tanstack-query", () => ({
  queryCacheKeys: {
    auction: {
      historyBids: vi.fn(() => ["auction", "history", "bids"]),
      historyWon: vi.fn(() => ["auction", "history", "won"]),
      historyCreated: vi.fn(() => ["auction", "history", "created"]),
    },
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// 入札履歴アイテムファクトリー
const bidHistoryItemFactory = Factory.define<BidHistoryItem>(({ sequence, params }) => ({
  auctionId: params.auctionId ?? `auction-${sequence}`,
  bidStatus: params.bidStatus ?? BidStatus.BIDDING,
  lastBidAt: params.lastBidAt ?? faker.date.recent(),
  taskId: params.taskId ?? `task-${sequence}`,
  taskName: params.taskName ?? faker.lorem.sentence(),
  taskStatus: params.taskStatus ?? TaskStatus.AUCTION_ACTIVE,
  currentHighestBid: params.currentHighestBid ?? faker.number.int({ min: 100, max: 10000 }),
  auctionEndTime: params.auctionEndTime ?? faker.date.future(),
}));

// 落札履歴アイテムファクトリー
const wonAuctionItemFactory = Factory.define<WonAuctionItem>(({ sequence, params }) => ({
  auctionId: params.auctionId ?? `auction-${sequence}`,
  taskId: params.taskId ?? `task-${sequence}`,
  currentHighestBid: params.currentHighestBid ?? faker.number.int({ min: 100, max: 10000 }),
  auctionEndTime: params.auctionEndTime ?? faker.date.recent(),
  taskStatus: params.taskStatus ?? TaskStatus.AUCTION_ENDED,
  auctionCreatedAt: params.auctionCreatedAt ?? faker.date.past(),
  taskName: params.taskName ?? faker.lorem.sentence(),
  deliveryMethod: params.deliveryMethod ?? faker.lorem.word(),
  rating: params.rating ?? faker.number.float({ min: 1, max: 5 }),
}));

// 出品履歴アイテムファクトリー
const createdAuctionItemFactory = Factory.define<CreatedAuctionItem>(({ sequence, params }) => ({
  auctionId: params.auctionId ?? `auction-${sequence}`,
  currentHighestBid: params.currentHighestBid ?? faker.number.int({ min: 100, max: 10000 }),
  auctionEndTime: params.auctionEndTime ?? faker.date.future(),
  taskStatus: params.taskStatus ?? TaskStatus.AUCTION_ACTIVE,
  auctionCreatedAt: params.auctionCreatedAt ?? faker.date.past(),
  taskId: params.taskId ?? `task-${sequence}`,
  taskName: params.taskName ?? faker.lorem.sentence(),
  deliveryMethod: params.deliveryMethod ?? faker.lorem.word(),
  winnerId: params.winnerId ?? null,
  winnerName: params.winnerName ?? null,
  isCreator: params.isCreator ?? true,
  isExecutor: params.isExecutor ?? false,
  isReporter: params.isReporter ?? false,
  taskRole: params.taskRole ?? ["SUPPLIER"],
}));

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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

const createTestSession = (overrides: Partial<{ user: { id: string; email: string; name: string } }> = {}) => {
  return sessionFactory.build(overrides);
};

const createTestBidHistoryItems = (count = 3): BidHistoryItem[] => {
  return bidHistoryItemFactory.buildList(count);
};

const createTestWonAuctionItems = (count = 3): WonAuctionItem[] => {
  return wonAuctionItemFactory.buildList(count);
};

const createTestCreatedAuctionItems = (count = 3): CreatedAuctionItem[] => {
  return createdAuctionItemFactory.buildList(count);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストセットアップ
 */

describe("useAuctionHistory", () => {
  const testUserId = "test-user-id";
  const testSession = createTestSession({ user: { id: testUserId, email: "test@example.com", name: "Test User" } });

  beforeEach(() => {
    // モックをリセット
    vi.clearAllMocks();

    // デフォルトのクエリクライアントモック
    mockUseQueryClient.mockReturnValue({
      prefetchQuery: vi.fn(),
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
    });

    // デフォルトのuseQueryモック
    mockUseQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    // デフォルトのセッションモック
    mockUseSession.mockReturnValue({
      data: testSession,
      status: "authenticated",
    });

    // デフォルトのuseQueryStatesモック
    mockUseQueryStates.mockReturnValue([
      {
        tab: "bids",
        page: 1,
        itemPerPage: 21,
        filter: [],
        condition: "and",
        wonStatus: "all",
      },
      mockSetParams,
    ]);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期状態", () => {
    test("should return default values when initialized", () => {
      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.activeTab).toBe("bids");
      expect(result.current.currentPage).toBe(1);
      expect(result.current.itemPerPage).toBe(21);
      expect(result.current.filter).toStrictEqual([]);
      expect(result.current.filterCondition).toBe("and");
      expect(result.current.wonStatus).toBe("all");
      expect(result.current.bidHistoryResult).toStrictEqual([]);
      expect(result.current.wonHistoryResult).toStrictEqual([]);
      expect(result.current.createdHistoryResult).toStrictEqual([]);
      expect(result.current.currentDataCount).toBe(0);
      expect(result.current.isLoadingCurrentTab).toBe(false);
      expect(result.current.userId).toBe(testUserId);
      expect(result.current.VALID_UI_FILTERS).toStrictEqual([
        "pending",
        "active",
        "ended",
        "supplier_done",
        "creator",
        "executor",
        "reporter",
      ]);
    });

    test("should return undefined userId when session is not available", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.userId).toBeUndefined();
      expect(result.current.isLoadingCurrentTab).toBe(false);
    });

    test("should handle session with undefined user", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: { user: undefined },
        status: "authenticated",
      });

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.userId).toBeUndefined();
    });

    test("should handle different tab values from query params", () => {
      // Arrange
      mockUseQueryStates.mockReturnValue([
        {
          tab: "won",
          page: 2,
          itemPerPage: 50,
          filter: ["active", "pending"],
          condition: "or",
          wonStatus: "completed",
        },
        mockSetParams,
      ]);

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.activeTab).toBe("won");
      expect(result.current.currentPage).toBe(2);
      expect(result.current.itemPerPage).toBe(50);
      expect(result.current.filter).toStrictEqual(["active", "pending"]);
      expect(result.current.filterCondition).toBe("or");
      expect(result.current.wonStatus).toBe("completed");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データ取得", () => {
    describe("入札履歴タブ", () => {
      test("should fetch bid history data when activeTab is 'bids'", () => {
        // Arrange
        const testBidHistoryData = createTestBidHistoryItems(3);
        const mockBidHistoryResult = { data: testBidHistoryData, count: 10 };

        mockUseQuery.mockReturnValue({
          data: mockBidHistoryResult,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        });

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Assert
        expect(result.current.bidHistoryResult).toStrictEqual(testBidHistoryData);
        expect(result.current.currentDataCount).toBe(10);
        expect(result.current.isLoadingCurrentTab).toBe(false);
      });

      test("should handle empty bid history data", () => {
        // Arrange
        const mockBidHistoryResult = { data: [], count: 0 };

        mockUseQuery.mockReturnValue({
          data: mockBidHistoryResult,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        });

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Assert
        expect(result.current.bidHistoryResult).toStrictEqual([]);
        expect(result.current.currentDataCount).toBe(0);
      });

      test("should handle undefined bid history data", () => {
        // Arrange
        mockUseQuery.mockReturnValue({
          data: undefined,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        });

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Assert
        expect(result.current.bidHistoryResult).toStrictEqual([]);
        expect(result.current.currentDataCount).toBe(0);
      });

      test("should show loading state when bid history is loading", () => {
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

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Assert
        expect(result.current.isLoadingCurrentTab).toBe(true);
      });

      test("should handle bid history with boundary values", () => {
        // Arrange
        const testBidHistoryData = createTestBidHistoryItems(1);
        testBidHistoryData[0].currentHighestBid = 0; // 境界値: 最小値
        const mockBidHistoryResult = { data: testBidHistoryData, count: 1 };

        mockUseQuery.mockReturnValue({
          data: mockBidHistoryResult,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        });

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Assert
        expect(result.current.bidHistoryResult?.data?.[0]?.currentHighestBid).toBe(0);
        expect(result.current.currentDataCount).toBe(1);
      });
    });

    describe("落札履歴タブ", () => {
      test("should fetch won history data when activeTab is 'won'", () => {
        // Arrange
        mockUseQueryStates.mockReturnValue([
          {
            tab: "won",
            page: 1,
            itemPerPage: 21,
            filter: [],
            condition: "and",
            wonStatus: "all",
          },
          mockSetParams,
        ]);

        const testWonHistoryData = createTestWonAuctionItems(2);
        const mockWonHistoryResult = { data: testWonHistoryData, count: 5 };

        mockUseQuery.mockReturnValue({
          data: mockWonHistoryResult,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        });

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Assert
        expect(result.current.activeTab).toBe("won");
        expect(result.current.wonHistoryResult).toStrictEqual(testWonHistoryData);
        expect(result.current.currentDataCount).toBe(5);
      });

      test("should handle won history with null rating", () => {
        // Arrange
        mockUseQueryStates.mockReturnValue([
          {
            tab: "won",
            page: 1,
            itemPerPage: 21,
            filter: [],
            condition: "and",
            wonStatus: "all",
          },
          mockSetParams,
        ]);

        const testWonHistoryData = createTestWonAuctionItems(1);
        testWonHistoryData[0].rating = null; // null値のテスト
        const mockWonHistoryResult = { data: testWonHistoryData, count: 1 };

        mockUseQuery.mockReturnValue({
          data: mockWonHistoryResult,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        });

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Assert
        expect(result.current.wonHistoryResult?.data?.[0]?.rating).toBeNull();
      });
    });

    describe("出品履歴タブ", () => {
      test("should fetch created history data when activeTab is 'created'", () => {
        // Arrange
        mockUseQueryStates.mockReturnValue([
          {
            tab: "created",
            page: 1,
            itemPerPage: 21,
            filter: ["active"],
            condition: "and",
            wonStatus: "all",
          },
          mockSetParams,
        ]);

        const testCreatedHistoryData = createTestCreatedAuctionItems(3);
        const mockCreatedHistoryResult = { data: testCreatedHistoryData, count: 8 };

        mockUseQuery.mockReturnValue({
          data: mockCreatedHistoryResult,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        });

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Assert
        expect(result.current.activeTab).toBe("created");
        expect(result.current.createdHistoryResult).toStrictEqual(testCreatedHistoryData);
        expect(result.current.currentDataCount).toBe(8);
      });

      test("should handle created history with null winner", () => {
        // Arrange
        mockUseQueryStates.mockReturnValue([
          {
            tab: "created",
            page: 1,
            itemPerPage: 21,
            filter: [],
            condition: "and",
            wonStatus: "all",
          },
          mockSetParams,
        ]);

        const testCreatedHistoryData = createTestCreatedAuctionItems(1);
        testCreatedHistoryData[0].winnerId = null;
        testCreatedHistoryData[0].winnerName = null;
        const mockCreatedHistoryResult = { data: testCreatedHistoryData, count: 1 };

        mockUseQuery.mockReturnValue({
          data: mockCreatedHistoryResult,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        });

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Assert
        expect(result.current.createdHistoryResult?.data?.[0]?.winnerId).toBeNull();
        expect(result.current.createdHistoryResult?.data?.[0]?.winnerName).toBeNull();
      });
    });

    describe("エラーハンドリング", () => {
      test("should handle query error state", () => {
        // Arrange
        const testError = new Error("Network error");
        mockUseQuery.mockReturnValue({
          data: undefined,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isError: true,
          error: testError,
          refetch: vi.fn(),
        });

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Assert
        expect(result.current.bidHistoryResult).toStrictEqual([]);
        expect(result.current.currentDataCount).toBe(0);
        expect(result.current.isLoadingCurrentTab).toBe(false);
      });

      test("should handle malformed data structure", () => {
        // Arrange
        const malformedData = { data: null, count: null };
        mockUseQuery.mockReturnValue({
          data: malformedData,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        });

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Assert
        expect(result.current.bidHistoryResult).toStrictEqual([]);
        expect(result.current.currentDataCount).toBe(0);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ナビゲーション機能", () => {
    test("should call router.push when handleItemClick is called", () => {
      // Arrange
      const testAuctionId = "test-auction-id";

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.handleItemClick(testAuctionId);
      });

      // Assert
      expect(mockPush).toHaveBeenCalledWith(`/dashboard/auction/${testAuctionId}`);
    });

    test("should call router.push when handleWonItemClick is called", () => {
      // Arrange
      const testAuctionId = "test-auction-id";

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.handleWonItemClick(testAuctionId);
      });

      // Assert
      expect(mockPush).toHaveBeenCalledWith(`/dashboard/auction/won-detail/${testAuctionId}`);
    });

    test("should call router.push when handleCreatedItemClick is called", () => {
      // Arrange
      const testAuctionId = "test-auction-id";

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.handleCreatedItemClick(testAuctionId);
      });

      // Assert
      expect(mockPush).toHaveBeenCalledWith(`/dashboard/auction/created-detail/${testAuctionId}`);
    });

    test("should handle empty auction ID", () => {
      // Arrange
      const emptyAuctionId = "";

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.handleItemClick(emptyAuctionId);
      });

      // Assert
      expect(mockPush).toHaveBeenCalledWith("/dashboard/auction/");
    });

    test("should handle special characters in auction ID", () => {
      // Arrange
      const specialAuctionId = "auction-123!@#$%";

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.handleItemClick(specialAuctionId);
      });

      // Assert
      expect(mockPush).toHaveBeenCalledWith(`/dashboard/auction/${specialAuctionId}`);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("パラメータ変更", () => {
    describe("タブ変更", () => {
      test("should call setParams when handleTabChange is called with 'won'", () => {
        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        act(() => {
          result.current.handleTabChange("won");
        });

        // Assert
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });

      test("should call setParams when handleTabChange is called with 'created'", () => {
        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        act(() => {
          result.current.handleTabChange("created");
        });

        // Assert
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });

      test("should call setParams when handleTabChange is called with 'bids'", () => {
        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        act(() => {
          result.current.handleTabChange("bids");
        });

        // Assert
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });

      test("should handle invalid tab value", () => {
        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        act(() => {
          result.current.handleTabChange("invalid-tab");
        });

        // Assert
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    describe("ページネーション", () => {
      test("should call setParams when handlePageChange is called", () => {
        // Arrange
        const newPage = 2;

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        act(() => {
          result.current.handlePageChange(newPage);
        });

        // Assert
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });

      test("should handle boundary page values", () => {
        // Arrange
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Act & Assert - 最小値
        act(() => {
          result.current.handlePageChange(1);
        });
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));

        // Act & Assert - 大きな値
        act(() => {
          result.current.handlePageChange(999);
        });
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));

        // Act & Assert - 0
        act(() => {
          result.current.handlePageChange(0);
        });
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));

        // Act & Assert - 負の値
        act(() => {
          result.current.handlePageChange(-1);
        });
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });

      test("should call setParams when handleItemPerPageChange is called", () => {
        // Arrange
        const newItemPerPage = 50;

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        act(() => {
          result.current.handleItemPerPageChange(newItemPerPage);
        });

        // Assert
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });

      test("should handle boundary itemPerPage values", () => {
        // Arrange
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Act & Assert - 最小値
        act(() => {
          result.current.handleItemPerPageChange(1);
        });
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));

        // Act & Assert - 大きな値
        act(() => {
          result.current.handleItemPerPageChange(1000);
        });
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    describe("フィルター", () => {
      test("should call setParams when handleFilterChange is called", () => {
        // Arrange
        const newFilter: AuctionCreatedTabFilter[] = ["pending", "active"];

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        act(() => {
          result.current.handleFilterChange(newFilter);
        });

        // Assert
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });

      test("should handle empty filter array", () => {
        // Arrange
        const emptyFilter: AuctionCreatedTabFilter[] = [];

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        act(() => {
          result.current.handleFilterChange(emptyFilter);
        });

        // Assert
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });

      test("should handle all valid filter values", () => {
        // Arrange
        const allFilters: AuctionCreatedTabFilter[] = [
          "pending",
          "active",
          "ended",
          "supplier_done",
          "creator",
          "executor",
          "reporter",
        ];

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        act(() => {
          result.current.handleFilterChange(allFilters);
        });

        // Assert
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });

      test("should call setParams when handleFilterConditionChange is called", () => {
        // Arrange
        const newCondition: FilterCondition = "or";

        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        act(() => {
          result.current.handleFilterConditionChange(newCondition);
        });

        // Assert
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });

      test("should handle both filter condition values", () => {
        // Arrange
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        // Act & Assert - "and"
        act(() => {
          result.current.handleFilterConditionChange("and");
        });
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));

        // Act & Assert - "or"
        act(() => {
          result.current.handleFilterConditionChange("or");
        });
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });

      test("should call setParams when handleClearFilters is called", () => {
        // Act
        const { result } = renderHook(() => useAuctionHistory(), {
          wrapper: AllTheProviders,
        });

        act(() => {
          result.current.handleClearFilters();
        });

        // Assert
        expect(mockSetParams).toHaveBeenCalledWith(expect.any(Function));
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("Prefetch機能", () => {
    test("should call prefetchQuery when data exists and has next page", () => {
      // Arrange
      const mockPrefetchQuery = vi.fn();
      mockUseQueryClient.mockReturnValue({
        prefetchQuery: mockPrefetchQuery,
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
      });

      const testBidHistoryData = createTestBidHistoryItems(21); // 1ページ分のデータ
      const mockBidHistoryResult = { data: testBidHistoryData, count: 42 }; // 2ページ分の総数

      mockUseQuery.mockReturnValue({
        data: mockBidHistoryResult,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      // useEffectが実行されるまで少し待つ
      expect(mockPrefetchQuery).toHaveBeenCalled();
    });

    test("should not call prefetchQuery when no userId", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      const mockPrefetchQuery = vi.fn();
      mockUseQueryClient.mockReturnValue({
        prefetchQuery: mockPrefetchQuery,
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
      });

      // Act
      renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(mockPrefetchQuery).not.toHaveBeenCalled();
    });

    test("should not call prefetchQuery when on last page", () => {
      // Arrange
      const mockPrefetchQuery = vi.fn();
      mockUseQueryClient.mockReturnValue({
        prefetchQuery: mockPrefetchQuery,
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
      });

      const testBidHistoryData = createTestBidHistoryItems(10); // 少ないデータ
      const mockBidHistoryResult = { data: testBidHistoryData, count: 10 }; // 1ページ分のみ

      mockUseQuery.mockReturnValue({
        data: mockBidHistoryResult,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      // 最後のページなのでprefetchは呼ばれない
      expect(mockPrefetchQuery).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle very large page numbers", () => {
      // Arrange
      mockUseQueryStates.mockReturnValue([
        {
          tab: "bids",
          page: 999999,
          itemPerPage: 21,
          filter: [],
          condition: "and",
          wonStatus: "all",
        },
        mockSetParams,
      ]);

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.currentPage).toBe(999999);
    });

    test("should handle very large itemPerPage values", () => {
      // Arrange
      mockUseQueryStates.mockReturnValue([
        {
          tab: "bids",
          page: 1,
          itemPerPage: 10000,
          filter: [],
          condition: "and",
          wonStatus: "all",
        },
        mockSetParams,
      ]);

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.itemPerPage).toBe(10000);
    });

    test("should handle very long filter arrays", () => {
      // Arrange
      const longFilter: AuctionCreatedTabFilter[] = Array(100).fill("active") as AuctionCreatedTabFilter[];
      mockUseQueryStates.mockReturnValue([
        {
          tab: "created",
          page: 1,
          itemPerPage: 21,
          filter: longFilter,
          condition: "and",
          wonStatus: "all",
        },
        mockSetParams,
      ]);

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.filter).toHaveLength(100);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle null query params", () => {
      // Arrange
      mockUseQueryStates.mockReturnValue([
        {
          tab: null,
          page: null,
          itemPerPage: null,
          filter: null,
          condition: null,
          wonStatus: null,
        },
        mockSetParams,
      ]);

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.activeTab).toBe("bids"); // デフォルト値
      expect(result.current.currentPage).toBe(1); // デフォルト値
      expect(result.current.itemPerPage).toBe(21); // デフォルト値
      expect(result.current.filter).toStrictEqual([]); // デフォルト値
      expect(result.current.filterCondition).toBe("and"); // デフォルト値
      expect(result.current.wonStatus).toBe("all"); // デフォルト値
    });

    test("should handle undefined query params", () => {
      // Arrange
      mockUseQueryStates.mockReturnValue([
        {
          tab: undefined,
          page: undefined,
          itemPerPage: undefined,
          filter: undefined,
          condition: undefined,
          wonStatus: undefined,
        },
        mockSetParams,
      ]);

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.activeTab).toBe("bids");
      expect(result.current.currentPage).toBe(1);
      expect(result.current.itemPerPage).toBe(21);
      expect(result.current.filter).toStrictEqual([]);
      expect(result.current.filterCondition).toBe("and");
      expect(result.current.wonStatus).toBe("all");
    });

    test("should handle setParams function throwing error", () => {
      // Arrange
      const mockSetParamsError = vi.fn().mockImplementation(() => {
        throw new Error("setParams error");
      });
      mockUseQueryStates.mockReturnValue([
        {
          tab: "bids",
          page: 1,
          itemPerPage: 21,
          filter: [],
          condition: "and",
          wonStatus: "all",
        },
        mockSetParamsError,
      ]);

      // Act
      const { result } = renderHook(() => useAuctionHistory(), {
        wrapper: AllTheProviders,
      });

      // Assert - エラーが発生してもフックが正常に動作することを確認
      expect(() => {
        act(() => {
          result.current.handlePageChange(2);
        });
      }).toThrow("setParams error");
    });
  });
});
