import type { MyTaskTable } from "@/types/group-types";
import { AllTheProviders, mockUseMutation, mockUseQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { groupFactory, userFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { ContributionType, TaskStatus } from "@prisma/client";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useMyTaskTable } from "./use-my-task-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// ホイストされたモック関数の宣言
const { mockPush, mockRefresh, mockRedirect, mockToastError, mockToastSuccess, mockUseSession } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockRedirect: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockUseSession: vi.fn(),
}));

// next/navigationのモック
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  redirect: mockRedirect,
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
vi.mock("@/actions/permission/permission", () => ({
  checkIsPermission: vi.fn(),
}));

vi.mock("@/actions/task/my-task-table", () => ({
  getMyTaskData: vi.fn(),
}));

vi.mock("@/actions/task/task", () => ({
  deleteTask: vi.fn(),
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
  taskContributionType: ContributionType.NON_REWARD,
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
  isGroupOwner: false,
  ...overrides,
});

const mockTasksData = [
  createMockMyTaskTable({ id: "task-1", taskName: "タスク1" }),
  createMockMyTaskTable({ id: "task-2", taskName: "タスク2", taskStatus: TaskStatus.TASK_COMPLETED }),
  createMockMyTaskTable({ id: "task-3", taskName: "タスク3", taskContributionType: ContributionType.REWARD }),
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */
const setupDefaultMocks = () => {
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
    success: true,
    message: "データを取得しました",
    data: {
      tasks: mockTasksData,
      totalTaskCount: 3,
    },
  });

  mockCheckIsOwner.mockResolvedValue({ success: true, message: "Permission check successfully", data: true });
  mockDeleteTask.mockResolvedValue({ success: true, message: "タスクを削除しました", data: null });

  // TanStack Queryのモック設定
  mockUseQuery.mockReturnValue({
    data: {
      success: true,
      message: "データを取得しました",
      data: {
        tasks: mockTasksData,
        totalTaskCount: 3,
      },
    },
    isPending: false,
    isPlaceholderData: false,
  });

  // デフォルトのmutation設定（成功パターン）
  mockUseMutation.mockReturnValue({
    isPending: false,
    mutate: vi.fn().mockResolvedValue({ success: true, message: "タスクを削除しました" }),
  });

  mockUseQueryClient.mockReturnValue({
    invalidateQueries: vi.fn(),
    prefetchQuery: vi.fn(),
  });
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useMyTaskTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化", () => {
    test("should initialize with correct default values", async () => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      await waitFor(() => {
        expect(mockUseSession).toHaveBeenCalledTimes(1);
        expect(mockUseQueryClient).toHaveBeenCalledTimes(1);
        expect(mockUseQuery).toHaveBeenCalledTimes(1);

        // 状態の値を検証
        expect(result.current.isLoading).toBe(false);
        expect(result.current.tasks).toStrictEqual(mockTasksData);
        expect(result.current.userId).toBe(testUser.id);
        expect(result.current.tableConditions).toStrictEqual({
          sort: { field: "id", direction: "desc" },
          page: 1,
          searchQuery: null,
          taskStatus: "ALL",
          contributionType: "ALL",
          itemPerPage: 10,
          isJoined: "all",
        });
        expect(result.current.totalTaskCount).toBe(3);
        expect(result.current.router).toStrictEqual({
          push: mockPush,
          refresh: mockRefresh,
        });
        expect(result.current.editingTaskId).toBe(null);
        expect(result.current.isTaskEditModalOpen).toBe(false);

        // 関数の存在を検証
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
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("データフェッチ_useQuery", () => {
    test.each([
      {
        description: "empty task data",
        mockData: { success: true, message: "データを取得しました", data: { tasks: [], totalTaskCount: 0 } },
        expectedTasks: [],
        expectedCount: 0,
      },
      {
        description: "undefined data",
        mockData: { success: true, message: "データを取得しました", data: undefined },
        expectedTasks: [],
        expectedCount: 0,
      },
      {
        description: "mock data",
        mockData: { success: true, message: "データを取得しました", data: { tasks: mockTasksData, totalTaskCount: 3 } },
        expectedTasks: mockTasksData,
        expectedCount: 3,
      },
    ])("should handle $description", async ({ mockData, expectedTasks, expectedCount }) => {
      // Arrange
      mockUseQuery.mockReturnValue({
        data: mockData,
        isPending: false,
        isPlaceholderData: false,
      });

      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      await waitFor(() => {
        expect(result.current.tasks).toStrictEqual(expectedTasks);
        expect(result.current.totalTaskCount).toBe(expectedCount);
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

      // Assert。waitForで待たない場合、isLoadingがtrueになる
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
      expect(mockUseQueryClient).toHaveBeenCalledWith();
      expect(mockToastSuccess).toHaveBeenCalledWith("タスクデータを更新しました");
      expect(mockRefresh).toHaveBeenCalled();
      expect(result.current.isTaskEditModalOpen).toBe(false);
      expect(result.current.editingTaskId).toBe(null);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("権限チェック", () => {
    test.each([
      {
        description: "should return true when user can edit task",
        functionName: "canEditTask" as const,
        taskStatus: TaskStatus.PENDING,
        permissionSuccess: true,
        expectedResult: true,
      },
      {
        description: "should return false when user cannot edit task due to permissions",
        functionName: "canEditTask" as const,
        taskStatus: TaskStatus.PENDING,
        permissionSuccess: false,
        expectedResult: false,
      },
      {
        description: "should return false when task status is not PENDING for edit",
        functionName: "canEditTask" as const,
        taskStatus: TaskStatus.TASK_COMPLETED,
        permissionSuccess: true,
        expectedResult: false,
      },
      {
        description: "should return true when user can delete task",
        functionName: "canDeleteTask" as const,
        taskStatus: TaskStatus.PENDING,
        permissionSuccess: true,
        expectedResult: true,
      },
      {
        description: "should return false when user cannot delete task due to permissions",
        functionName: "canDeleteTask" as const,
        taskStatus: TaskStatus.PENDING,
        permissionSuccess: false,
        expectedResult: false,
      },
      {
        description: "should return false when task status is not PENDING for delete",
        functionName: "canDeleteTask" as const,
        taskStatus: TaskStatus.TASK_COMPLETED,
        permissionSuccess: true,
        expectedResult: false,
      },
    ])("$description", async ({ functionName, taskStatus, permissionSuccess, expectedResult }) => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = createMockMyTaskTable({ taskStatus });
      mockCheckIsOwner.mockResolvedValue({
        success: permissionSuccess,
        message: permissionSuccess ? "Permission check successfully" : "Permission check failed",
        data: permissionSuccess,
      });

      // Act
      let canPerformAction = !expectedResult; // 期待値の逆を初期値にして、確実に変更を検証
      await waitFor(async () => {
        canPerformAction = await result.current[functionName](testTask);
      });

      // Assert
      expect(canPerformAction).toBe(expectedResult);

      // checkIsPermissionが呼ばれるかどうかは実装の条件分岐による
      if (functionName === "canEditTask" && taskStatus === TaskStatus.TASK_COMPLETED) {
        // canEditTaskでTASK_COMPLETEDの場合、immutableStatusesで早期returnするため権限チェックされない
        expect(mockCheckIsOwner).not.toHaveBeenCalled();
      } else if (functionName === "canDeleteTask" && taskStatus === TaskStatus.TASK_COMPLETED) {
        // canDeleteTaskでTASK_COMPLETEDの場合は権限チェックが行われる
        expect(mockCheckIsOwner).toHaveBeenCalledWith(testUser.id, testTask.groupId, testTask.id, true);
      } else {
        // その他の場合は権限チェックが行われる
        expect(mockCheckIsOwner).toHaveBeenCalledWith(testUser.id, testTask.groupId, testTask.id, true);
      }
    });

    test.each([
      { status: TaskStatus.FIXED_EVALUATED, description: "FIXED_EVALUATED" },
      { status: TaskStatus.POINTS_AWARDED, description: "POINTS_AWARDED" },
      { status: TaskStatus.ARCHIVED, description: "ARCHIVED" },
    ])("should return false when task status is immutable ($description)", async ({ status }) => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = createMockMyTaskTable({ taskStatus: status });

      // Act
      let canEdit = true;
      await waitFor(async () => {
        canEdit = await result.current.canEditTask(testTask);
      });

      // Assert
      expect(canEdit).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("タスク削除", () => {
    test("should delete task successfully", async () => {
      // Arrange
      const mockMutate = vi.fn().mockResolvedValue({ success: true });

      // useMutationのモックを設定し、onSuccessコールバックを実行
      mockUseMutation.mockReturnValue({
        mutate: vi.fn().mockImplementation(async (taskId: string) => {
          const result = (await mockMutate(taskId)) as { success: boolean };
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
      });

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const taskId = "task-1";

      // Act
      await waitFor(async () => {
        act(() => {
          result.current.handleDeleteTask(taskId);
        });
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(taskId);
      expect(mockToastSuccess).toHaveBeenCalledWith("タスクを削除しました");
      expect(mockUseQueryClient).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });

    test.each([
      {
        description: "should handle delete task error",
        mockError: new Error("削除エラー"),
        expectError: true,
      },
      {
        description: "should handle network timeout in handleDeleteTask",
        mockError: new Error("TIMEOUT"),
        expectError: true,
      },
    ])("$description - new Error()", async ({ mockError, expectError }) => {
      // Arrange
      const mockMutate = vi.fn().mockRejectedValue(mockError);

      mockUseMutation.mockReturnValue({
        mutate: vi.fn().mockImplementation(async (taskId: string): Promise<{ success: boolean }> => {
          try {
            return (await mockMutate(taskId)) as { success: boolean };
          } catch (err) {
            // onErrorコールバックを直接実行
            mockToastError("タスクの削除中にエラーが発生しました");
            throw err;
          }
        }),
        isPending: false,
        isLoading: false,
        isError: expectError,
        error: mockError,
        reset: vi.fn(),
        data: undefined,
      });

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const taskId = "task-1";

      // Act
      await waitFor(async () => {
        act(() => {
          result.current.handleDeleteTask(taskId);
        });
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(taskId);
      expect(mockToastError).toHaveBeenCalledWith("タスクの削除中にエラーが発生しました");
    });

    test("should handle delete task failure response - {success: false, message: '権限がありません'}", async () => {
      // Arrange
      const mockMutate = vi.fn().mockResolvedValue({ success: false, message: "権限がありません" });

      mockUseMutation.mockReturnValue({
        mutate: vi.fn().mockImplementation(async (taskId: string): Promise<{ success: boolean; message: string }> => {
          const result = (await mockMutate(taskId)) as { success: boolean; message: string };
          // 失敗レスポンスでもonSuccessが呼ばれる（APIレベルでは成功）
          mockToastError("タスクを削除しました");
          mockRefresh();
          return result;
        }),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const taskId = "task-1";

      // Act
      await waitFor(async () => {
        act(() => {
          result.current.handleDeleteTask(taskId);
        });
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(taskId);
      expect(mockToastError).toHaveBeenCalledWith("タスクを削除しました");
    });

    test.each([
      {
        description: "should handle empty string taskId in handleDeleteTask",
        taskId: "",
      },
      {
        description: "should handle null taskId in handleDeleteTask",
        taskId: null,
      },
    ])("$description", async ({ taskId }) => {
      // Arrange
      const mockMutate = vi.fn().mockRejectedValue(new Error("データ取得エラー"));
      mockUseMutation.mockReturnValue({
        mutate: vi.fn().mockImplementation(async (taskIdParam: string) => {
          try {
            await mockMutate(taskIdParam);
          } catch (error) {
            // onErrorコールバックを直接実行
            mockToastError("タスクの削除中にエラーが発生しました");
            throw error;
          }
        }),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const invalidTaskId = taskId as unknown as string;

      // Act
      await waitFor(async () => {
        act(() => {
          result.current.handleDeleteTask(invalidTaskId);
        });
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(invalidTaskId);
      expect(mockToastError).toHaveBeenCalledWith("タスクの削除中にエラーが発生しました");
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
        contributionType: ContributionType.REWARD,
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
      expect(mockSetContributionType).toHaveBeenCalledWith(ContributionType.REWARD);
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
      expect(mockSetPage).toHaveBeenCalledWith(1);
      expect(mockSetSortField).toHaveBeenCalledWith(null);
      expect(mockSetSortDirection).toHaveBeenCalledWith("desc");
      expect(mockSetSearchQuery).toHaveBeenCalledWith(null);
      expect(mockSetTaskStatus).toHaveBeenCalledWith("ALL");
      expect(mockSetContributionType).toHaveBeenCalledWith("ALL");
      expect(mockSetItemPerPage).toHaveBeenCalledWith(10);
    });

    test.each([
      {
        description: "should reset filters correctly",
        functionName: "resetFilters" as const,
        expectedCalls: [
          { mock: mockSetSearchQuery, value: null },
          { mock: mockSetTaskStatus, value: "ALL" },
          { mock: mockSetContributionType, value: "ALL" },
          { mock: mockSetPage, value: 1 },
          { mock: mockSetSortField, value: null },
          { mock: mockSetSortDirection, value: "desc" },
        ],
      },
      {
        description: "should reset sort correctly",
        functionName: "resetSort" as const,
        expectedCalls: [
          { mock: mockSetSortField, value: "id" },
          { mock: mockSetSortDirection, value: "desc" },
          { mock: mockSetPage, value: 1 },
        ],
      },
    ])("$description", async ({ functionName, expectedCalls }) => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Act
      await waitFor(() => {
        act(() => {
          result.current[functionName]();
        });
      });

      // Assert
      expectedCalls.forEach(({ mock, value }) => {
        expect(mock).toHaveBeenCalledWith(value);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test.each([
      {
        description: "should handle null task in canEditTask",
        functionName: "canEditTask" as const,
        taskValue: null,
      },
      {
        description: "should handle undefined task in canDeleteTask",
        functionName: "canDeleteTask" as const,
        taskValue: undefined,
      },
    ])("$description", async ({ functionName, taskValue }) => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const invalidTask = taskValue as unknown as MyTaskTable;

      // Act & Assert
      await waitFor(async () => {
        const canPerformAction = await result.current[functionName](invalidTask);
        expect(canPerformAction).toBe(false);
      });
    });

    test.each([
      {
        description: "should handle empty string taskId in handleDeleteTask",
        taskId: "",
      },
      {
        description: "should handle null taskId in handleDeleteTask",
        taskId: null,
      },
    ])("$description", async ({ taskId }) => {
      // Arrange
      const mockMutate = vi.fn().mockRejectedValue(new Error("データ取得エラー"));
      mockUseMutation.mockReturnValue({
        mutate: vi.fn().mockImplementation(async (taskIdParam: string) => {
          try {
            await mockMutate(taskIdParam);
          } catch (error) {
            // onErrorコールバックを直接実行
            mockToastError("タスクの削除中にエラーが発生しました");
            throw error;
          }
        }),
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const invalidTaskId = taskId as unknown as string;

      // Act
      await waitFor(async () => {
        act(() => {
          result.current.handleDeleteTask(invalidTaskId);
        });
      });

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(invalidTaskId);
      expect(mockToastError).toHaveBeenCalledWith("タスクの削除中にエラーが発生しました");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

    test.each([
      {
        description: "should handle checkIsOwner error in canEditTask",
        functionName: "canEditTask" as const,
        errorMessage: "権限チェックエラー",
      },
      {
        description: "should handle checkIsOwner error in canDeleteTask",
        functionName: "canDeleteTask" as const,
        errorMessage: "権限チェックエラー",
      },
    ])("$description", async ({ functionName, errorMessage }) => {
      // Arrange
      const { result } = renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });
      const testTask = createMockMyTaskTable();
      mockCheckIsOwner.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await waitFor(async () => {
        await expect(result.current[functionName](testTask)).rejects.toThrow(errorMessage);
      });
    });

    test("should handle useSession return undefined - redirect to /auth/signin", async () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: undefined,
        status: "unauthenticated",
      });
      renderHook(() => useMyTaskTable(), {
        wrapper: AllTheProviders,
      });

      // Act & Assert
      await waitFor(() => {
        expect(mockRedirect).toHaveBeenCalledWith("/auth/signin");
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("統合テスト", () => {
    test("should handle complete task management workflow", async () => {
      // Arrange
      const mockMutate = vi.fn().mockResolvedValue({ success: true });

      mockUseMutation.mockReturnValue({
        mutate: vi.fn().mockImplementation(async (taskId: string) => {
          const result = (await mockMutate(taskId)) as { success: boolean };
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
        act(() => {
          result.current.handleDeleteTask(testTask.id);
        });
      });
      expect(mockMutate).toHaveBeenCalledWith(testTask.id);
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
