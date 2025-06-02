import type { AllUserGroupTable, TableConditions } from "@/types/group-types";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useAllUserGroupTable } from "./use-all-user-group-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const {
  mockGetAllUserGroupsAndCount,
  mockJoinGroup,
  mockSetPage,
  mockSetSortField,
  mockSetSortDirection,
  mockSetSearchQuery,
  mockSetIsJoined,
  mockSetItemPerPage,
  mockUseQuery,
  mockUseMutation,
  mockUseQueryClient,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockGetAllUserGroupsAndCount: vi.fn(),
  mockJoinGroup: vi.fn(),
  mockSetPage: vi.fn(),
  mockSetSortField: vi.fn(),
  mockSetSortDirection: vi.fn(),
  mockSetSearchQuery: vi.fn(),
  mockSetIsJoined: vi.fn(),
  mockSetItemPerPage: vi.fn(),
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUseQueryClient: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 外部依存のモック
 */
vi.mock("@/lib/actions/group/all-user-group", () => ({
  getAllUserGroupsAndCount: mockGetAllUserGroupsAndCount,
}));

vi.mock("@/lib/actions/group", () => ({
  joinGroup: mockJoinGroup,
}));

vi.mock("@/lib/constants", () => ({
  TABLE_CONSTANTS: {
    ITEMS_PER_PAGE: 50,
  },
}));

