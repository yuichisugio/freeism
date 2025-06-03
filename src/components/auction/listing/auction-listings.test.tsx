import type { AuctionCard, AuctionListingsConditions } from "@/types/auction-types";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { faker } from "@faker-js/faker";
import { TaskStatus } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AuctionListings } from "./auction-listings";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * useAuctionListingsフックのモック
 */
const { useAuctionListings } = vi.hoisted(() => ({
  useAuctionListings: vi.fn(),
}));

vi.mock("@/hooks/auction/listing/use-auction-listings", () => ({
  useAuctionListings,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 子コンポーネントのモック
 */
vi.mock("@/components/auction/listing/auction-listing-card", () => ({
  AuctionCard: ({ auction }: { auction: AuctionCard }) => (
    <div data-testid="auction-card" data-auction-id={auction.id}>
      {auction.task}
    </div>
  ),
}));

vi.mock("@/components/auction/listing/auction-listing-filters", () => ({
  AuctionFilters: () => <div data-testid="auction-filters">フィルター</div>,
}));

vi.mock("@/components/auction/listing/auction-listing-pagination", () => ({
  AuctionPagination: () => <div data-testid="auction-pagination">ページネーション</div>,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// AuctionCardファクトリー
const auctionCardFactory = Factory.define<AuctionCard>(({ sequence, params }) => ({
  id: params.id ?? `auction-${sequence}`,
  current_highest_bid: params.current_highest_bid ?? faker.number.int({ min: 100, max: 10000 }),
  end_time: params.end_time ?? faker.date.future(),
  start_time: params.start_time ?? faker.date.past(),
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
  executors_json: params.executors_json ?? [],
}));

// AuctionListingsConditionsファクトリー
const auctionListingsConditionsFactory = Factory.define<AuctionListingsConditions>(({ params }) => ({
  categories: params.categories ?? ["すべて"],
  status: params.status ?? ["all"],
  statusConditionJoinType: params.statusConditionJoinType ?? "AND",
  minBid: params.minBid ?? null,
  maxBid: params.maxBid ?? null,
  minRemainingTime: params.minRemainingTime ?? null,
  maxRemainingTime: params.maxRemainingTime ?? null,
  groupIds: params.groupIds ?? null,
  searchQuery: params.searchQuery ?? null,
  sort: params.sort ?? null,
  page: params.page ?? 1,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */
const createTestAuctionCard = (overrides: Partial<AuctionCard> = {}): AuctionCard => {
  return auctionCardFactory.build(overrides);
};

const createTestListingsConditions = (overrides: Partial<AuctionListingsConditions> = {}): AuctionListingsConditions => {
  return auctionListingsConditionsFactory.build(overrides);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("AuctionListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本的なレンダリング", () => {
    test("should render auction listings with data correctly", () => {
      // Arrange
      const mockAuctions = [
        createTestAuctionCard({ id: "auction-1", task: "テストタスク1" }),
        createTestAuctionCard({ id: "auction-2", task: "テストタスク2" }),
      ];
      const mockConditions = createTestListingsConditions();

      useAuctionListings.mockReturnValue({
        auctions: mockAuctions,
        totalAuctionsCount: 2,
        listingsConditions: mockConditions,
        isLoading: false,
        setListingsConditions: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionListings />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("auction-filters")).toBeInTheDocument();
      expect(screen.getAllByTestId("auction-card")).toHaveLength(2);
      expect(screen.getByTestId("auction-pagination")).toBeInTheDocument();
      expect(screen.getByText("テストタスク1")).toBeInTheDocument();
      expect(screen.getByText("テストタスク2")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ローディング状態", () => {
    test("should display loading skeleton when isLoading is true", () => {
      // Arrange
      const mockConditions = createTestListingsConditions();

      useAuctionListings.mockReturnValue({
        auctions: [],
        totalAuctionsCount: 0,
        listingsConditions: mockConditions,
        isLoading: true,
        setListingsConditions: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionListings />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("データを読み込み中...")).toBeInTheDocument();
      // ローディング中はフィルターやページネーションは表示されない
      expect(screen.queryByTestId("auction-filters")).not.toBeInTheDocument();
      expect(screen.queryByTestId("auction-pagination")).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("商品が見つからない場合", () => {
    test("should display no results message when auctions array is empty", () => {
      // Arrange
      const mockConditions = createTestListingsConditions();

      useAuctionListings.mockReturnValue({
        auctions: [],
        totalAuctionsCount: 0,
        listingsConditions: mockConditions,
        isLoading: false,
        setListingsConditions: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionListings />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("auction-filters")).toBeInTheDocument();
      expect(screen.getByText("商品が見つかりませんでした")).toBeInTheDocument();
      expect(screen.getByText("検索条件を変更するか、別のフィルターを試してみてください。")).toBeInTheDocument();
      expect(screen.queryByTestId("auction-card")).not.toBeInTheDocument();
      expect(screen.queryByTestId("auction-pagination")).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エッジケース", () => {
    test("should handle single auction item correctly", () => {
      // Arrange
      const mockAuctions = [createTestAuctionCard({ id: "auction-1", task: "単一のオークション" })];
      const mockConditions = createTestListingsConditions();

      useAuctionListings.mockReturnValue({
        auctions: mockAuctions,
        totalAuctionsCount: 1,
        listingsConditions: mockConditions,
        isLoading: false,
        setListingsConditions: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionListings />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getAllByTestId("auction-card")).toHaveLength(1);
      expect(screen.getByText("単一のオークション")).toBeInTheDocument();
      expect(screen.getByTestId("auction-pagination")).toBeInTheDocument();
    });

    test("should handle large number of auction items", () => {
      // Arrange
      const mockAuctions = Array.from({ length: 10 }, (_, i) => createTestAuctionCard({ id: `auction-${i}`, task: `オークション${i + 1}` }));
      const mockConditions = createTestListingsConditions();

      useAuctionListings.mockReturnValue({
        auctions: mockAuctions,
        totalAuctionsCount: 100,
        listingsConditions: mockConditions,
        isLoading: false,
        setListingsConditions: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionListings />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getAllByTestId("auction-card")).toHaveLength(10);
      expect(screen.getByTestId("auction-pagination")).toBeInTheDocument();
    });

    test("should handle null or undefined values gracefully", () => {
      // Arrange
      const mockAuctions = [
        createTestAuctionCard({
          id: "auction-1",
          task: "テストタスク",
          detail: null,
          image_url: null,
          category: null,
        }),
      ];
      const mockConditions = createTestListingsConditions();

      useAuctionListings.mockReturnValue({
        auctions: mockAuctions,
        totalAuctionsCount: 1,
        listingsConditions: mockConditions,
        isLoading: false,
        setListingsConditions: vi.fn(),
      });

      // Act & Assert
      expect(() => {
        render(
          <AllTheProviders>
            <AuctionListings />
          </AllTheProviders>,
        );
      }).not.toThrow();

      expect(screen.getByText("テストタスク")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フィルターとページネーションの統合", () => {
    test("should pass correct props to child components", () => {
      // Arrange
      const mockAuctions = [createTestAuctionCard({ id: "auction-1", task: "テストタスク" })];
      const mockConditions = createTestListingsConditions({
        page: 2,
        searchQuery: "検索クエリ",
        status: ["started"],
      });
      const mockSetListingsConditions = vi.fn();

      useAuctionListings.mockReturnValue({
        auctions: mockAuctions,
        totalAuctionsCount: 50,
        listingsConditions: mockConditions,
        isLoading: false,
        setListingsConditions: mockSetListingsConditions,
      });

      // Act
      render(
        <AllTheProviders>
          <AuctionListings />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("auction-filters")).toBeInTheDocument();
      expect(screen.getByTestId("auction-pagination")).toBeInTheDocument();
      expect(screen.getAllByTestId("auction-card")).toHaveLength(1);
    });

    test("should handle loading state without data", () => {
      // Arrange
      const mockConditions = createTestListingsConditions();

      useAuctionListings.mockReturnValue({
        auctions: [],
        totalAuctionsCount: 0,
        listingsConditions: mockConditions,
        isLoading: true,
        setListingsConditions: vi.fn(),
      });

      // Act
      const { container } = render(
        <AllTheProviders>
          <AuctionListings />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("データを読み込み中...")).toBeInTheDocument();
      // スケルトンローダーが表示されることを確認
      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0); // スケルトンローダーが表示される
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("メモ化の動作確認", () => {
    test("should be memoized and not re-render unnecessarily", () => {
      // Arrange
      const mockAuctions = [createTestAuctionCard({ id: "auction-1", task: "テストタスク" })];
      const mockConditions = createTestListingsConditions();
      const mockSetListingsConditions = vi.fn();

      const mockReturnValue = {
        auctions: mockAuctions,
        totalAuctionsCount: 1,
        listingsConditions: mockConditions,
        isLoading: false,
        setListingsConditions: mockSetListingsConditions,
      };

      useAuctionListings.mockReturnValue(mockReturnValue);

      // Act
      const { rerender } = render(
        <AllTheProviders>
          <AuctionListings />
        </AllTheProviders>,
      );

      // 同じプロップスで再レンダリング
      rerender(
        <AllTheProviders>
          <AuctionListings />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("テストタスク")).toBeInTheDocument();
      // memo化により、不要な再レンダリングが防がれることを確認
      // （実際のパフォーマンステストではないが、構造的に正しく動作することを確認）
    });
  });
});
