import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { MyGroupTableComponent } from "./my-group-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック関数
const mockChangeTableConditions = vi.fn();
const mockHandleLeave = vi.fn();
const mockResetFilters = vi.fn();
const mockResetSort = vi.fn();

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// モック設定
vi.mock("@/hooks/group/use-my-group-table", () => ({
  useMyGroupTable: vi.fn(() => ({
    groups: [],
    tableConditions: {
      sort: { field: "groupName", direction: "desc" },
      page: 1,
      searchQuery: "",
      isJoined: "all",
      itemPerPage: 50,
    },
    isLoading: false,
    totalGroupCount: 0,
    changeTableConditions: mockChangeTableConditions,
    handleLeave: mockHandleLeave,
    resetFilters: mockResetFilters,
    resetSort: mockResetSort,
  })),
}));

vi.mock("@/components/share/share-loading", () => ({
  Loading: () => <div data-testid="loading">Loading...</div>,
}));

vi.mock("@/components/share/table/share-table", () => ({
  ShareTable: () => <div data-testid="share-table">ShareTable</div>,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("MyGroupTableComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    test("should render component without crashing", () => {
      // Act
      render(<MyGroupTableComponent />);

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
    });

    test("should not show loading overlay when not loading", () => {
      // Act
      render(<MyGroupTableComponent />);

      // Assert
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
    });
  });

  describe("異常系", () => {
    test("should handle empty groups gracefully", () => {
      // Arrange - 空のグループデータのモックを設定（デフォルトと同じなので特に設定不要）

      // Act
      render(<MyGroupTableComponent />);

      // Assert
      expect(screen.getByTestId("share-table")).toBeInTheDocument();
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
    });
  });
});