vi.mock("@/lib/tanstack-query", () => ({
  queryCacheKeys: {
    table: {
      allGroupConditions: vi.fn((conditions: unknown) => ["table", "allGroup", JSON.stringify(conditions)]),
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useQueryClient: mockUseQueryClient,
  keepPreviousData: "keepPreviousData",
}));

vi.mock("nuqs", () => ({
  useQueryState: vi.fn((key: string) => {
    const defaultValues: Record<string, unknown> = {
      page: 1,
      sort_field: "createdAt",
      sort_direction: "desc",
      q: "",
      is_joined: "all",
      item_per_page: 50,
    };

    const setters: Record<string, unknown> = {
      page: mockSetPage,
      sort_field: mockSetSortField,
      sort_direction: mockSetSortDirection,
      q: mockSetSearchQuery,
      is_joined: mockSetIsJoined,
      item_per_page: mockSetItemPerPage,
    };

    return [defaultValues[key], setters[key]];
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータファクトリー
 */
function createMockAllUserGroupTable(overrides: Partial<AllUserGroupTable> = {}): AllUserGroupTable {
  return {
    id: "group-1",
    name: "テストグループ",
    goal: "テスト目標",
    evaluationMethod: "自動評価",
    maxParticipants: 10,
    joinMembersCount: 5,
    depositPeriod: 30,
    isJoined: false,
    createdBy: "テストユーザー",
    ...overrides,
  };
}

function createMockTableConditions(overrides: Partial<TableConditions<AllUserGroupTable>> = {}): TableConditions<AllUserGroupTable> {
  return {
    sort: { field: "createdAt" as keyof AllUserGroupTable, direction: "desc" },
    page: 1,
    searchQuery: "",
    isJoined: "all",
    itemPerPage: 50,
    ...overrides,
  };
}

function createMockGetAllUserGroupsAndCountResponse(
  groups: AllUserGroupTable[] = [],
  totalCount = 0,
): { AllUserGroupList: AllUserGroupTable[]; AllUserGroupTotalCount: number } {
  return {
    AllUserGroupList: groups,
    AllUserGroupTotalCount: totalCount,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useAllUserGroupTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockGetAllUserGroupsAndCount.mockResolvedValue(createMockGetAllUserGroupsAndCountResponse());
    mockJoinGroup.mockResolvedValue({ success: true });

    // QueryClientのモック設定
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
      removeQueries: vi.fn(),
      clear: vi.fn(),
      prefetchQuery: vi.fn(),
      setQueriesData: vi.fn(),
    });

    // デフォルトのuseQueryモック設定
    mockUseQuery.mockReturnValue({
      data: createMockGetAllUserGroupsAndCountResponse(),
      isPending: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isPlaceholderData: false,
    });

    // デフォルトのuseMutationモック設定
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      reset: vi.fn(),
      data: undefined,
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should initialize with default values", async () => {
      // Arrange
      const mockGroups = [createMockAllUserGroupTable()];
      const mockResponse = createMockGetAllUserGroupsAndCountResponse(mockGroups, 1);

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.groups).toStrictEqual(mockGroups);
        expect(result.current.totalGroupCount).toBe(1);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.tableConditions).toStrictEqual(createMockTableConditions());
      });
    });

    test("should update table conditions correctly", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newConditions = createMockTableConditions({
        page: 2,
        searchQuery: "テスト検索",
        isJoined: "isJoined",
      });

      result.current.changeTableConditions(newConditions);

      // Assert
      expect(mockSetPage).toHaveBeenCalledWith(2);
      expect(mockSetSearchQuery).toHaveBeenCalledWith("テスト検索");
      expect(mockSetIsJoined).toHaveBeenCalledWith("isJoined");
    });

    test("should reset filters correctly", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.resetFilters();

      // Assert
      expect(mockSetSearchQuery).toHaveBeenCalledWith(null);
      expect(mockSetIsJoined).toHaveBeenCalledWith("all");
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    test("should reset sort correctly", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.resetSort();

      // Assert
      expect(mockSetSortField).toHaveBeenCalledWith("createdAt");
      expect(mockSetSortDirection).toHaveBeenCalledWith("desc");
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle getAllUserGroupsAndCount error", async () => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: true,
        error: new Error("データ取得エラー"),
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.groups).toStrictEqual([]);
        expect(result.current.totalGroupCount).toBe(0);
      });
    });

    test("should handle undefined data from getAllUserGroupsAndCount", async () => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.groups).toStrictEqual([]);
        expect(result.current.totalGroupCount).toBe(0);
      });
    });

    test("should handle null values in table conditions", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const conditionsWithNulls = createMockTableConditions({
        sort: null,
        searchQuery: null,
        isJoined: "all",
      });

      result.current.changeTableConditions(conditionsWithNulls);

      // Assert
      expect(mockSetSortField).toHaveBeenCalledWith(null);
      expect(mockSetSortDirection).toHaveBeenCalledWith("desc");
      expect(mockSetSearchQuery).toHaveBeenCalledWith(null);
      expect(mockSetIsJoined).toHaveBeenCalledWith("all");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty groups array", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse([], 0);

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.groups).toStrictEqual([]);
        expect(result.current.totalGroupCount).toBe(0);
        expect(result.current.isLoading).toBe(false);
      });
    });

    test("should handle large number of groups", async () => {
      // Arrange
      const largeGroupsArray = Array.from({ length: 100 }, (_, index) =>
        createMockAllUserGroupTable({
          id: `group-${index}`,
          name: `グループ${index}`,
        }),
      );
      const mockResponse = createMockGetAllUserGroupsAndCountResponse(largeGroupsArray, 100);

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.groups).toHaveLength(100);
        expect(result.current.totalGroupCount).toBe(100);
      });
    });

    test("should handle page number 0", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const conditionsWithZeroPage = createMockTableConditions({ page: 0 });
      result.current.changeTableConditions(conditionsWithZeroPage);

      // Assert
      expect(mockSetPage).toHaveBeenCalledWith(0);
    });

    test("should handle very large page number", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const conditionsWithLargePage = createMockTableConditions({ page: 999999 });
      result.current.changeTableConditions(conditionsWithLargePage);

      // Assert
      expect(mockSetPage).toHaveBeenCalledWith(999999);
    });

    test("should handle very long search query", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const longSearchQuery = "a".repeat(1000);
      const conditionsWithLongQuery = createMockTableConditions({ searchQuery: longSearchQuery });
      result.current.changeTableConditions(conditionsWithLongQuery);

      // Assert
      expect(mockSetSearchQuery).toHaveBeenCalledWith(longSearchQuery);
    });

    test("should handle itemPerPage of 1", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const conditionsWithMinItems = createMockTableConditions({ itemPerPage: 1 });
      result.current.changeTableConditions(conditionsWithMinItems);

      // Assert
      expect(mockSetItemPerPage).toHaveBeenCalledWith(1);
    });

    test("should handle very large itemPerPage", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const conditionsWithMaxItems = createMockTableConditions({ itemPerPage: 10000 });
      result.current.changeTableConditions(conditionsWithMaxItems);

      // Assert
      expect(mockSetItemPerPage).toHaveBeenCalledWith(10000);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ソート機能テスト", () => {
    test("should handle different sort fields", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const conditionsWithNameSort = createMockTableConditions({
        sort: { field: "name", direction: "asc" },
      });
      result.current.changeTableConditions(conditionsWithNameSort);

      // Assert
      expect(mockSetSortField).toHaveBeenCalledWith("name");
      expect(mockSetSortDirection).toHaveBeenCalledWith("asc");
    });

    test("should handle sort direction changes", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const conditionsWithDescSort = createMockTableConditions({
        sort: { field: "name", direction: "desc" },
      });
      result.current.changeTableConditions(conditionsWithDescSort);

      // Assert
      expect(mockSetSortField).toHaveBeenCalledWith("name");
      expect(mockSetSortDirection).toHaveBeenCalledWith("desc");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フィルター機能テスト", () => {
    test("should handle isJoined filter changes", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const conditionsWithJoinedFilter = createMockTableConditions({
        isJoined: "isJoined",
      });
      result.current.changeTableConditions(conditionsWithJoinedFilter);

      // Assert
      expect(mockSetIsJoined).toHaveBeenCalledWith("isJoined");
    });

    test("should handle notJoined filter", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const conditionsWithNotJoinedFilter = createMockTableConditions({
        isJoined: "notJoined",
      });
      result.current.changeTableConditions(conditionsWithNotJoinedFilter);

      // Assert
      expect(mockSetIsJoined).toHaveBeenCalledWith("notJoined");
    });

    test("should handle search query changes", async () => {
      // Arrange
      const mockResponse = createMockGetAllUserGroupsAndCountResponse();

      mockUseQuery.mockReturnValue({
        data: mockResponse,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isPlaceholderData: false,
      });

      // Act
      const { result } = renderHook(() => useAllUserGroupTable(), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const conditionsWithSearch = createMockTableConditions({
        searchQuery: "検索テスト",
      });
      result.current.changeTableConditions(conditionsWithSearch);

      // Assert
      expect(mockSetSearchQuery).toHaveBeenCalledWith("検索テスト");
    });
  });
});
