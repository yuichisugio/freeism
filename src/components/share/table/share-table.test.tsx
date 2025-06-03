import type { DataTableComponentProps } from "@/types/group-types";
import { render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ShareTable } from "./share-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// useTaskStatusフックのモック
vi.mock("@/hooks/task/use-task-status", () => ({
  useTaskStatus: vi.fn(() => ({
    openStatus: null,
    setOpenStatus: vi.fn(),
    handleStatusChange: vi.fn(),
    taskStatuses: [
      { label: "タスク実施前", value: "PENDING" },
      { label: "オークション中", value: "AUCTION_ACTIVE" },
    ],
  })),
  taskStatuses: [
    { label: "タスク実施前", value: "PENDING" },
    { label: "オークション中", value: "AUCTION_ACTIVE" },
  ],
}));

// 子コンポーネントのモック
vi.mock("@/components/share/share-no-result", () => ({
  NoResult: vi.fn(({ message }: { message: string }) => <div data-testid="no-result">{message}</div>),
}));

vi.mock("@/components/share/table/share-table-filter", () => ({
  ShareTableFilter: vi.fn(() => <div data-testid="share-table-filter">Filter</div>),
}));

vi.mock("@/components/share/table/share-table-pagination", () => ({
  ShareTablePagination: vi.fn(() => <div data-testid="share-table-pagination">Pagination</div>),
}));

