"use client";

import type { GroupDetailTableConditions, GroupDetailTask, TaskParticipant } from "@/types/group-types";
import type { UseQueryOptions } from "@tanstack/react-query";
import { AllTheProviders, mockUseMutation, mockUseQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { groupDetailTaskFactory, taskParticipantFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { ContributionType, TaskStatus } from "@prisma/client";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Factory } from "fishery";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useGroupDetailTable } from "./use-group-detail-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const {
  mockPush,
  mockRefresh,
  mockRedirect,
  mockSetPage,
  mockSetSortField,
  mockSetSortDirection,
  mockSetSearchQuery,
  mockSetContributionType,
  mockSetStatus,
  mockSetItemPerPage,
  mockGetGroupTaskAndCount,
  mockDeleteTask,
  mockGetAllUsers,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockRedirect: vi.fn(),
  mockSetPage: vi.fn(),
  mockSetSortField: vi.fn(),
  mockSetSortDirection: vi.fn(),
  mockSetSearchQuery: vi.fn(),
  mockSetContributionType: vi.fn(),
  mockSetStatus: vi.fn(),
  mockSetItemPerPage: vi.fn(),
  mockGetGroupTaskAndCount: vi.fn(),
  mockDeleteTask: vi.fn(),
  mockGetAllUsers: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// Next.js navigation のモック
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  redirect: mockRedirect,
}));

// nuqsのモック
vi.mock("nuqs", () => ({
  useQueryState: (key: string, options?: { defaultValue?: unknown }) => {
    const mockSetters = {
      page: mockSetPage,
      sort_field: mockSetSortField,
      sort_direction: mockSetSortDirection,
      q: mockSetSearchQuery,
      contribution_type: mockSetContributionType,
      status: mockSetStatus,
      item_per_page: mockSetItemPerPage,
    };
    return [options?.defaultValue, mockSetters[key as keyof typeof mockSetters] || vi.fn()];
  },
}));

// アクション関数のモック
vi.mock("@/lib/actions/task/group-detail-table", () => ({
  getGroupTaskAndCount: mockGetGroupTaskAndCount,
}));

vi.mock("@/lib/actions/task/task", () => ({
  deleteTask: mockDeleteTask,
}));

vi.mock("@/lib/actions/user", () => ({
  getAllUsers: mockGetAllUsers,
}));

// Sonnerのモック
vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

// TanStack Queryのキャッシュキーのモック
vi.mock("@/lib/tanstack-query", () => ({
  queryCacheKeys: {
    tasks: {
      byGroupIdWithConditions: vi.fn((groupId: string, conditions: unknown) => [
        "tasks",
        "byGroupIdWithConditions",
        groupId,
        JSON.stringify(conditions),
      ]),
      byGroupId: vi.fn((groupId: string) => ["tasks", "byGroupId", groupId]),
    },
    users: {
      all: vi.fn(() => ["users", "all"]),
    },
  },
}));

