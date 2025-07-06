"use client";

import type { MyTaskTable, MyTaskTableConditions } from "@/types/group-types";
import type { ContributionType } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { redirect, useRouter } from "next/navigation";
import { checkIsPermission } from "@/actions/permission/permission";
import { getMyTaskData } from "@/actions/task/my-task-table";
import { deleteTask as deleteTaskAction } from "@/actions/task/task";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { TaskStatus } from "@prisma/client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * マイタスク管理のためのカスタムフックの戻り値の型
 */
type UseMyTaskTableReturn = {
  // state
  isLoading: boolean;
  tasks: MyTaskTable[];
  userId: string | null;
  tableConditions: MyTaskTableConditions;
  totalTaskCount: number;
  editingTaskId: string | null;
  isTaskEditModalOpen: boolean;
  router: ReturnType<typeof useRouter>;
  errorMessage: string | undefined;

  // functions
  canEditTask: (task: MyTaskTable) => Promise<boolean>;
  handleTaskEdited: () => void;
  canDeleteTask: (task: MyTaskTable) => Promise<boolean>;
  handleDeleteTask: (taskId: string) => void;
  openTaskEditModal: (task: MyTaskTable) => void;
  closeTaskEditModal: () => void;
  changeTableConditions: (newTableConditions: MyTaskTableConditions) => void;
  resetFilters: () => void;
  resetSort: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクデータの型
 */
type TasksQueryResult = Awaited<ReturnType<typeof getMyTaskData>>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * マイタスク管理のためのカスタムフック
 * @returns タスク管理に必要な状態と関数
 */
export function useMyTaskTable(): UseMyTaskTableReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * nuqsでURLパラメータを管理
   */
  const [page, setPage] = useQueryState("page", { history: "push", defaultValue: 1, parse: Number, serialize: String });
  const [sortField, setSortField] = useQueryState("sort_field", { history: "push", defaultValue: "id" });
  const [sortDirection, setSortDirection] = useQueryState("sort_direction", { history: "push", defaultValue: "desc" });
  const [searchQuery, setSearchQuery] = useQueryState("q", { history: "push" });
  const [taskStatus, setTaskStatus] = useQueryState("task_status", { history: "push", defaultValue: "ALL" });
  const [contributionType, setContributionType] = useQueryState("contribution_type", {
    history: "push",
    defaultValue: "ALL",
  });
  const [itemPerPage, setItemPerPage] = useQueryState("item_per_page", {
    history: "push",
    defaultValue: TABLE_CONSTANTS.ITEMS_PER_PAGE,
    parse: Number,
    serialize: String,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * tableConditionsをuseMemoで生成
   */
  const tableConditions = useMemo(
    () => ({
      sort: sortField && sortDirection ? { field: sortField as keyof MyTaskTable, direction: sortDirection } : null,
      page,
      searchQuery,
      taskStatus: taskStatus as "ALL" | TaskStatus,
      contributionType: contributionType as "ALL" | ContributionType,
      itemPerPage,
    }),
    [page, sortField, sortDirection, searchQuery, taskStatus, contributionType, itemPerPage],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * changeTableConditionsでset関数を呼ぶ
   */
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データフェッチ
   */
  const {
    data: tasksResult,
    isPending: isLoadingTasks,
    isPlaceholderData,
    error,
  } = useQuery({
    queryKey: queryCacheKeys.table.myTaskConditions(tableConditions, currentUserId),
    queryFn: async () => await getMyTaskData(tableConditions, currentUserId),
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
        void queryClient.prefetchQuery<
          TasksQueryResult,
          Error,
          TasksQueryResult,
          ReturnType<typeof queryCacheKeys.table.myTaskConditions>
        >({
          queryKey: queryCacheKeys.table.myTaskConditions({ ...tableConditions, page: nextPage }, currentUserId),
          queryFn: async () => await getMyTaskData({ ...tableConditions, page: nextPage }, currentUserId),
        });
      }
    }
  }, [tasksResult, tableConditions, isPlaceholderData, queryClient, currentUserId]);

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
    async (task: MyTaskTable): Promise<boolean> => {
      const status = task.taskStatus;
      const immutableStatuses = [TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED, TaskStatus.ARCHIVED];
      if (immutableStatuses.includes(status as (typeof immutableStatuses)[number])) return false;

      if (task.isGroupOwner) return true;

      const isOwner = await checkIsPermission(currentUserId, task.groupId, task.id, true);

      return !currentUserId || isOwner.success;
    },
    [currentUserId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク削除
   */
  const { mutate: deleteTaskMutate, isPending: isDeletingTask } = useMutation({
    mutationFn: (taskId: string) => deleteTaskAction(taskId, currentUserId),
    onSuccess: async () => {
      router.refresh();
    },
    meta: {
      invalidateCacheKeys: [{ queryKey: queryCacheKeys.table.myTask(), exact: false }],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク削除
   */
  const canDeleteTask = useCallback(
    async (task: MyTaskTable): Promise<boolean> => {
      if (task.isGroupOwner && task.taskStatus === TaskStatus.PENDING) return true;

      const isOwner = await checkIsPermission(currentUserId, task.groupId, task.id, true);
      return isOwner.success && task.taskStatus === TaskStatus.PENDING;
    },
    [currentUserId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク編集
   */
  const handleTaskEdited = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryCacheKeys.table.myTask(), exact: false });
    toast.success("タスクデータを更新しました");
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
   * 戻り値
   */
  return {
    // state
    isLoading: isLoadingTasks || isDeletingTask || isPlaceholderData,
    tasks: tasksResult?.tasks ?? [],
    userId: currentUserId ?? null,
    tableConditions,
    totalTaskCount: tasksResult?.totalTaskCount ?? 0,
    editingTaskId,
    isTaskEditModalOpen,
    router,
    errorMessage: error?.message,

    // functions
    canEditTask,
    handleTaskEdited,
    canDeleteTask,
    handleDeleteTask: deleteTaskMutate,
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
