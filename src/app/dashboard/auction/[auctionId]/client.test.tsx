import { AllTheProviders, mockUseQuery } from "@/test/setup/tanstack-query-setup";
import { type AuctionWithDetails } from "@/types/auction-types";
import { TaskStatus } from "@prisma/client";
import { type QueryFunction } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import AuctionDetailWrapper from "./client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// ホイストされたモック関数の宣言
const { mockGetAuctionByAuctionId, mockQueryCacheKeys } = vi.hoisted(() => ({
  mockGetAuctionByAuctionId: vi.fn(),
  mockQueryCacheKeys: {
    auction: {
      detail: vi.fn((auctionId: string) => ["auction", "detail", auctionId]),
    },
  },
}));

// getAuctionByAuctionId のモック
vi.mock("@/lib/auction/action/auction-retrieve", () => ({
  getAuctionByAuctionId: mockGetAuctionByAuctionId,
}));

// queryCacheKeys のモック
vi.mock("@/lib/tanstack-query", () => ({
  queryCacheKeys: mockQueryCacheKeys,
}));

// NoResult コンポーネントのモック
vi.mock("@/components/share/share-no-result", () => ({
  NoResult: ({ message }: { message: string }) => (
    <div data-testid="no-result" role="alert">
      {message}
    </div>
  ),
}));

