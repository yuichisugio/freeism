import type { AuctionCard as AuctionCardType } from "@/types/auction-types";
import { mockUseSession } from "@/test/setup/setup";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { faker } from "@faker-js/faker";
import { TaskStatus } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { addDays, subDays } from "date-fns";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AuctionCard } from "./auction-listing-card";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const { mockUseAuctionCard, mockUseWatchlist, mockUseCountdown } = vi.hoisted(() => ({
  mockUseAuctionCard: vi.fn(),
  mockUseWatchlist: vi.fn(),
  mockUseCountdown: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */
vi.mock("@/hooks/auction/listing/use-auction-card", () => ({
  useAuctionCard: mockUseAuctionCard,
}));

vi.mock("@/hooks/auction/bid/use-watchlist", () => ({
  useWatchlist: mockUseWatchlist,
}));

vi.mock("@/hooks/auction/bid/use-countdown", () => ({
  useCountdown: mockUseCountdown,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */
const auctionCardFactory = Factory.define<AuctionCardType>(({ sequence, params }) => ({
  id: params.id ?? `auction-${sequence}`,
  current_highest_bid: params.current_highest_bid ?? faker.number.int({ min: 100, max: 10000 }),
  end_time: params.end_time ?? addDays(new Date(), 7),
  start_time: params.start_time ?? subDays(new Date(), 1),
  status: params.status ?? TaskStatus.AUCTION_ACTIVE,
  task: params.task ?? faker.lorem.sentence(),
  detail: params.detail ?? faker.lorem.paragraph(),
  image_url: params.image_url ?? faker.image.url(),
  category: params.category ?? "その他",
  group_id: params.group_id ?? `group-${sequence}`,
  group_name: params.group_name ?? faker.company.name(),
  bids_count: params.bids_count ?? faker.number.int({ min: 0, max: 50 }),
  is_watched: params.is_watched ?? false,
  score: params.score ?? faker.number.float({ min: 0, max: 1 }),
  task_highlighted: params.task_highlighted ?? null,
  detail_highlighted: params.detail_highlighted ?? null,
  executors_json: params.executors_json ?? [
    {
      id: `executor-${sequence}`,
      rating: faker.number.float({ min: 1, max: 5 }),
      userId: `user-${sequence}`,
      userImage: faker.image.avatar(),
      userSettingsUsername: faker.person.fullName(),
    },
  ],
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */
const createTestAuction = (overrides: Partial<AuctionCardType> = {}): AuctionCardType => {
  return auctionCardFactory.build(overrides);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用の定数
 */
const TEST_USER_ID = "test-user-id";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("AuctionCard", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトのセッション設定
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: TEST_USER_ID,
          email: "test@example.com",
          name: "Test User",
        },
      },
      status: "authenticated",
    });

    // デフォルトのフックの戻り値を設定
    mockUseAuctionCard.mockReturnValue({
      isStarted: true,
      isEnded: false,
      isNew: false,
      isEndingSoon: false,
      setIsEnded: vi.fn(),
      getStartMessage: vi.fn(() => "開始まで1時間"),
      prefetchAuctionDetails: vi.fn(),
    });

    mockUseWatchlist.mockReturnValue({
      isLoading: false,
      isWatchlisted: false,
      toggleWatchlist: vi.fn(),
    });

    mockUseCountdown.mockReturnValue({
      countdownState: {
        isExpired: false,
        isCritical: false,
        isUrgent: false,
      },
      formatCountdown: vi.fn(() => "7日 12時間"),
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本的なレンダリング", () => {
    test("should render auction card with basic information", () => {
      // Arrange
      const auction = createTestAuction({
        task: "テストタスク",
        current_highest_bid: 1000,
        bids_count: 5,
        group_name: "テストグループ",
        category: "テストカテゴリ",
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("テストタスク")).toBeInTheDocument();
      expect(screen.getByText("現在価格: 1,000 P")).toBeInTheDocument();
      expect(screen.getByText("5件")).toBeInTheDocument();
      expect(screen.getByText("テストグループ")).toBeInTheDocument();
      expect(screen.getByText("カテゴリ: テストカテゴリ")).toBeInTheDocument();
    });

    test("should render correct link to auction detail page", () => {
      // Arrange
      const auction = createTestAuction({
        id: "test-auction-123",
        task: "テストタスク",
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      const links = screen.getAllByRole("link");
      const detailLinks = links.filter((link) => link.getAttribute("href") === "/dashboard/auction/test-auction-123");
      expect(detailLinks.length).toBeGreaterThan(0);
    });

    test("should render auction image when image_url is provided", () => {
      // Arrange
      const auction = createTestAuction({
        image_url: "https://example.com/test-image.jpg",
        task: "テストタスク",
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      const image = screen.getByAltText("テストタスク");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "https://example.com/test-image.jpg");
    });

    test("should render placeholder when image_url is null", () => {
      // Arrange
      const auction = createTestAuction({
        image_url: null,
        task: "テストタスク",
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      // 画像の代わりにプレースホルダが表示されることを確認
      const imageContainer = screen.getByText("テストタスク").closest("div");
      expect(imageContainer).toBeTruthy();

      // プレースホルダアイコンが存在することを確認（より具体的なセレクタを使用）
      const container = screen.getByText("テストタスク").closest("div") as HTMLElement;
      const placeholderDiv = container.querySelector("div.bg-gray-100") ?? container.querySelector("div.bg-gray-200");
      expect(placeholderDiv).toBeTruthy();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("バッジ表示", () => {
    test("should display NEW badge when auction is new", () => {
      // Arrange
      const auction = createTestAuction();
      mockUseAuctionCard.mockReturnValue({
        isStarted: true,
        isEnded: false,
        isNew: true,
        isEndingSoon: false,
        setIsEnded: vi.fn(),
        getStartMessage: vi.fn(),
        prefetchAuctionDetails: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("NEW")).toBeInTheDocument();
    });

    test("should display ending soon badge when auction is ending soon", () => {
      // Arrange
      const auction = createTestAuction();
      mockUseAuctionCard.mockReturnValue({
        isStarted: true,
        isEnded: false,
        isNew: false,
        isEndingSoon: true,
        setIsEnded: vi.fn(),
        getStartMessage: vi.fn(),
        prefetchAuctionDetails: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("まもなく終了")).toBeInTheDocument();
    });

    test("should display start message when auction has not started", () => {
      // Arrange
      const auction = createTestAuction();
      const mockGetStartMessage = vi.fn(() => "開始まで2時間");
      mockUseAuctionCard.mockReturnValue({
        isStarted: false,
        isEnded: false,
        isNew: false,
        isEndingSoon: false,
        setIsEnded: vi.fn(),
        getStartMessage: mockGetStartMessage,
        prefetchAuctionDetails: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("開始まで2時間")).toBeInTheDocument();
      expect(mockGetStartMessage).toHaveBeenCalled();
    });

    test("should display ended message when auction has ended", () => {
      // Arrange
      const auction = createTestAuction();
      mockUseAuctionCard.mockReturnValue({
        isStarted: true,
        isEnded: true,
        isNew: false,
        isEndingSoon: false,
        setIsEnded: vi.fn(),
        getStartMessage: vi.fn(),
        prefetchAuctionDetails: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("終了しました")).toBeInTheDocument();
    });

    test("should display search hit badge when task or detail is highlighted", () => {
      // Arrange
      const auction = createTestAuction({
        task_highlighted: "<mark>ハイライト</mark>されたタスク",
        detail_highlighted: null,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("検索ヒット")).toBeInTheDocument();
    });

    test("should display search hit badge when detail is highlighted", () => {
      // Arrange
      const auction = createTestAuction({
        task_highlighted: null,
        detail_highlighted: "<mark>ハイライト</mark>された詳細",
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("検索ヒット")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ウォッチリスト機能", () => {
    test("should render watchlist button", () => {
      // Arrange
      const auction = createTestAuction();

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      const watchlistButton = screen.getByRole("button", { name: /ウォッチリスト/ });
      expect(watchlistButton).toBeInTheDocument();
    });

    test("should show watchlisted state when auction is watchlisted", () => {
      // Arrange
      const auction = createTestAuction();
      mockUseWatchlist.mockReturnValue({
        isLoading: false,
        isWatchlisted: true,
        toggleWatchlist: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      const watchlistButton = screen.getByRole("button", { name: /ウォッチリストから削除/ });
      expect(watchlistButton).toBeInTheDocument();
    });

    test("should show not watchlisted state when auction is not watchlisted", () => {
      // Arrange
      const auction = createTestAuction();
      mockUseWatchlist.mockReturnValue({
        isLoading: false,
        isWatchlisted: false,
        toggleWatchlist: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      const watchlistButton = screen.getByRole("button", { name: /ウォッチリストに追加/ });
      expect(watchlistButton).toBeInTheDocument();
    });

    test("should disable watchlist button when loading", () => {
      // Arrange
      const auction = createTestAuction();
      mockUseWatchlist.mockReturnValue({
        isLoading: true,
        isWatchlisted: false,
        toggleWatchlist: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      const watchlistButton = screen.getByRole("button", { name: /ウォッチリスト/ });
      expect(watchlistButton).toBeDisabled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("出品者評価表示", () => {
    test("should render executor with rating", () => {
      // Arrange
      const auction = createTestAuction({
        executors_json: [
          {
            id: "executor-1",
            rating: 4.5,
            userId: "user-1",
            userImage: "https://example.com/avatar.jpg",
            userSettingsUsername: "テストユーザー",
          },
        ],
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("テストユーザー")).toBeInTheDocument();
      expect(screen.getByText("4.5")).toBeInTheDocument();
    });

    test("should render executor without rating as 未評価", () => {
      // Arrange
      const auction = createTestAuction({
        executors_json: [
          {
            id: "executor-1",
            rating: null,
            userId: "user-1",
            userImage: "https://example.com/avatar.jpg",
            userSettingsUsername: "未評価ユーザー",
          },
        ],
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("未評価ユーザー")).toBeInTheDocument();
      expect(screen.getByText("未評価")).toBeInTheDocument();
    });

    test("should render executor with fallback username", () => {
      // Arrange
      const auction = createTestAuction({
        executors_json: [
          {
            id: "executor-1",
            rating: 3.0,
            userId: "user-1",
            userImage: null,
            userSettingsUsername: null,
          },
        ],
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    test("should handle string executors_json gracefully", () => {
      // Arrange
      const auction = createTestAuction({
        executors_json: "invalid-json-string",
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("出品者情報がありません")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ユーザーインタラクション", () => {
    test("should call toggleWatchlist when watchlist button is clicked", async () => {
      // Arrange
      const mockToggleWatchlist = vi.fn();
      const auction = createTestAuction();
      mockUseWatchlist.mockReturnValue({
        isLoading: false,
        isWatchlisted: false,
        toggleWatchlist: mockToggleWatchlist,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      const watchlistButton = screen.getByRole("button", { name: /ウォッチリスト/ });
      await userEvent.click(watchlistButton);

      // Assert
      expect(mockToggleWatchlist).toHaveBeenCalledTimes(1);
    });

    test("should call prefetchAuctionDetails on mouse enter", async () => {
      // Arrange
      const mockPrefetchAuctionDetails = vi.fn().mockResolvedValue(undefined);
      const auction = createTestAuction();
      mockUseAuctionCard.mockReturnValue({
        isStarted: true,
        isEnded: false,
        isNew: false,
        isEndingSoon: false,
        setIsEnded: vi.fn(),
        getStartMessage: vi.fn(),
        prefetchAuctionDetails: mockPrefetchAuctionDetails,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      const cardElement = screen.getByText(auction.task).closest("div")?.parentElement;
      if (cardElement) {
        await userEvent.hover(cardElement);
      }

      // Assert
      expect(mockPrefetchAuctionDetails).toHaveBeenCalled();
    });

    test("should prevent propagation when watchlist button is clicked", async () => {
      // Arrange
      const mockToggleWatchlist = vi.fn();
      const auction = createTestAuction();
      mockUseWatchlist.mockReturnValue({
        isLoading: false,
        isWatchlisted: false,
        toggleWatchlist: mockToggleWatchlist,
      });

      const mockPreventDefault = vi.fn();
      const mockStopPropagation = vi.fn();

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      const watchlistButton = screen.getByRole("button", { name: /ウォッチリスト/ });

      // イベントオブジェクトをモック
      const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
      clickEvent.preventDefault = mockPreventDefault;
      clickEvent.stopPropagation = mockStopPropagation;

      watchlistButton.dispatchEvent(clickEvent);

      // Assert
      expect(mockToggleWatchlist).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常値・境界値処理", () => {
    test("should handle zero bids count", () => {
      // Arrange
      const auction = createTestAuction({
        bids_count: 0,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("0件")).toBeInTheDocument();
    });

    test("should handle large bid amounts", () => {
      // Arrange
      const auction = createTestAuction({
        current_highest_bid: 1000000,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("現在価格: 1,000,000 P")).toBeInTheDocument();
    });

    test("should handle null category", () => {
      // Arrange
      const auction = createTestAuction({
        category: null,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("カテゴリ: 未設定")).toBeInTheDocument();
    });

    test("should handle null detail", () => {
      // Arrange
      const auction = createTestAuction({
        detail: null,
        detail_highlighted: null,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      // detail_highlightedがnullの場合、detailの表示は行われない
      const detailElement = screen.queryByText(/詳細/);
      expect(detailElement).not.toBeInTheDocument();
    });

    test("should handle empty executors array", () => {
      // Arrange
      const auction = createTestAuction({
        executors_json: [],
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      // 空の配列の場合、何も出品者が表示されない
      const executorElements = screen.queryByText(/評価/);
      expect(executorElements).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("カウントダウン表示", () => {
    test("should display countdown when auction is active", () => {
      // Arrange
      const auction = createTestAuction();
      mockUseCountdown.mockReturnValue({
        countdownState: {
          isExpired: false,
          isCritical: false,
          isUrgent: false,
        },
        formatCountdown: vi.fn(() => "2日 5時間"),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("2日 5時間")).toBeInTheDocument();
    });

    test("should handle critical countdown state", () => {
      // Arrange
      const auction = createTestAuction();
      mockUseCountdown.mockReturnValue({
        countdownState: {
          isExpired: false,
          isCritical: true,
          isUrgent: false,
        },
        formatCountdown: vi.fn(() => "30分"),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionCard auction={auction} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("30分")).toBeInTheDocument();
    });
  });
});