// TABLE_CONSTANTSのモック
vi.mock("@/lib/constants", () => ({
  TABLE_CONSTANTS: {
    ITEMS_PER_PAGE: 16,
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成用のファクトリー
 */

// GetGroupTaskAndCountResponseのファクトリー
const getGroupTaskAndCountResponseFactory = Factory.define<{
  returnTasks: GroupDetailTask[];
  totalTaskCount: number;
}>(({ params }) => ({
  returnTasks: params.returnTasks ?? [],
  totalTaskCount: params.totalTaskCount ?? 0,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */

const testGroupId = "test-group-id";
const testUserId = "test-user-id";

const createTestGroupDetailTask = (overrides: Partial<GroupDetailTask> = {}): GroupDetailTask => {
  return groupDetailTaskFactory.build(overrides);
};

const createTestTaskParticipant = (overrides: Partial<TaskParticipant> = {}): TaskParticipant => {
  return taskParticipantFactory.build(overrides);
};

const createTestGetGroupTaskAndCountResponse = (tasks: GroupDetailTask[] = [], totalCount = 0) => {
  return getGroupTaskAndCountResponseFactory.build({
    returnTasks: tasks,
    totalTaskCount: totalCount,
  });
};

const createTestTableConditions = (overrides: Partial<GroupDetailTableConditions> = {}): GroupDetailTableConditions => {
  return {
    sort: { field: "createdAt", direction: "desc" },
    page: 1,
    searchQuery: "",
    contributionType: "ALL",
    status: "ALL",
    itemPerPage: 16,
    isJoined: "all",
    ...overrides,
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useGroupDetailTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのセッション設定
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        user: {
          id: testUserId,
          email: "test@example.com",
          name: "Test User",
        },
      },
      status: "authenticated",
    });

    // デフォルトのuseQueryモック設定
    mockUseQuery.mockImplementation((options: UseQueryOptions) => {
      if (options.queryKey[0] === "tasks") {
        return {
          data: createTestGetGroupTaskAndCountResponse(),
          isPending: false,
          isPlaceholderData: false,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (options.queryKey[0] === "users") {
        return {
          data: [],
          isPending: false,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      return {
        data: undefined,
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    // デフォルトのuseMutationモック設定
    mockUseMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true }),
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      reset: vi.fn(),
      data: undefined,
      mutate: vi.fn(),
    });

    // デフォルトのuseQueryClientモック設定
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
      removeQueries: vi.fn(),
      clear: vi.fn(),
      prefetchQuery: vi.fn(),
      setQueriesData: vi.fn(),
    });
  });

  describe("正常系", () => {
    test("should initialize with default values", () => {
      // Act
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isLoading).toBe(false);
      expect(result.current.tasks).toStrictEqual([]);
      expect(result.current.users).toStrictEqual([]);
      expect(result.current.totalTaskCount).toBe(0);
      expect(result.current.editingTaskId).toBe(null);
      expect(result.current.isTaskEditModalOpen).toBe(false);
      expect(typeof result.current.handleDeleteTask).toBe("function");
      expect(typeof result.current.canDeleteTask).toBe("function");
      expect(typeof result.current.canEditTask).toBe("function");
      expect(typeof result.current.handleTaskEdited).toBe("function");
      expect(typeof result.current.openTaskEditModal).toBe("function");
      expect(typeof result.current.closeTaskEditModal).toBe("function");
      expect(typeof result.current.changeTableConditions).toBe("function");
      expect(typeof result.current.resetFilters).toBe("function");
      expect(typeof result.current.resetSort).toBe("function");
    });

    test("should return tasks and users data correctly", () => {
      // Arrange
      const testTasks = [createTestGroupDetailTask(), createTestGroupDetailTask()];
      const testUsers = [createTestTaskParticipant(), createTestTaskParticipant()];

      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (options.queryKey[0] === "tasks") {
          return {
            data: createTestGetGroupTaskAndCountResponse(testTasks, 2),
            isPending: false,
            isPlaceholderData: false,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        if (options.queryKey[0] === "users") {
          return {
            data: testUsers,
            isPending: false,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: undefined,
          isPending: false,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      // Act
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.tasks).toStrictEqual(testTasks);
      expect(result.current.users).toStrictEqual(testUsers);
      expect(result.current.totalTaskCount).toBe(2);
    });

    test("should handle table conditions changes correctly", () => {
      // Arrange
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      const newConditions = createTestTableConditions({
        page: 2,
        searchQuery: "test query",
        contributionType: ContributionType.REWARD,
        status: TaskStatus.PENDING,
        itemPerPage: 20,
      });

      // Act
      act(() => {
        result.current.changeTableConditions(newConditions);
      });

      // Assert
      expect(mockSetPage).toHaveBeenCalledWith(2);
      expect(mockSetSearchQuery).toHaveBeenCalledWith("test query");
      expect(mockSetContributionType).toHaveBeenCalledWith(ContributionType.REWARD);
      expect(mockSetStatus).toHaveBeenCalledWith(TaskStatus.PENDING);
      expect(mockSetItemPerPage).toHaveBeenCalledWith(20);
    });

    test("should handle task deletion successfully", async () => {
      // Arrange
      const mockMutateAsync = vi.fn().mockResolvedValue({ success: true });
      const mockInvalidateQueries = vi.fn();
      let onSuccessCallback: (() => Promise<void>) | undefined;

      mockUseMutation.mockImplementation((options: { onSuccess?: () => Promise<void> }) => {
        onSuccessCallback = options.onSuccess;
        return {
          mutateAsync: mockMutateAsync,
          isPending: false,
          isLoading: false,
          isError: false,
          error: null,
          reset: vi.fn(),
          data: undefined,
          mutate: vi.fn(),
        };
      });

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: mockInvalidateQueries,
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Act
      await waitFor(async () => {
        await act(async () => {
          result.current.handleDeleteTask("test-task-id");
          // onSuccessコールバックを手動で呼び出す
          if (onSuccessCallback) {
            await onSuccessCallback();
          }
        });
      });

      // Assert
      expect(mockMutateAsync).toHaveBeenCalledWith("test-task-id");
      expect(mockToastSuccess).toHaveBeenCalledWith("タスクを削除しました");
      expect(mockInvalidateQueries).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });

    test("should open and close task edit modal correctly", () => {
      // Arrange
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      const testTask = createTestGroupDetailTask({ id: "test-task-id" });

      // Act - Open modal
      act(() => {
        result.current.openTaskEditModal(testTask);
      });

      // Assert - Modal opened
      expect(result.current.isTaskEditModalOpen).toBe(true);
      expect(result.current.editingTaskId).toBe("test-task-id");

      // Act - Close modal
      act(() => {
        result.current.closeTaskEditModal();
      });

      // Assert - Modal closed
      expect(result.current.isTaskEditModalOpen).toBe(false);
      expect(result.current.editingTaskId).toBe(null);
    });

    test("should reset filters correctly", () => {
      // Arrange
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.resetFilters();
      });

      // Assert
      expect(mockSetSearchQuery).toHaveBeenCalledWith(null);
      expect(mockSetContributionType).toHaveBeenCalledWith("ALL");
      expect(mockSetStatus).toHaveBeenCalledWith("ALL");
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    test("should reset sort correctly", () => {
      // Arrange
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Act
      act(() => {
        result.current.resetSort();
      });

      // Assert
      expect(mockSetSortField).toHaveBeenCalledWith("createdAt");
      expect(mockSetSortDirection).toHaveBeenCalledWith("desc");
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });
  });

  describe("権限チェック", () => {
    test("should allow owner to delete any task with PENDING status", () => {
      // Arrange
      const testTask = createTestGroupDetailTask({
        taskStatus: TaskStatus.PENDING,
        taskContributionType: ContributionType.NON_REWARD,
        taskReporterUserIds: ["other-user"],
        taskExecutorUserIds: ["other-user"],
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      expect(result.current.canDeleteTask(testTask)).toBe(true);
    });

    test("should allow reporter to delete their task with PENDING status", () => {
      // Arrange
      const testTask = createTestGroupDetailTask({
        taskStatus: TaskStatus.PENDING,
        taskContributionType: ContributionType.NON_REWARD,
        taskReporterUserIds: [testUserId],
        taskExecutorUserIds: ["other-user"],
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: false }), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      expect(result.current.canDeleteTask(testTask)).toBe(true);
    });

    test("should allow executor to delete their task with PENDING status", () => {
      // Arrange
      const testTask = createTestGroupDetailTask({
        taskStatus: TaskStatus.PENDING,
        taskContributionType: ContributionType.NON_REWARD,
        taskReporterUserIds: ["other-user"],
        taskExecutorUserIds: [testUserId],
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: false }), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      expect(result.current.canDeleteTask(testTask)).toBe(true);
    });

    test("should not allow non-owner/non-reporter/non-executor to delete task", () => {
      // Arrange
      const testTask = createTestGroupDetailTask({
        taskStatus: TaskStatus.PENDING,
        taskContributionType: ContributionType.NON_REWARD,
        taskReporterUserIds: ["other-user"],
        taskExecutorUserIds: ["other-user"],
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: false }), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      expect(result.current.canDeleteTask(testTask)).toBe(false);
    });

    test("should not allow deletion of task with non-PENDING status", () => {
      // Arrange
      const testTask = createTestGroupDetailTask({
        taskStatus: TaskStatus.FIXED_EVALUATED,
        taskContributionType: ContributionType.NON_REWARD,
        taskReporterUserIds: [testUserId],
        taskExecutorUserIds: [testUserId],
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      expect(result.current.canDeleteTask(testTask)).toBe(false);
    });

    test("should allow editing task with valid status and permissions", () => {
      // Arrange
      const testTask = createTestGroupDetailTask({
        taskStatus: TaskStatus.PENDING,
        taskReporterUserIds: [testUserId],
        taskExecutorUserIds: ["other-user"],
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: false }), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      expect(result.current.canEditTask(testTask)).toBe(true);
    });

    test("should not allow editing task with immutable status", () => {
      // Arrange
      const testTask = createTestGroupDetailTask({
        taskStatus: TaskStatus.FIXED_EVALUATED,
        taskReporterUserIds: [testUserId],
        taskExecutorUserIds: [testUserId],
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      expect(result.current.canEditTask(testTask)).toBe(false);
    });
  });

  describe("異常系", () => {
    test("should handle task deletion error", async () => {
      // Arrange
      const mockMutateAsync = vi.fn().mockRejectedValue(new Error("削除エラー"));
      let onErrorCallback: ((error: Error) => void) | undefined;

      mockUseMutation.mockImplementation((options: { onError?: (error: Error) => void }) => {
        onErrorCallback = options.onError;
        return {
          mutateAsync: mockMutateAsync,
          isPending: false,
          isLoading: false,
          isError: false,
          error: null,
          reset: vi.fn(),
          data: undefined,
          mutate: vi.fn(),
        };
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Act
      await waitFor(async () => {
        await act(async () => {
          result.current.handleDeleteTask("test-task-id");
          // onErrorコールバックを手動で呼び出す
          if (onErrorCallback) {
            onErrorCallback(new Error("削除エラー"));
          }
        });
      });

      // Assert
      expect(mockMutateAsync).toHaveBeenCalledWith("test-task-id");
      expect(mockToastError).toHaveBeenCalledWith("タスクの削除中にエラーが発生しました");
    });

    test("should handle loading states correctly", () => {
      // Arrange
      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (options.queryKey[0] === "tasks") {
          return {
            data: undefined,
            isPending: true,
            isPlaceholderData: false,
            isLoading: true,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        if (options.queryKey[0] === "users") {
          return {
            data: undefined,
            isPending: true,
            isLoading: true,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: undefined,
          isPending: true,
          isLoading: true,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      // Act
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isLoading).toBe(true);
    });

    test("should handle mutation pending state", () => {
      // Arrange
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: true,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
        mutate: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isLoading).toBe(true);
    });

    test("should handle placeholder data state", () => {
      // Arrange
      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (options.queryKey[0] === "tasks") {
          return {
            data: createTestGetGroupTaskAndCountResponse(),
            isPending: false,
            isPlaceholderData: true,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: undefined,
          isPending: false,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      // Act
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isLoading).toBe(true);
    });

    test("should handle empty task arrays", () => {
      // Arrange
      const testTask = createTestGroupDetailTask({
        taskReporterUserIds: [],
        taskExecutorUserIds: [],
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: false }), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      expect(result.current.canDeleteTask(testTask)).toBe(false);
      expect(result.current.canEditTask(testTask)).toBe(false);
    });

    test("should handle null taskId in handleDeleteTask", async () => {
      // Arrange
      const mockMutateAsync = vi.fn().mockResolvedValue({ success: true });
      mockUseMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });
      const nullTaskId = null as unknown as string;

      // Act
      await waitFor(async () => {
        await act(async () => {
          result.current.handleDeleteTask(nullTaskId);
        });
      });

      // Assert
      expect(mockMutateAsync).toHaveBeenCalledWith(null);
    });

    test("should handle undefined taskId in handleDeleteTask", async () => {
      // Arrange
      const mockMutateAsync = vi.fn().mockResolvedValue({ success: true });
      mockUseMutation.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });
      const undefinedTaskId = undefined as unknown as string;

      // Act
      await waitFor(async () => {
        await act(async () => {
          result.current.handleDeleteTask(undefinedTaskId);
        });
      });

      // Assert
      expect(mockMutateAsync).toHaveBeenCalledWith(undefined);
    });
  });

  describe("境界値テスト", () => {
    test("should handle very long search query", () => {
      // Arrange
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      const longSearchQuery = "a".repeat(1000);
      const conditionsWithLongQuery = createTestTableConditions({ searchQuery: longSearchQuery });

      // Act
      act(() => {
        result.current.changeTableConditions(conditionsWithLongQuery);
      });

      // Assert
      expect(mockSetSearchQuery).toHaveBeenCalledWith(longSearchQuery);
    });

    test("should handle itemPerPage of 1", () => {
      // Arrange
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      const conditionsWithMinItems = createTestTableConditions({ itemPerPage: 1 });

      // Act
      act(() => {
        result.current.changeTableConditions(conditionsWithMinItems);
      });

      // Assert
      expect(mockSetItemPerPage).toHaveBeenCalledWith(1);
    });

    test("should handle very large itemPerPage", () => {
      // Arrange
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      const conditionsWithLargeItems = createTestTableConditions({ itemPerPage: 10000 });

      // Act
      act(() => {
        result.current.changeTableConditions(conditionsWithLargeItems);
      });

      // Assert
      expect(mockSetItemPerPage).toHaveBeenCalledWith(10000);
    });

    test("should handle page number 0", () => {
      // Arrange
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      const conditionsWithZeroPage = createTestTableConditions({ page: 0 });

      // Act
      act(() => {
        result.current.changeTableConditions(conditionsWithZeroPage);
      });

      // Assert
      expect(mockSetPage).toHaveBeenCalledWith(0);
    });

    test("should handle very large page number", () => {
      // Arrange
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      const conditionsWithLargePage = createTestTableConditions({ page: 999999 });

      // Act
      act(() => {
        result.current.changeTableConditions(conditionsWithLargePage);
      });

      // Assert
      expect(mockSetPage).toHaveBeenCalledWith(999999);
    });

    test("should handle null values in table conditions", () => {
      // Arrange
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      const conditionsWithNulls = createTestTableConditions({
        searchQuery: null,
        sort: null,
      });

      // Act
      act(() => {
        result.current.changeTableConditions(conditionsWithNulls);
      });

      // Assert
      expect(mockSetSearchQuery).toHaveBeenCalledWith(null);
      expect(mockSetSortField).toHaveBeenCalledWith(null);
    });

    test("should handle empty string search query", () => {
      // Arrange
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      const conditionsWithEmptyQuery = createTestTableConditions({ searchQuery: "" });

      // Act
      act(() => {
        result.current.changeTableConditions(conditionsWithEmptyQuery);
      });

      // Assert
      expect(mockSetSearchQuery).toHaveBeenCalledWith("");
    });

    test("should handle task with null user arrays", () => {
      // Arrange
      const testTask = createTestGroupDetailTask({
        taskReporterUserIds: null,
        taskExecutorUserIds: null,
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: false }), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      expect(result.current.canDeleteTask(testTask)).toBe(false);
      expect(result.current.canEditTask(testTask)).toBe(false);
    });

    test("should handle task with undefined user arrays", () => {
      // Arrange
      const testTask = createTestGroupDetailTask({
        taskReporterUserIds: undefined as unknown as string[] | null,
        taskExecutorUserIds: undefined as unknown as string[] | null,
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: false }), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      expect(result.current.canDeleteTask(testTask)).toBe(false);
      expect(result.current.canEditTask(testTask)).toBe(false);
    });
  });

  describe("セッション関連", () => {
    test("should handle unauthenticated session", () => {
      // Arrange
      (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      // Act
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Assert - フックは動作するが、権限チェックで制限される
      expect(result.current.isLoading).toBe(false);
      expect(result.current.tasks).toStrictEqual([]);
    });

    test("should handle session without user id", () => {
      // Arrange
      (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
        data: {
          user: {
            email: "test@example.com",
            name: "Test User",
          },
        },
        status: "authenticated",
      });

      // Act
      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // Assert - フックは動作するが、権限チェックで制限される
      expect(result.current.isLoading).toBe(false);
      expect(result.current.tasks).toStrictEqual([]);
    });
  });

  describe("handleTaskEdited", () => {
    test("should handle task edited successfully", () => {
      // Arrange
      const mockInvalidateQueries = vi.fn();

      mockUseQueryClient.mockReturnValue({
        invalidateQueries: mockInvalidateQueries,
        setQueryData: vi.fn(),
        getQueryData: vi.fn(),
        removeQueries: vi.fn(),
        clear: vi.fn(),
        prefetchQuery: vi.fn(),
        setQueriesData: vi.fn(),
      });

      const { result } = renderHook(() => useGroupDetailTable({ groupId: testGroupId, isOwner: true }), {
        wrapper: AllTheProviders,
      });

      // 先にモーダルを開く
      const testTask = createTestGroupDetailTask({ id: "test-task-id" });
      act(() => {
        result.current.openTaskEditModal(testTask);
      });

      // Act
      act(() => {
        result.current.handleTaskEdited();
      });

      // Assert
      expect(mockInvalidateQueries).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("タスクデータを更新しました");
      expect(mockRefresh).toHaveBeenCalled();
      expect(result.current.isTaskEditModalOpen).toBe(false);
      expect(result.current.editingTaskId).toBe(null);
    });
  });
});
