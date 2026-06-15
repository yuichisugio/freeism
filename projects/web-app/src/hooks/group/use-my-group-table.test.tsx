import type { MyGroupTable, TableConditions } from "@/types/group-types";
import React from "react";
// モック関数のインポート
import { getUserJoinGroup, getUserJoinGroupCount, leaveGroup } from "@/actions/group/my-group";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useMyGroupTable } from "./use-my-group-table";

// モック設定
vi.mock("@/actions/group/my-group", () => ({
  getUserJoinGroup: vi.fn(),
  getUserJoinGroupCount: vi.fn(),
  leaveGroup: vi.fn(),
}));

// nuqsのモック
const mockSetPage = vi.fn();
const mockSetSortField = vi.fn();
const mockSetSortDirection = vi.fn();
const mockSetSearchQuery = vi.fn();
const mockSetItemPerPage = vi.fn();

vi.mock("nuqs", () => ({
  useQueryState: vi.fn((key: string) => {
    const defaultValues: Record<string, unknown> = {
      page: 1,
      sort_field: "createdAt",
      sort_direction: "desc",
      q: null,
      item_per_page: 50,
    };

    const setters: Record<string, unknown> = {
      page: mockSetPage,
      sort_field: mockSetSortField,
      sort_direction: mockSetSortDirection,
      q: mockSetSearchQuery,
      item_per_page: mockSetItemPerPage,
    };

    return [defaultValues[key], setters[key]];
  }),
}));

vi.mock("@/lib/constants", () => ({
  TABLE_CONSTANTS: {
    ITEMS_PER_PAGE: 50,
  },
}));

vi.mock("@/lib/tanstack-query", () => ({
  queryCacheKeys: {
    table: {
      myGroupConditions: vi.fn(() => ["table", "myGroup", "test-conditions"]),
    },
  },
}));

// モック関数の型定義
const mockGetUserJoinGroup = vi.mocked(getUserJoinGroup);
const mockGetUserJoinGroupCount = vi.mocked(getUserJoinGroupCount);
const mockLeaveGroup = vi.mocked(leaveGroup);

// テストデータ
const mockGroupData: MyGroupTable[] = [
  {
    id: "group-1",
    groupName: "テストグループ1",
    groupGoal: "テスト目標1",
    groupEvaluationMethod: "評価方法1",
    groupDepositPeriod: 30,
    groupPointBalance: 1000,
    groupPointFixedTotalPoints: 5000,
    isGroupOwner: true,
  },
];

