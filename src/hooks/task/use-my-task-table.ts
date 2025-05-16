"use client";

import type { MyTaskTable, MyTaskTableConditions, SortDirection } from "@/types/group-types";
import { useCallback, useEffect, useState } from "react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { checkAppOwner } from "@/lib/actions/group";
import { getMyTaskData } from "@/lib/actions/task/my-task-table";
import { deleteTask as deleteTaskAction } from "@/lib/actions/task/task";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { type contributionType, type TaskStatus } from "@prisma/client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * マイタスク管理のためのカスタムフックの戻り値の型
 */
type UseMyTaskTableReturn = {
  // state
  isLoading: boolean;
  tasks: MyTaskTable[];
  userId: string | null;
  isAppOwner: boolean;
  tableConditions: MyTaskTableConditions;
  totalTaskCount: number;
  editingTaskId: string | null;
  isTaskEditModalOpen: boolean;

  // functions
  canEditTask: (task: MyTaskTable) => boolean;
  handleTaskEdited: () => void;
  canDeleteTask: (task: MyTaskTable) => boolean;
  handleDeleteTask: (taskId: string) => Promise<void>;
  openTaskEditModal: (task: MyTaskTable) => void;
  closeTaskEditModal: () => void;
  changeTableConditions: (newTableConditions: MyTaskTableConditions) => void;
  resetFilters: () => void;
  resetSort: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * マイタスク管理のためのカスタムフック
 * @returns タスク管理に必要な状態と関数
 */
export function useMyTaskTable(): UseMyTaskTableReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 使用するデータの初期化
   */
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  if (!currentUserId) {
    redirect("/auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isTaskEditModalOpen, setIsTaskEditModalOpen] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブル条件の取得と更新
   */
  const getTableConditionsFromParams = useCallback((): MyTaskTableConditions => {
    const currentPage = Number(searchParams.get("page") ?? 1);
    const currentSortField = searchParams.get("sort_field") as keyof MyTaskTable | null;
    const currentSortDirection = searchParams.get("sort_direction") as SortDirection | null;
    const currentQuery = searchParams.get("q");
    const currentTaskStatus = (searchParams.get("task_status") ?? "ALL") as "ALL" | TaskStatus;
    const currentContributionType = (searchParams.get("contribution_type") ?? "ALL") as "ALL" | contributionType;
    const currentItemPerPage = Number(searchParams.get("item_per_page") ?? TABLE_CONSTANTS.ITEMS_PER_PAGE);

    return {
      sort: currentSortField && currentSortDirection ? { field: currentSortField, direction: currentSortDirection } : null,
      page: currentPage,
      searchQuery: currentQuery,
      taskStatus: currentTaskStatus,
      contributionType: currentContributionType,
      itemPerPage: currentItemPerPage,
    };
  }, [searchParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  /**
   * 条件を保持
   */
  const [tableConditions, setTableConditions] = useState<MyTaskTableConditions>(getTableConditionsFromParams());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページから戻った場合に、条件を更新
   */
  useEffect(() => {
    setTableConditions(getTableConditionsFromParams());
  }, [searchParams, getTableConditionsFromParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 条件をURLに反映
   */
  const updateUrlParams = useCallback((newTableConditions: MyTaskTableConditions) => {
    // パラメータを更新
    const params = new URLSearchParams();
    // ページ数
    if (newTableConditions.page > 1) params.set("page", String(newTableConditions.page));
    // ソート
    if (newTableConditions.sort?.field && newTableConditions.sort?.field !== "id") params.set("sort_field", newTableConditions.sort.field as string);
    // ソート方向
    if (newTableConditions.sort?.direction && newTableConditions.sort?.direction !== "desc")
      params.set("sort_direction", newTableConditions.sort.direction);
    // 検索
    if (newTableConditions.searchQuery) params.set("q", newTableConditions.searchQuery);
    // タスクステータス
    if (newTableConditions.taskStatus && newTableConditions.taskStatus !== "ALL") params.set("task_status", newTableConditions.taskStatus);
    // 貢献タイプ
    if (newTableConditions.contributionType && newTableConditions.contributionType !== "ALL")
      params.set("contribution_type", newTableConditions.contributionType);
    // ページあたりの表示件数
    if (newTableConditions.itemPerPage && newTableConditions.itemPerPage !== TABLE_CONSTANTS.ITEMS_PER_PAGE)
      params.set("item_per_page", String(newTableConditions.itemPerPage));

    // URLを更新
    const newUrl = `/dashboard/my-task${params.toString() ? `?${params.toString()}` : ""}`; // パスは適宜修正
    window.history.pushState({}, "", newUrl);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 条件を更新
   */
  const changeTableConditions = useCallback(
    (newTableConditions: MyTaskTableConditions) => {
      // 条件変更時は、1pageに戻す
      if (
        tableConditions.sort?.field !== newTableConditions.sort?.field ||
        tableConditions.sort?.direction !== newTableConditions.sort?.direction ||
        tableConditions.searchQuery !== newTableConditions.searchQuery ||
        tableConditions.taskStatus !== newTableConditions.taskStatus ||
        tableConditions.contributionType !== newTableConditions.contributionType ||
        tableConditions.itemPerPage !== newTableConditions.itemPerPage
      ) {
        newTableConditions.page = 1;
      }
      updateUrlParams(newTableConditions);
      setTableConditions(newTableConditions);
    },
    [updateUrlParams, tableConditions],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データフェッチ
   */
  type TasksQueryResult = Awaited<ReturnType<typeof getMyTaskData>>;

  const {
    data: tasksResult,
    isPending: isLoadingTasks,
    isPlaceholderData,
  } = useQuery({
    queryKey: queryCacheKeys.table.myTaskConditions(tableConditions),
    queryFn: async () => await getMyTaskData(tableConditions),
    enabled: !!currentUserId, // ユーザーIDが取得できてからフェッチ
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データのプリフェッチ
   */
  useEffect(() => {
    if (!isPlaceholderData && tasksResult?.tasks.length) {
      const currentPage = tableConditions.page;
      const totalPages = Math.ceil((tasksResult?.totalTaskCount ?? 0) / tableConditions.itemPerPage);
      if (currentPage < totalPages) {
        const nextPage = currentPage + 1;
        void queryClient.prefetchQuery<TasksQueryResult, Error, TasksQueryResult, ReturnType<typeof queryCacheKeys.table.myTaskConditions>>({
          queryKey: queryCacheKeys.table.myTaskConditions({ ...tableConditions, page: nextPage }),
          queryFn: async () => await getMyTaskData({ ...tableConditions, page: nextPage }),
        });
      }
    }
  }, [tasksResult, tableConditions, isPlaceholderData, queryClient]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限を取得
   */
  const { data: isAppOwner, isPending: isLoadingIsAppOwner } = useQuery({
    queryKey: queryCacheKeys.permission.appOwner(currentUserId),
    queryFn: () => checkAppOwner(currentUserId),
    enabled: !!currentUserId,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集モーダル開閉
   */
  const closeTaskEditModal = useCallback(() => {
    setIsTaskEditModalOpen(false);
    setEditingTaskId(null);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集モーダル開閉
   */
  const openTaskEditModal = useCallback((task: MyTaskTable) => {
    setEditingTaskId(task.id); // task.taskId から task.id に修正
    setIsTaskEditModalOpen(true);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集・削除ロジック
   */
  const canEditTask = useCallback(
    (task: MyTaskTable): boolean => {
      const status = task.taskStatus;
      const immutableStatuses = ["FIXED_EVALUATED", "POINTS_AWARDED", "ARCHIVED"];
      if (immutableStatuses.includes(status as string)) return false; // taskStatusがenumなのでstringにキャスト
      if (!currentUserId) return false;

      const isReporter = task.taskReporterUserIds?.includes(currentUserId) ?? false;
      const isExecutor = task.taskExecutorUserIds?.includes(currentUserId) ?? false;

      return isAppOwner ?? isReporter ?? isExecutor;
    },
    [currentUserId, isAppOwner],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク削除
   */
  const { mutateAsync: deleteTaskMutateAsync, isPending: isDeletingTask } = useMutation({
    mutationFn: deleteTaskAction,
    onSuccess: async () => {
      toast.success("タスクを削除しました");
      await queryClient.invalidateQueries({ queryKey: queryCacheKeys.table.myTask(), exact: false });
      router.refresh();
    },
    onError: (error) => {
      console.error("タスク削除エラー:", error);
      toast.error("タスクの削除中にエラーが発生しました");
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク削除
   */
  const handleDeleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      try {
        await deleteTaskMutateAsync(taskId);
      } catch (error) {
        console.error("handleDeleteTask でエラーハンドリング:", error);
      }
    },
    [deleteTaskMutateAsync],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク削除
   */
  const canDeleteTask = useCallback(
    (task: MyTaskTable): boolean => {
      if (!currentUserId) return false;
      const isReporter = task.taskReporterUserIds?.includes(currentUserId) ?? false;
      const isExecutor = task.taskExecutorUserIds?.includes(currentUserId) ?? false;
      // 報酬タスクの場合はオークションの状態も考慮する必要があるが、ここでは簡略化
      return (isAppOwner ?? isReporter ?? isExecutor) && task.taskStatus === "PENDING";
    },
    [currentUserId, isAppOwner],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集
   */
  const handleTaskEdited = useCallback(() => {
    toast.success("タスクデータを更新しました");
    void queryClient.invalidateQueries({ queryKey: queryCacheKeys.table.myTask(), exact: false });
    router.refresh();
    closeTaskEditModal();
  }, [queryClient, router, closeTaskEditModal]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターとソートのリセット
   */
  const resetFilters = useCallback(() => {
    changeTableConditions({
      ...tableConditions,
      searchQuery: null,
      taskStatus: "ALL",
      contributionType: "ALL",
      page: 1,
    });
  }, [changeTableConditions, tableConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターとソートのリセット
   */
  const resetSort = useCallback(() => {
    changeTableConditions({
      ...tableConditions,
      sort: { field: "id", direction: "desc" }, // "taskId" から "id" に修正
      page: 1,
    });
  }, [changeTableConditions, tableConditions]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 認証リダイレクト
   */
  if (!currentUserId && typeof window !== "undefined") {
    redirect("/auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    isLoading: isLoadingTasks || isDeletingTask || isPlaceholderData || isLoadingIsAppOwner,
    tasks: tasksResult?.tasks ?? [],
    userId: currentUserId ?? null,
    isAppOwner: isAppOwner ?? false,
    tableConditions,
    totalTaskCount: tasksResult?.totalTaskCount ?? 0,
    editingTaskId,
    isTaskEditModalOpen,
    canEditTask,
    handleTaskEdited,
    canDeleteTask,
    handleDeleteTask,
    openTaskEditModal,
    closeTaskEditModal,
    changeTableConditions,
    resetFilters,
    resetSort,
  };
}
