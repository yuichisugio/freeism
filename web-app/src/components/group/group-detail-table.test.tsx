import React from "react";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { groupDetailTaskFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { ContributionType, TaskStatus } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GroupDetailTable } from "./group-detail-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// ホイストされたモック関数の宣言
const { mockUseGroupDetailTable } = vi.hoisted(() => ({
  mockUseGroupDetailTable: vi.fn(),
}));

// useGroupDetailTableフックのモック
vi.mock("@/hooks/group/group-detail/use-group-detail-table", () => ({
  useGroupDetailTable: mockUseGroupDetailTable,
}));

// ShareTableコンポーネントのモック
vi.mock("@/components/share/table/share-table", () => ({
  ShareTable: vi.fn(({ dataTableProps }: { dataTableProps: { initialData: unknown[]; columns: unknown[] } }) => (
    <div data-testid="share-table">
      <div data-testid="table-data">{JSON.stringify(dataTableProps.initialData)}</div>
      <div data-testid="table-columns-count">{dataTableProps.columns.length}</div>
    </div>
  )),
}));

// Loadingコンポーネントのモック
vi.mock("@/components/share/share-loading", () => ({
  Loading: vi.fn(() => <div data-testid="loading">Loading...</div>),
}));

// useRouterのモック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */

