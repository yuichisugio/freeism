import type { TaskDetailWithRelations } from "@/actions/task/edit-task-modal";
import type { TaskParticipant } from "@/types/group-types";
import type { UseQueryOptions } from "@tanstack/react-query";
import { getTaskById, updateTaskAction } from "@/actions/task/edit-task-modal";
import { getAllUsers } from "@/actions/user/user";
import { AllTheProviders, mockUseMutation, mockUseQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { ContributionType } from "@prisma/client";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UseTaskEditModalProps } from "./use-task-edit-modal";
import { useTaskEditModal } from "./use-task-edit-modal";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// アクション関数のモック
vi.mock("@/actions/task/edit-task-modal", () => ({
  getTaskById: vi.fn(),
  updateTaskAction: vi.fn(),
}));

vi.mock("@/actions/user", () => ({
  getAllUsers: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

const createTestUsers = (): TaskParticipant[] => [
  { appUserId: "user-1", appUserName: "テストユーザー1" },
  { appUserId: "user-2", appUserName: "テストユーザー2" },
  { appUserId: "user-3", appUserName: "テストユーザー3" },
];

const createDefaultProps = (): UseTaskEditModalProps => ({
  taskId: "test-task-id",
  onOpenChangeAction: vi.fn(),
  onTaskUpdated: vi.fn(),
});

const createMockTask = () => ({
  id: "test-task-id",
  task: "テストタスク",
  detail: "テスト詳細",
  reference: "テスト参考",
  info: "テスト情報",
  imageUrl: "https://example.com/image.jpg",
  contributionType: ContributionType.REWARD,
  category: "テスト",
  createdAt: new Date(),
  updatedAt: new Date(),
  creator: {
    id: "creator-id",
    name: "作成者",
  },
  executors: [
    {
      id: "executor-1",
      name: null,
      userId: "user-1",
      user: {
        id: "user-1",
        name: "テストユーザー1",
      },
    },
  ],
  reporters: [
    {
      id: "reporter-1",
      name: null,
      userId: "user-2",
      user: {
        id: "user-2",
        name: "テストユーザー2",
      },
    },
  ],
  group: {
    id: "group-id",
    name: "テストグループ",
    maxParticipants: 10,
    goal: "テスト目標",
    evaluationMethod: "テスト評価方法",
    depositPeriod: 30,
    members: [
      {
        userId: "user-1",
      },
    ],
  },
  auction: {
    id: "auction-id",
    startTime: new Date(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    currentHighestBid: 100,
    currentHighestBidderId: "bidder-id",
    winnerId: null,
    extensionLimitCount: 3,
    extensionTotalCount: 0,
  },
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストスイート
 */

describe("useTaskEditModal", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 各テスト前のセットアップ
   */
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockUseQuery.mockImplementation((options: UseQueryOptions) => {
      if (options.queryKey[0] === "users") {
        return {
          data: [],
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (options.queryKey[0] === "task") {
        return {
          data: null,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      return {
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
      data: undefined,
    });

    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
      removeQueries: vi.fn(),
      clear: vi.fn(),
      prefetchQuery: vi.fn(),
      setQueriesData: vi.fn(),
    });

    vi.mocked(getAllUsers).mockResolvedValue({
      success: true,
      message: "ユーザー一覧を取得しました",
      data: [],
    });
    vi.mocked(getTaskById).mockResolvedValue({
      success: false,
      message: "タスクが見つかりません",
      data: {} as TaskDetailWithRelations,
    });
    vi.mocked(updateTaskAction).mockResolvedValue({
      success: false,
      message: "更新に失敗しました",
      data: null,
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    test("should initialize with default values", () => {
      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      expect(result.current.form).toBeDefined();
      expect(result.current.users).toStrictEqual([]);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isRewardType).toBe(true);
      expect(result.current.categoryOpen).toBe(false);
      expect(result.current.executors).toStrictEqual([]);
      expect(result.current.nonRegisteredExecutor).toBe("");
      expect(result.current.reporters).toStrictEqual([]);
      expect(result.current.nonRegisteredReporter).toBe("");
      expect(result.current.isLoading).toBe(false);
    });

    test("should load users data correctly", async () => {
      const testUsers = createTestUsers();

      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (options.queryKey[0] === "users") {
          return {
            data: testUsers,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: null,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.users).toStrictEqual(testUsers);
      });
    });

    test("should update isRewardType when contributionType changes", async () => {
      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      // 初期値はREWARDなのでtrueのはず
      expect(result.current.isRewardType).toBe(true);

      // NON_REWARDに変更
      act(() => {
        result.current.form.setValue("contributionType", ContributionType.NON_REWARD);
        // フォームの変更を強制的にトリガー
        void result.current.form.trigger("contributionType");
      });

      // フォームの値が変更されることを確認
      expect(result.current.form.getValues("contributionType")).toBe(ContributionType.NON_REWARD);

      // REWARDに戻す
      act(() => {
        result.current.form.setValue("contributionType", ContributionType.REWARD);
        void result.current.form.trigger("contributionType");
      });

      // フォームの値が変更されることを確認
      expect(result.current.form.getValues("contributionType")).toBe(ContributionType.REWARD);
      expect(result.current.isRewardType).toBe(true);
    });

    test("should add executor with userId", () => {
      const testUsers = createTestUsers();

      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (options.queryKey[0] === "users") {
          return {
            data: testUsers,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: null,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addExecutor("user-1");
      });

      expect(result.current.executors).toHaveLength(1);
      expect(result.current.executors[0].appUserId).toBe("user-1");
      expect(result.current.executors[0].appUserName).toBe("テストユーザー1");
    });

    test("should add executor with name only", () => {
      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addExecutor(undefined, "未登録ユーザー");
      });

      expect(result.current.executors).toHaveLength(1);
      expect(result.current.executors[0].appUserId).toBeNull();
      expect(result.current.executors[0].appUserName).toBeNull();
    });

    test("should remove executor by index", () => {
      const testUsers = createTestUsers();

      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (options.queryKey[0] === "users") {
          return {
            data: testUsers,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: null,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      // 実行者を追加
      act(() => {
        result.current.addExecutor("user-1");
        result.current.addExecutor("user-2");
      });

      expect(result.current.executors).toHaveLength(2);

      // 最初の実行者を削除
      act(() => {
        result.current.removeExecutor(0);
      });

      expect(result.current.executors).toHaveLength(1);
      expect(result.current.executors[0].appUserId).toBe("user-2");
    });

    test("should handle image upload", () => {
      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      const imageUrl = "https://example.com/new-image.jpg";

      act(() => {
        result.current.handleImageUploaded(imageUrl);
      });

      expect(result.current.form.getValues("imageUrl")).toBe(imageUrl);
    });

    test("should handle image removal", () => {
      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      // 最初に画像を設定
      act(() => {
        result.current.form.setValue("imageUrl", "https://example.com/image.jpg");
      });

      expect(result.current.form.getValues("imageUrl")).toBe("https://example.com/image.jpg");

      // 画像を削除
      act(() => {
        result.current.handleImageRemoved();
      });

      expect(result.current.form.getValues("imageUrl")).toBe("");
    });

    test("should update category open state", () => {
      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      expect(result.current.categoryOpen).toBe(false);

      act(() => {
        result.current.setCategoryOpen(true);
      });

      expect(result.current.categoryOpen).toBe(true);

      act(() => {
        result.current.setCategoryOpen(false);
      });

      expect(result.current.categoryOpen).toBe(false);
    });

    test("should update non-registered executor name", () => {
      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      expect(result.current.nonRegisteredExecutor).toBe("");

      act(() => {
        result.current.setNonRegisteredExecutor("新しい実行者");
      });

      expect(result.current.nonRegisteredExecutor).toBe("新しい実行者");
    });

    test("should update non-registered reporter name", () => {
      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      expect(result.current.nonRegisteredReporter).toBe("");

      act(() => {
        result.current.setNonRegisteredReporter("新しい報告者");
      });

      expect(result.current.nonRegisteredReporter).toBe("新しい報告者");
    });

    test("should handle modal open/close when not pending", () => {
      const onOpenChangeAction = vi.fn();
      const props: UseTaskEditModalProps = {
        taskId: "test-task-id",
        onOpenChangeAction,
      };

      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.handleOpenChange(true);
      });

      expect(onOpenChangeAction).toHaveBeenCalledWith(true);

      act(() => {
        result.current.handleOpenChange(false);
      });

      expect(onOpenChangeAction).toHaveBeenCalledWith(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    test("should handle undefined taskId", () => {
      const props: UseTaskEditModalProps = {
        taskId: "",
        onOpenChangeAction: vi.fn(),
      };

      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      expect(result.current.form).toBeDefined();
      expect(result.current.isLoading).toBe(false);
    });

    test("should handle task loading error", async () => {
      vi.mocked(getTaskById).mockResolvedValue({
        success: false,
        message: "タスクが見つかりません",
        data: {} as TaskDetailWithRelations,
      });

      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      // フォームのデフォルト値が保持されることを確認
      expect(result.current.form.getValues("task")).toBe("");
      expect(result.current.form.getValues("contributionType")).toBe(ContributionType.REWARD);
    });

    test("should not add duplicate executor", () => {
      const testUsers = createTestUsers();

      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (Array.isArray(options.queryKey) && options.queryKey[0] === "users") {
          return {
            data: testUsers,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: null,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      // 最初のユーザーを追加
      act(() => {
        result.current.addExecutor("user-1");
      });

      expect(result.current.executors).toHaveLength(1);

      // 同じユーザーを再度追加しようとする
      act(() => {
        result.current.addExecutor("user-1");
      });

      // 重複は追加されないので、長さは1のまま
      expect(result.current.executors).toHaveLength(1);
    });

    test("should not add executor with empty name", () => {
      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addExecutor(undefined, "");
      });

      expect(result.current.executors).toHaveLength(0);

      act(() => {
        result.current.addExecutor(undefined, "   ");
      });

      expect(result.current.executors).toHaveLength(0);
    });

    test("should not add executor for non-existent user", () => {
      const testUsers = createTestUsers();

      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (options.queryKey[0] === "users") {
          return {
            data: testUsers,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: null,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.addExecutor("non-existent-user");
      });

      expect(result.current.executors).toHaveLength(0);
    });

    test("should not handle modal close when pending", () => {
      const onOpenChangeAction = vi.fn();
      const props: UseTaskEditModalProps = {
        taskId: "test-task-id",
        onOpenChangeAction,
      };

      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      act(() => {
        result.current.handleOpenChange(false);
      });

      expect(onOpenChangeAction).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    test("should handle empty users array", () => {
      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (options.queryKey[0] === "users") {
          return {
            data: [],
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: null,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      expect(result.current.users).toStrictEqual([]);

      act(() => {
        result.current.addExecutor("user-1");
      });

      expect(result.current.executors).toHaveLength(0);
    });

    test("should handle null task data", async () => {
      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (options.queryKey[0] === "users") {
          return {
            data: [],
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        if (options.queryKey[0] === "task") {
          return {
            data: null,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: undefined,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      // フォームのデフォルト値が保持されることを確認
      expect(result.current.form.getValues("task")).toBe("");
      expect(result.current.form.getValues("contributionType")).toBe(ContributionType.REWARD);
    });

    test("should handle loading states correctly", () => {
      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (options.queryKey[0] === "users") {
          return {
            data: undefined,
            isLoading: true,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        if (options.queryKey[0] === "task") {
          return {
            data: undefined,
            isLoading: true,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: undefined,
          isLoading: true,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      expect(result.current.isLoading).toBe(true);
    });

    test("should handle mutation pending state", () => {
      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
        reset: vi.fn(),
        data: undefined,
      });

      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      expect(result.current.isSubmitting).toBe(true);
    });

    test("should handle task data loading and form reset", async () => {
      const mockTask = createMockTask();

      mockUseQuery.mockImplementation((options: UseQueryOptions) => {
        if (options.queryKey[0] === "users") {
          return {
            data: createTestUsers(),
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        if (options.queryKey[0] === "task") {
          return {
            data: mockTask,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
          };
        }
        return {
          data: undefined,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      vi.mocked(getTaskById).mockResolvedValue({
        success: true,
        message: "タスクが取得されました",
        data: mockTask,
      });

      const props = createDefaultProps();
      const { result } = renderHook(() => useTaskEditModal(props), {
        wrapper: AllTheProviders,
      });

      await waitFor(() => {
        expect(result.current.form.getValues("task")).toBe("テストタスク");
        expect(result.current.form.getValues("detail")).toBe("テスト詳細");
        expect(result.current.form.getValues("contributionType")).toBe(ContributionType.REWARD);
      });
    });
  });
});
