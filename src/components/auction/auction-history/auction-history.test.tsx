import type {
  AuctionCreatedTabFilter,
  BidHistoryItem,
  CreatedAuctionItem,
  WonAuctionItem,
} from "@/types/auction-types";
import { faker } from "@faker-js/faker";
import { BidStatus, TaskStatus } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AuctionHistory } from "./auction-history";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const { mockUseAuctionHistory } = vi.hoisted(() => ({
  mockUseAuctionHistory: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */
vi.mock("@/hooks/auction/history/use-auction-history", () => ({
  useAuctionHistory: mockUseAuctionHistory,
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */
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
 * デフォルトのモック戻り値
 */
const defaultMockReturnValue = {
  // state
  activeTab: "bids",
  currentPage: 1,
  itemPerPage: 21,
  bidHistoryData: [],
  wonHistoryData: [],
  createdHistoryData: [],
  currentDataCount: 0,
  isLoadingCurrentTab: false,
  filter: [],
  VALID_UI_FILTERS: ["pending", "active", "ended", "supplier_done", "creator", "executor", "reporter"],
  filterCondition: "and",
  wonStatus: "all",
  // function
  handleTabChange: vi.fn(),
  handlePageChange: vi.fn(),
  handleItemClick: vi.fn(),
  handleWonItemClick: vi.fn(),
  handleCreatedItemClick: vi.fn(),
  handleItemPerPageChange: vi.fn(),
  handleFilterChange: vi.fn(),
  handleClearFilters: vi.fn(),
  handleFilterConditionChange: vi.fn(),
  setParams: vi.fn(),
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("AuctionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuctionHistory.mockReturnValue(defaultMockReturnValue);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期表示", () => {
    test("should render auction history component with tabs", () => {
      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "入札履歴" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "落札履歴" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "出品履歴" })).toBeInTheDocument();
    });

    test("should show empty message when no bid history data", () => {
      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("入札履歴はありません")).toBeInTheDocument();
    });

    test("should show loading state when data is loading", () => {
      // Arrange
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        isLoadingCurrentTab: true,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      // アクティブなタブコンテンツ内のLoadingテキストのみをチェック
      const activeTabContent = screen.getByRole("tabpanel", { name: "入札履歴" });
      expect(activeTabContent).toHaveTextContent("Loading...");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("入札履歴タブ", () => {
    test("should display bid history items correctly", () => {
      // Arrange
      const testBidHistoryData = [
        bidHistoryItemFactory.build({
          taskName: "テストタスク1",
          currentHighestBid: 1000,
        }),
        bidHistoryItemFactory.build({
          taskName: "テストタスク2",
          currentHighestBid: 2000,
        }),
      ];
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        bidHistoryData: testBidHistoryData,
        currentDataCount: 2,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("テストタスク1")).toBeInTheDocument();
      expect(screen.getByText("テストタスク2")).toBeInTheDocument();
      // 複数の同じテキストが存在する場合はgetAllByTextを使用
      const pointTexts = screen.getAllByText(/1,000.*ポイント/);
      expect(pointTexts.length).toBeGreaterThan(0);
      const pointTexts2 = screen.getAllByText(/2,000.*ポイント/);
      expect(pointTexts2.length).toBeGreaterThan(0);
    });

    test("should handle click on bid history item", async () => {
      // Arrange
      const user = userEvent.setup();
      const testBidHistoryData = createTestBidHistoryItems(1);
      const handleItemClick = vi.fn();
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        bidHistoryData: testBidHistoryData,
        currentDataCount: 1,
        handleItemClick,
      });

      // Act
      render(<AuctionHistory />);
      const historyCard = screen
        .getByText(testBidHistoryData[0].taskName)
        .closest('[role="button"], div[class*="cursor-pointer"]');
      if (historyCard) {
        await user.click(historyCard);
      }

      // Assert
      expect(handleItemClick).toHaveBeenCalledWith(testBidHistoryData[0].auctionId);
    });

    test("should display correct bid status badges", () => {
      // Arrange
      const testBidHistoryData = [
        bidHistoryItemFactory.build({ bidStatus: BidStatus.BIDDING }),
        bidHistoryItemFactory.build({ bidStatus: BidStatus.WON }),
        bidHistoryItemFactory.build({ bidStatus: BidStatus.LOST }),
      ];
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        bidHistoryData: testBidHistoryData,
        currentDataCount: 3,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("入札中")).toBeInTheDocument();
      expect(screen.getByText("落札")).toBeInTheDocument();
      expect(screen.getByText("落札失敗")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("落札履歴タブ", () => {
    test("should display won history items when won tab is active", () => {
      // Arrange
      const testWonHistoryData = createTestWonAuctionItems(2);
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "won",
        wonHistoryData: testWonHistoryData,
        currentDataCount: 2,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      testWonHistoryData.forEach((item) => {
        expect(screen.getByText(item.taskName)).toBeInTheDocument();
      });
    });

    test("should show empty message when no won history data", () => {
      // Arrange
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "won",
        wonHistoryData: [],
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("落札履歴はありません")).toBeInTheDocument();
    });

    test("should display won status filter options", () => {
      // Arrange
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "won",
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByLabelText("すべて")).toBeInTheDocument();
      expect(screen.getByLabelText("報告タスク済み")).toBeInTheDocument();
      expect(screen.getByLabelText("報告タスク未完了")).toBeInTheDocument();
    });

    test("should handle won status filter change", async () => {
      // Arrange
      const user = userEvent.setup();
      const setParams = vi.fn();
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "won",
        setParams,
      });

      // Act
      render(<AuctionHistory />);
      await user.click(screen.getByLabelText("報告タスク済み"));

      // Assert
      expect(setParams).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("出品履歴タブ", () => {
    test("should display created history items when created tab is active", () => {
      // Arrange
      const testCreatedHistoryData = createTestCreatedAuctionItems(2);
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "created",
        createdHistoryData: testCreatedHistoryData,
        currentDataCount: 2,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      testCreatedHistoryData.forEach((item) => {
        expect(screen.getByText(item.taskName)).toBeInTheDocument();
      });
    });

    test("should show empty message when no created history data", () => {
      // Arrange
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "created",
        createdHistoryData: [],
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("出品履歴はありません")).toBeInTheDocument();
    });

    test("should display filter options for created tab", () => {
      // Arrange
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "created",
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("フィルター")).toBeInTheDocument();
      expect(screen.getByLabelText("あなたが作成")).toBeInTheDocument();
      expect(screen.getByLabelText("あなたが提供")).toBeInTheDocument();
      expect(screen.getByLabelText("あなたが報告")).toBeInTheDocument();
      expect(screen.getByLabelText("開催中")).toBeInTheDocument();
      expect(screen.getByLabelText("オークション終了")).toBeInTheDocument();
      expect(screen.getByLabelText("開始前")).toBeInTheDocument();
      expect(screen.getByLabelText("提供の完了（タスク完了含む）")).toBeInTheDocument();
    });

    test("should handle filter checkbox changes", async () => {
      // Arrange
      const user = userEvent.setup();
      const handleFilterChange = vi.fn();
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "created",
        handleFilterChange,
        filter: [],
      });

      // Act
      render(<AuctionHistory />);
      await user.click(screen.getByLabelText("あなたが作成"));

      // Assert
      expect(handleFilterChange).toHaveBeenCalledWith(["creator"]);
    });

    test("should handle clear filters", async () => {
      // Arrange
      const user = userEvent.setup();
      const handleClearFilters = vi.fn();
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "created",
        handleClearFilters,
        filter: ["creator", "active"],
      });

      // Act
      render(<AuctionHistory />);
      await user.click(screen.getByText("クリア"));

      // Assert
      expect(handleClearFilters).toHaveBeenCalled();
    });

    test("should disable clear button when no filters applied", () => {
      // Arrange
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "created",
        filter: [],
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("クリア")).toBeDisabled();
    });

    test("should handle filter condition toggle", async () => {
      // Arrange
      const user = userEvent.setup();
      const handleFilterConditionChange = vi.fn();
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "created",
        handleFilterConditionChange,
        filter: ["creator", "active"],
        filterCondition: "and",
      });

      // Act
      render(<AuctionHistory />);
      await user.click(screen.getByLabelText("フィルター条件をANDとORで切り替え"));

      // Assert
      expect(handleFilterConditionChange).toHaveBeenCalledWith("or");
    });

    test("should disable filter condition switch when no filters applied", () => {
      // Arrange
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "created",
        filter: [],
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByLabelText("フィルター条件をANDとORで切り替え")).toBeDisabled();
    });

    test("should display winner name correctly for ended auctions", () => {
      // Arrange
      const testCreatedHistoryData = [
        createdAuctionItemFactory.build({
          taskStatus: TaskStatus.AUCTION_ENDED,
          winnerId: "winner-1",
          winnerName: "Winner User",
        }),
        createdAuctionItemFactory.build({
          taskStatus: TaskStatus.AUCTION_ENDED,
          winnerId: null,
          winnerName: null,
        }),
      ];
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "created",
        createdHistoryData: testCreatedHistoryData,
        currentDataCount: 2,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("Winner User")).toBeInTheDocument();
      expect(screen.getByText("落札者なし")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ページネーション", () => {
    test("should display pagination when data count is greater than 0", () => {
      // Arrange
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        currentDataCount: 50,
        bidHistoryData: createTestBidHistoryItems(21),
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("50件中1〜21件")).toBeInTheDocument();
    });

    test("should not display pagination when loading", () => {
      // Arrange
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        isLoadingCurrentTab: true,
        currentDataCount: 50,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.queryByText("50件中1〜21件")).not.toBeInTheDocument();
    });

    test("should not display pagination when no data", () => {
      // Arrange
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        currentDataCount: 0,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.queryByText(/件中/)).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("タブ切り替え", () => {
    test("should handle tab change", async () => {
      // Arrange
      const user = userEvent.setup();
      const handleTabChange = vi.fn();
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        handleTabChange,
      });

      // Act
      render(<AuctionHistory />);
      await user.click(screen.getByRole("tab", { name: "落札履歴" }));

      // Assert
      expect(handleTabChange).toHaveBeenCalledWith("won");
    });

    test("should show correct active tab content", () => {
      // Arrange - wonタブがアクティブな場合の検証
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "won",
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("すべて")).toBeInTheDocument();
      // wonタブがアクティブな時、createdタブのフィルターセクションは非表示になっている
      const filterElements = screen.queryAllByText("フィルター");
      // フィルターが表示されている場合、非表示状態（inactive）であることを確認
      if (filterElements.length > 0) {
        const activeFilter = filterElements.find((el) => !el.closest('[data-state="inactive"]'));
        expect(activeFilter).toBeFalsy();
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリング", () => {
    test("should handle invalid date objects gracefully", () => {
      // Arrange
      const testBidHistoryData = [
        bidHistoryItemFactory.build({
          lastBidAt: new Date("invalid-date"),
          auctionEndTime: new Date("invalid-date"),
        }),
      ];
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        bidHistoryData: testBidHistoryData,
        currentDataCount: 1,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("日付不明")).toBeInTheDocument();
    });

    test("should handle empty task names", () => {
      // Arrange
      const testBidHistoryData = [bidHistoryItemFactory.build({ taskName: "" })];
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        bidHistoryData: testBidHistoryData,
        currentDataCount: 1,
      });

      // Act
      render(<AuctionHistory />);

      // Assert - コンポーネントがクラッシュしないことを確認
      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    test("should handle null delivery method", () => {
      // Arrange
      const testWonHistoryData = [wonAuctionItemFactory.build({ deliveryMethod: null })];
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "won",
        wonHistoryData: testWonHistoryData,
        currentDataCount: 1,
      });

      // Act
      render(<AuctionHistory />);

      // Assert - コンポーネントがクラッシュしないことを確認
      expect(screen.getByText(testWonHistoryData[0].taskName)).toBeInTheDocument();
    });

    test("should handle invalid filter options gracefully", () => {
      // Arrange - 無効なフィルター値を含むVALID_UI_FILTERSをモック
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "created",
        VALID_UI_FILTERS: [
          "pending",
          "active",
          "ended",
          "supplier_done",
          "creator",
          "executor",
          "reporter",
          "invalid_filter" as AuctionCreatedTabFilter,
        ],
      });

      // Act
      render(<AuctionHistory />);

      // Assert - コンポーネントがクラッシュしないことを確認（default caseの実行）
      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(screen.getByText("フィルター")).toBeInTheDocument();
    });

    test("should handle large amounts correctly", () => {
      // Arrange
      const testBidHistoryData = [
        bidHistoryItemFactory.build({
          currentHighestBid: 999999999,
          taskName: "大きな金額のテスト",
        }),
      ];
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        bidHistoryData: testBidHistoryData,
        currentDataCount: 1,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("大きな金額のテスト")).toBeInTheDocument();
      // 複数の同じテキストが存在する場合はgetAllByTextを使用
      const pointTexts = screen.getAllByText(/999,999,999.*ポイント/);
      expect(pointTexts.length).toBeGreaterThan(0);
    });

    test("should handle zero amounts", () => {
      // Arrange
      const testBidHistoryData = [
        bidHistoryItemFactory.build({
          currentHighestBid: 0,
          taskName: "ゼロ金額のテスト",
        }),
      ];
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        bidHistoryData: testBidHistoryData,
        currentDataCount: 1,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("ゼロ金額のテスト")).toBeInTheDocument();
      // 複数の同じテキストが存在する場合はgetAllByTextを使用
      const pointTexts = screen.getAllByText(/0.*ポイント/);
      expect(pointTexts.length).toBeGreaterThan(0);
    });

    test("should handle edge case filter combinations", () => {
      // Arrange
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        activeTab: "created",
        filter: ["creator", "executor", "reporter", "pending", "active", "ended", "supplier_done"],
        filterCondition: "or",
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      // 全フィルターが有効な状態でコンポーネントが正常に動作することを確認
      expect(screen.getByText("フィルター")).toBeInTheDocument();
      expect(screen.getByLabelText("フィルター条件をANDとORで切り替え")).not.toBeDisabled();
      expect(screen.getByText("クリア")).not.toBeDisabled();
    });

    test("should handle very long task names", () => {
      // Arrange
      const longTaskName = "これは非常に長いタスク名です。".repeat(10);
      const testBidHistoryData = [
        bidHistoryItemFactory.build({
          taskName: longTaskName,
        }),
      ];
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        bidHistoryData: testBidHistoryData,
        currentDataCount: 1,
      });

      // Act
      render(<AuctionHistory />);

      // Assert - 長い名前でもコンポーネントがクラッシュしない
      expect(screen.getByText(longTaskName)).toBeInTheDocument();
    });

    test("should handle negative amounts gracefully", () => {
      // Arrange
      const testBidHistoryData = [
        bidHistoryItemFactory.build({
          currentHighestBid: -100,
          taskName: "負の金額テスト",
        }),
      ];
      mockUseAuctionHistory.mockReturnValue({
        ...defaultMockReturnValue,
        bidHistoryData: testBidHistoryData,
        currentDataCount: 1,
      });

      // Act
      render(<AuctionHistory />);

      // Assert
      expect(screen.getByText("負の金額テスト")).toBeInTheDocument();
      // 複数の同じテキストが存在する場合はgetAllByTextを使用
      const pointTexts = screen.getAllByText(/-100.*ポイント/);
      expect(pointTexts.length).toBeGreaterThan(0);
    });
  });
});
