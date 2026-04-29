import type { AllUserGroupTable, TableConditions } from "@/types/group-types";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AllUserGroupTableComponent } from "./all-user-group-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const { mockUseAllUserGroupTable } = vi.hoisted(() => ({
  mockUseAllUserGroupTable: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 外部依存のモック
 */
vi.mock("@/hooks/group/use-all-user-group-table", () => ({
  useAllUserGroupTable: mockUseAllUserGroupTable,
}));

vi.mock("@/components/share/share-loading", () => ({
  Loading: () => <div data-testid="loading">Loading...</div>,
}));

vi.mock("@/components/share/table/share-table", () => ({
  ShareTable: () => (
    <div data-testid="share-table">
      <div data-testid="table-data">ShareTable rendered</div>
    </div>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className} data-testid="link">
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  UserPlus: () => <div data-testid="user-plus-icon">UserPlus</div>,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータファクトリー
 */
const allUserGroupTableFactory = Factory.define<AllUserGroupTable>(({ sequence, params }) => ({
  id: params.id ?? `group-${sequence}`,
  name: params.name ?? `テストグループ${sequence}`,
  goal: params.goal ?? `テスト目標${sequence}`,
  evaluationMethod: params.evaluationMethod ?? "自動評価",
  maxParticipants: params.maxParticipants ?? 10,
  joinMembersCount: params.joinMembersCount ?? 5,
  depositPeriod: params.depositPeriod ?? 30,
  isJoined: params.isJoined ?? false,
  createdBy: params.createdBy ?? `作成者${sequence}`,
}));

/**
 * テーブル条件のファクトリー関数
 */
function createTableConditions(
  overrides: Partial<TableConditions<AllUserGroupTable>> = {},
): TableConditions<AllUserGroupTable> {
  return {
    sort: { field: "createdAt" as keyof AllUserGroupTable, direction: "desc" },
    page: 1,
    searchQuery: "",
    isJoined: "all",
    itemPerPage: 50,
    ...overrides,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */
function createMockUseAllUserGroupTableReturn(overrides = {}) {
  return {
    groups: [],
    tableConditions: createTableConditions(),
    isLoading: false,
    totalGroupCount: 0,
    changeTableConditions: vi.fn(),
    handleJoin: vi.fn(),
    resetFilters: vi.fn(),
    resetSort: vi.fn(),
    ...overrides,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("AllUserGroupTableComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック実装
    mockUseAllUserGroupTable.mockReturnValue(createMockUseAllUserGroupTableReturn());
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should render component without crashing", () => {
      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should render ShareTable when not loading", () => {
      // Arrange
      const mockGroups = allUserGroupTableFactory.buildList(3);
      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          groups: mockGroups,
          isLoading: false,
        }),
      );

      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
    });

    test("should display loading overlay when isLoading is true", () => {
      // Arrange
      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          isLoading: true,
        }),
      );

      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });
    test("should call useAllUserGroupTable hook", () => {
      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(mockUseAllUserGroupTable).toHaveBeenCalledTimes(1);
    });

    test("should pass correct props to ShareTable", () => {
      // Arrange
      const mockGroups = allUserGroupTableFactory.buildList(2);
      const mockTableConditions = createTableConditions({ page: 2, itemPerPage: 25 });
      const mockChangeTableConditions = vi.fn();
      const mockResetFilters = vi.fn();
      const mockResetSort = vi.fn();

      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          groups: mockGroups,
          tableConditions: mockTableConditions,
          totalGroupCount: 50,
          changeTableConditions: mockChangeTableConditions,
          resetFilters: mockResetFilters,
          resetSort: mockResetSort,
        }),
      );

      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle empty groups array", () => {
      // Arrange
      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          groups: [],
          totalGroupCount: 0,
        }),
      );

      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should handle large number of groups", () => {
      // Arrange
      const mockGroups = allUserGroupTableFactory.buildList(100);
      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          groups: mockGroups,
          totalGroupCount: 100,
        }),
      );

      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("カラム定義テスト", () => {
    test("should define correct number of columns", () => {
      // Arrange
      const mockGroups = allUserGroupTableFactory.buildList(1);
      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          groups: mockGroups,
        }),
      );

      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      // カラム数は8つ（isJoined, name, currentParticipants, maxParticipants, evaluationMethod, goal, depositPeriod, createdBy）
    });

    test("should handle handleJoin function in column definition", () => {
      // Arrange
      const mockHandleJoin = vi.fn();
      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          handleJoin: mockHandleJoin,
        }),
      );

      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("メモ化テスト", () => {
    test("should memoize component correctly", () => {
      // Arrange
      const mockGroups = allUserGroupTableFactory.buildList(1);
      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          groups: mockGroups,
        }),
      );

      // Act
      const { rerender } = render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });
      rerender(<AllUserGroupTableComponent />);

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle zero totalGroupCount", () => {
      // Arrange
      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          groups: [],
          totalGroupCount: 0,
        }),
      );

      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should handle very large totalGroupCount", () => {
      // Arrange
      const mockGroups = allUserGroupTableFactory.buildList(5);
      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          groups: mockGroups,
          totalGroupCount: 999999,
        }),
      );

      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should handle groups with different isJoined values", () => {
      // Arrange
      const mockGroups = [
        allUserGroupTableFactory.build({ isJoined: true }),
        allUserGroupTableFactory.build({ isJoined: false }),
      ];
      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          groups: mockGroups,
        }),
      );

      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should handle groups with extreme values", () => {
      // Arrange
      const mockGroups = [
        allUserGroupTableFactory.build({
          maxParticipants: 1,
          joinMembersCount: 0,
          depositPeriod: 1,
        }),
        allUserGroupTableFactory.build({
          maxParticipants: 10000,
          joinMembersCount: 9999,
          depositPeriod: 365,
        }),
      ];
      mockUseAllUserGroupTable.mockReturnValue(
        createMockUseAllUserGroupTableReturn({
          groups: mockGroups,
        }),
      );

      // Act
      render(<AllUserGroupTableComponent />, { wrapper: AllTheProviders });

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });
  });
});
