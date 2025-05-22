"use client";

import type { MyTaskTable, MyTaskTableConditions, SortDirection } from "@/types/group-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { redirect, useRouter } from "next/navigation";
import { checkAppOwner } from "@/lib/actions/group";
import { getMyTaskData } from "@/lib/actions/task/my-task-table";
import { deleteTask as deleteTaskAction } from "@/lib/actions/task/task";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { type contributionType, type TaskStatus } from "@prisma/client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";
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
  router: ReturnType<typeof useRouter>;

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
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  if (!currentUserId) {
    redirect("/auth/signin");
  }

  // nuqsでURLパラメータを管理
  const [page, setPage] = useQueryState("page", { history: "push", defaultValue: 1, parse: Number, serialize: String });
  const [sortField, setSortField] = useQueryState("sort_field", { history: "push", defaultValue: "id" });
  const [sortDirection, setSortDirection] = useQueryState("sort_direction", { history: "push", defaultValue: "desc" });
  const [searchQuery, setSearchQuery] = useQueryState("q", { history: "push" });
  const [taskStatus, setTaskStatus] = useQueryState("task_status", { history: "push", defaultValue: "ALL" });
  const [contributionType, setContributionType] = useQueryState("contribution_type", { history: "push", defaultValue: "ALL" });
  const [itemPerPage, setItemPerPage] = useQueryState("item_per_page", {
    history: "push",
    defaultValue: TABLE_CONSTANTS.ITEMS_PER_PAGE,
    parse: Number,
    serialize: String,
  });

  // tableConditionsをuseMemoで生成
  const tableConditions = useMemo(
    () => ({
      sort: sortField && sortDirection ? { field: sortField as keyof MyTaskTable, direction: sortDirection as SortDirection } : null,
      page,
      searchQuery,
      taskStatus: taskStatus as "ALL" | TaskStatus,
      contributionType: contributionType as "ALL" | contributionType,
      itemPerPage,
    }),
    [page, sortField, sortDirection, searchQuery, taskStatus, contributionType, itemPerPage],
  );

  // changeTableConditionsでset関数を呼ぶ
  const changeTableConditions = useCallback(
    (newTableConditions: MyTaskTableConditions) => {
      void setPage(newTableConditions.page);
      void setSortField(newTableConditions.sort?.field ?? null);
      void setSortDirection(newTableConditions.sort?.direction ?? "desc");
      void setSearchQuery(newTableConditions.searchQuery ?? null);
      void setTaskStatus(newTableConditions.taskStatus ?? "ALL");
      void setContributionType(newTableConditions.contributionType ?? "ALL");
      void setItemPerPage(newTableConditions.itemPerPage ?? 10);
    },
    [setPage, setSortField, setSortDirection, setSearchQuery, setTaskStatus, setContributionType, setItemPerPage],
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isTaskEditModalOpen, setIsTaskEditModalOpen] = useState(false);

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
    setIsTaskEditModalOpen(false);
    setEditingTaskId(null);
  }, [queryClient, router, setIsTaskEditModalOpen, setEditingTaskId]);

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
      sort: { field: "id", direction: "desc" },
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
    router,

    canEditTask,
    handleTaskEdited,
    canDeleteTask,
    handleDeleteTask,
    openTaskEditModal: (task: MyTaskTable) => {
      setEditingTaskId(task.id);
      setIsTaskEditModalOpen(true);
    },
    closeTaskEditModal: () => {
      setIsTaskEditModalOpen(false);
      setEditingTaskId(null);
    },
    changeTableConditions,
    resetFilters,
    resetSort,
  };
}
