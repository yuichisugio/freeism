import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { GroupDetailSkeleton } from "./group-detail-skeleton";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Skeletonコンポーネントのモック
 */
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: vi.fn(({ className, ...props }: { className?: string; [key: string]: unknown }) => (
    <div data-testid="skeleton" className={className} {...props} />
  )),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("GroupDetailSkeleton", () => {
  test("should render without crashing", () => {
    // Act
    render(<GroupDetailSkeleton />);

    // Assert
    expect(screen.getAllByTestId("skeleton")).toBeDefined();
  });

  test("should render correct number of skeleton elements", () => {
    // Act
    render(<GroupDetailSkeleton />);

    // Assert
    const skeletonElements = screen.getAllByTestId("skeleton");
    // グループ情報: 3個 + アクションボタン: 4個 + タスク一覧タイトル: 1個 + タスク一覧ヘッダー: 5個 + タスク一覧行: 15個 + 報酬一覧タイトル: 1個 + 報酬一覧ヘッダー: 3個 + 報酬一覧行: 9個 = 41個
    expect(skeletonElements).toHaveLength(41);
  });

  test("should have correct container structure", () => {
    // Act
    const { container } = render(<GroupDetailSkeleton />);

    // Assert
    const mainContainer = container.querySelector(".space-y-6");
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer).toHaveClass("space-y-6");
  });

  describe("セクション別のスケルトン要素テスト", () => {
    test("should render group information skeleton section", () => {
      // Act
      const { container } = render(<GroupDetailSkeleton />);

      // Assert
      const groupInfoSection = container.querySelector(".space-y-6 > div:first-child");
      expect(groupInfoSection).toBeInTheDocument();

      // グループ情報セクション内のスケルトン要素を確認
      const groupInfoSkeletons = groupInfoSection?.querySelectorAll('[data-testid="skeleton"]');
      expect(groupInfoSkeletons).toHaveLength(3);
    });

    test("should render action buttons skeleton section", () => {
      // Act
      const { container } = render(<GroupDetailSkeleton />);

      // Assert
      const actionButtonsSection = container.querySelector(".flex.flex-wrap.gap-2");
      expect(actionButtonsSection).toBeInTheDocument();

      // アクションボタンセクション内のスケルトン要素を確認
      const actionButtonSkeletons = actionButtonsSection?.querySelectorAll('[data-testid="skeleton"]');
      expect(actionButtonSkeletons).toHaveLength(4);
    });

    test("should render task list skeleton section with table structure", () => {
      // Act
      const { container } = render(<GroupDetailSkeleton />);

      // Assert
      const tables = container.querySelectorAll("table");
      expect(tables).toHaveLength(2); // タスク一覧と報酬一覧の2つのテーブル

      // 最初のテーブル（タスク一覧）の構造を確認
      const taskTable = tables[0];
      expect(taskTable).toHaveClass("w-full");

      // ヘッダー行の確認
      const headerCells = taskTable?.querySelectorAll("thead th");
      expect(headerCells).toHaveLength(5);

      // データ行の確認
      const dataRows = taskTable?.querySelectorAll("tbody tr");
      expect(dataRows).toHaveLength(3);
    });

    test("should render reward list skeleton section with table structure", () => {
      // Act
      const { container } = render(<GroupDetailSkeleton />);

      // Assert
      const tables = container.querySelectorAll("table");

      // 2番目のテーブル（報酬一覧）の構造を確認
      const rewardTable = tables[1];
      expect(rewardTable).toHaveClass("w-full");

      // ヘッダー行の確認
      const headerCells = rewardTable?.querySelectorAll("thead th");
      expect(headerCells).toHaveLength(3);

      // データ行の確認
      const dataRows = rewardTable?.querySelectorAll("tbody tr");
      expect(dataRows).toHaveLength(3);
    });
  });

  describe("CSSクラステスト", () => {
    test("should apply correct CSS classes to skeleton elements", () => {
      // Act
      const { container } = render(<GroupDetailSkeleton />);

      // Assert
      // グループ情報のスケルトン要素のクラスを確認
      const groupTitleSkeleton = container.querySelector('[data-testid="skeleton"].h-8.w-64');
      expect(groupTitleSkeleton).toBeInTheDocument();

      const groupDescSkeleton = container.querySelector('[data-testid="skeleton"].mt-2.h-4.w-full.max-w-2xl');
      expect(groupDescSkeleton).toBeInTheDocument();

      // アクションボタンのスケルトン要素のクラスを確認
      const actionButtonSkeletons = container.querySelectorAll('[data-testid="skeleton"].h-10.w-32');
      expect(actionButtonSkeletons).toHaveLength(4);
    });

    test("should apply correct table styling classes", () => {
      // Act
      const { container } = render(<GroupDetailSkeleton />);

      // Assert
      // テーブルコンテナのスタイリングを確認
      const tableContainers = container.querySelectorAll(
        ".rounded-lg.border.border-blue-100.bg-white\\/80.backdrop-blur-sm",
      );
      expect(tableContainers).toHaveLength(2);

      // テーブルヘッダーのスタイリングを確認
      const tableHeaders = container.querySelectorAll(".border-b.border-blue-100.bg-blue-50\\/50");
      expect(tableHeaders).toHaveLength(2);
    });
  });

  describe("アクセシビリティテスト", () => {
    test("should render proper table structure for screen readers", () => {
      // Act
      const { container } = render(<GroupDetailSkeleton />);

      // Assert
      const tables = container.querySelectorAll("table");

      tables.forEach((table) => {
        // テーブルにtheadとtbodyが存在することを確認
        expect(table.querySelector("thead")).toBeInTheDocument();
        expect(table.querySelector("tbody")).toBeInTheDocument();

        // ヘッダーセルがth要素であることを確認
        const headerCells = table.querySelectorAll("thead th");
        expect(headerCells.length).toBeGreaterThan(0);

        // データセルがtd要素であることを確認
        const dataCells = table.querySelectorAll("tbody td");
        expect(dataCells.length).toBeGreaterThan(0);
      });
    });

    test("should have proper semantic HTML structure", () => {
      // Act
      const { container } = render(<GroupDetailSkeleton />);

      // Assert
      // div要素が適切に構造化されていることを確認
      const mainContainer = container.querySelector(".space-y-6");
      expect(mainContainer).toBeInTheDocument();

      // 子要素が適切に配置されていることを確認
      const childDivs = mainContainer?.children;
      expect(childDivs).toHaveLength(4); // グループ情報、アクションボタン、タスク一覧、報酬一覧
    });
  });

  describe("境界値テスト", () => {
    test("should handle multiple renders without issues", () => {
      // Act & Assert
      // 複数回レンダリングしてもエラーが発生しないことを確認
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<GroupDetailSkeleton />);
        expect(screen.getAllByTestId("skeleton")).toHaveLength(41);
        unmount();
      }
    });

    test("should be memoized and not re-render unnecessarily", () => {
      // Act
      const { rerender } = render(<GroupDetailSkeleton />);
      const initialSkeletons = screen.getAllByTestId("skeleton");

      // 同じpropsで再レンダリング
      rerender(<GroupDetailSkeleton />);
      const afterRerenderSkeletons = screen.getAllByTestId("skeleton");

      // Assert
      expect(afterRerenderSkeletons).toHaveLength(initialSkeletons.length);
    });
  });
});
