import { fireEvent, render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ShareTablePaginationProps } from "./share-table-pagination";
import { ShareTablePagination } from "./share-table-pagination";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */
const shareTablePaginationPropsFactory = Factory.define<ShareTablePaginationProps>(({ params }) => ({
  currentPage: params.currentPage ?? 1,
  onPageChange: params.onPageChange ?? vi.fn(),
  totalRowCount: params.totalRowCount ?? 100,
  itemPerPage: params.itemPerPage ?? 10,
  onItemPerPageChange: params.onItemPerPageChange ?? vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("ShareTablePagination", () => {
  describe("正常系", () => {
    test("should render pagination component with correct initial state", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build();

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.getByText("100件中1〜10件")).toBeInTheDocument();
      expect(screen.getByText("表示件数 / 10件")).toBeInTheDocument();
    });

    test("should display correct item range when on different pages", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 3,
        totalRowCount: 100,
        itemPerPage: 10,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.getByText("100件中21〜30件")).toBeInTheDocument();
    });

    test("should display zero state correctly", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        totalRowCount: 0,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.getByText("0件 / 0件")).toBeInTheDocument();
    });

    test("should not render pagination controls when totalPages is 0", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        totalRowCount: 0,
        itemPerPage: 10,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      // ページネーションコントロールが表示されないことを確認
      expect(screen.queryByPlaceholderText("page")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("次のページへ")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("前のページへ")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("最初のページへ")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("最後のページへ")).not.toBeInTheDocument();
    });
  });

  describe("ページネーション機能", () => {
    test("should call onPageChange when page number button is clicked", () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 100,
        itemPerPage: 10,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);
      const pageButton = screen.getByRole("button", { name: "2" });
      fireEvent.click(pageButton);

      // Assert
      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    test("should call onPageChange when next button is clicked", () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 100,
        itemPerPage: 10,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);
      const nextButton = screen.getByLabelText("次のページへ");
      fireEvent.click(nextButton);

      // Assert
      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    test("should call onPageChange when previous button is clicked", () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 2,
        totalRowCount: 100,
        itemPerPage: 10,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);
      const prevButton = screen.getByLabelText("前のページへ");
      fireEvent.click(prevButton);

      // Assert
      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });

    test("should call onPageChange when first page button is clicked", () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 5,
        totalRowCount: 100,
        itemPerPage: 10,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);
      const firstButton = screen.getByLabelText("最初のページへ");
      fireEvent.click(firstButton);

      // Assert
      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });

    test("should call onPageChange when last page button is clicked", () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 100,
        itemPerPage: 10,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);
      const lastButton = screen.getByLabelText("最後のページへ");
      fireEvent.click(lastButton);

      // Assert
      expect(mockOnPageChange).toHaveBeenCalledWith(10);
    });

    test("should not show first page button when on first page", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 100,
        itemPerPage: 10,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.queryByLabelText("最初のページへ")).not.toBeInTheDocument();
    });

    test("should not show last page button when on last page", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 10,
        totalRowCount: 100,
        itemPerPage: 10,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.queryByLabelText("最後のページへ")).not.toBeInTheDocument();
    });

    test("should not show previous button when on first page", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 100,
        itemPerPage: 10,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.queryByLabelText("前のページへ")).not.toBeInTheDocument();
    });

    test("should not show next button when on last page", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 10,
        totalRowCount: 100,
        itemPerPage: 10,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.queryByLabelText("次のページへ")).not.toBeInTheDocument();
    });

    test("should disable current page button", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 3,
        totalRowCount: 100,
        itemPerPage: 10,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      const currentPageButton = screen.getByRole("button", { name: "3" });
      expect(currentPageButton).toBeDisabled();
    });
  });

  describe("表示件数変更機能", () => {
    test("should render dropdown trigger with correct text", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        itemPerPage: 25,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.getByText("表示件数 / 25件")).toBeInTheDocument();
    });

    test("should render dropdown trigger button", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        itemPerPage: 10,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      const dropdownTrigger = screen.getByRole("button", { name: /表示件数/ });
      expect(dropdownTrigger).toBeInTheDocument();
    });
  });

  describe("ページ番号入力機能", () => {
    test("should call onPageChange when page number is entered in input field", async () => {
      // Arrange
      const mockOnPageChange = vi.fn();
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 100,
        itemPerPage: 10,
        onPageChange: mockOnPageChange,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);
      const pageInput = screen.getByPlaceholderText("page");
      fireEvent.change(pageInput, { target: { value: "5" } });

      // 2秒のタイムアウト後にonPageChangeが呼ばれることを確認
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Assert
      expect(mockOnPageChange).toHaveBeenCalledWith(5);
    });

    test("should render page number input field", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 100,
        itemPerPage: 10,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      const pageInput = screen.getByPlaceholderText("page");
      expect(pageInput).toBeInTheDocument();
      expect(pageInput).toHaveAttribute("type", "number");
    });
  });

  describe("境界値テスト", () => {
    test("should handle single page correctly", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 5,
        itemPerPage: 10,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.getByText("5件中1〜5件")).toBeInTheDocument();
      expect(screen.queryByLabelText("次のページへ")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("前のページへ")).not.toBeInTheDocument();
    });

    test("should handle last page with partial items", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 3,
        totalRowCount: 25,
        itemPerPage: 10,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.getByText("25件中21〜25件")).toBeInTheDocument();
    });

    test("should handle large numbers correctly", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 100,
        totalRowCount: 10000,
        itemPerPage: 100,
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.getByText("10000件中9901〜10000件")).toBeInTheDocument();
    });

    test("should display ellipsis when there are many pages", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 5,
        totalRowCount: 1000,
        itemPerPage: 10, // 100ページになる
      });

      // Act
      render(<ShareTablePagination pagination={props} />);

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
        ...shareTablePaginationPropsFactory.build(),
        currentPage: undefined as unknown as number,
        totalRowCount: 100,
        itemPerPage: 10,
      };

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      // undefinedの場合、計算でNaNになることを確認
      expect(screen.getByText("100件中NaN〜NaN件")).toBeInTheDocument();
    });

    test("should handle undefined totalRowCount gracefully", () => {
      // Arrange
      const props = {
        ...shareTablePaginationPropsFactory.build(),
        currentPage: 1,
        totalRowCount: undefined as unknown as number,
        itemPerPage: 10,
      };

      // Act
      render(<ShareTablePagination pagination={props} />);

      // Assert
      expect(screen.getByText("0件 / 0件")).toBeInTheDocument();
    });

    test("should handle zero itemPerPage", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: 1,
        totalRowCount: 100,
        itemPerPage: 0,
      });

      // Act & Assert
      // itemPerPageが0の場合、Math.ceilでInfinityになるため、適切にハンドリングされることを確認
      expect(() => render(<ShareTablePagination pagination={props} />)).not.toThrow();
    });

    test("should handle negative values", () => {
      // Arrange
      const props = shareTablePaginationPropsFactory.build({
        currentPage: -1,
        totalRowCount: -100,
        itemPerPage: -10,
      });

      // Act & Assert
      expect(() => render(<ShareTablePagination pagination={props} />)).not.toThrow();
    });
  });
});
