import type { AuctionWithDetails } from "@/types/auction-types";
import React from "react";
import { mockUseSession } from "@/test/setup/setup";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { TaskStatus } from "@prisma/client";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AuctionBidDetail } from "./auction-bid-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// ホイストされたモック関数の宣言
const { mockUseAuctionBidSSE, mockUseAuctionBidUI, mockUseCountdown, mockUseWatchlist } = vi.hoisted(() => ({
  mockUseAuctionBidSSE: vi.fn(),
  mockUseAuctionBidUI: vi.fn(),
  mockUseCountdown: vi.fn(),
  mockUseWatchlist: vi.fn(),
}));

// カスタムフックのモック
vi.mock("@/hooks/auction/bid/use-auction-bid-sse", () => ({
  useAuctionBidSSE: mockUseAuctionBidSSE,
}));

vi.mock("@/hooks/auction/bid/use-auction-bid-ui", () => ({
  useAuctionBidUI: mockUseAuctionBidUI,
}));

vi.mock("@/hooks/auction/bid/use-countdown", () => ({
  useCountdown: mockUseCountdown,
}));

vi.mock("@/hooks/auction/bid/use-watchlist", () => ({
  useWatchlist: mockUseWatchlist,
}));

// フレーマーモーションのモック
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("div", { ...props, "data-testid": "motion-div" }, children),
    button: ({ children, ...props }: { children: React.ReactNode; onClick?: () => void }) =>
      React.createElement("button", { ...props, "data-testid": "motion-button" }, children),
  },
}));

// アイコンのモック
vi.mock("lucide-react", () => ({
  AlertTriangle: () => <div data-testid="alert-triangle-icon">AlertTriangle</div>,
  BarChart: () => <div data-testid="bar-chart-icon">BarChart</div>,
  Heart: () => <div data-testid="heart-icon">Heart</div>,
  Info: () => <div data-testid="info-icon">Info</div>,
  MessageSquare: () => <div data-testid="message-square-icon">MessageSquare</div>,
  ShoppingBag: () => <div data-testid="shopping-bag-icon">ShoppingBag</div>,
  TruckIcon: () => <div data-testid="truck-icon">TruckIcon</div>,
  User: () => <div data-testid="user-icon">User</div>,
  Gavel: () => <div data-testid="gavel-icon">Gavel</div>,
  Plus: () => <div data-testid="plus-icon">Plus</div>,
  Minus: () => <div data-testid="minus-icon">Minus</div>,
}));

// 子コンポーネントのモック
vi.mock("./auction-bid-countdown", () => ({
  CountdownDisplay: ({ countdownAction }: { countdownAction: () => string }) => (
    <div data-testid="countdown-display">CountdownDisplay - {countdownAction()}</div>
  ),
}));

vi.mock("./bid-form", () => ({
  BidForm: ({
    auctionId,
    currentHighestBid,
    currentHighestBidderId,
  }: {
    auctionId: string;
    currentHighestBid: number;
    currentHighestBidderId: string | null;
  }) => (
    <div data-testid="bid-form">
      BidForm - {auctionId} - {currentHighestBid} - {currentHighestBidderId}
    </div>
  ),
}));

vi.mock("./bid-history", () => ({
  BidHistory: ({ initialBids }: { initialBids: unknown[] }) => (
    <div data-testid="bid-history">BidHistory - {initialBids.length} bids</div>
  ),
}));

vi.mock("../common/auction-qa", () => ({
  AuctionQA: ({
    auctionId,
    isDisplayAfterEnd,
    isEnd,
  }: {
    auctionId: string;
    isDisplayAfterEnd: boolean;
    isEnd: boolean;
  }) => (
    <div data-testid="auction-qa">
      AuctionQA - {auctionId} - {isDisplayAfterEnd.toString()} - {isEnd.toString()}
    </div>
  ),
}));

