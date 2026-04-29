import { fireEvent, render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Filter, ShareTableFilterProps } from "./share-table-filter";
import { ShareTableFilter, TableToolTips } from "./share-table-filter";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// useShortcutフックのモック
vi.mock("@/hooks/utils/use-shortcut", () => ({
  useShortcut: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */
const filterFactory = Factory.define<Filter>(({ params }) => ({
  filterType: params?.filterType ?? "input",
  filterText: params?.filterText ?? "",
  onFilterChange: params?.onFilterChange ?? vi.fn(),
  placeholder: params?.placeholder ?? "テスト用プレースホルダー",
  radioOptions: params?.radioOptions ?? null,
}));

const shareTableFilterPropsFactory = Factory.define<ShareTableFilterProps>(() => ({
  filter: {
    filterContents: [filterFactory.build()],
    onResetFilters: vi.fn(),
    onResetSort: vi.fn(),
  },
  fullScreenProps: {
    isFullScreen: false,
    toggleFullScreen: vi.fn(),
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 各テスト前にモックをリセット
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("ShareTableFilter", () => {
  describe("基本的なレンダリング", () => {
    test("should render filter component with input type filter correctly", () => {
      // Arrange
      const props = shareTableFilterPropsFactory.build();

      // Act
      render(<ShareTableFilter {...props} />);

      // Assert
      expect(screen.getByPlaceholderText("テスト用プレースホルダー")).toBeInTheDocument();
      expect(screen.getByText("適応")).toBeInTheDocument();
      expect(screen.getByText("フィルターリセット")).toBeInTheDocument();
      expect(screen.getByText("ソートリセット")).toBeInTheDocument();
      expect(screen.getByText("フルスクリーン")).toBeInTheDocument();
    });

    test("should render filter component with radio type filter correctly", () => {
      // Arrange
      const radioFilter = filterFactory.build({
        filterType: "radio",
        radioOptions: [
          { value: "option1", label: "オプション1" },
          { value: "option2", label: "オプション2" },
        ],
      });
      const props = shareTableFilterPropsFactory.build();
      props.filter.filterContents = [radioFilter];

      // Act
      render(<ShareTableFilter {...props} />);

      // Assert
      expect(screen.getByText("オプション1")).toBeInTheDocument();
      expect(screen.getByText("オプション2")).toBeInTheDocument();
      expect(screen.getByText("フィルターリセット")).toBeInTheDocument();
      expect(screen.getByText("ソートリセット")).toBeInTheDocument();
      expect(screen.getByText("フルスクリーン")).toBeInTheDocument();
    });

    test("should render multiple filters correctly", () => {
      // Arrange
      const inputFilter = filterFactory.build({
        filterType: "input",
        placeholder: "入力フィルター",
      });
      const radioFilter = filterFactory.build({
        filterType: "radio",
        placeholder: "ラジオフィルター",
        radioOptions: [
          { value: "radio1", label: "ラジオ1" },
          { value: "radio2", label: "ラジオ2" },
        ],
      });
      const props = shareTableFilterPropsFactory.build();
      props.filter.filterContents = [inputFilter, radioFilter];

      // Act
      render(<ShareTableFilter {...props} />);

      // Assert
      expect(screen.getByPlaceholderText("入力フィルター")).toBeInTheDocument();
      expect(screen.getByText("ラジオ1")).toBeInTheDocument();
      expect(screen.getByText("ラジオ2")).toBeInTheDocument();
    });
  });

  describe("inputタイプフィルターの機能", () => {
    test("should update input value when typing", () => {
      // Arrange
      const props = shareTableFilterPropsFactory.build();
      render(<ShareTableFilter {...props} />);
      const input = screen.getByPlaceholderText("テスト用プレースホルダー");

      // Act
      fireEvent.change(input, { target: { value: "テスト入力" } });

      // Assert
      expect(input).toHaveValue("テスト入力");
    });

    test("should call onFilterChange when apply button is clicked", () => {
      // Arrange
      const mockOnFilterChange = vi.fn();
      const inputFilter = filterFactory.build({
        onFilterChange: mockOnFilterChange,
      });
      const props = shareTableFilterPropsFactory.build();
      props.filter.filterContents = [inputFilter];

      render(<ShareTableFilter {...props} />);
      const input = screen.getByPlaceholderText("テスト用プレースホルダー");
      const applyButton = screen.getByText("適応");

      // Act
      fireEvent.change(input, { target: { value: "フィルター値" } });
      fireEvent.click(applyButton);

      // Assert
      expect(mockOnFilterChange).toHaveBeenCalledWith("フィルター値");
    });

    test("should show clear button when input has value", () => {
      // Arrange
      const props = shareTableFilterPropsFactory.build();
      render(<ShareTableFilter {...props} />);
      const input = screen.getByPlaceholderText("テスト用プレースホルダー");

      // Act
      fireEvent.change(input, { target: { value: "テスト" } });

      // Assert
      expect(screen.getByLabelText("入力をクリア")).toBeInTheDocument();
    });

    test("should not show clear button when input is empty", () => {
      // Arrange
      const props = shareTableFilterPropsFactory.build();
      render(<ShareTableFilter {...props} />);

      // Assert
      expect(screen.queryByLabelText("入力をクリア")).not.toBeInTheDocument();
    });

    test("should clear input and call onFilterChange when clear button is clicked", () => {
      // Arrange
      const mockOnFilterChange = vi.fn();
      const inputFilter = filterFactory.build({
        onFilterChange: mockOnFilterChange,
      });
      const props = shareTableFilterPropsFactory.build();
      props.filter.filterContents = [inputFilter];

      render(<ShareTableFilter {...props} />);
      const input = screen.getByPlaceholderText("テスト用プレースホルダー");

      // Act
      fireEvent.change(input, { target: { value: "テスト" } });
      const clearButton = screen.getByLabelText("入力をクリア");
      fireEvent.click(clearButton);

      // Assert
      expect(input).toHaveValue("");
      expect(mockOnFilterChange).toHaveBeenCalledWith("");
    });
  });

  describe("radioタイプフィルターの機能", () => {
    test("should call onFilterChange when radio option is selected", () => {
      // Arrange
      const mockOnFilterChange = vi.fn();
      const radioFilter = filterFactory.build({
        filterType: "radio",
        onFilterChange: mockOnFilterChange,
        radioOptions: [
          { value: "option1", label: "オプション1" },
          { value: "option2", label: "オプション2" },
        ],
      });
      const props = shareTableFilterPropsFactory.build();
      props.filter.filterContents = [radioFilter];

      render(<ShareTableFilter {...props} />);

      // Act
      const radioOption = screen.getByLabelText("オプション1");
      fireEvent.click(radioOption);

      // Assert
      expect(mockOnFilterChange).toHaveBeenCalledWith("option1");
    });

    test("should show selected radio option correctly", () => {
      // Arrange
      const radioFilter = filterFactory.build({
        filterType: "radio",
        filterText: "option2",
        radioOptions: [
          { value: "option1", label: "オプション1" },
          { value: "option2", label: "オプション2" },
        ],
      });
      const props = shareTableFilterPropsFactory.build();
      props.filter.filterContents = [radioFilter];

      // Act
      render(<ShareTableFilter {...props} />);

      // Assert
      const selectedRadio = screen.getByLabelText("オプション2");
      expect(selectedRadio).toHaveAttribute("data-state", "checked");
    });

    test("should not render radio filter when radioOptions is null", () => {
      // Arrange
      const radioFilter = filterFactory.build({
        filterType: "radio",
        radioOptions: null,
      });
      const props = shareTableFilterPropsFactory.build();
      props.filter.filterContents = [radioFilter];

      // Act
      render(<ShareTableFilter {...props} />);

      // Assert
      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    });
  });

  describe("フルスクリーン機能", () => {
    test("should call toggleFullScreen when fullscreen button is clicked", () => {
      // Arrange
      const mockToggleFullScreen = vi.fn();
      const props = shareTableFilterPropsFactory.build();
      props.fullScreenProps.toggleFullScreen = mockToggleFullScreen;

      render(<ShareTableFilter {...props} />);

      // Act
      const fullScreenButton = screen.getByText("フルスクリーン");
      fireEvent.click(fullScreenButton);

      // Assert
      expect(mockToggleFullScreen).toHaveBeenCalledTimes(1);
    });

    test("should show correct button text when not in fullscreen mode", () => {
      // Arrange
      const props = shareTableFilterPropsFactory.build();
      props.fullScreenProps.isFullScreen = false;

      // Act
      render(<ShareTableFilter {...props} />);

      // Assert
      expect(screen.getByText("フルスクリーン")).toBeInTheDocument();
      expect(screen.queryByText("通常表示に戻す")).not.toBeInTheDocument();
    });

    test("should show correct button text when in fullscreen mode", () => {
      // Arrange
      const props = shareTableFilterPropsFactory.build();
      props.fullScreenProps.isFullScreen = true;

      // Act
      render(<ShareTableFilter {...props} />);

      // Assert
      expect(screen.getByText("通常表示に戻す")).toBeInTheDocument();
      expect(screen.queryByText("フルスクリーン")).not.toBeInTheDocument();
    });

    test("should not show tooltip when in fullscreen mode", () => {
      // Arrange
      const props = shareTableFilterPropsFactory.build();
      props.fullScreenProps.isFullScreen = true;

      // Act
      render(<ShareTableFilter {...props} />);

      // Assert
      expect(screen.queryByLabelText("通知コマンドのヘルプ")).not.toBeInTheDocument();
    });

    test("should show tooltip when not in fullscreen mode", () => {
      // Arrange
      const props = shareTableFilterPropsFactory.build();
      props.fullScreenProps.isFullScreen = false;

      // Act
      render(<ShareTableFilter {...props} />);

      // Assert
      expect(screen.getByLabelText("通知コマンドのヘルプ")).toBeInTheDocument();
    });
  });

  describe("リセット機能", () => {
    test("should call onResetFilters when filter reset button is clicked", () => {
      // Arrange
      const mockOnResetFilters = vi.fn();
      const props = shareTableFilterPropsFactory.build();
      props.filter.onResetFilters = mockOnResetFilters;

      render(<ShareTableFilter {...props} />);

      // Act
      const resetButton = screen.getByText("フィルターリセット");
      fireEvent.click(resetButton);

      // Assert
      expect(mockOnResetFilters).toHaveBeenCalledTimes(1);
    });

    test("should call onResetSort when sort reset button is clicked", () => {
      // Arrange
      const mockOnResetSort = vi.fn();
      const props = shareTableFilterPropsFactory.build();
      props.filter.onResetSort = mockOnResetSort;

      render(<ShareTableFilter {...props} />);

      // Act
      const resetButton = screen.getByText("ソートリセット");
      fireEvent.click(resetButton);

      // Assert
      expect(mockOnResetSort).toHaveBeenCalledTimes(1);
    });
  });
});

describe("TableToolTips", () => {
  describe("基本的なレンダリング", () => {
    test("should render tooltip component correctly", () => {
      // Act
      render(<TableToolTips />);

      // Assert
      expect(screen.getByLabelText("通知コマンドのヘルプ")).toBeInTheDocument();
    });
  });
});
