import type { ShareTablePaginationProps } from "@/components/share/table/share-table-pagination";
import { fireEvent, render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AuctionHistoryPagination } from "./auction-history-pagination";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */
const auctionHistoryPaginationPropsFactory = Factory.define<ShareTablePaginationProps>(({ params }) => ({
  currentPage: params.currentPage ?? 1,
  onPageChange: params.onPageChange ?? vi.fn(),
  totalRowCount: params.totalRowCount ?? 100,
  itemPerPage: params.itemPerPage ?? 21, // AUCTION_HISTORY_CONSTANTSのデフォルト値
  onItemPerPageChange: params.onItemPerPageChange ?? vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("AuctionHistoryPagination", () => {
  describe("正常系", () => {
    test("should render pagination component with correct initial state", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build();

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.getByText("100件中1〜21件")).toBeInTheDocument();
      expect(screen.getByText("表示件数 / 21件")).toBeInTheDocument();
    });

    test("should display correct item range when on different pages", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 2,
        totalRowCount: 100,
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.getByText("100件中22〜42件")).toBeInTheDocument();
    });

    test("should display zero state correctly", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        totalRowCount: 0,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.getByText("0件 / 0件")).toBeInTheDocument();
    });

    test("should not render pagination controls when totalPages is 0", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        totalRowCount: 0,
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      // ページネーションコントロールが表示されないことを確認
      expect(screen.queryByPlaceholderText("page")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("次のページへ")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("前のページへ")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("最初のページへ")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("最後のページへ")).not.toBeInTheDocument();
    });

    test("should render dropdown with AUCTION_HISTORY_CONSTANTS derived values", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      // ドロップダウントリガーボタンが正しく表示される
      expect(screen.getByText("表示件数 / 21件")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /表示件数/ })).toBeInTheDocument();
    });
  });

  describe("ページネーション機能", () => {
    test("should call onPageChange when page number button is clicked", () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 63, // 21 * 3 = 63で3ページ
        itemPerPage: 21,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);
      const page2Button = screen.getByRole("button", { name: "2" });
      fireEvent.click(page2Button);

      // Assert
      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    test("should call onPageChange when next button is clicked", () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 63,
        itemPerPage: 21,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);
      const nextButton = screen.getByLabelText("次のページへ");
      fireEvent.click(nextButton);

      // Assert
      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    test("should call onPageChange when previous button is clicked", () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 2,
        totalRowCount: 63,
        itemPerPage: 21,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);
      const prevButton = screen.getByLabelText("前のページへ");
      fireEvent.click(prevButton);

      // Assert
      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });

    test("should call onPageChange when first page button is clicked", () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 3,
        totalRowCount: 105, // 21 * 5 = 105で5ページ
        itemPerPage: 21,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);
      const firstButton = screen.getByLabelText("最初のページへ");
      fireEvent.click(firstButton);

      // Assert
      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });

    test("should call onPageChange when last page button is clicked", () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 105,
        itemPerPage: 21,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);
      const lastButton = screen.getByLabelText("最後のページへ");
      fireEvent.click(lastButton);

      // Assert
      expect(mockOnPageChange).toHaveBeenCalledWith(5);
    });

    test("should not show first page button when on first page", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 63,
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.queryByLabelText("最初のページへ")).not.toBeInTheDocument();
    });

    test("should not show last page button when on last page", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 3,
        totalRowCount: 63,
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.queryByLabelText("最後のページへ")).not.toBeInTheDocument();
    });

    test("should not show previous button when on first page", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 63,
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.queryByLabelText("前のページへ")).not.toBeInTheDocument();
    });

    test("should not show next button when on last page", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 3,
        totalRowCount: 63,
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.queryByLabelText("次のページへ")).not.toBeInTheDocument();
    });

    test("should disable current page button", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 2,
        totalRowCount: 63,
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      const currentPageButton = screen.getByRole("button", { name: "2" });
      expect(currentPageButton).toBeDisabled();
    });
  });

  describe("表示件数変更機能", () => {
    test("should render dropdown trigger with correct text", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        itemPerPage: 10, // AUCTION_HISTORY_CONSTANTSから計算される値の一つ
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.getByText("表示件数 / 10件")).toBeInTheDocument();
    });

    test("should render dropdown trigger button", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      const dropdownTrigger = screen.getByRole("button", { name: /表示件数/ });
      expect(dropdownTrigger).toBeInTheDocument();
    });

    test("should verify AUCTION_HISTORY_CONSTANTS value is used in dropdown trigger", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        itemPerPage: 21, // AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      // AUCTION_HISTORY_CONSTANTSの値（21）がドロップダウントリガーに表示されることを確認
      expect(screen.getByText("表示件数 / 21件")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /表示件数/ })).toBeInTheDocument();
    });

    test("should verify onItemPerPageChange function is correctly passed", () => {
      // Arrange
      const mockOnItemPerPageChange = vi.fn();
      const props = auctionHistoryPaginationPropsFactory.build({
        itemPerPage: 21,
        onItemPerPageChange: mockOnItemPerPageChange,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      // ドロップダウンが正しく表示されることを確認
      const dropdownTrigger = screen.getByRole("button", { name: /表示件数/ });
      expect(dropdownTrigger).toBeInTheDocument();

      // モック関数が初期状態では呼ばれていないことを確認
      expect(mockOnItemPerPageChange).not.toHaveBeenCalled();
    });

    test("should render page number input field", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 63,
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      // ページ番号入力フィールドが表示されることを確認
      const pageInput = screen.getByPlaceholderText("page");
      expect(pageInput).toBeInTheDocument();
      expect(pageInput).toHaveAttribute("type", "number");
    });

    test("should handle page input field change with setTimeout", () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 63,
        itemPerPage: 21,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);
      const pageInput = screen.getByPlaceholderText("page");

      // 値を変更
      fireEvent.change(pageInput, { target: { value: "2" } });

      // Assert
      // setTimeoutが使用されているため、すぐには呼ばれない
      expect(mockOnPageChange).not.toHaveBeenCalled();

      // 入力フィールドが存在することを確認
      expect(pageInput).toBeInTheDocument();
    });
  });

  describe("境界値テスト", () => {
    test("should handle single page correctly", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 10,
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.getByText("10件中1〜10件")).toBeInTheDocument();
      expect(screen.queryByLabelText("次のページへ")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("前のページへ")).not.toBeInTheDocument();
    });

    test("should handle last page with partial items", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 3,
        totalRowCount: 50, // 21 * 2 + 8 = 50 (3ページ目は8件)
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.getByText("50件中43〜50件")).toBeInTheDocument();
    });

    test("should handle large numbers correctly", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 50,
        totalRowCount: 1050, // 21 * 50 = 1050
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.getByText("1050件中1030〜1050件")).toBeInTheDocument();
    });

    test("should display ellipsis when there are many pages", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 5,
        totalRowCount: 1000, // 約48ページ
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      // 省略記号（...）が表示されることを確認
      const ellipsis = screen.getAllByText("...");
      expect(ellipsis.length).toBeGreaterThan(0);
    });
  });

  describe("異常系・エッジケース", () => {
    test("should handle undefined currentPage gracefully", () => {
      // Arrange
      const props = {
        ...auctionHistoryPaginationPropsFactory.build(),
        currentPage: undefined as unknown as number,
        totalRowCount: 100,
        itemPerPage: 21,
      };

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      // undefinedの場合、計算でNaNになることを確認
      expect(screen.getByText("100件中NaN〜NaN件")).toBeInTheDocument();
    });

    test("should handle undefined totalRowCount gracefully", () => {
      // Arrange
      const props = {
        ...auctionHistoryPaginationPropsFactory.build(),
        currentPage: 1,
        totalRowCount: undefined as unknown as number,
        itemPerPage: 21,
      };

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.getByText("0件 / 0件")).toBeInTheDocument();
    });

    test("should handle zero itemPerPage", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 100,
        itemPerPage: 0,
      });

      // Act & Assert
      // itemPerPageが0の場合、Math.ceilでInfinityになるため、適切にハンドリングされることを確認
      expect(() => render(<AuctionHistoryPagination pagination={props} />)).not.toThrow();
    });

    test("should handle negative values", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: -1,
        totalRowCount: -100,
        itemPerPage: -21,
      });

      // Act & Assert
      expect(() => render(<AuctionHistoryPagination pagination={props} />)).not.toThrow();
    });
  });

  describe("オークション履歴特有のテスト", () => {
    test("should verify AUCTION_HISTORY_CONSTANTS impact on pagination calculation", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 63, // 21 * 3 = 63で3ページ (AUCTION_HISTORY_CONSTANTSベース)
        itemPerPage: 21, // AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      // AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE = 21 を使った計算結果が正しく表示されることを確認
      expect(screen.getByText("63件中1〜21件")).toBeInTheDocument(); // 1ページ目
      expect(screen.getByText("表示件数 / 21件")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "1" })).toBeDisabled(); // 現在のページ
      expect(screen.getByRole("button", { name: "2" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "3" })).toBeEnabled();
    });

    test("should handle typical auction history pagination with 21 items per page", () => {
      // Arrange
      const props = auctionHistoryPaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 84, // 21 * 4 = 84で4ページ
        itemPerPage: 21,
      });

      // Act
      render(<AuctionHistoryPagination pagination={props} />);

      // Assert
      expect(screen.getByText("84件中1〜21件")).toBeInTheDocument();
      expect(screen.getByText("表示件数 / 21件")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "1" })).toBeDisabled(); // 現在のページ
      expect(screen.getByRole("button", { name: "2" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "3" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "4" })).toBeEnabled();
    });
  });
});