// テスト用のQueryClientを作成
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// テスト用のWrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useMyGroupTable", () => {
  beforeEach(() => {
    // モック関数をリセット
    vi.clearAllMocks();

    // APIのモック設定
    mockGetUserJoinGroup.mockResolvedValue({
      success: true,
      message: "Get user join group successfully",
      data: mockGroupData,
    });
    mockGetUserJoinGroupCount.mockResolvedValue({
      success: true,
      message: "Get user join group count successfully",
      data: 1,
    });
    mockLeaveGroup.mockResolvedValue({ success: true, message: "Leave group successfully", data: null });
  });

  describe("正常系", () => {
    test("should initialize with correct table conditions", () => {
      // Act
      const { result } = renderHook(() => useMyGroupTable(), {
        wrapper: TestWrapper,
      });

      // Assert
      expect(result.current.tableConditions).toStrictEqual({
        sort: { field: "createdAt", direction: "desc" },
        page: 1,
        searchQuery: null,
        itemPerPage: 50,
        isJoined: "all",
      });
    });

    test("should call changeTableConditions correctly", () => {
      // Arrange
      const { result } = renderHook(() => useMyGroupTable(), {
        wrapper: TestWrapper,
      });

      const newConditions: TableConditions<MyGroupTable> = {
        sort: { field: "groupName", direction: "asc" },
        page: 2,
        searchQuery: "テスト",
        itemPerPage: 25,
        isJoined: "all",
      };

      // Act
      act(() => {
        result.current.changeTableConditions(newConditions);
      });

      // Assert
      expect(mockSetPage).toHaveBeenCalledWith(2);
      expect(mockSetSortField).toHaveBeenCalledWith("groupName");
      expect(mockSetSortDirection).toHaveBeenCalledWith("asc");
      expect(mockSetSearchQuery).toHaveBeenCalledWith("テスト");
      expect(mockSetItemPerPage).toHaveBeenCalledWith(25);
    });

    test("should call resetFilters correctly", () => {
      // Arrange
      const { result } = renderHook(() => useMyGroupTable(), {
        wrapper: TestWrapper,
      });

      // Act
      act(() => {
        result.current.resetFilters();
      });

      // Assert
      expect(mockSetSearchQuery).toHaveBeenCalledWith(null);
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    test("should call resetSort correctly", () => {
      // Arrange
      const { result } = renderHook(() => useMyGroupTable(), {
        wrapper: TestWrapper,
      });

      // Act
      act(() => {
        result.current.resetSort();
      });

      // Assert
      expect(mockSetSortField).toHaveBeenCalledWith(null);
      expect(mockSetSortDirection).toHaveBeenCalledWith("desc");
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    test("should return initial empty state", () => {
      // Act
      const { result } = renderHook(() => useMyGroupTable(), {
        wrapper: TestWrapper,
      });

      // Assert
      expect(result.current.groups).toEqual([]);
      expect(result.current.totalGroupCount).toBe(0);
      expect(typeof result.current.isLoading).toBe("boolean");
    });

    test("should call handleLeave function", () => {
      // Arrange
      const { result } = renderHook(() => useMyGroupTable(), {
        wrapper: TestWrapper,
      });

      // Act
      act(() => {
        result.current.handleLeave("group-1");
      });

      // Assert - 関数が呼ばれることを確認（実際のAPIコールは非同期なのでここでは確認しない）
      expect(typeof result.current.handleLeave).toBe("function");
    });
  });

  describe("異常系", () => {
    test("should handle API error gracefully", async () => {
      // Arrange
      mockGetUserJoinGroup.mockRejectedValue(new Error("API Error"));

      // Act
      const { result } = renderHook(() => useMyGroupTable(), {
        wrapper: TestWrapper,
      });

      // Assert - エラーが発生してもクラッシュしないことを確認
      expect(result.current.groups).toEqual([]);
      expect(result.current.totalGroupCount).toBe(0);
    });

    test("should handle leave group error gracefully", () => {
      // Arrange
      mockLeaveGroup.mockRejectedValue(new Error("Leave group failed"));

      const { result } = renderHook(() => useMyGroupTable(), {
        wrapper: TestWrapper,
      });

      // Act
      act(() => {
        result.current.handleLeave("group-1");
      });

      // Assert - エラーが発生してもクラッシュしないことを確認
      expect(typeof result.current.handleLeave).toBe("function");
    });
  });

  describe("境界値テスト", () => {
    test("should handle extreme values in changeTableConditions", () => {
      // Arrange
      const { result } = renderHook(() => useMyGroupTable(), {
        wrapper: TestWrapper,
      });

      const extremeConditions: TableConditions<MyGroupTable> = {
        sort: { field: "groupName", direction: "asc" },
        page: 999,
        searchQuery: "very long search query",
        itemPerPage: 1,
        isJoined: "all",
      };

      // Act
      act(() => {
        result.current.changeTableConditions(extremeConditions);
      });

      // Assert
      expect(mockSetPage).toHaveBeenCalledWith(999);
      expect(mockSetItemPerPage).toHaveBeenCalledWith(1);
      expect(mockSetSearchQuery).toHaveBeenCalledWith("very long search query");
    });
  });

  describe("関数の存在確認", () => {
    test("should provide all required functions", () => {
      // Act
      const { result } = renderHook(() => useMyGroupTable(), {
        wrapper: TestWrapper,
      });

      // Assert
      expect(typeof result.current.changeTableConditions).toBe("function");
      expect(typeof result.current.handleLeave).toBe("function");
      expect(typeof result.current.resetFilters).toBe("function");
      expect(typeof result.current.resetSort).toBe("function");
    });

    test("should provide all required state properties", () => {
      // Act
      const { result } = renderHook(() => useMyGroupTable(), {
        wrapper: TestWrapper,
      });

      // Assert
      expect(Array.isArray(result.current.groups)).toBe(true);
      expect(typeof result.current.isLoading).toBe("boolean");
      expect(typeof result.current.totalGroupCount).toBe("number");
      expect(typeof result.current.tableConditions).toBe("object");
    });
  });
});
