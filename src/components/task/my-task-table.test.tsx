import type { MyTaskTable } from "@/types/group-types";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { taskFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { contributionType, TaskStatus } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { MyTaskTableComponent } from "./my-task-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// ホイストされたモック関数の宣言
const { mockUseMyTaskTable } = vi.hoisted(() => ({
  mockUseMyTaskTable: vi.fn(),
}));

// useMyTaskTableフックのモック
vi.mock("@/hooks/task/use-my-task-table", () => ({
  useMyTaskTable: mockUseMyTaskTable,
}));

// ShareTableコンポーネントのモック
vi.mock("@/components/share/table/share-table", () => ({
  ShareTable: vi.fn(({ dataTableProps }: { dataTableProps: { initialData: MyTaskTable[]; columns: unknown[] } }) => (
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

// Buttonコンポーネントのモック
vi.mock("@/components/ui/button", () => ({
  Button: vi.fn(({ children, onClick, className, size }: { children: React.ReactNode; onClick?: () => void; className?: string; size?: string }) => (
    <button onClick={onClick} className={className} data-size={size} data-testid="button">
      {children}
    </button>
  )),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー
 */
function createTestMyTaskTable(overrides: Partial<MyTaskTable> = {}): MyTaskTable {
  const testUser = userFactory.build();
  const testTask = taskFactory.build();

  return {
    id: testTask.id,
    taskName: testTask.task,
    taskDetail: testTask.detail,
    taskStatus: testTask.status,
    taskContributionType: testTask.contributionType,
    taskFixedContributionPoint: testTask.fixedContributionPoint,
    taskFixedEvaluator: "テスト評価者",
    taskFixedEvaluationLogic: "テスト評価ロジック",
    taskCreatorName: testUser.name,
    taskReporterUserIds: ["user-1"],
    taskExecutorUserIds: ["user-2"],
    taskReporterUserNames: "報告者テスト",
    taskExecutorUserNames: "実行者テスト",
    reporters: [{ appUserName: "報告者テスト", appUserId: "user-1" }],
    executors: [{ appUserName: "実行者テスト", appUserId: "user-2" }],
    groupId: "group-1",
    groupName: "テストグループ",
    auctionId: "auction-1",
    group: { id: "group-1", name: "テストグループ" },
    ...overrides,
  };
}

type MockHookReturn = {
  tasks: MyTaskTable[];
  tableConditions: {
    sort: { field: string; direction: string };
    page: number;
    searchQuery: string | null;
    taskStatus: string;
    contributionType: string;
    itemPerPage: number;
  };
  totalTaskCount: number;
  editingTaskId: string | null;
  isTaskEditModalOpen: boolean;
  isLoading: boolean;
  router: { push: ReturnType<typeof vi.fn> };
  canEditTask: ReturnType<typeof vi.fn>;
  handleTaskEdited: ReturnType<typeof vi.fn>;
  canDeleteTask: ReturnType<typeof vi.fn>;
  handleDeleteTask: ReturnType<typeof vi.fn>;
  openTaskEditModal: ReturnType<typeof vi.fn>;
  closeTaskEditModal: ReturnType<typeof vi.fn>;
  changeTableConditions: ReturnType<typeof vi.fn>;
  resetFilters: ReturnType<typeof vi.fn>;
  resetSort: ReturnType<typeof vi.fn>;
};

function createDefaultMockHookReturn(overrides: Partial<MockHookReturn> = {}): MockHookReturn {
  return {
    // state
    tasks: [],
    tableConditions: {
      sort: { field: "id", direction: "desc" },
      page: 1,
      searchQuery: null,
      taskStatus: "ALL",
      contributionType: "ALL",
      itemPerPage: 10,
    },
    totalTaskCount: 0,
    editingTaskId: null,
    isTaskEditModalOpen: false,
    isLoading: false,
    router: { push: vi.fn() },

    // functions
    canEditTask: vi.fn().mockResolvedValue(true),
    handleTaskEdited: vi.fn(),
    canDeleteTask: vi.fn().mockResolvedValue(true),
    handleDeleteTask: vi.fn().mockResolvedValue(undefined),
    openTaskEditModal: vi.fn(),
    closeTaskEditModal: vi.fn(),
    changeTableConditions: vi.fn(),
    resetFilters: vi.fn(),
    resetSort: vi.fn(),
    ...overrides,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("MyTaskTableComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMyTaskTable.mockReturnValue(createDefaultMockHookReturn());
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系", () => {
    test("should render component successfully", () => {
      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should display tasks when tasks are provided", () => {
      // Arrange
      const testTasks = [createTestMyTaskTable(), createTestMyTaskTable({ id: "task-2" })];
      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tasks: testTasks,
          totalTaskCount: 2,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-data")).toHaveTextContent(JSON.stringify(testTasks));
    });

    test("should show loading overlay when isLoading is true", () => {
      // Arrange
      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          isLoading: true,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should not show loading overlay when isLoading is false", () => {
      // Arrange
      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          isLoading: false,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should render correct number of columns", () => {
      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      // 期待されるカラム数: groupName, taskName, taskReporterUserNames, taskExecutorUserNames,
      // taskFixedContributionPoint, taskFixedEvaluator, taskFixedEvaluationLogic, taskStatus,
      // auctionId, id(編集), delete, detail = 12カラム
      expect(screen.getByTestId("table-columns-count")).toHaveTextContent("12");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系", () => {
    test("should handle empty tasks array", () => {
      // Arrange
      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tasks: [],
          totalTaskCount: 0,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-data")).toHaveTextContent("[]");
    });

    test("should handle null values in task data", () => {
      // Arrange
      const taskWithNulls = createTestMyTaskTable({
        taskDetail: null,
        taskFixedContributionPoint: null,
        taskFixedEvaluator: null,
        taskFixedEvaluationLogic: null,
        taskReporterUserNames: null,
        taskExecutorUserNames: null,
        auctionId: null,
      });

      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tasks: [taskWithNulls],
          totalTaskCount: 1,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-data")).toHaveTextContent(JSON.stringify([taskWithNulls]));
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle task with all possible TaskStatus values", () => {
      // Arrange
      const taskStatuses = Object.values(TaskStatus);
      const tasks = taskStatuses.map((status, index) =>
        createTestMyTaskTable({
          id: `task-${index}`,
          taskStatus: status,
        }),
      );

      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tasks: tasks,
          totalTaskCount: tasks.length,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-data")).toHaveTextContent(JSON.stringify(tasks));
    });

    test("should handle task with all possible contributionType values", () => {
      // Arrange
      const contributionTypes = Object.values(contributionType);
      const tasks = contributionTypes.map((type, index) =>
        createTestMyTaskTable({
          id: `task-${index}`,
          taskContributionType: type,
        }),
      );

      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tasks: tasks,
          totalTaskCount: tasks.length,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-data")).toHaveTextContent(JSON.stringify(tasks));
    });

    test("should handle large number of tasks", () => {
      // Arrange
      const largeTasks = Array.from({ length: 100 }, (_, index) => createTestMyTaskTable({ id: `task-${index}` }));

      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tasks: largeTasks,
          totalTaskCount: 100,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-data")).toHaveTextContent(JSON.stringify(largeTasks));
    });

    test("should handle zero totalTaskCount", () => {
      // Arrange
      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tasks: [],
          totalTaskCount: 0,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-data")).toHaveTextContent("[]");
    });

    test("should handle maximum page number", () => {
      // Arrange
      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tableConditions: {
            sort: { field: "id", direction: "desc" },
            page: 999999,
            searchQuery: null,
            taskStatus: "ALL",
            contributionType: "ALL",
            itemPerPage: 10,
          },
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should handle minimum itemPerPage", () => {
      // Arrange
      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tableConditions: {
            sort: { field: "id", direction: "desc" },
            page: 1,
            searchQuery: null,
            taskStatus: "ALL",
            contributionType: "ALL",
            itemPerPage: 1,
          },
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should handle maximum itemPerPage", () => {
      // Arrange
      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tableConditions: {
            sort: { field: "id", direction: "desc" },
            page: 1,
            searchQuery: null,
            taskStatus: "ALL",
            contributionType: "ALL",
            itemPerPage: 1000,
          },
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("カラム設定テスト", () => {
    test("should configure columns with correct properties", () => {
      // Arrange
      const testTask = createTestMyTaskTable();
      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tasks: [testTask],
          totalTaskCount: 1,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-columns-count")).toHaveTextContent("12");
    });

    test("should handle tasks with extreme values", () => {
      // Arrange
      const extremeTask = createTestMyTaskTable({
        taskName: "a".repeat(1000), // 非常に長いタスク名
        taskFixedContributionPoint: 999999, // 非常に大きなポイント
        taskReporterUserNames: "報告者1, 報告者2, 報告者3, 報告者4, 報告者5", // 複数の報告者
        taskExecutorUserNames: "実行者1, 実行者2, 実行者3, 実行者4, 実行者5", // 複数の実行者
      });

      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tasks: [extremeTask],
          totalTaskCount: 1,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-data")).toHaveTextContent(JSON.stringify([extremeTask]));
    });

    test("should handle tasks with special characters", () => {
      // Arrange
      const specialCharTask = createTestMyTaskTable({
        taskName: "特殊文字テスト!@#$%^&*()_+-=[]{}|;':\",./<>?",
        taskDetail: "改行\nタブ\t特殊文字テスト",
        groupName: "グループ名<script>alert('xss')</script>",
      });

      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tasks: [specialCharTask],
          totalTaskCount: 1,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-data")).toHaveTextContent(JSON.stringify([specialCharTask]));
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("useMemoの依存関係テスト", () => {
    test("should recalculate columns when dependencies change", () => {
      // Arrange
      const initialMockReturn = createDefaultMockHookReturn();
      mockUseMyTaskTable.mockReturnValue(initialMockReturn);

      const { rerender } = render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Act - 依存関係を変更
      const updatedMockReturn = createDefaultMockHookReturn({
        canDeleteTask: vi.fn().mockResolvedValue(false),
        handleDeleteTask: vi.fn().mockResolvedValue(undefined),
        router: { push: vi.fn() },
      });
      mockUseMyTaskTable.mockReturnValue(updatedMockReturn);

      rerender(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-columns-count")).toHaveTextContent("12");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリングテスト", () => {
    test("should handle hook function errors gracefully", () => {
      // Arrange
      const mockCanEditTask = vi.fn().mockRejectedValue(new Error("Permission check failed"));
      const mockCanDeleteTask = vi.fn().mockRejectedValue(new Error("Delete check failed"));

      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          canEditTask: mockCanEditTask,
          canDeleteTask: mockCanDeleteTask,
        }),
      );

      // Act & Assert - コンポーネントがエラーなくレンダリングされることを確認
      expect(() => {
        render(
          <AllTheProviders>
            <MyTaskTableComponent />
          </AllTheProviders>,
        );
      }).not.toThrow();

      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should handle undefined hook return values", () => {
      // Arrange
      mockUseMyTaskTable.mockReturnValue(
        createDefaultMockHookReturn({
          tasks: [],
          totalTaskCount: 0,
          editingTaskId: null,
          isTaskEditModalOpen: false,
        }),
      );

      // Act
      render(
        <AllTheProviders>
          <MyTaskTableComponent />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
    });
  });
});
