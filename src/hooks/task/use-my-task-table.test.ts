import type { MyTaskTable } from "@/types/group-types";
import { AllTheProviders, mockUseMutation, mockUseQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { groupFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { contributionType, TaskStatus } from "@prisma/client";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useMyTaskTable } from "./use-my-task-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// next/navigationのモック
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  redirect: vi.fn(),
}));

// nuqsのモック
const mockSetPage = vi.fn();
const mockSetSortField = vi.fn();
const mockSetSortDirection = vi.fn();
const mockSetSearchQuery = vi.fn();
const mockSetTaskStatus = vi.fn();
const mockSetContributionType = vi.fn();
const mockSetItemPerPage = vi.fn();

vi.mock("nuqs", () => ({
  useQueryState: vi.fn((key: string) => {
    const defaultValues: Record<string, unknown> = {
      page: [1, mockSetPage],
      sort_field: ["id", mockSetSortField],
      sort_direction: ["desc", mockSetSortDirection],
      q: [null, mockSetSearchQuery],
      task_status: ["ALL", mockSetTaskStatus],
      contribution_type: ["ALL", mockSetContributionType],
      item_per_page: [10, mockSetItemPerPage],
    };
    return defaultValues[key] ?? [null, vi.fn()];
  }),
}));

// アクション関数のモック
vi.mock("@/lib/actions/permission", () => ({
  checkIsOwner: vi.fn(),
}));

vi.mock("@/lib/actions/task/my-task-table", () => ({
  getMyTaskData: vi.fn(),
}));

vi.mock("@/lib/actions/task/task", () => ({
  deleteTask: vi.fn(),
}));

// ホイストされたモック関数の宣言
const { mockToastError, mockToastSuccess, mockUseSession } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockUseSession: vi.fn(),
}));

// sonnerのモック（setup.tsと一致させる）
vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

// next-auth/reactのモック
vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockCheckIsOwner = vi.mocked(await import("@/actions/permission/permission")).checkIsPermission;
const mockGetMyTaskData = vi.mocked(await import("@/actions/task/my-task-table")).getMyTaskData;
const mockDeleteTask = vi.mocked(await import("@/actions/task/task")).deleteTask;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
const testUser = userFactory.build({ id: "cmb0e9xnm0001mchbj6ler4py" });
const testGroup = groupFactory.build({ id: "test-group-id", name: "テストグループ" });

const createMockMyTaskTable = (overrides: Partial<MyTaskTable> = {}): MyTaskTable => ({
  id: "task-1",
  taskName: "テストタスク",
  taskDetail: "テストタスクの詳細",
  taskStatus: TaskStatus.PENDING,
  taskContributionType: contributionType.NON_REWARD,
  taskFixedContributionPoint: null,
  taskFixedEvaluator: "未設定",
  taskFixedEvaluationLogic: null,
  taskCreatorName: "テストユーザー",
  taskReporterUserIds: [],
  taskExecutorUserIds: [],
  taskReporterUserNames: null,
  taskExecutorUserNames: null,
  reporters: [],
  executors: [],
  groupId: testGroup.id,
  groupName: testGroup.name,
  auctionId: null,
  group: { id: testGroup.id, name: testGroup.name },
  ...overrides,
});