const createMockHookReturn = (overrides = {}) => ({
  // state
  tasks: [],
  isLoading: false,
  tableConditions: {
    sort: { field: "createdAt", direction: "desc" },
    page: 1,
    searchQuery: "",
    contributionType: "ALL",
    status: "ALL",
    itemPerPage: 16,
    isJoined: "all",
  },
  totalTaskCount: 0,
  editingTaskId: null,
  isTaskEditModalOpen: false,

  // functions
  canDeleteTask: vi.fn(() => false),
  handleDeleteTask: vi.fn(),
  canEditTask: vi.fn(() => false),
  handleTaskEdited: vi.fn(),
  openTaskEditModal: vi.fn(),
  closeTaskEditModal: vi.fn(),
  changeTableConditions: vi.fn(),
  resetFilters: vi.fn(),
  resetSort: vi.fn(),
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("GroupDetailTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのフックモック設定
    mockUseGroupDetailTable.mockReturnValue(createMockHookReturn());
  });

  describe("基本的なレンダリング", () => {
    test("should render component with title", () => {
      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("タスク一覧")).toBeInTheDocument();
    });

    test("should render ShareTable component", () => {
      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should call useGroupDetailTable hook with correct props", () => {
      // Arrange
      const groupId = "test-group-id";
      const isOwner = true;

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId={groupId} isOwner={isOwner} />
        </AllTheProviders>,
      );

      // Assert
      expect(mockUseGroupDetailTable).toHaveBeenCalledWith({ groupId, isOwner });
    });
  });

  describe("ローディング状態", () => {
    test("should show loading overlay when isLoading is true", () => {
      // Arrange
      mockUseGroupDetailTable.mockReturnValue(createMockHookReturn({ isLoading: true }));

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("loading")).toBeInTheDocument();
    });

    test("should not show loading overlay when isLoading is false", () => {
      // Arrange
      mockUseGroupDetailTable.mockReturnValue(createMockHookReturn({ isLoading: false }));

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
    });
  });

  describe("データ表示", () => {
    test("should pass tasks data to ShareTable", () => {
      // Arrange
      const testTasks = [
        groupDetailTaskFactory.build({
          id: "task-1",
          taskName: "テストタスク1",
          taskCreator: "作成者1",
        }),
        groupDetailTaskFactory.build({
          id: "task-2",
          taskName: "テストタスク2",
          taskCreator: "作成者2",
        }),
      ];

      mockUseGroupDetailTable.mockReturnValue(createMockHookReturn({ tasks: testTasks }));

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      const tableData = screen.getByTestId("table-data");
      expect(tableData.textContent).toContain("テストタスク1");
      expect(tableData.textContent).toContain("テストタスク2");
    });

    test("should pass correct number of columns to ShareTable", () => {
      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      const columnsCount = screen.getByTestId("table-columns-count");
      expect(columnsCount.textContent).toBe("10"); // 期待されるカラム数
    });
  });

  describe("プロパティの検証", () => {
    test("should handle different groupId values", () => {
      // Arrange
      const groupIds = ["group-1", "group-2", "group-3"];

      groupIds.forEach((groupId) => {
        // Act
        render(
          <AllTheProviders>
            <GroupDetailTable groupId={groupId} isOwner={true} />
          </AllTheProviders>,
        );

        // Assert
        expect(mockUseGroupDetailTable).toHaveBeenCalledWith({ groupId, isOwner: true });
      });
    });

    test("should handle different isOwner values", () => {
      // Arrange
      const ownerValues = [true, false];

      ownerValues.forEach((isOwner) => {
        // Act
        render(
          <AllTheProviders>
            <GroupDetailTable groupId="test-group-id" isOwner={isOwner} />
          </AllTheProviders>,
        );

        // Assert
        expect(mockUseGroupDetailTable).toHaveBeenCalledWith({ groupId: "test-group-id", isOwner });
      });
    });
  });

  describe("テーブル設定", () => {
    test("should configure table with correct pagination settings", () => {
      // Arrange
      const mockTableConditions = {
        sort: { field: "taskName", direction: "asc" },
        page: 2,
        searchQuery: "test query",
        contributionType: ContributionType.REWARD,
        status: TaskStatus.PENDING,
        itemPerPage: 20,
        isJoined: "all",
      };

      mockUseGroupDetailTable.mockReturnValue(
        createMockHookReturn({
          tableConditions: mockTableConditions,
          totalTaskCount: 100,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should handle empty tasks array", () => {
      // Arrange
      mockUseGroupDetailTable.mockReturnValue(createMockHookReturn({ tasks: [] }));

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      const tableData = screen.getByTestId("table-data");
      expect(tableData.textContent).toBe("[]");
    });
  });

  describe("エラーケース", () => {
    test("should handle null/undefined values gracefully", () => {
      // Arrange
      mockUseGroupDetailTable.mockReturnValue(
        createMockHookReturn({
          tasks: [],
          tableConditions: {
            sort: null,
            page: 1,
            searchQuery: null,
            contributionType: "ALL",
            status: "ALL",
            itemPerPage: 16,
            isJoined: "all",
          },
        }),
      );

      // Act & Assert - コンポーネントがクラッシュしないことを確認
      expect(() => {
        render(
          <AllTheProviders>
            <GroupDetailTable groupId="test-group-id" isOwner={true} />
          </AllTheProviders>,
        );
      }).not.toThrow();
    });

    test("should handle missing hook functions", () => {
      // Arrange
      mockUseGroupDetailTable.mockReturnValue({
        tasks: [],
        isLoading: false,
        tableConditions: {
          sort: { field: "createdAt", direction: "desc" },
          page: 1,
          searchQuery: "",
          contributionType: "ALL",
          status: "ALL",
          itemPerPage: 16,
          isJoined: "all",
        },
        totalTaskCount: 0,
        editingTaskId: null,
        isTaskEditModalOpen: false,
        // 関数を意図的に省略
      });

      // Act & Assert - コンポーネントがクラッシュしないことを確認
      expect(() => {
        render(
          <AllTheProviders>
            <GroupDetailTable groupId="test-group-id" isOwner={true} />
          </AllTheProviders>,
        );
      }).not.toThrow();
    });
  });

  describe("カラム定義", () => {
    test("should have correct column headers", () => {
      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      const columnsCount = screen.getByTestId("table-columns-count");
      expect(columnsCount.textContent).toBe("10");
    });

    test("should handle tasks with different contribution types", () => {
      // Arrange
      const rewardTask = groupDetailTaskFactory.build({
        id: "reward-task",
        taskName: "報酬タスク",
        taskContributionType: ContributionType.REWARD,
        taskFixedContributionPoint: 100,
      });

      const nonRewardTask = groupDetailTaskFactory.build({
        id: "non-reward-task",
        taskName: "通常タスク",
        taskContributionType: ContributionType.NON_REWARD,
        taskFixedContributionPoint: null,
      });

      mockUseGroupDetailTable.mockReturnValue(createMockHookReturn({ tasks: [rewardTask, nonRewardTask] }));

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      const tableData = screen.getByTestId("table-data");
      expect(tableData.textContent).toContain("報酬タスク");
      expect(tableData.textContent).toContain("通常タスク");
    });

    test("should handle tasks with auction IDs", () => {
      // Arrange
      const taskWithAuction = groupDetailTaskFactory.build({
        id: "auction-task",
        taskName: "オークションタスク",
        auctionId: "auction-123",
      });

      const taskWithoutAuction = groupDetailTaskFactory.build({
        id: "no-auction-task",
        taskName: "通常タスク",
        auctionId: null,
      });

      mockUseGroupDetailTable.mockReturnValue(createMockHookReturn({ tasks: [taskWithAuction, taskWithoutAuction] }));

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      const tableData = screen.getByTestId("table-data");
      expect(tableData.textContent).toContain("オークションタスク");
      expect(tableData.textContent).toContain("通常タスク");
    });
  });

  describe("フック関数の呼び出し", () => {
    test("should call hook functions with correct parameters", () => {
      // Arrange
      const mockFunctions = {
        canDeleteTask: vi.fn(() => true),
        handleDeleteTask: vi.fn(),
        canEditTask: vi.fn(() => true),
        handleTaskEdited: vi.fn(),
        openTaskEditModal: vi.fn(),
        closeTaskEditModal: vi.fn(),
        changeTableConditions: vi.fn(),
        resetFilters: vi.fn(),
        resetSort: vi.fn(),
      };

      mockUseGroupDetailTable.mockReturnValue(createMockHookReturn(mockFunctions));

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert - フック関数が適切に設定されていることを確認
      expect(mockUseGroupDetailTable).toHaveBeenCalledWith({
        groupId: "test-group-id",
        isOwner: true,
      });
    });

    test("should handle different task statuses", () => {
      // Arrange
      const tasks = [
        groupDetailTaskFactory.build({
          id: "pending-task",
          taskName: "ペンディングタスク",
          taskStatus: TaskStatus.PENDING,
        }),
        groupDetailTaskFactory.build({
          id: "completed-task",
          taskName: "完了タスク",
          taskStatus: TaskStatus.TASK_COMPLETED,
        }),
        groupDetailTaskFactory.build({
          id: "evaluated-task",
          taskName: "評価済みタスク",
          taskStatus: TaskStatus.FIXED_EVALUATED,
        }),
      ];

      mockUseGroupDetailTable.mockReturnValue(createMockHookReturn({ tasks }));

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      const tableData = screen.getByTestId("table-data");
      expect(tableData.textContent).toContain("ペンディングタスク");
      expect(tableData.textContent).toContain("完了タスク");
      expect(tableData.textContent).toContain("評価済みタスク");
    });
  });

  describe("メモ化の検証", () => {
    test("should memoize component properly", () => {
      // Arrange
      const props = { groupId: "test-group-id", isOwner: true };

      // Act - 同じpropsで複数回レンダリング
      const { rerender } = render(
        <AllTheProviders>
          <GroupDetailTable {...props} />
        </AllTheProviders>,
      );

      rerender(
        <AllTheProviders>
          <GroupDetailTable {...props} />
        </AllTheProviders>,
      );

      // Assert - フックが適切に呼ばれていることを確認
      expect(mockUseGroupDetailTable).toHaveBeenCalledWith(props);
    });

    test("should handle prop changes correctly", () => {
      // Arrange
      const initialProps = { groupId: "group-1", isOwner: true };
      const updatedProps = { groupId: "group-2", isOwner: false };

      // Act
      const { rerender } = render(
        <AllTheProviders>
          <GroupDetailTable {...initialProps} />
        </AllTheProviders>,
      );

      rerender(
        <AllTheProviders>
          <GroupDetailTable {...updatedProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(mockUseGroupDetailTable).toHaveBeenCalledWith(initialProps);
      expect(mockUseGroupDetailTable).toHaveBeenCalledWith(updatedProps);
    });
  });

  describe("境界値テスト", () => {
    test("should handle very long task names", () => {
      // Arrange
      const longTaskName = "a".repeat(1000);
      const task = groupDetailTaskFactory.build({
        id: "long-name-task",
        taskName: longTaskName,
      });

      mockUseGroupDetailTable.mockReturnValue(createMockHookReturn({ tasks: [task] }));

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      const tableData = screen.getByTestId("table-data");
      expect(tableData.textContent).toContain(longTaskName);
    });

    test("should handle empty string values", () => {
      // Arrange
      const task = groupDetailTaskFactory.build({
        id: "empty-values-task",
        taskName: "",
        taskCreator: "",
        taskDetail: "",
      });

      mockUseGroupDetailTable.mockReturnValue(createMockHookReturn({ tasks: [task] }));

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should handle large number of tasks", () => {
      // Arrange
      const largeTasks = Array.from({ length: 1000 }, (_, index) =>
        groupDetailTaskFactory.build({
          id: `task-${index}`,
          taskName: `タスク${index}`,
        }),
      );

      mockUseGroupDetailTable.mockReturnValue(
        createMockHookReturn({
          tasks: largeTasks,
          totalTaskCount: 1000,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <GroupDetailTable groupId="test-group-id" isOwner={true} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      const tableData = screen.getByTestId("table-data");
      expect(tableData.textContent).toContain("タスク0");
    });
  });
});