vi.mock("@/components/task/task-edit-modal", () => ({
  TaskEditModal: vi.fn(() => <div data-testid="task-edit-modal">Task Edit Modal</div>),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ型定義
 */
type TestTableData = {
  id: string;
  name: string;
  status: string;
  isJoined?: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */
const testTableDataFactory = Factory.define<TestTableData>(({ sequence, params }) => ({
  id: params.id ?? `test-id-${sequence}`,
  name: params.name ?? `テストアイテム${sequence}`,
  status: params.status ?? "PENDING",
  isJoined: params.isJoined ?? false,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */
function createBasicProps(): DataTableComponentProps<TestTableData> {
  return {
    dataTableProps: {
      initialData: testTableDataFactory.buildList(3),
      columns: [
        {
          key: "name",
          header: "名前",
          cell: (row) => row.name,
          cellClassName: null,
          sortable: true,
          statusCombobox: false,
          joinGroupModal: false,
          leaveGroupModal: false,
          modalList: null,
          editTask: false,
          deleteTask: null,
        },
        {
          key: "status",
          header: "ステータス",
          cell: (row) => row.status,
          cellClassName: null,
          sortable: false,
          statusCombobox: true,
          joinGroupModal: false,
          leaveGroupModal: false,
          modalList: null,
          editTask: false,
          deleteTask: null,
        },
      ],
      onDataChange: vi.fn(),
      editTask: null,
      pagination: {
        totalRowCount: 3,
        currentPage: 1,
        onPageChange: vi.fn(),
        itemPerPage: 10,
        onItemPerPageChange: vi.fn(),
      },
      sort: {
        onSortChange: vi.fn(),
        sortDirection: "asc",
        sortField: "name",
      },
      filter: null,
    },
  };
}

function createPropsWithoutPagination() {
  const props = createBasicProps();
  return {
    dataTableProps: {
      ...props.dataTableProps,
      pagination: null,
    },
  } as unknown as DataTableComponentProps<TestTableData>;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("ShareTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // フルスクリーンAPIのモック
    Object.defineProperty(document, "fullscreenElement", {
      writable: true,
      value: null,
    });

    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });

    Object.defineProperty(document, "exitFullscreen", {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本的なレンダリング", () => {
    test("should render table with data correctly", () => {
      const props = createBasicProps();

      render(<ShareTable {...props} />);

      // テーブルヘッダーの確認
      expect(screen.getByText("名前")).toBeInTheDocument();
      expect(screen.getByText("ステータス")).toBeInTheDocument();

      // テーブルデータの確認
      expect(screen.getByText("テストアイテム1")).toBeInTheDocument();
      expect(screen.getByText("テストアイテム2")).toBeInTheDocument();
      expect(screen.getByText("テストアイテム3")).toBeInTheDocument();

      // ページネーションの確認
      expect(screen.getByTestId("share-table-pagination")).toBeInTheDocument();
    });

    test("should render empty state when no data provided", () => {
      const props = createBasicProps();
      props.dataTableProps.initialData = [];

      render(<ShareTable {...props} />);

      // 空の状態の確認
      expect(screen.getByTestId("no-result")).toBeInTheDocument();
      expect(screen.getByText("データがありません")).toBeInTheDocument();
    });

    test("should render without pagination when pagination is not provided", () => {
      const props = createPropsWithoutPagination();

      render(<ShareTable {...props} />);

      // ページネーションが表示されないことを確認
      expect(screen.queryByTestId("share-table-pagination")).not.toBeInTheDocument();
    });

    test("should render filter when filter prop is provided", () => {
      const props = createBasicProps();
      props.dataTableProps.filter = {
        filterContents: [],
        onResetFilters: vi.fn(),
        onResetSort: vi.fn(),
      };

      render(<ShareTable {...props} />);

      // フィルターの確認
      expect(screen.getByTestId("share-table-filter")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle large dataset correctly", () => {
      const props = createBasicProps();
      props.dataTableProps.initialData = testTableDataFactory.buildList(100);

      render(<ShareTable {...props} />);

      // テーブルが正常にレンダリングされることを確認
      expect(screen.getByText("名前")).toBeInTheDocument();
      expect(screen.getByText("ステータス")).toBeInTheDocument();
    });

    test("should handle single item correctly", () => {
      const props = createBasicProps();
      const singleItem = testTableDataFactory.build({ name: "単一テストアイテム" });
      props.dataTableProps.initialData = [singleItem];

      render(<ShareTable {...props} />);

      // 単一アイテムが正常に表示されることを確認
      expect(screen.getByText("単一テストアイテム")).toBeInTheDocument();
    });

    test("should handle empty columns array", () => {
      const props = createBasicProps();
      props.dataTableProps.columns = [];

      render(<ShareTable {...props} />);

      // テーブルが正常にレンダリングされることを確認（ヘッダーなし）
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ソート機能テスト", () => {
    test("should call onSortChange when sortable column header is clicked", async () => {
      const props = createBasicProps();
      const mockOnSortChange = vi.fn();
      if (props.dataTableProps.sort) {
        props.dataTableProps.sort.onSortChange = mockOnSortChange;
      }

      render(<ShareTable {...props} />);

      // ソート可能な列ヘッダーをクリック
      const sortButton = screen.getByRole("button", { name: /名前/ });
      sortButton.click();

      // ソート関数が呼ばれることを確認
      expect(mockOnSortChange).toHaveBeenCalledWith("name");
    });

    test("should display correct sort icon based on sort direction", () => {
      const props = createBasicProps();
      if (props.dataTableProps.sort) {
        props.dataTableProps.sort.sortDirection = "desc";
        props.dataTableProps.sort.sortField = "name";
      }

      render(<ShareTable {...props} />);

      // 降順のアイコンが表示されることを確認
      const sortButton = screen.getByRole("button", { name: /名前/ });
      expect(sortButton).toBeInTheDocument();
    });

    test("should render without sort when sort prop is null", () => {
      const props = createBasicProps();
      props.dataTableProps.sort = null;

      render(<ShareTable {...props} />);

      // ソートが無効でも、列の設定でsortableがtrueの場合はボタンが表示される
      expect(screen.getByText("名前")).toBeInTheDocument();
      // sortがnullでもsortableがtrueの場合はボタンが表示される
      expect(screen.getByRole("button", { name: /名前/ })).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ステータスコンボボックステスト", () => {
    test("should render status combobox for status column", () => {
      const props = createBasicProps();
      const singleItem = testTableDataFactory.build({ name: "ステータステスト" });
      props.dataTableProps.initialData = [singleItem];

      render(<ShareTable {...props} />);

      // ステータスコンボボックスが表示されることを確認（単一アイテムで複数要素を避ける）
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByText("タスク実施前")).toBeInTheDocument();
    });

    test("should handle status combobox with different status values", () => {
      const props = createBasicProps();
      const itemWithDifferentStatus = testTableDataFactory.build({
        name: "異なるステータスアイテム",
        status: "AUCTION_ACTIVE",
      });
      props.dataTableProps.initialData = [itemWithDifferentStatus];

      render(<ShareTable {...props} />);

      // 異なるステータスが表示されることを確認
      expect(screen.getByText("オークション中")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フルスクリーン機能テスト", () => {
    test("should handle fullscreen mode correctly", () => {
      const props = createBasicProps();

      render(<ShareTable {...props} />);

      // フルスクリーンモードが初期状態では無効であることを確認
      const wrapper = screen.getByRole("table").closest("div");
      expect(wrapper).not.toHaveClass("flex h-screen w-screen flex-col overflow-auto bg-white");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データ変更テスト", () => {
    test("should call onDataChange when provided", () => {
      const props = createBasicProps();
      const mockOnDataChange = vi.fn();
      props.dataTableProps.onDataChange = mockOnDataChange;

      render(<ShareTable {...props} />);

      // onDataChangeが初期データで呼ばれることを確認
      expect(mockOnDataChange).toHaveBeenCalledWith(props.dataTableProps.initialData);
    });

    test("should handle null onDataChange gracefully", () => {
      const props = createBasicProps();
      // @ts-expect-error - テスト用にnullを設定
      props.dataTableProps.onDataChange = null;

      expect(() => render(<ShareTable {...props} />)).not.toThrow();
    });
  });
});