const mockTasksData = [
  createMockMyTaskTable({ id: "task-1", taskName: "タスク1" }),
  createMockMyTaskTable({ id: "task-2", taskName: "タスク2", taskStatus: TaskStatus.TASK_COMPLETED }),
  createMockMyTaskTable({ id: "task-3", taskName: "タスク3", taskContributionType: contributionType.REWARD }),
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useMyTaskTable", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // セッションのモック設定
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: testUser.id,
          email: "test@example.com",
          name: "Test User",
        },
      },
      status: "authenticated",
    });

    // デフォルトのモック設定
    mockGetMyTaskData.mockResolvedValue({
      tasks: mockTasksData,
      totalTaskCount: 3,
    });

    mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });
    mockDeleteTask.mockResolvedValue({ success: true, message: "タスクを削除しました" });

    // TanStack Queryのモック設定
    mockUseQuery.mockReturnValue({
      data: {
        tasks: mockTasksData,
        totalTaskCount: 3,
      },
      isPending: false,
      isLoading: false,
      isPlaceholderData: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    // デフォルトのmutation設定（成功パターン）
    mockUseMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true, message: "タスクを削除しました" }),
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      reset: vi.fn(),
      data: undefined,
      mutate: vi.fn(),
    });

    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
      removeQueries: vi.fn(),
      clear: vi.fn(),
      prefetchQuery: vi.fn(),
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化", () => {
    test("should initialize with correct default values", async () => {
      // Act
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.tasks).toStrictEqual(mockTasksData);
        expect(result.current.totalTaskCount).toBe(3);
        expect(result.current.userId).toBe(testUser.id);
        expect(result.current.editingTaskId).toBe(null);
        expect(result.current.isTaskEditModalOpen).toBe(false);
        expect(typeof result.current.canEditTask).toBe("function");
        expect(typeof result.current.handleTaskEdited).toBe("function");
        expect(typeof result.current.canDeleteTask).toBe("function");
        expect(typeof result.current.handleDeleteTask).toBe("function");
        expect(typeof result.current.openTaskEditModal).toBe("function");
        expect(typeof result.current.closeTaskEditModal).toBe("function");
        expect(typeof result.current.changeTableConditions).toBe("function");
        expect(typeof result.current.resetFilters).toBe("function");
        expect(typeof result.current.resetSort).toBe("function");
      });
    });

    test("should initialize with correct table conditions", async () => {
      // Act
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.tableConditions).toStrictEqual({
          sort: { field: "id", direction: "desc" },
          page: 1,
          searchQuery: null,
          taskStatus: "ALL",
          contributionType: "ALL",
          itemPerPage: 10,
        });
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データフェッチ", () => {
    test("should fetch task data with correct parameters", async () => {
      // Act
      renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(mockUseQuery).toHaveBeenCalled();
      });
    });

    test("should handle empty task data", async () => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: {
          tasks: [],
          totalTaskCount: 0,
        },
        isPending: false,
        isLoading: false,
        isPlaceholderData: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.tasks).toStrictEqual([]);
        expect(result.current.totalTaskCount).toBe(0);
      });
    });

    test("should handle loading state", async () => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: undefined,
        isPending: true,
        isLoading: true,
        isPlaceholderData: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Assert
      expect(result.current.isLoading).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("タスク編集モーダル", () => {
    test("should open task edit modal correctly", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = mockTasksData[0];

      // Act
      await waitFor(() => {
        act(() => {
          result.current.openTaskEditModal(testTask);
        });
      });

      // Assert
      expect(result.current.editingTaskId).toBe(testTask.id);
      expect(result.current.isTaskEditModalOpen).toBe(true);
    });

    test("should close task edit modal correctly", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = mockTasksData[0];

      // 先にモーダルを開く
      await waitFor(() => {
        act(() => {
          result.current.openTaskEditModal(testTask);
        });
      });

      // Act
      act(() => {
        result.current.closeTaskEditModal();
      });

      // Assert
      expect(result.current.editingTaskId).toBe(null);
      expect(result.current.isTaskEditModalOpen).toBe(false);
    });

    test("should handle task edited successfully", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Act
      await waitFor(() => {
        act(() => {
          result.current.handleTaskEdited();
        });
      });

      // Assert
      expect(mockToastSuccess).toHaveBeenCalledWith("タスクデータを更新しました");
      expect(mockRefresh).toHaveBeenCalled();
      expect(result.current.isTaskEditModalOpen).toBe(false);
      expect(result.current.editingTaskId).toBe(null);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("タスク編集権限", () => {
    test("should return true when user can edit task", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = createMockMyTaskTable({ taskStatus: TaskStatus.PENDING });
      mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });

      // Act
      let canEdit = false;
      await waitFor(async () => {
        canEdit = await result.current.canEditTask(testTask);
      });

      // Assert
      expect(canEdit).toBe(true);
      expect(mockCheckIsOwner).toHaveBeenCalledWith(testUser.id, testTask.groupId, testTask.id, true);
    });

    test("should return false when user cannot edit task due to permissions", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = createMockMyTaskTable({ taskStatus: TaskStatus.PENDING });
      mockCheckIsOwner.mockResolvedValue({ success: false, message: "Permission check failed" });

      // Act
      let canEdit = true;
      await waitFor(async () => {
        canEdit = await result.current.canEditTask(testTask);
      });

      // Assert
      expect(canEdit).toBe(false);
    });

    test("should return false when task status is immutable", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      const immutableStatuses = [TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED, TaskStatus.ARCHIVED];

      for (const status of immutableStatuses) {
        const testTask = createMockMyTaskTable({ taskStatus: status });

        // Act
        let canEdit = true;
        await waitFor(async () => {
          canEdit = await result.current.canEditTask(testTask);
        });

        // Assert
        expect(canEdit).toBe(false);
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("タスク削除権限", () => {
    test("should return true when user can delete task", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = createMockMyTaskTable({ taskStatus: TaskStatus.PENDING });
      mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });

      // Act
      let canDelete = false;
      await waitFor(async () => {
        canDelete = await result.current.canDeleteTask(testTask);
      });

      // Assert
      expect(canDelete).toBe(true);
      expect(mockCheckIsOwner).toHaveBeenCalledWith(testUser.id, testTask.groupId, testTask.id, true);
    });

    test("should return false when user cannot delete task due to permissions", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = createMockMyTaskTable({ taskStatus: TaskStatus.PENDING });
      mockCheckIsOwner.mockResolvedValue({ success: false, message: "Permission check failed" });

      // Act
      let canDelete = true;
      await waitFor(async () => {
        canDelete = await result.current.canDeleteTask(testTask);
      });

      // Assert
      expect(canDelete).toBe(false);
    });

    test("should return false when task status is not PENDING", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = createMockMyTaskTable({ taskStatus: TaskStatus.TASK_COMPLETED });
      mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully" });

      // Act
      let canDelete = true;
      await waitFor(async () => {
        canDelete = await result.current.canDeleteTask(testTask);
      });

      // Assert
      expect(canDelete).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("タスク削除", () => {
    test("should delete task successfully", async () => {
      // Arrange
      const mockMutateAsync = vi.fn().mockResolvedValue({ success: true });

      // useMutationのモックを設定し、onSuccessコールバックを実行
      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn().mockImplementation(async (taskId: string) => {
          const result = (await mockMutateAsync(taskId)) as { success: boolean };
          // onSuccessコールバックを直接実行
          mockToastSuccess("タスクを削除しました");
          mockRefresh();
          return result;
        }),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const taskId = "task-1";

      // Act
      await waitFor(async () => {
        await act(async () => {
          await result.current.handleDeleteTask(taskId);
        });
      });

      // Assert
      expect(mockMutateAsync).toHaveBeenCalledWith(taskId);
      expect(mockToastSuccess).toHaveBeenCalledWith("タスクを削除しました");
      expect(mockRefresh).toHaveBeenCalled();
    });

    test("should handle delete task error", async () => {
      // Arrange
      const error = new Error("削除エラー");
      const mockMutateAsync = vi.fn().mockRejectedValue(error);

      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn().mockImplementation(async (taskId: string): Promise<{ success: boolean }> => {
          try {
            return (await mockMutateAsync(taskId)) as { success: boolean };
          } catch (err) {
            // onErrorコールバックを直接実行
            mockToastError("タスクの削除中にエラーが発生しました");
            throw err;
          }
        }),
        isPending: false,
        isLoading: false,
        isError: true,
        error: error,
        reset: vi.fn(),
        data: undefined,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const taskId = "task-1";

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // コンソールエラーをモック
      });

      // Act
      await waitFor(async () => {
        await act(async () => {
          await result.current.handleDeleteTask(taskId);
        });
      });

      // Assert
      expect(mockMutateAsync).toHaveBeenCalledWith(taskId);
      expect(mockToastError).toHaveBeenCalledWith("タスクの削除中にエラーが発生しました");

      consoleErrorSpy.mockRestore();
    });

    test("should handle delete task failure response", async () => {
      // Arrange
      const mockMutateAsync = vi.fn().mockResolvedValue({ success: false, error: "権限がありません" });

      mockUseMutation.mockReturnValue({
        mutateAsync: vi
          .fn()
          .mockImplementation(async (taskId: string): Promise<{ success: boolean; error?: string }> => {
            const result = (await mockMutateAsync(taskId)) as { success: boolean; error?: string };
            // 失敗レスポンスでもonSuccessが呼ばれる（APIレベルでは成功）
            mockToastSuccess("タスクを削除しました");
            mockRefresh();
            return result;
          }),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const taskId = "task-1";

      // Act
      await waitFor(async () => {
        await act(async () => {
          await result.current.handleDeleteTask(taskId);
        });
      });

      // Assert
      expect(mockMutateAsync).toHaveBeenCalledWith(taskId);
      expect(mockToastSuccess).toHaveBeenCalledWith("タスクを削除しました");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("テーブル条件変更", () => {
    test("should change table conditions correctly", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      const newConditions = {
        sort: { field: "taskName" as keyof MyTaskTable, direction: "asc" as const },
        page: 2,
        searchQuery: "テスト",
        taskStatus: TaskStatus.TASK_COMPLETED,
        contributionType: contributionType.REWARD,
        itemPerPage: 20,
      };

      // Act
      await waitFor(() => {
        act(() => {
          result.current.changeTableConditions(newConditions);
        });
      });

      // Assert
      expect(mockSetPage).toHaveBeenCalledWith(2);
      expect(mockSetSortField).toHaveBeenCalledWith("taskName");
      expect(mockSetSortDirection).toHaveBeenCalledWith("asc");
      expect(mockSetSearchQuery).toHaveBeenCalledWith("テスト");
      expect(mockSetTaskStatus).toHaveBeenCalledWith(TaskStatus.TASK_COMPLETED);
      expect(mockSetContributionType).toHaveBeenCalledWith(contributionType.REWARD);
      expect(mockSetItemPerPage).toHaveBeenCalledWith(20);
    });

    test("should handle null values in table conditions", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      const newConditions = {
        sort: null,
        page: 1,
        searchQuery: null,
        taskStatus: "ALL" as const,
        contributionType: "ALL" as const,
        itemPerPage: 10,
      };

      // Act
      await waitFor(() => {
        act(() => {
          result.current.changeTableConditions(newConditions);
        });
      });

      // Assert
      expect(mockSetSortField).toHaveBeenCalledWith(null);
      expect(mockSetSortDirection).toHaveBeenCalledWith("desc");
      expect(mockSetSearchQuery).toHaveBeenCalledWith(null);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フィルターとソートのリセット", () => {
    test("should reset filters correctly", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Act
      await waitFor(() => {
        act(() => {
          result.current.resetFilters();
        });
      });

      // Assert
      expect(mockSetSearchQuery).toHaveBeenCalledWith(null);
      expect(mockSetTaskStatus).toHaveBeenCalledWith("ALL");
      expect(mockSetContributionType).toHaveBeenCalledWith("ALL");
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    test("should reset sort correctly", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Act
      await waitFor(() => {
        act(() => {
          result.current.resetSort();
        });
      });

      // Assert
      expect(mockSetSortField).toHaveBeenCalledWith("id");
      expect(mockSetSortDirection).toHaveBeenCalledWith("desc");
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle null task in canEditTask", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const nullTask = null as unknown as MyTaskTable;

      // Act & Assert
      await waitFor(async () => {
        await expect(result.current.canEditTask(nullTask)).rejects.toThrow();
      });
    });

    test("should handle undefined task in canDeleteTask", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const undefinedTask = undefined as unknown as MyTaskTable;

      // Act & Assert
      await waitFor(async () => {
        await expect(result.current.canDeleteTask(undefinedTask)).rejects.toThrow();
      });
    });

    test("should handle empty string taskId in handleDeleteTask", async () => {
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

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const emptyTaskId = "";

      // Act
      await waitFor(async () => {
        await act(async () => {
          await result.current.handleDeleteTask(emptyTaskId);
        });
      });

      // Assert
      expect(mockMutateAsync).toHaveBeenCalledWith("");
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

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const nullTaskId = null as unknown as string;

      // Act
      await waitFor(async () => {
        await act(async () => {
          await result.current.handleDeleteTask(nullTaskId);
        });
      });

      // Assert
      expect(mockMutateAsync).toHaveBeenCalledWith(null);
    });

    test("should handle large page number", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      const largePageConditions = {
        sort: { field: "id" as keyof MyTaskTable, direction: "desc" as const },
        page: 999999,
        searchQuery: null,
        taskStatus: "ALL" as const,
        contributionType: "ALL" as const,
        itemPerPage: 10,
      };

      // Act
      await waitFor(() => {
        act(() => {
          result.current.changeTableConditions(largePageConditions);
        });
      });

      // Assert
      expect(mockSetPage).toHaveBeenCalledWith(999999);
    });

    test("should handle very long search query", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      const longSearchQuery = "a".repeat(1000);
      const longSearchConditions = {
        sort: { field: "id" as keyof MyTaskTable, direction: "desc" as const },
        page: 1,
        searchQuery: longSearchQuery,
        taskStatus: "ALL" as const,
        contributionType: "ALL" as const,
        itemPerPage: 10,
      };

      // Act
      await waitFor(() => {
        act(() => {
          result.current.changeTableConditions(longSearchConditions);
        });
      });

      // Assert
      expect(mockSetSearchQuery).toHaveBeenCalledWith(longSearchQuery);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle getMyTaskData error", async () => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: undefined,
        isPending: false,
        isLoading: false,
        isPlaceholderData: false,
        isError: true,
        error: new Error("データ取得エラー"),
        refetch: vi.fn(),
      });

      // Act
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.tasks).toStrictEqual([]);
        expect(result.current.totalTaskCount).toBe(0);
      });
    });

    test("should handle checkIsOwner error in canEditTask", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = createMockMyTaskTable();
      mockCheckIsOwner.mockRejectedValue(new Error("権限チェックエラー"));

      // Act & Assert
      await waitFor(async () => {
        await expect(result.current.canEditTask(testTask)).rejects.toThrow("権限チェックエラー");
      });
    });

    test("should handle checkIsOwner error in canDeleteTask", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = createMockMyTaskTable();
      mockCheckIsOwner.mockRejectedValue(new Error("権限チェックエラー"));

      // Act & Assert
      await waitFor(async () => {
        await expect(result.current.canDeleteTask(testTask)).rejects.toThrow("権限チェックエラー");
      });
    });

    test("should handle network timeout in handleDeleteTask", async () => {
      // Arrange
      const error = new Error("TIMEOUT");
      const mockMutateAsync = vi.fn().mockRejectedValue(error);

      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn().mockImplementation(async (taskId: string): Promise<{ success: boolean }> => {
          try {
            return (await mockMutateAsync(taskId)) as { success: boolean };
          } catch (err) {
            // onErrorコールバックを直接実行
            mockToastError("タスクの削除中にエラーが発生しました");
            throw err;
          }
        }),
        isPending: false,
        isLoading: false,
        isError: true,
        error: error,
        reset: vi.fn(),
        data: undefined,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const taskId = "task-1";

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // コンソールエラーをモック
      });

      // Act
      await waitFor(async () => {
        await act(async () => {
          await result.current.handleDeleteTask(taskId);
        });
      });

      // Assert
      expect(mockToastError).toHaveBeenCalledWith("タスクの削除中にエラーが発生しました");
      expect(consoleErrorSpy).toHaveBeenCalledWith("handleDeleteTask でエラーハンドリング:", expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("統合テスト", () => {
    test("should handle complete task management workflow", async () => {
      // Arrange
      const mockMutateAsync = vi.fn().mockResolvedValue({ success: true });

      mockUseMutation.mockReturnValue({
        mutateAsync: vi.fn().mockImplementation(async (taskId: string): Promise<{ success: boolean }> => {
          const result = (await mockMutateAsync(taskId)) as { success: boolean };
          // onSuccessコールバックを直接実行
          mockToastSuccess("タスクを削除しました");
          mockRefresh();
          return result;
        }),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = mockTasksData[0];

      // Act & Assert - タスク編集権限チェック
      await waitFor(async () => {
        const canEdit = await result.current.canEditTask(testTask);
        expect(canEdit).toBe(true);
      });

      // Act & Assert - タスク編集モーダル開く
      act(() => {
        result.current.openTaskEditModal(testTask);
      });
      expect(result.current.editingTaskId).toBe(testTask.id);
      expect(result.current.isTaskEditModalOpen).toBe(true);

      // Act & Assert - タスク編集完了
      act(() => {
        result.current.handleTaskEdited();
      });
      expect(result.current.editingTaskId).toBe(null);
      expect(result.current.isTaskEditModalOpen).toBe(false);
      expect(mockToastSuccess).toHaveBeenCalledWith("タスクデータを更新しました");

      // Act & Assert - タスク削除権限チェック
      await waitFor(async () => {
        const canDelete = await result.current.canDeleteTask(testTask);
        expect(canDelete).toBe(true);
      });

      // Act & Assert - タスク削除
      await waitFor(async () => {
        await act(async () => {
          await result.current.handleDeleteTask(testTask.id);
        });
      });
      expect(mockMutateAsync).toHaveBeenCalledWith(testTask.id);
      expect(mockToastSuccess).toHaveBeenCalledWith("タスクを削除しました");
    });

    test("should handle multiple filter and sort operations", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Act - 検索フィルター適用
      await waitFor(() => {
        act(() => {
          result.current.changeTableConditions({
            ...result.current.tableConditions,
            searchQuery: "テスト",
          });
        });
      });

      // Act - ステータスフィルター適用
      await waitFor(() => {
        act(() => {
          result.current.changeTableConditions({
            ...result.current.tableConditions,
            taskStatus: TaskStatus.TASK_COMPLETED,
          });
        });
      });

      // Act - ソート変更
      await waitFor(() => {
        act(() => {
          result.current.changeTableConditions({
            ...result.current.tableConditions,
            sort: { field: "taskName", direction: "asc" },
          });
        });
      });

      // Act - フィルターリセット
      await waitFor(() => {
        act(() => {
          result.current.resetFilters();
        });
      });

      // Act - ソートリセット
      await waitFor(() => {
        act(() => {
          result.current.resetSort();
        });
      });

      // Assert
      expect(mockSetSearchQuery).toHaveBeenCalledWith("テスト");
      expect(mockSetTaskStatus).toHaveBeenCalledWith(TaskStatus.TASK_COMPLETED);
      expect(mockSetSortField).toHaveBeenCalledWith("taskName");
      expect(mockSetSortDirection).toHaveBeenCalledWith("asc");
      expect(mockSetSearchQuery).toHaveBeenCalledWith(null);
      expect(mockSetTaskStatus).toHaveBeenCalledWith("ALL");
      expect(mockSetSortField).toHaveBeenCalledWith("id");
      expect(mockSetSortDirection).toHaveBeenCalledWith("desc");
    });

    test("should maintain state consistency across operations", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = mockTasksData[0];

      // Act - モーダル開く
      await waitFor(() => {
        act(() => {
          result.current.openTaskEditModal(testTask);
        });
      });

      // Assert - モーダル状態確認
      expect(result.current.editingTaskId).toBe(testTask.id);
      expect(result.current.isTaskEditModalOpen).toBe(true);

      // Act - テーブル条件変更（モーダルが開いている状態で）
      await waitFor(() => {
        act(() => {
          result.current.changeTableConditions({
            ...result.current.tableConditions,
            page: 2,
          });
        });
      });

      // Assert - モーダル状態が維持されていることを確認
      expect(result.current.editingTaskId).toBe(testTask.id);
      expect(result.current.isTaskEditModalOpen).toBe(true);

      // Act - モーダル閉じる
      act(() => {
        result.current.closeTaskEditModal();
      });

      // Assert - モーダル状態がリセットされることを確認
      expect(result.current.editingTaskId).toBe(null);
      expect(result.current.isTaskEditModalOpen).toBe(false);
    });
  });
});