// 共通コンポーネントのモック
vi.mock("@/components/auction/common/status-badge", () => ({
  TaskRoleBadge: ({ role }: { role: string[] }) => <div data-testid="task-role-badge">{role.join(",")}</div>,
  TaskStatusBadge: ({ status }: { status: TaskStatus }) => <div data-testid="task-status-badge">{status}</div>,
}));

vi.mock("@/components/share/share-error", () => ({
  Error: ({ error }: { error: string }) => <div data-testid="error">Error: {error}</div>,
}));

vi.mock("@/components/share/share-loading", () => ({
  Loading: () => <div data-testid="loading">Loading...</div>,
}));

// UI コンポーネントのモック
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) => (
    <div data-testid="badge" data-variant={variant} className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, defaultValue, value }: { children: React.ReactNode; defaultValue?: string; value?: string }) => (
    <div data-testid="tabs" data-value={value} data-default-value={defaultValue}>
      {children}
    </div>
  ),
  TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="tabs-list" className={className}>
      {children}
    </div>
  ),
  TabsTrigger: ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) => (
    <button data-testid={`tab-trigger-${value}`} data-value={value} className={className}>
      {children}
    </button>
  ),
  TabsContent: ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) => (
    <div data-testid={`tab-content-${value}`} data-value={value} className={className}>
      {children}
    </div>
  ),
}));

// utilsのモック
vi.mock("@/lib/utils", () => ({
  formatCurrency: (amount: number) => `￥${amount.toLocaleString()}`,
}));