// 動的インポートされる AuctionBidDetail コンポーネントのモック
vi.mock("@/components/auction/bid/auction-bid-detail", () => ({
  AuctionBidDetail: ({ initialAuction }: { initialAuction: AuctionWithDetails }) => (
    <div data-testid="auction-bid-detail">
      <span data-testid="auction-id">{initialAuction.id}</span>
      <span data-testid="auction-task">{initialAuction.task.task}</span>
    </div>
  ),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fishery ファクトリーを使用したテストデータ作成
 */

const auctionWithDetailsFactory = Factory.define<AuctionWithDetails>(({ sequence, params }) => {
  return {
    id: params.id ?? `auction-${sequence}`,
    currentHighestBid: params.currentHighestBid ?? 100,
    currentHighestBidderId: params.currentHighestBidderId ?? null,
    status: params.status ?? TaskStatus.AUCTION_ACTIVE,
    extensionTotalCount: params.extensionTotalCount ?? 0,
    extensionLimitCount: params.extensionLimitCount ?? 3,
    extensionTime: params.extensionTime ?? 5,
    remainingTimeForExtension: params.remainingTimeForExtension ?? 300,
    startTime: params.startTime ?? new Date("2024-01-01T10:00:00Z"),
    endTime: params.endTime ?? new Date("2024-01-01T18:00:00Z"),
    bidHistories: params.bidHistories ?? [],
    task: {
      task: params.task?.task ?? `テストタスク ${sequence}`,
      detail: params.task?.detail ?? `テストタスクの詳細 ${sequence}`,
      imageUrl: params.task?.imageUrl ?? "https://placekitten.com/400/300",
      status: params.task?.status ?? TaskStatus.AUCTION_ACTIVE,
      category: params.task?.category ?? "テスト",
      group: {
        id: params.task?.group?.id ?? `group-${sequence}`,
        name: params.task?.group?.name ?? `テストグループ ${sequence}`,
        depositPeriod: params.task?.group?.depositPeriod ?? 7,
      },
      creator: {
        id: params.task?.creator?.id ?? `creator-${sequence}`,
        image: params.task?.creator?.image ?? "https://placekitten.com/50/50",
        settings: {
          username: params.task?.creator?.settings?.username ?? `作成者 ${sequence}`,
        },
      },
      executors: params.task?.executors ?? [],
      reporters: params.task?.reporters ?? [],
    },
  } as AuctionWithDetails;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */

const createTestAuction = (overrides: Partial<AuctionWithDetails> = {}): AuctionWithDetails => {
  return auctionWithDetailsFactory.build(overrides);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * AuctionDetailWrapper コンポーネントのテスト
 */
describe("AuctionDetailWrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should render successfully with valid auction data", async () => {
      // Arrange
      const testAuction = createTestAuction();
      // task名だけを変更
      testAuction.id = "test-auction-id";
      testAuction.task.task = "テストオークション";

      mockUseQuery.mockReturnValue({
        data: testAuction,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="test-auction-id" />
        </AllTheProviders>,
      );

      // 動的インポートが完了するまで待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(screen.getByTestId("auction-bid-detail")).toBeInTheDocument();
      expect(screen.getByTestId("auction-id")).toHaveTextContent("test-auction-id");
      expect(screen.getByTestId("auction-task")).toHaveTextContent("テストオークション");
    });

    test("should display loading state when isPending is true", () => {
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
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="test-auction-id" />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("オークション情報を読み込み中...")).toBeInTheDocument();
      expect(screen.queryByTestId("auction-bid-detail")).not.toBeInTheDocument();
      expect(screen.queryByTestId("no-result")).not.toBeInTheDocument();
    });

    test("should display NoResult when auction data is null", () => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: null,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="test-auction-id" />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("no-result")).toBeInTheDocument();
      expect(screen.getByText("オークションが見つかりません")).toBeInTheDocument();
      expect(screen.queryByTestId("auction-bid-detail")).not.toBeInTheDocument();
      expect(screen.queryByText("オークション情報を読み込み中...")).not.toBeInTheDocument();
    });

    test("should display NoResult when auction data is undefined", () => {
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
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="test-auction-id" />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("no-result")).toBeInTheDocument();
      expect(screen.getByText("オークションが見つかりません")).toBeInTheDocument();
      expect(screen.queryByTestId("auction-bid-detail")).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty string auctionId", async () => {
      // Arrange
      const testAuction = createTestAuction();
      testAuction.id = "";

      mockUseQuery.mockReturnValue({
        data: testAuction,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="" />
        </AllTheProviders>,
      );

      // 動的インポートが完了するまで待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(screen.getByTestId("auction-bid-detail")).toBeInTheDocument();
      expect(screen.getByTestId("auction-id")).toHaveTextContent("");
    });

    test("should handle very long auctionId", async () => {
      // Arrange
      const longAuctionId = "a".repeat(1000);
      const testAuction = createTestAuction();
      testAuction.id = longAuctionId;

      mockUseQuery.mockReturnValue({
        data: testAuction,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId={longAuctionId} />
        </AllTheProviders>,
      );

      // 動的インポートが完了するまで待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(screen.getByTestId("auction-bid-detail")).toBeInTheDocument();
      expect(screen.getByTestId("auction-id")).toHaveTextContent(longAuctionId);
    });

    test("should handle auction with null currentHighestBidderId", async () => {
      // Arrange
      const testAuction = createTestAuction();
      testAuction.currentHighestBidderId = null;

      mockUseQuery.mockReturnValue({
        data: testAuction,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="test-auction-id" />
        </AllTheProviders>,
      );

      // 動的インポートが完了するまで待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(screen.getByTestId("auction-bid-detail")).toBeInTheDocument();
    });

    test("should handle auction with empty bidHistories", async () => {
      // Arrange
      const testAuction = createTestAuction();
      testAuction.bidHistories = [];

      mockUseQuery.mockReturnValue({
        data: testAuction,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="test-auction-id" />
        </AllTheProviders>,
      );

      // 動的インポートが完了するまで待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(screen.getByTestId("auction-bid-detail")).toBeInTheDocument();
    });

    test("should handle auction with null task detail", async () => {
      // Arrange
      const testAuction = createTestAuction();
      testAuction.task.detail = null;

      mockUseQuery.mockReturnValue({
        data: testAuction,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="test-auction-id" />
        </AllTheProviders>,
      );

      // 動的インポートが完了するまで待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(screen.getByTestId("auction-bid-detail")).toBeInTheDocument();
    });

    test("should handle auction with null task imageUrl", async () => {
      // Arrange
      const testAuction = createTestAuction();
      testAuction.task.imageUrl = null;

      mockUseQuery.mockReturnValue({
        data: testAuction,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="test-auction-id" />
        </AllTheProviders>,
      );

      // 動的インポートが完了するまで待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(screen.getByTestId("auction-bid-detail")).toBeInTheDocument();
    });

    test("should handle different task statuses", async () => {
      // Arrange
      const testStatuses = [
        TaskStatus.PENDING,
        TaskStatus.AUCTION_ACTIVE,
        TaskStatus.AUCTION_ENDED,
        TaskStatus.SUPPLIER_DONE,
        TaskStatus.TASK_COMPLETED,
      ];

      for (const status of testStatuses) {
        const testAuction = createTestAuction();
        testAuction.status = status;
        testAuction.task.status = status;

        mockUseQuery.mockReturnValue({
          data: testAuction,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        });

        // Act
        render(
          <AllTheProviders>
            <AuctionDetailWrapper auctionId={`test-auction-${status}`} />
          </AllTheProviders>,
        );

        // 動的インポートが完了するまで待機
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Assert
        expect(screen.getByTestId("auction-bid-detail")).toBeInTheDocument();

        // クリーンアップ
        document.body.innerHTML = "";
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle useQuery configuration correctly", () => {
      // Arrange
      const testAuction = createTestAuction();

      mockUseQuery.mockReturnValue({
        data: testAuction,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="test-auction-id" />
        </AllTheProviders>,
      );

      // Assert - useQuery が正しいパラメータで呼び出されることを確認
      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: ["auction", "detail", "test-auction-id"],
        queryFn: expect.any(Function) as QueryFunction,
        staleTime: 1000 * 60 * 60 * 1, // 1時間
        gcTime: 1000 * 60 * 60 * 1, // 1時間
        enabled: true,
      });
    });

    test("should disable query when auctionId is falsy", () => {
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
      render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="" />
        </AllTheProviders>,
      );

      // Assert - enabled が false になることを確認
      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: ["auction", "detail", ""],
        queryFn: expect.any(Function) as QueryFunction,
        staleTime: 1000 * 60 * 60 * 1,
        gcTime: 1000 * 60 * 60 * 1,
        enabled: false,
      });
    });

    test("should handle concurrent state changes", async () => {
      // Arrange
      const testAuction = createTestAuction();

      // 最初はローディング状態
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
      const { rerender } = render(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="test-auction-id" />
        </AllTheProviders>,
      );

      // Assert - 最初はローディング状態
      expect(screen.getByText("オークション情報を読み込み中...")).toBeInTheDocument();

      // データが読み込まれた状態に変更
      mockUseQuery.mockReturnValue({
        data: testAuction,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act - 再レンダリング
      rerender(
        <AllTheProviders>
          <AuctionDetailWrapper auctionId="test-auction-id" />
        </AllTheProviders>,
      );

      // 動的インポートが完了するまで待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - データが表示される
      expect(screen.getByTestId("auction-bid-detail")).toBeInTheDocument();
      expect(screen.queryByText("オークション情報を読み込み中...")).not.toBeInTheDocument();
    });
  });
});
