import type { UsePaginationResult } from "@/hooks/utils/use-pagination";
import type { AuctionListingsConditions } from "@/types/auction-types";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AuctionPagination } from "./auction-listing-pagination";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * usePaginationフックのモック
 */
vi.mock("@/hooks/utils/use-pagination");

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * window.scrollToのモック
 */
const mockScrollTo = vi.fn();
Object.defineProperty(window, "scrollTo", {
  value: mockScrollTo,
  writable: true,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */
const auctionListingsConditionsFactory = Factory.define<AuctionListingsConditions>(({ params }) => ({
  categories: params.categories ?? null,
  status: params.status ?? null,
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
const createTestListingsConditions = (overrides: Partial<AuctionListingsConditions> = {}): AuctionListingsConditions => {
  return auctionListingsConditionsFactory.build(overrides);
};

/**
 * usePaginationの戻り値をモック
 */
const createMockUsePaginationResult = (overrides: Partial<UsePaginationResult> = {}): UsePaginationResult => ({
  pageNumbers: [1, 2, 3],
  hasPreviousPage: false,
  hasNextPage: true,
  totalPages: 3,
  isFirstPage: true,
  isLastPage: false,
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("AuctionPagination", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 各テスト前のセットアップ
   */
  beforeEach(() => {
    vi.clearAllMocks();
    mockScrollTo.mockClear();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should render pagination component correctly", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(createMockUsePaginationResult());

      const listingsConditions = createTestListingsConditions({ page: 1 });
      const setListingsConditionsAction = vi.fn();
      const totalAuctionsCount = 50;
      const auctionsCountPerPage = AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={totalAuctionsCount}
          auctionsCountPerPage={auctionsCountPerPage}
        />,
      );

      // Assert
      expect(screen.getByText("1 / 3 ページ")).toBeInTheDocument();
      expect(screen.getByText("全50件中20件を表示")).toBeInTheDocument();
    });

    test("should show first and last page buttons when not on first/last page", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [1, 2, 3, 4, 5],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 5,
          isFirstPage: false,
          isLastPage: false,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 3 });
      const setListingsConditionsAction = vi.fn();

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={100}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      // Assert
      expect(screen.getByLabelText("Go to first page")).toBeInTheDocument();
      expect(screen.getByLabelText("Go to last page")).toBeInTheDocument();
      expect(screen.getByLabelText("Go to previous page")).toBeInTheDocument();
      expect(screen.getByLabelText("Go to next page")).toBeInTheDocument();
    });

    test("should hide first/last buttons when on first/last page", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [1],
          hasPreviousPage: false,
          hasNextPage: false,
          totalPages: 1,
          isFirstPage: true,
          isLastPage: true,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 1 });
      const setListingsConditionsAction = vi.fn();

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={15}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      // Assert
      expect(screen.queryByLabelText("Go to first page")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Go to last page")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Go to previous page")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Go to next page")).not.toBeInTheDocument();
    });

    test("should display correct totalPages calculation", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          totalPages: 5,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 1 });
      const setListingsConditionsAction = vi.fn();
      const totalAuctionsCount = 85; // 85 / 20 = 4.25 -> Math.ceil = 5 pages

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={totalAuctionsCount}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      // Assert
      expect(screen.getByText("1 / 5 ページ")).toBeInTheDocument();
    });

    test("should handle ellipsis in pagination", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [1, -1, 8, 9, 10, 11, 12, -2, 20], // -1, -2 represent ellipsis
          totalPages: 20,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 10 });
      const setListingsConditionsAction = vi.fn();

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={400}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      // Assert
      // Ellipsis should be rendered for -1 and -2 values
      const ellipsisElements = screen.getAllByText("More pages");
      expect(ellipsisElements).toHaveLength(2);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ユーザーインタラクション", () => {
    test("should call setListingsConditionsAction when page button is clicked", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [1, 2, 3],
          totalPages: 3,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 1 });
      const setListingsConditionsAction = vi.fn();
      const user = userEvent.setup();

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={50}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      const page2Button = screen.getByText("2");
      await user.click(page2Button);

      // Assert
      expect(setListingsConditionsAction).toHaveBeenCalledWith({
        ...listingsConditions,
        page: 2,
      });
    });

    test("should call window.scrollTo when page changes", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [1, 2, 3],
          totalPages: 3,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 1 });
      const setListingsConditionsAction = vi.fn();
      const user = userEvent.setup();

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={50}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      const page3Button = screen.getByText("3");
      await user.click(page3Button);

      // Assert
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });

    test("should not call setListingsConditionsAction when same page button is clicked", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [1, 2, 3],
          totalPages: 3,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 2 });
      const setListingsConditionsAction = vi.fn();
      const user = userEvent.setup();

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={50}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      const currentPageButton = screen.getByText("2");
      await user.click(currentPageButton);

      // Assert
      expect(setListingsConditionsAction).not.toHaveBeenCalled();
      expect(mockScrollTo).not.toHaveBeenCalled();
    });

    test("should handle first page button click", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [1, 2, 3, 4, 5],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 5,
          isFirstPage: false,
          isLastPage: false,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 3 });
      const setListingsConditionsAction = vi.fn();
      const user = userEvent.setup();

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={100}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      const firstPageButton = screen.getByLabelText("Go to first page");
      await user.click(firstPageButton);

      // Assert
      expect(setListingsConditionsAction).toHaveBeenCalledWith({
        ...listingsConditions,
        page: 1,
      });
    });

    test("should handle last page button click", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [1, 2, 3, 4, 5],
          hasPreviousPage: true,
          hasNextPage: true,
          totalPages: 5,
          isFirstPage: false,
          isLastPage: false,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 2 });
      const setListingsConditionsAction = vi.fn();
      const user = userEvent.setup();

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={100}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      const lastPageButton = screen.getByLabelText("Go to last page");
      await user.click(lastPageButton);

      // Assert
      expect(setListingsConditionsAction).toHaveBeenCalledWith({
        ...listingsConditions,
        page: 5,
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle totalAuctionsCount of 0", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [],
          hasPreviousPage: false,
          hasNextPage: false,
          totalPages: 0,
          isFirstPage: true,
          isLastPage: true,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 1 });
      const setListingsConditionsAction = vi.fn();

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={0}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      // Assert
      expect(screen.getByText("1 / 0 ページ")).toBeInTheDocument();
      expect(screen.getByText("全0件中0件を表示")).toBeInTheDocument();
    });

    test("should handle single auction", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [1],
          hasPreviousPage: false,
          hasNextPage: false,
          totalPages: 1,
          isFirstPage: true,
          isLastPage: true,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 1 });
      const setListingsConditionsAction = vi.fn();

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={1}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      // Assert
      expect(screen.getByText("1 / 1 ページ")).toBeInTheDocument();
      expect(screen.getByText("全1件中1件を表示")).toBeInTheDocument();
    });

    test("should handle exact page size boundary", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [1],
          hasPreviousPage: false,
          hasNextPage: false,
          totalPages: 1,
          isFirstPage: true,
          isLastPage: true,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 1 });
      const setListingsConditionsAction = vi.fn();
      const totalAuctionsCount = AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE; // Exactly one page worth

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={totalAuctionsCount}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      // Assert
      expect(
        screen.getByText((_, element) => {
          return element?.textContent === "1 / 1 ページ";
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, element) => {
          return element?.textContent === `全${totalAuctionsCount}件中${AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}件を表示`;
        }),
      ).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should handle negative totalAuctionsCount", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [],
          hasPreviousPage: false,
          hasNextPage: false,
          totalPages: 0,
          isFirstPage: true,
          isLastPage: true,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 1 });
      const setListingsConditionsAction = vi.fn();

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={-5}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      // Assert - Should handle gracefully without crashing
      expect(screen.getByText("1 / 0 ページ")).toBeInTheDocument();
    });

    test("should handle very large totalAuctionsCount", async () => {
      // Arrange
      const { usePagination } = await import("@/hooks/utils/use-pagination");
      const mockUsePagination = vi.mocked(usePagination);

      mockUsePagination.mockReturnValue(
        createMockUsePaginationResult({
          pageNumbers: [1, 2, 3],
          totalPages: 50000,
        }),
      );

      const listingsConditions = createTestListingsConditions({ page: 1 });
      const setListingsConditionsAction = vi.fn();
      const totalAuctionsCount = 1000000;

      // Act
      render(
        <AuctionPagination
          listingsConditions={listingsConditions}
          setListingsConditionsAction={setListingsConditionsAction}
          totalAuctionsCount={totalAuctionsCount}
          auctionsCountPerPage={AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE}
        />,
      );

      // Assert
      expect(screen.getByText("1 / 50000 ページ")).toBeInTheDocument();
      expect(screen.getByText("全1000000件中20件を表示")).toBeInTheDocument();
    });
  });
});