// 定数のモック
vi.mock("@/lib/constants", () => ({
  AUCTION_CONSTANTS: {
    DEFAULT_AUCTION_IMAGE_URL: "https://placekitten.com/400/300",
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テストデータファクトリー
const auctionWithDetailsFactory = Factory.define<AuctionWithDetails>(({ sequence, params }) => {
  const defaultTask = {
    task: params.task?.task ?? "テストタスク",
    detail: params.task?.detail ?? "テストタスクの詳細",
    imageUrl: params.task?.imageUrl ?? "https://placekitten.com/400/300",
    status: params.task?.status ?? TaskStatus.AUCTION_ACTIVE,
    category: params.task?.category ?? "テスト",
    group: {
      id: params.task?.group?.id ?? "group-1",
      name: params.task?.group?.name ?? "テストグループ",
      depositPeriod: params.task?.group?.depositPeriod ?? 7,
    },
    creator: {
      id: params.task?.creator?.id ?? "creator-1",
      image: params.task?.creator?.image ?? "https://placekitten.com/50/50",
      settings: {
        username: params.task?.creator?.settings?.username ?? "作成者",
      },
    },
    executors: params.task?.executors ?? [],
    reporters: params.task?.reporters ?? [],
  } as const;

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
    task: defaultTask,
  } as AuctionWithDetails;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("AuctionBidDetail", () => {
  // テストデータ
  const defaultProps = {
    initialAuction: auctionWithDetailsFactory.build(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのセッション状態を設定
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
        },
      },
      status: "authenticated",
    });

    // 修正: デフォルトのSSEモックを基本設定のみにし、各テストで詳細を設定
    mockUseAuctionBidSSE.mockReturnValue({
      auction: defaultProps.initialAuction,
      loading: false,
      error: null,
      lastMsg: null,
      reconnect: vi.fn(),
      disconnect: vi.fn(),
    });

    mockUseAuctionBidUI.mockReturnValue({
      activeTab: "details",
      setActiveTab: vi.fn(),
      currentUserId: "test-user-id",
      usersWithRoles: [
        {
          id: "creator-1",
          image: "https://placekitten.com/50/50",
          username: "作成者",
          roles: ["SUPPLIER"],
        },
      ],
      isActive: true,
      isExecutor: false,
    });

    mockUseCountdown.mockReturnValue({
      countdownState: {
        days: 0,
        hours: 2,
        minutes: 30,
        isExpired: false,
        isUrgent: false,
        isCritical: false,
      },
      formatCountdown: vi.fn(() => "2時間 30分"),
      isUrgent: false,
      isCritical: false,
    });

    mockUseWatchlist.mockReturnValue({
      isLoading: false,
      isWatchlisted: false,
      toggleWatchlist: vi.fn(),
    });
  });

  describe("基本レンダリング", () => {
    test("should render auction detail correctly", () => {
      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("テストタスク")).toBeInTheDocument();
      expect(screen.getByText("テストグループ")).toBeInTheDocument();
      expect(screen.getByText("作成者")).toBeInTheDocument();
      expect(screen.getByTestId("countdown-display")).toBeInTheDocument();
    });

    test("should display current highest bid and minimum bid correctly", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        currentHighestBid: 1000,
      });

      // 修正: SSEモックでカスタムオークションデータを返すように設定
      mockUseAuctionBidSSE.mockReturnValue({
        auction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail initialAuction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("￥1,000")).toBeInTheDocument();
      expect(screen.getByText("￥1,001")).toBeInTheDocument();
    });

    test("should display bid count correctly", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        bidHistories: new Array(3).fill(null).map((_, i) => ({
          id: `bid-${i}`,
          amount: 100 + i,
          createdAt: new Date(),
          isAutoBid: false,
          user: { settings: { username: `bidder-${i}` } },
        })),
      });

      // 修正: SSEモックでカスタムオークションデータを返すように設定
      mockUseAuctionBidSSE.mockReturnValue({
        auction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail initialAuction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    test("should display 25+ when bid count exceeds 25", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        bidHistories: new Array(30).fill(null).map((_, i) => ({
          id: `bid-${i}`,
          amount: 100 + i,
          createdAt: new Date(),
          isAutoBid: false,
          user: { settings: { username: `bidder-${i}` } },
        })),
      });

      // 修正: SSEモックでカスタムオークションデータを返すように設定
      mockUseAuctionBidSSE.mockReturnValue({
        auction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail initialAuction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("25+")).toBeInTheDocument();
    });

    test("should render loading state", () => {
      // Arrange
      mockUseAuctionBidSSE.mockReturnValue({
        auction: defaultProps.initialAuction,
        loading: true,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("loading")).toBeInTheDocument();
    });

    test("should render error state", () => {
      // Arrange
      mockUseAuctionBidSSE.mockReturnValue({
        auction: defaultProps.initialAuction,
        loading: false,
        error: "テストエラー",
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText("Error: テストエラー")).toBeInTheDocument();
    });
  });

  describe("タブ切り替え", () => {
    test("should render details tab by default", () => {
      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("tab-content-details")).toBeInTheDocument();
      expect(screen.getByTestId("tabs")).toHaveAttribute("data-value", "details");
    });

    test("should render bid-history tab when activeTab is 'bid-history'", () => {
      // Arrange
      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "bid-history",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: true,
        isExecutor: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("bid-history")).toBeInTheDocument();
      expect(screen.getByTestId("tabs")).toHaveAttribute("data-value", "bid-history");
    });

    test("should render qa tab when activeTab is 'qa'", () => {
      // Arrange
      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "qa",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: true,
        isExecutor: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("auction-qa")).toBeInTheDocument();
      expect(screen.getByTestId("tabs")).toHaveAttribute("data-value", "qa");
    });

    test("should render shipping tab when activeTab is 'shipping'", () => {
      // Arrange
      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "shipping",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: true,
        isExecutor: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("tab-content-shipping")).toBeInTheDocument();
      expect(screen.getByText("配送方法")).toBeInTheDocument();
      expect(screen.getByText("支払い方法")).toBeInTheDocument();
    });

    test("should display correct deposit period in shipping tab", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: "https://placekitten.com/400/300",
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 14, // 修正: 14日に設定
          },
          creator: {
            id: "creator-1",
            image: "https://placekitten.com/50/50",
            settings: {
              username: "作成者",
            },
          },
          executors: [],
          reporters: [],
        },
      });

      // 修正: SSEモックでカスタムオークションデータを返すように設定
      mockUseAuctionBidSSE.mockReturnValue({
        auction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "shipping",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: true,
        isExecutor: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail initialAuction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText(/14日後/)).toBeInTheDocument();
    });
  });

  describe("状態表示", () => {
    test("should show executor message when isExecutor is true", () => {
      // Arrange
      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "details",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: true,
        isExecutor: true,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("自分の出品したオークションです")).toBeInTheDocument();
      expect(screen.getByTestId("user-icon")).toBeInTheDocument();
    });

    test("should show inactive message when isActive is false", () => {
      // Arrange
      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "details",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: false,
        isExecutor: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("このオークションは現在アクティブではありません")).toBeInTheDocument();
      expect(screen.getByTestId("alert-triangle-icon")).toBeInTheDocument();
    });

    test("should show bid form when not executor and active", () => {
      // Arrange
      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "details",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: true,
        isExecutor: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("bid-form")).toBeInTheDocument();
    });

    test("should not show bid form when isExecutor is true", () => {
      // Arrange
      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "details",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: true,
        isExecutor: true,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.queryByTestId("bid-form")).not.toBeInTheDocument();
    });

    test("should not show bid form when isActive is false", () => {
      // Arrange
      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "details",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: false,
        isExecutor: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.queryByTestId("bid-form")).not.toBeInTheDocument();
    });
  });

  describe("ユーザーインタラクション", () => {
    test("should call toggleWatchlist when heart button is clicked", async () => {
      // Arrange
      const mockToggleWatchlist = vi.fn();
      mockUseWatchlist.mockReturnValue({
        isLoading: false,
        isWatchlisted: false,
        toggleWatchlist: mockToggleWatchlist,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      const heartButton = screen.getByTestId("motion-button");
      fireEvent.click(heartButton);

      // Assert
      expect(mockToggleWatchlist).toHaveBeenCalledTimes(1);
    });

    test("should disable heart button when isLoading is true", () => {
      // Arrange
      mockUseWatchlist.mockReturnValue({
        isLoading: true,
        isWatchlisted: false,
        toggleWatchlist: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      const heartButton = screen.getByTestId("motion-button");
      expect(heartButton).toBeDisabled();
    });

    test("should show filled heart when isWatchlisted is true", () => {
      // Arrange
      mockUseWatchlist.mockReturnValue({
        isLoading: false,
        isWatchlisted: true,
        toggleWatchlist: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("heart-icon")).toBeInTheDocument();
    });

    test("should render multiple users with roles correctly", () => {
      // Arrange
      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "details",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [
          {
            id: "creator-1",
            image: "https://placekitten.com/50/50",
            username: "作成者",
            roles: ["SUPPLIER"],
          },
          {
            id: "executor-1",
            image: null,
            username: "実行者",
            roles: ["EXECUTOR"],
          },
        ],
        isActive: true,
        isExecutor: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("作成者")).toBeInTheDocument();
      expect(screen.getByText("実行者")).toBeInTheDocument();
      expect(screen.getAllByTestId("task-role-badge")).toHaveLength(2);
    });
  });

  describe("開発環境表示", () => {
    test("should show SSE debug info in development environment", () => {
      // Arrange
      vi.stubEnv("NODE_ENV", "development");

      mockUseAuctionBidSSE.mockReturnValue({
        auction: defaultProps.initialAuction,
        loading: false,
        error: null,
        lastMsg: '{"type":"bid","data":{"amount":200}}',
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("最後に受信したSSEメッセージ:")).toBeInTheDocument();
      expect(screen.getByText('{"type":"bid","data":{"amount":200}}')).toBeInTheDocument();

      // Cleanup
      vi.unstubAllEnvs();
    });

    test("should not show SSE debug info when lastMsg is null", () => {
      // Arrange
      vi.stubEnv("NODE_ENV", "development");

      mockUseAuctionBidSSE.mockReturnValue({
        auction: defaultProps.initialAuction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.queryByText("最後に受信したSSEメッセージ:")).not.toBeInTheDocument();

      // Cleanup
      vi.unstubAllEnvs();
    });

    test("should not show SSE debug info in production environment", () => {
      // Arrange
      vi.stubEnv("NODE_ENV", "production");

      mockUseAuctionBidSSE.mockReturnValue({
        auction: defaultProps.initialAuction,
        loading: false,
        error: null,
        lastMsg: '{"type":"bid","data":{"amount":200}}',
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.queryByText("最後に受信したSSEメッセージ:")).not.toBeInTheDocument();

      // Cleanup
      vi.unstubAllEnvs();
    });
  });

  describe("境界値テスト", () => {
    test("should handle zero current highest bid", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        currentHighestBid: 0,
      });

      // 修正: SSEモックでカスタムオークションデータを返すように設定
      mockUseAuctionBidSSE.mockReturnValue({
        auction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail initialAuction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("￥0")).toBeInTheDocument();
      expect(screen.getByText("￥1")).toBeInTheDocument(); // 最低入札額は0 + 1
    });

    test("should handle very large bid amount", () => {
      // Arrange
      const largeAmount = 999999999;
      const auction = auctionWithDetailsFactory.build({
        currentHighestBid: largeAmount,
      });

      // 修正: SSEモックでカスタムオークションデータを返すように設定
      mockUseAuctionBidSSE.mockReturnValue({
        auction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail initialAuction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("￥999,999,999")).toBeInTheDocument();
      expect(screen.getByText("￥1,000,000,000")).toBeInTheDocument();
    });

    test("should handle null currentHighestBidderId", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        currentHighestBidderId: null,
      });

      // 修正: SSEモックでカスタムオークションデータを返すように設定
      mockUseAuctionBidSSE.mockReturnValue({
        auction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail initialAuction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("bid-form")).toBeInTheDocument();
      // 修正: nullは文字列として"null"ではなく実際のnullなので、空文字列になります
      expect(
        screen.getByText(new RegExp(`BidForm.*${auction.id}.*${auction.currentHighestBid}.*$`)),
      ).toBeInTheDocument();
    });

    test("should handle empty bidHistories array", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        bidHistories: [],
      });

      // 修正: SSEモックでカスタムオークションデータを返すように設定
      mockUseAuctionBidSSE.mockReturnValue({
        auction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail initialAuction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("0")).toBeInTheDocument(); // 入札数
    });

    test("should handle auction without image", () => {
      // Arrange - 修正: imageUrlをnullではなくundefinedに設定
      const auction = auctionWithDetailsFactory.build({
        task: {
          task: "テストタスク",
          detail: "テストタスクの詳細",
          imageUrl: undefined, // 修正: undefinedに変更
          status: TaskStatus.AUCTION_ACTIVE,
          category: "テスト",
          group: {
            id: "group-1",
            name: "テストグループ",
            depositPeriod: 7,
          },
          creator: {
            id: "creator-1",
            image: "https://placekitten.com/50/50",
            settings: {
              username: "作成者",
            },
          },
          executors: [],
          reporters: [],
        },
      });

      // 修正: SSEモックでカスタムオークションデータを返すように設定
      mockUseAuctionBidSSE.mockReturnValue({
        auction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail initialAuction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("画像がありません")).toBeInTheDocument();
    });

    test("should handle users without settings", () => {
      // Arrange
      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "details",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [
          {
            id: "user-1",
            image: null,
            username: "ユーザー1",
            roles: ["SUPPLIER"],
          },
        ],
        isActive: true,
        isExecutor: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("ユーザー1")).toBeInTheDocument();
      expect(screen.getByTestId("user-icon")).toBeInTheDocument(); // 画像がない場合のフォールバック
    });
  });

  describe("異常系テスト", () => {
    test("should handle countdown with expired state", () => {
      // Arrange
      mockUseCountdown.mockReturnValue({
        countdownState: {
          days: 0,
          hours: 0,
          minutes: 0,
          isExpired: true,
          isUrgent: false,
          isCritical: false,
        },
        formatCountdown: vi.fn(() => "終了"),
        isUrgent: false,
        isCritical: true,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("CountdownDisplay - 終了")).toBeInTheDocument();
    });

    test("should handle missing task group", () => {
      // Arrange
      const auction = auctionWithDetailsFactory.build({
        task: {
          group: {
            id: "",
            name: "",
            depositPeriod: 0,
          },
        },
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail initialAuction={auction} />
        </AllTheProviders>,
      );

      // Assert
      // エラーなしでレンダリングされることを確認
      expect(screen.getByTestId("countdown-display")).toBeInTheDocument();
    });

    test("should handle SSE error followed by recovery", () => {
      // Arrange - 最初はエラー状態
      const mockReconnect = vi.fn();
      const mockDisconnect = vi.fn();

      mockUseAuctionBidSSE.mockReturnValue({
        auction: defaultProps.initialAuction,
        loading: false,
        error: "接続エラー",
        lastMsg: null,
        reconnect: mockReconnect,
        disconnect: mockDisconnect,
      });

      const { unmount } = render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      expect(screen.getByTestId("error")).toBeInTheDocument();

      // 修正: 新しいコンポーネントインスタンスをレンダリング
      unmount();

      // Act - 回復状態に変更
      mockUseAuctionBidSSE.mockReturnValue({
        auction: defaultProps.initialAuction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: mockReconnect,
        disconnect: mockDisconnect,
      });

      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.queryByTestId("error")).not.toBeInTheDocument();
      expect(screen.getByText("テストタスク")).toBeInTheDocument();
    });

    test("should handle hook errors gracefully", () => {
      // Arrange
      mockUseAuctionBidUI.mockImplementation(() => {
        throw new Error("UI Hook Error");
      });

      // Act & Assert
      expect(() => {
        render(
          <AllTheProviders>
            <AuctionBidDetail {...defaultProps} />
          </AllTheProviders>,
        );
      }).toThrow("UI Hook Error");
    });
  });

  describe("条件分岐テスト", () => {
    test("should render different content based on auction status combinations", () => {
      // テストケース1: executor + active
      // 修正: beforeEachのモック状態を完全にリセットしてから設定
      vi.clearAllMocks();

      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            name: "Test User",
          },
        },
        status: "authenticated",
      });

      mockUseAuctionBidSSE.mockReturnValue({
        auction: defaultProps.initialAuction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "details",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: true,
        isExecutor: true,
      });

      mockUseCountdown.mockReturnValue({
        countdownState: {
          days: 0,
          hours: 2,
          minutes: 30,
          isExpired: false,
          isUrgent: false,
          isCritical: false,
        },
        formatCountdown: vi.fn(() => "2時間 30分"),
        isUrgent: false,
        isCritical: false,
      });

      mockUseWatchlist.mockReturnValue({
        isLoading: false,
        isWatchlisted: false,
        toggleWatchlist: vi.fn(),
      });

      const { unmount } = render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("自分の出品したオークションです")).toBeInTheDocument();
      expect(screen.queryByTestId("bid-form")).not.toBeInTheDocument();

      unmount();

      // テストケース2: not executor + not active
      // 修正: 再度モックを完全にリセット
      vi.clearAllMocks();

      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            name: "Test User",
          },
        },
        status: "authenticated",
      });

      mockUseAuctionBidSSE.mockReturnValue({
        auction: defaultProps.initialAuction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "details",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: false,
        isExecutor: false,
      });

      mockUseCountdown.mockReturnValue({
        countdownState: {
          days: 0,
          hours: 2,
          minutes: 30,
          isExpired: false,
          isUrgent: false,
          isCritical: false,
        },
        formatCountdown: vi.fn(() => "2時間 30分"),
        isUrgent: false,
        isCritical: false,
      });

      mockUseWatchlist.mockReturnValue({
        isLoading: false,
        isWatchlisted: false,
        toggleWatchlist: vi.fn(),
      });

      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      expect(screen.getByText("このオークションは現在アクティブではありません")).toBeInTheDocument();
      expect(screen.queryByTestId("bid-form")).not.toBeInTheDocument();

      unmount();
      // 修正: DOMを確実にクリーンアップ
      cleanup();

      // テストケース3: not executor + active
      // 修正: 再度モックを完全にリセット
      vi.clearAllMocks();

      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            name: "Test User",
          },
        },
        status: "authenticated",
      });

      mockUseAuctionBidSSE.mockReturnValue({
        auction: defaultProps.initialAuction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "details",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: true,
        isExecutor: false,
      });

      mockUseCountdown.mockReturnValue({
        countdownState: {
          days: 0,
          hours: 2,
          minutes: 30,
          isExpired: false,
          isUrgent: false,
          isCritical: false,
        },
        formatCountdown: vi.fn(() => "2時間 30分"),
        isUrgent: false,
        isCritical: false,
      });

      mockUseWatchlist.mockReturnValue({
        isLoading: false,
        isWatchlisted: false,
        toggleWatchlist: vi.fn(),
      });

      render(
        <AllTheProviders>
          <AuctionBidDetail {...defaultProps} />
        </AllTheProviders>,
      );

      // 修正: デバッグのためにDOM内容を確認
      // console.log(document.body.innerHTML);

      expect(screen.queryByText("自分の出品したオークションです")).not.toBeInTheDocument();
      expect(screen.queryByText("このオークションは現在アクティブではありません")).not.toBeInTheDocument();
      expect(screen.getByTestId("bid-form")).toBeInTheDocument();
    });

    test("should pass correct props to AuctionQA based on task status", () => {
      // Arrange
      const endedAuction = auctionWithDetailsFactory.build({
        status: TaskStatus.AUCTION_ENDED,
        endTime: new Date("2024-01-01T18:00:00Z"),
      });

      // 修正: SSEモックでエンドしたオークションデータを返すように設定
      mockUseAuctionBidSSE.mockReturnValue({
        auction: endedAuction,
        loading: false,
        error: null,
        lastMsg: null,
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      mockUseAuctionBidUI.mockReturnValue({
        activeTab: "qa",
        setActiveTab: vi.fn(),
        currentUserId: "test-user-id",
        usersWithRoles: [],
        isActive: false,
        isExecutor: false,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionBidDetail initialAuction={endedAuction} />
        </AllTheProviders>,
      );

      // Assert - 修正: 実際のPropsの確認方法を変更
      expect(screen.getByTestId("auction-qa")).toBeInTheDocument();
      // isEndがtrueの場合の具体的な動作を確認
      const auctionQA = screen.getByTestId("auction-qa");
      expect(auctionQA).toHaveTextContent("true"); // isEndがtrueになることを確認
    });

    test("should handle different TaskStatus values for isEnd calculation", () => {
      const statusesToTest = [
        TaskStatus.AUCTION_ENDED,
        TaskStatus.SUPPLIER_DONE,
        TaskStatus.POINTS_DEPOSITED,
        TaskStatus.TASK_COMPLETED,
        TaskStatus.FIXED_EVALUATED,
        TaskStatus.POINTS_AWARDED,
      ];

      statusesToTest.forEach((status, index) => {
        // Arrange
        const auction = auctionWithDetailsFactory.build({
          id: `auction-test-${index}`, // 修正: 一意のIDを設定
          status,
        });

        // 修正: SSEモックで該当ステータスのオークションデータを返すように設定
        mockUseAuctionBidSSE.mockReturnValue({
          auction,
          loading: false,
          error: null,
          lastMsg: null,
          reconnect: vi.fn(),
          disconnect: vi.fn(),
        });

        mockUseAuctionBidUI.mockReturnValue({
          activeTab: "qa",
          setActiveTab: vi.fn(),
          currentUserId: "test-user-id",
          usersWithRoles: [],
          isActive: false,
          isExecutor: false,
        });

        // Act
        const { unmount } = render(
          <AllTheProviders>
            <AuctionBidDetail initialAuction={auction} />
          </AllTheProviders>,
        );

        // Assert - 修正: isEndがtrueになることを確認
        const auctionQA = screen.getByTestId("auction-qa");
        expect(auctionQA).toHaveTextContent("true"); // isEndがtrueになることを確認

        unmount();
      });
    });
  });
});
